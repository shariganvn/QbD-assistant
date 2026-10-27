"""The `serve` command: a local web page around `run`. It adds no pipeline logic of its own.

Every run goes through `run.run`, the same function the command line uses, so a draft made here
is byte-for-byte the draft the command line would make. People sign in with a local account. The
head of R&D can record the A13 signature; the record is a note of who signed which bytes and never
changes the draft or unlocks a step.
"""

from __future__ import annotations

import argparse
import contextlib
import csv
import hashlib
import hmac
import io
import json
import re
import secrets
import sys
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime
from html import escape
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit

from qbd_core import run
from qbd_core.modules.accounts.api import AccountError, User, UserStore, clean_name
from qbd_core.modules.dossier_drafting.api import (
    IntakeRejected,
    agent_status_rows,
    dosage_forms,
    intake_digest,
    propose_cqa,
    validate_intake,
)
from qbd_core.modules.provider_access.api import HTTP_PROVIDERS, load_config
from qbd_core.modules.rendering.api import DEFAULT_NAME
from qbd_core.publish import PublishFailed, publish_all
from qbd_core.users import EXIT_ACCOUNTS

EXIT_SERVE = 16

MAX_BODY = 64 * 1024
SESSION_SECONDS = 8 * 3600
LOCK_AFTER, LOCK_SECONDS = 5, 60
MAX_LOGINS, MAX_FAILURES, MAX_KEY = 4, 1000, 64
COOKIE = "qbd_session"
RUN_ID = re.compile(r"^\d{8}T\d{6}(-\d{1,3})?$")
A13_FILE = re.compile(r"^a13-record-(\d+)\.json$")
MARKETS = (("eu", "EU"), ("domestic", "Trong nước"), ("both", "Cả hai"))
ROLE_TEXT = {"researcher": "Nghiên cứu viên", "head": "Trưởng bộ phận R&D"}
LABEL = "Bản định hướng nội bộ, chưa FD duyệt. Trưởng bộ phận R&D duyệt cuối (A13) ngoài hệ thống."
CSV_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")

EXIT_TEXT = {
    0: "Đã dựng bản định hướng.",
    run.EXIT_INTAKE: "Đầu vào bị từ chối.",
    run.EXIT_REFUSED: "Tổ hợp hoặc phạm vi nằm ngoài SOP, không dựng.",
    run.EXIT_DOCUMENTS: "Không đọc được bộ tài liệu của Kho.",
    run.EXIT_CQA: "CQA chưa được xác nhận hợp lệ.",
    run.EXIT_RENDER: "Không dựng được trang HTML.",
    run.EXIT_BLOCKED: "Cổng chất lượng chặn bản nháp, không công bố.",
    run.EXIT_PUBLISH: "Không ghi được file.",
    run.EXIT_PROVIDER: "Nhà cung cấp mô hình không dùng được.",
    run.EXIT_TRIAL: "Không đọc được báo cáo thử nghiệm.",
}

CSS = """
:root{--ink:#1f2937;--muted:#6b7280;--line:#d1d5db;--bg:#f9fafb;--card:#fff;--primary:#2563eb;
--warn:#b45309;--danger:#b91c1c;--ok:#15803d}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,system-ui,sans-serif}
header{background:var(--card);border-bottom:1px solid var(--line);padding:12px 24px;display:flex;
gap:24px;align-items:center}
header a{color:var(--ink);text-decoration:none}header .brand{font-weight:700}
header form{margin-left:auto;display:flex;gap:8px;align-items:center}
header form button{margin:0;background:var(--card);color:var(--ink);border:1px solid var(--line)}
.chip{background:#fef3c7;color:var(--warn);border-radius:999px;padding:2px 10px;font-size:12px}
main{max-width:960px;margin:24px auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 20px;
margin-bottom:16px}
h1{font-size:22px;margin:0 0 12px}h2{font-size:16px;margin:0 0 8px}
label{display:block;margin:8px 0 2px;font-weight:600}
input[type=text],input[type=date],input[type=password],select,textarea{width:100%;padding:6px 8px;
border:1px solid var(--line);border-radius:6px;font:inherit}
button{background:var(--primary);color:#fff;border:0;border-radius:6px;padding:8px 16px;
font:inherit;cursor:pointer;margin-top:12px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);padding:6px 8px;
text-align:left;vertical-align:top}
.err{color:var(--danger)}.ok{color:var(--ok)}.muted{color:var(--muted)}
pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.check{font-weight:400;display:flex;gap:8px;align-items:center;margin:4px 0}
.filters a{margin-right:12px}
"""


@dataclass(frozen=True)
class Session:
    name: str
    role: str
    expires: float


def _page(title: str, body: str, me: Session | None = None, token: str = "") -> bytes:
    who = ""
    if me is not None:
        who = (
            f'<form method="post" action="/logout">{_hidden(token)}'
            f"<span>{escape(me.name)} ({escape(ROLE_TEXT[me.role])})</span>"
            '<button type="submit">Đăng xuất</button></form>'
        )
    nav = (
        '<header><a class="brand" href="/">QbD P.2</a><a href="/">Đề tài mới</a>'
        '<a href="/runs">Đề tài đã chạy</a><a href="/system">Hệ thống</a>'
        f'<span class="chip">chưa FD duyệt</span>{who}</header>'
        if me is not None
        else (
            '<header><span class="brand">QbD P.2</span>'
            '<span class="chip">chưa FD duyệt</span></header>'
        )
    )
    text = (
        '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{escape(title)}</title><style>{CSS}</style></head><body>{nav}"
        f'<main>{body}<p class="muted">{escape(LABEL)}</p></main></body></html>'
    )
    return text.encode("utf-8")


def _hidden(token: str, **fields: str) -> str:
    items = {"token": token, **fields}
    return "".join(
        f'<input type="hidden" name="{escape(k)}" value="{escape(v, quote=True)}">'
        for k, v in items.items()
    )


class Context:
    """What one server instance is configured with."""

    def __init__(self, args: argparse.Namespace, port: int, store: UserStore) -> None:
        self.args = args
        self.port = port
        self.store = store
        self.workdir = Path(args.workdir)
        self.token = secrets.token_hex(16)
        self.lock = threading.Lock()
        self.run_lock = threading.Lock()
        self.sign_lock = threading.Lock()
        self.logins = threading.BoundedSemaphore(MAX_LOGINS)
        self.sessions: dict[str, Session] = {}
        self.failures: dict[str, tuple[int, float]] = {}
        self.session_seconds = SESSION_SECONDS

    @property
    def hosts(self) -> set[str]:
        return {f"127.0.0.1:{self.port}", f"localhost:{self.port}"}

    def _key(self, name: str) -> str:
        try:
            return clean_name(name).casefold()
        except AccountError:
            return name.strip().casefold()[:MAX_KEY]

    def _locked(self, key: str) -> bool:
        count, since = self.failures.get(key, (0, 0.0))
        return count >= LOCK_AFTER and time.time() - since < LOCK_SECONDS

    def login(self, name: str, password: str) -> str | None:
        """A session id, or None. Five wrong passwords lock the name for a minute."""
        key = self._key(name)
        with self.lock:
            if self._locked(key):
                return None
        if not self.logins.acquire(blocking=False):
            return None
        try:
            user: User | None = self.store.authenticate(name, password)
        finally:
            self.logins.release()
        with self.lock:
            if user is None:
                self._fail(key)
                return None
            self.failures.pop(key, None)
            sid = secrets.token_urlsafe(32)
            self.sessions[sid] = Session(user.name, user.role, time.time() + self.session_seconds)
            return sid

    def _fail(self, key: str) -> None:
        now = time.time()
        if len(self.failures) >= MAX_FAILURES:
            for old in [k for k, (_, t) in self.failures.items() if now - t >= LOCK_SECONDS]:
                del self.failures[old]
            if len(self.failures) >= MAX_FAILURES:
                return
        count, since = self.failures.get(key, (0, 0.0))
        self.failures[key] = (1 if now - since >= LOCK_SECONDS else count + 1, now)

    def session(self, sid: str | None) -> Session | None:
        if not sid:
            return None
        with self.lock:
            found = self.sessions.get(sid)
            if found is None:
                return None
            if found.expires <= time.time() or not self._still_valid(found):
                del self.sessions[sid]
                return None
            return found

    def _still_valid(self, who: Session) -> bool:
        """The account must still exist with the same role; a damaged file ends every session."""
        try:
            return any(u.name == who.name and u.role == who.role for u in self.store.users())
        except AccountError:
            return False

    def logout(self, sid: str | None) -> None:
        with self.lock:
            self.sessions.pop(sid or "", None)


def _login_page(ctx: Context, error: str = "") -> bytes:
    note = f'<p class="err">{escape(error)}</p>' if error else ""
    body = (
        '<h1>Đăng nhập</h1><div class="card">'
        f'{note}<form method="post" action="/login">{_hidden(ctx.token)}'
        '<label>Tên</label><input type="text" name="name" autocomplete="username">'
        '<label>Mật khẩu</label><input type="password" name="password" '
        'autocomplete="current-password"><button type="submit">Đăng nhập</button></form>'
        '<p class="muted">Tài khoản do quản trị tạo bằng lệnh user-add.</p></div>'
    )
    return _page("Đăng nhập", body)


def _form_page(
    ctx: Context, me: Session, error: str = "", values: dict[str, str] | None = None
) -> bytes:
    v = values or {}
    subs = v.get("substances", "").split("\n") if v.get("substances") else []
    inputs = "".join(
        f'<input type="text" name="substance" value="{escape(subs[i] if i < len(subs) else "")}">'
        for i in range(3)
    )
    forms = "".join(
        f'<option value="{escape(f["name"])}"{" selected" if f["name"] == v.get("form") else ""}>'
        f"{escape(f['id'])} - {escape(f['name'])} ({escape(f['group'])})</option>"
        for f in dosage_forms()
    )
    markets = "".join(
        f'<option value="{m}"{" selected" if m == v.get("market") else ""}>{escape(t)}</option>'
        for m, t in MARKETS
    )
    note = f'<p class="err">{escape(error)}</p>' if error else ""
    body = (
        '<h1>Đề tài mới</h1><div class="card">'
        f'{note}<form method="post" action="/propose">{_hidden(ctx.token)}'
        "<label>Tên đề tài (tùy chọn)</label>"
        f'<input type="text" name="name" value="{escape(v.get("name", ""), quote=True)}">'
        "<label>Hoạt chất (tối đa 3; tổ hợp nằm ngoài SOP)</label>"
        f'{inputs}<label>Dạng bào chế</label><select name="form">{forms}</select>'
        f'<label>Thị trường</label><select name="market">{markets}</select>'
        '<button type="submit">Đề xuất CQA</button></form></div>'
    )
    return _page("Đề tài mới", body, me, ctx.token)


def _substances(fields: dict[str, list[str]]) -> list[str]:
    return [s.strip() for s in fields.get("substance", []) if s.strip()]


def _first(fields: dict[str, list[str]], key: str) -> str:
    return (fields.get(key) or [""])[0]


def _raw(fields: dict[str, list[str]]) -> dict[str, object]:
    return {
        "substances": _substances(fields),
        "dosage_form": _first(fields, "form"),
        "market": _first(fields, "market"),
    }


def _propose_page(ctx: Context, me: Session, fields: dict[str, list[str]]) -> tuple[int, bytes]:
    raw = _raw(fields)
    name = _first(fields, "name").strip()[:120]
    values = {
        "name": name,
        "substances": "\n".join(raw["substances"]),  # type: ignore[arg-type]
        "form": str(raw["dosage_form"]),
        "market": str(raw["market"]),
    }
    try:
        intake = validate_intake(raw)
    except IntakeRejected as rejected:
        return 400, _form_page(ctx, me, "Từ chối: " + ", ".join(rejected.codes), values)
    proposal = propose_cqa(intake)
    boxes = "".join(
        f'<label class="check"><input type="checkbox" name="cqa" value="{escape(c, quote=True)}">'
        f'{escape(c)} <span class="chip">Ứng viên</span></label>'
        for c in proposal.candidates
    )
    warn = ""
    if intake.scope_flags:
        warn = '<p class="err">Có nhiều hoạt chất: tổ hợp nằm ngoài SOP, lần chạy bị từ chối.</p>'
    hidden = _hidden(ctx.token, form=values["form"], market=values["market"], name=name)
    hidden += "".join(
        f'<input type="hidden" name="substance" value="{escape(s, quote=True)}">'
        for s in raw["substances"]  # type: ignore[union-attr]
    )
    body = (
        f'<h1>Xác nhận CQA</h1><div class="card">{warn}'
        f"<p>Nhóm {escape(proposal.group)}, dạng {escape(values['form'])}. Đây chỉ là ứng viên; "
        f"chỉ CQA do bạn tích mới được dùng, và người xác nhận là {escape(me.name)}.</p>"
        f'<form method="post" action="/run">{hidden}{boxes}'
        '<label>Ngày xác nhận</label><input type="date" name="confirmed_on">'
        '<button type="submit">Xác nhận và dựng bản định hướng</button></form></div>'
    )
    return 200, _page("Xác nhận CQA", body, me, ctx.token)


def _new_run_dir(workdir: Path) -> tuple[str, Path]:
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    for n in range(1000):
        run_id = stamp if n == 0 else f"{stamp}-{n}"
        path = workdir / run_id
        try:
            path.mkdir(parents=True, exist_ok=False)
        except FileExistsError:
            continue
        return run_id, path
    raise OSError("no free run folder")


def _dump(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _execute(ctx: Context, me: Session, fields: dict[str, list[str]]) -> tuple[int, str]:
    """Returns (status, run id or error text). Nothing is created when the input is rejected."""
    raw = _raw(fields)
    try:
        intake = validate_intake(raw)
    except IntakeRejected as rejected:
        return 400, "Từ chối: " + ", ".join(rejected.codes)
    confirmation = {
        "intake_digest": intake_digest(intake),
        "confirmed_cqa": [c.strip() for c in fields.get("cqa", [])],
        "confirmed_by": me.name,
        "confirmed_on": _first(fields, "confirmed_on").strip() or None,
    }
    run_id, folder = _new_run_dir(ctx.workdir)
    args = argparse.Namespace(
        substances=list(raw["substances"]),  # type: ignore[arg-type]
        form=raw["dosage_form"],
        market=raw["market"],
        documents=ctx.args.documents,
        out=str(folder / "draft.json"),
        date=None,
        cqa_confirmation=str(folder / "cqa-confirmation.json"),
        render_dir=str(folder / "html"),
        trial_files=None,
        provider_recording=None,
        provider=getattr(ctx.args, "provider", None),
        model=getattr(ctx.args, "model", None),
        manifest=getattr(ctx.args, "manifest", None),
        provider_destination="remote",
    )
    publish_all({folder / "cqa-confirmation.json": _dump(confirmation)})
    sink = io.StringIO()
    with ctx.run_lock, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        code = run.run(args)
    record = {"exit": code, "message": EXIT_TEXT.get(code, "Lỗi không rõ."), "log": sink.getvalue()}
    project = {
        "name": _first(fields, "name").strip()[:120] or str(raw["substances"][0]),  # type: ignore[index]
        "substances": raw["substances"],
        "form": raw["dosage_form"],
        "market": raw["market"],
        "created_by": me.name,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "exit": code,
    }
    publish_all({folder / "run.json": _dump(record), folder / "project.json": _dump(project)})
    return 200, run_id


def _load_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _sha256(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def _fingerprints(folder: Path) -> dict[str, str | None]:
    return {
        "draft_sha256": _sha256(folder / "draft.json"),
        "quality_sha256": _sha256(folder / "draft.quality.json"),
        "html_sha256": _sha256(folder / "html" / DEFAULT_NAME),
    }


def _a13_records(folder: Path) -> list[tuple[int, dict]]:
    found = []
    for path in folder.glob("a13-record-*.json"):
        match = A13_FILE.match(path.name)
        record = _load_json(path) if match else None
        if match and record is not None:
            found.append((int(match.group(1)), record))
    return sorted(found, key=lambda item: item[0])


def _sign_a13(ctx: Context, me: Session, run_id: str, fields: dict[str, list[str]]) -> int:
    """Records who signed which bytes. Returns an HTTP status; writes nothing on a refusal."""
    if me.role != "head":
        return 403
    folder = ctx.workdir / run_id
    record = _load_json(folder / "run.json")
    prints = _fingerprints(folder)
    if record is None or record.get("exit") != 0 or None in prints.values():
        return 409
    note = _first(fields, "note").strip()[:500]
    with ctx.sign_lock:
        earlier = _a13_records(folder)
        if earlier and not note:
            return 422
        number = (earlier[-1][0] + 1) if earlier else 1
        target = folder / f"a13-record-{number}.json"
        if target.exists():
            return 409
        entry = {
            "signed_by": me.name,
            "signed_on": date.today().isoformat(),
            "note": note,
            **prints,
        }
        try:
            publish_all({target: _dump(entry)})
        except PublishFailed:
            return 500
    return 303


def _a13_block(ctx: Context, me: Session, run_id: str, folder: Path, code: int) -> str:
    records = _a13_records(folder)
    body = '<div class="card"><h2>Chữ ký A13 (Trưởng bộ phận R&amp;D)</h2>'
    body += (
        '<p class="muted">Đây là biên bản của người ký, gắn với mã băm của bản nháp. Hệ thống '
        "không tự duyệt và không đổi bản nháp.</p>"
    )
    if records:
        _, last = records[-1]
        prints = _fingerprints(folder)
        same = all(last.get(k) == v for k, v in prints.items())
        if same:
            who = escape(str(last.get("signed_by", "?")))
            when = escape(str(last.get("signed_on", "?")))
            body += (
                f'<p class="ok">Đã ghi nhận chữ ký A13 do {who} ngày {when}; '
                "mã băm khớp bản nháp hiện tại.</p>"
            )
        else:
            body += '<p class="err">Bản nháp đã đổi sau chữ ký A13; chữ ký không còn khớp.</p>'
        body += f'<p class="muted">{len(records)} bản ghi.</p>'
    else:
        body += '<p class="muted">Chưa có chữ ký A13.</p>'
    if me.role == "head" and code == 0:
        need = " (bắt buộc khi đã có bản ghi)" if records else ""
        body += (
            f'<form method="post" action="/runs/{escape(run_id)}/a13">{_hidden(ctx.token)}'
            f'<label>Ghi chú{need}</label><textarea name="note" rows="2"></textarea>'
            '<button type="submit">Ghi nhận chữ ký A13</button></form>'
        )
    elif code == 0:
        body += '<p class="muted">Chỉ vai trò Trưởng bộ phận R&amp;D ghi nhận được chữ ký.</p>'
    return body + "</div>"


def _run_page(ctx: Context, me: Session, run_id: str) -> tuple[int, bytes]:
    folder = ctx.workdir / run_id
    record = _load_json(folder / "run.json")
    if record is None:
        return 404, _page("Không có", "<h1>Không tìm thấy lần chạy</h1>", me, ctx.token)
    project = _load_json(folder / "project.json") or {}
    code = record.get("exit", "?")
    cls = "ok" if code == 0 else "err"
    title = escape(str(project.get("name") or run_id))
    body = f'<h1>{title}</h1><p class="muted">Lần chạy {escape(run_id)}</p><div class="card">'
    body += f'<p class="{cls}">{escape(str(record.get("message", "")))} (mã {code})</p>'
    log = escape(str(record.get("log", "")).strip())
    body += f"<pre>{log}</pre></div>" if log else "</div>"
    draft = _load_json(folder / "draft.json")
    if code == 0 and draft:
        sections = draft["sections"]
        gaps = [s for s in sections if s["status"] == "gap"]
        covered = sum(s["status"] == "covered" for s in sections)
        base = f"/runs/{escape(run_id)}"
        body += (
            f'<div class="card"><h2>Kết quả</h2><p>{covered} mục có dữ liệu, {len(gaps)} khoảng '
            f'trống. <a href="{base}/draft">Mở bản định hướng (HTML)</a> | '
            f'<a href="{base}/gaps.csv">Xuất CSV khoảng trống</a> | '
            f'<a href="{base}/checklist.csv">Xuất CSV checklist</a></p>'
            "<h2>Sổ khoảng trống (CẦN DỮ LIỆU)</h2><table><tr><th>Mục</th><th>Lý do</th></tr>"
        )
        for s in gaps:
            body += f"<tr><td>{escape(s['id'])}</td><td>{escape(s['gapReason'])}</td></tr>"
        body += "</table></div>"
    quality = _load_json(folder / "draft.quality.json")
    if quality:
        rows = run.STATUS_LABEL
        body += '<div class="card"><h2>Danh mục kiểm tra chất lượng</h2><table>'
        for c in quality["checklist"]:
            body += (
                f"<tr><td>{c['no']}</td><td>{escape(c['text'])}</td>"
                f"<td>{escape(rows.get(c['status'], c['status']))}</td>"
                f"<td>{escape(c.get('detail', ''))}</td></tr>"
            )
        body += "</table></div>"
    body += _a13_block(ctx, me, run_id, folder, code)
    return 200, _page(f"Lần chạy {run_id}", body, me, ctx.token)


def _finished(ctx: Context, run_id: str) -> bool:
    record = _load_json(ctx.workdir / run_id / "run.json")
    return record is not None and record.get("exit") == 0


def _values(fields: dict[str, list[str]]) -> dict[str, str]:
    raw = _raw(fields)
    return {
        "name": _first(fields, "name").strip()[:120],
        "substances": "\n".join(raw["substances"]),  # type: ignore[arg-type]
        "form": str(raw["dosage_form"]),
        "market": str(raw["market"]),
    }


def _csv_cell(value: object) -> str:
    text = str(value)
    return "'" + text if text.startswith(CSV_FORMULA_START) else text


def _csv_bytes(header: list[str], rows: list[list[object]]) -> bytes:
    sink = io.StringIO()
    writer = csv.writer(sink, lineterminator="\r\n")
    writer.writerow(header)
    for row in rows:
        writer.writerow([_csv_cell(c) for c in row])
    return ("﻿" + sink.getvalue()).encode("utf-8")


def _csv_for(ctx: Context, run_id: str, kind: str) -> bytes | None:
    folder = ctx.workdir / run_id
    if kind == "gaps":
        draft = _load_json(folder / "draft.json")
        if draft is None:
            return None
        gaps = [s for s in draft["sections"] if s["status"] == "gap"]
        return _csv_bytes(["Mục", "Lý do"], [[s["id"], s["gapReason"]] for s in gaps])
    quality = _load_json(folder / "draft.quality.json")
    if quality is None:
        return None
    return _csv_bytes(
        ["Số", "Nội dung", "Trạng thái", "Chi tiết"],
        [
            [
                c["no"],
                c["text"],
                run.STATUS_LABEL.get(c["status"], c["status"]),
                c.get("detail", ""),
            ]
            for c in quality["checklist"]
        ],
    )


def _runs_page(ctx: Context, me: Session, only: str | None) -> bytes:
    ids = (
        sorted(
            (p.name for p in ctx.workdir.glob("*") if p.is_dir() and RUN_ID.match(p.name)),
            reverse=True,
        )
        if ctx.workdir.is_dir()
        else []
    )
    entries = []
    for run_id in ids:
        record = _load_json(ctx.workdir / run_id / "run.json") or {"exit": "?", "message": ""}
        project = _load_json(ctx.workdir / run_id / "project.json") or {}
        entries.append((run_id, record, project))
    codes = sorted({str(e[1].get("exit", "?")) for e in entries})
    links = '<p class="filters"><a href="/runs">Tất cả</a>' + "".join(
        f'<a href="/runs?exit={quote(c)}">Mã {escape(c)}</a>' for c in codes
    )
    rows = ""
    for run_id, record, project in entries:
        if only is not None and str(record.get("exit", "?")) != only:
            continue
        subs = ", ".join(project.get("substances") or []) or "không rõ"
        rows += (
            f'<tr><td><a href="/runs/{run_id}">{escape(str(project.get("name") or run_id))}</a>'
            f'<br><span class="muted">{run_id}</span></td><td>{escape(subs)}</td>'
            f"<td>{escape(str(project.get('form', '')))}</td>"
            f"<td>{escape(str(project.get('market', '')))}</td>"
            f"<td>{escape(str(project.get('created_by', '')))}</td>"
            f"<td>{escape(str(record.get('exit', '?')))}: "
            f"{escape(str(record.get('message', '')))}</td></tr>"
        )
    table = (
        "<table><tr><th>Đề tài</th><th>Hoạt chất</th><th>Dạng</th><th>Thị trường</th>"
        f"<th>Người tạo</th><th>Kết quả</th></tr>{rows}</table>"
    )
    return _page(
        "Đề tài đã chạy",
        f'<h1>Đề tài đã chạy</h1><div class="card">{links}</p>{table}</div>',
        me,
        ctx.token,
    )


def _system_page(ctx: Context, me: Session) -> bytes:
    agents = "".join(
        f"<tr><td>{escape(i)}</td><td>{escape(n)}</td><td>{escape(k)}</td><td>{escape(s)}</td>"
        f"<td>{escape(r)}</td></tr>"
        for i, n, k, s, r in agent_status_rows()
    )
    providers = ""
    for name in sorted(HTTP_PROVIDERS):
        try:
            config = load_config(name)
            state = "bật" if config.enabled else "tắt"
            models = ", ".join(config.approved_models) or "chưa duyệt model"
        except Exception as error:  # the page only reports; a bad file is shown, not hidden
            state, models = "không đọc được", type(error).__name__
        providers += f"<tr><td>{escape(name)}</td><td>{state}</td><td>{escape(models)}</td></tr>"
    body = (
        '<h1>Hệ thống</h1><div class="card"><h2>Nhà cung cấp mô hình</h2>'
        '<p class="muted">Chỉ đọc. Bật nhà cung cấp là quyết định của người, sửa '
        "providers.json bằng tay.</p><table><tr><th>Tên</th><th>Trạng thái</th>"
        f"<th>Model được duyệt</th></tr>{providers}</table></div>"
        '<div class="card"><h2>Agent</h2><table><tr><th>Mã</th><th>Tên</th><th>Loại</th>'
        f"<th>Trạng thái</th><th>Ghi chú</th></tr>{agents}</table></div>"
    )
    return _page("Hệ thống", body, me, ctx.token)


class Handler(BaseHTTPRequestHandler):
    ctx: Context

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - base signature
        return

    def _send(
        self,
        status: int,
        body: bytes,
        kind: str = "text/html; charset=utf-8",
        extra: dict[str, str] | None = None,
        draft: bool = False,
    ) -> None:
        # The draft page needs its one fixed script, so it runs sandboxed in an opaque origin
        # and cannot read the form token or reach the session.
        policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'"
        if draft:
            policy += "; script-src 'unsafe-inline'; sandbox allow-scripts"
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", policy)
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _text(self, status: int, text: str) -> None:
        self._send(status, text.encode("utf-8"), "text/plain; charset=utf-8")

    def _redirect(self, where: str, extra: dict[str, str] | None = None) -> None:
        self.send_response(303)
        self.send_header("Location", where)
        self.send_header("Content-Length", "0")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()

    def _host_ok(self) -> bool:
        return self.headers.get("Host", "") in self.ctx.hosts

    def _sid(self) -> str | None:
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        morsel = jar.get(COOKIE)
        return morsel.value if morsel else None

    def _me(self) -> Session | None:
        return self.ctx.session(self._sid())

    def do_GET(self) -> None:  # noqa: N802 - http.server naming
        self._guarded(self._get)

    def do_POST(self) -> None:  # noqa: N802 - http.server naming
        self._guarded(self._post)

    def _guarded(self, handler) -> None:
        try:
            handler()
        except Exception:  # one bad request must not kill the thread or show a traceback
            with contextlib.suppress(Exception):
                self._text(500, "internal error")

    def _get(self) -> None:
        if not self._host_ok():
            return self._text(403, "host not allowed")
        parts = urlsplit(self.path)
        path, ctx = parts.path, self.ctx
        if path == "/login":
            return self._send(200, _login_page(ctx))
        me = self._me()
        if me is None:
            return self._redirect("/login")
        if path == "/":
            return self._send(200, _form_page(ctx, me))
        if path == "/runs":
            only = (parse_qs(parts.query).get("exit") or [None])[0]
            return self._send(200, _runs_page(ctx, me, only))
        if path == "/system":
            return self._send(200, _system_page(ctx, me))
        match = re.fullmatch(r"/runs/([^/]+)(?:/(draft|gaps\.csv|checklist\.csv))?", path)
        if not match or not RUN_ID.match(match.group(1)):
            return self._text(404, "not found")
        run_id, leaf = match.group(1), match.group(2)
        if leaf is None:
            status, body = _run_page(ctx, me, run_id)
            return self._send(status, body)
        if not _finished(ctx, run_id):
            return self._text(404, "not found")
        if leaf == "draft":
            try:
                page = (ctx.workdir / run_id / "html" / DEFAULT_NAME).read_bytes()
            except OSError:
                return self._text(404, "not found")
            return self._send(200, page, draft=True)
        data = _csv_for(ctx, run_id, leaf.removesuffix(".csv"))
        if data is None:
            return self._text(404, "not found")
        return self._send(
            200,
            data,
            "text/csv; charset=utf-8",
            {"Content-Disposition": f'attachment; filename="{run_id}-{leaf}"'},
        )

    def _read_form(self) -> dict[str, list[str]] | None:
        if not self._host_ok():
            self._text(403, "host not allowed")
            return None
        length = self.headers.get("Content-Length")
        if length is None or not (length.isascii() and length.isdigit()):
            self._text(411, "length required")
            return None
        if int(length) > MAX_BODY:
            self._text(413, "body too large")
            return None
        if not self.headers.get("Content-Type", "").startswith("application/x-www-form-urlencoded"):
            self._text(415, "form data only")
            return None
        raw = self.rfile.read(int(length)).decode("utf-8", errors="replace")
        fields = parse_qs(raw, keep_blank_values=True)
        sent = _first(fields, "token")
        if not hmac.compare_digest(sent, self.ctx.token):
            self._text(403, "bad token")
            return None
        return fields

    def _post(self) -> None:
        fields = self._read_form()
        if fields is None:
            return
        path, ctx = urlsplit(self.path).path, self.ctx
        if path == "/login":
            sid = ctx.login(_first(fields, "name"), _first(fields, "password"))
            if sid is None:
                return self._send(
                    401, _login_page(ctx, "Sai tên hoặc mật khẩu, hoặc đang bị khóa.")
                )
            cookie = f"{COOKIE}={sid}; HttpOnly; SameSite=Strict; Path=/"
            return self._redirect("/", {"Set-Cookie": cookie})
        me = self._me()
        if me is None:
            return self._text(401, "sign in first")
        if path == "/logout":
            ctx.logout(self._sid())
            return self._redirect("/login", {"Set-Cookie": f"{COOKIE}=; Max-Age=0; Path=/"})
        if path == "/propose":
            status, body = _propose_page(ctx, me, fields)
            return self._send(status, body)
        if path == "/run":
            status, result = _execute(ctx, me, fields)
            if status != 200:
                return self._send(status, _form_page(ctx, me, result, _values(fields)))
            return self._redirect(f"/runs/{result}")
        match = re.fullmatch(r"/runs/([^/]+)/a13", path)
        if match and RUN_ID.match(match.group(1)):
            status = _sign_a13(ctx, me, match.group(1), fields)
            if status == 303:
                return self._redirect(f"/runs/{match.group(1)}")
            return self._text(status, "not recorded")
        self._text(404, "not found")


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--documents", required=True, help="JSON list of knowledge documents")
    parser.add_argument("--users-file", required=True, help="accounts made with user-add")
    parser.add_argument("--workdir", default="runs", help="where each run is written")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--provider", choices=sorted(HTTP_PROVIDERS), default=None)
    parser.add_argument("--model", default=None)
    parser.add_argument("--manifest", default=None)


def make_server(args: argparse.Namespace) -> ThreadingHTTPServer:
    """Binds to loopback only. Port 0 picks a free port. Refuses to start with nobody to sign in."""
    store = UserStore(args.users_file)
    if not store.users():
        raise AccountError("the accounts file has no users")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    ctx = Context(args, server.server_address[1], store)
    server.RequestHandlerClass = type("BoundHandler", (Handler,), {"ctx": ctx})
    return server


def serve(args: argparse.Namespace) -> int:
    try:
        server = make_server(args)
    except AccountError as error:
        print(f"accounts: {error}", file=sys.stderr)
        return EXIT_ACCOUNTS
    except OSError as error:
        print(f"cannot listen: {error}", file=sys.stderr)
        return EXIT_SERVE
    port = server.server_address[1]
    print(f"http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0
