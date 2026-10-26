"""The `serve` command: a local web page around `run`. It adds no logic of its own.

Every run goes through `run.run`, the same function the command line uses, so a draft made here
is byte-for-byte the draft the command line would make. The person who confirms the CQA is the
person at the keyboard; there is no button for the head-of-R&D approval (A13).
"""

from __future__ import annotations

import argparse
import contextlib
import hmac
import io
import json
import re
import secrets
import threading
from datetime import datetime
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from qbd_core import run
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
from qbd_core.publish import publish_all

MAX_BODY = 64 * 1024
RUN_ID = re.compile(r"^\d{8}T\d{6}(-\d{1,3})?$")
MARKETS = (("eu", "EU"), ("domestic", "Trong nước"), ("both", "Cả hai"))
LABEL = "Bản định hướng nội bộ, chưa FD duyệt. Trưởng bộ phận R&D duyệt cuối (A13) ngoài hệ thống."

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
.chip{background:#fef3c7;color:var(--warn);border-radius:999px;padding:2px 10px;font-size:12px}
main{max-width:960px;margin:24px auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 20px;
margin-bottom:16px}
h1{font-size:22px;margin:0 0 12px}h2{font-size:16px;margin:0 0 8px}
label{display:block;margin:8px 0 2px;font-weight:600}
input[type=text],input[type=date],select{width:100%;padding:6px 8px;border:1px solid var(--line);
border-radius:6px;font:inherit}
button{background:var(--primary);color:#fff;border:0;border-radius:6px;padding:8px 16px;
font:inherit;cursor:pointer;margin-top:12px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);padding:6px 8px;
text-align:left;vertical-align:top}
.err{color:var(--danger)}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.ok{color:var(--ok)}.muted{color:var(--muted)}
.check{font-weight:400;display:flex;gap:8px;align-items:center;margin:4px 0}
"""


def _page(title: str, body: str) -> bytes:
    nav = (
        '<header><a class="brand" href="/">QbD P.2</a><a href="/">Đề tài mới</a>'
        '<a href="/runs">Các lần chạy</a><a href="/system">Hệ thống</a>'
        '<span class="chip">chưa FD duyệt</span></header>'
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

    def __init__(self, args: argparse.Namespace, port: int) -> None:
        self.args = args
        self.port = port
        self.workdir = Path(args.workdir)
        self.token = secrets.token_hex(16)
        self.lock = threading.Lock()

    @property
    def hosts(self) -> set[str]:
        return {f"127.0.0.1:{self.port}", f"localhost:{self.port}"}


def _form_page(ctx: Context, error: str = "", values: dict[str, str] | None = None) -> bytes:
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
        "<label>Hoạt chất (tối đa 3; tổ hợp nằm ngoài SOP)</label>"
        f'{inputs}<label>Dạng bào chế</label><select name="form">{forms}</select>'
        f'<label>Thị trường</label><select name="market">{markets}</select>'
        '<button type="submit">Đề xuất CQA</button></form></div>'
    )
    return _page("Đề tài mới", body)


def _substances(fields: dict[str, list[str]]) -> list[str]:
    return [s.strip() for s in fields.get("substance", []) if s.strip()]


def _raw(fields: dict[str, list[str]]) -> dict[str, object]:
    return {
        "substances": _substances(fields),
        "dosage_form": (fields.get("form") or [""])[0],
        "market": (fields.get("market") or [""])[0],
    }


def _propose_page(ctx: Context, fields: dict[str, list[str]]) -> tuple[int, bytes]:
    raw = _raw(fields)
    values = {
        "substances": "\n".join(raw["substances"]),  # type: ignore[arg-type]
        "form": str(raw["dosage_form"]),
        "market": str(raw["market"]),
    }
    try:
        intake = validate_intake(raw)
    except IntakeRejected as rejected:
        return 400, _form_page(ctx, "Từ chối: " + ", ".join(rejected.codes), values)
    proposal = propose_cqa(intake)
    boxes = "".join(
        f'<label class="check"><input type="checkbox" name="cqa" value="{escape(c, quote=True)}">'
        f'{escape(c)} <span class="chip">Ứng viên</span></label>'
        for c in proposal.candidates
    )
    warn = ""
    if intake.scope_flags:
        warn = '<p class="err">Có nhiều hoạt chất: tổ hợp nằm ngoài SOP, lần chạy bị từ chối.</p>'
    hidden = _hidden(ctx.token, form=values["form"], market=values["market"]) + "".join(
        f'<input type="hidden" name="substance" value="{escape(s, quote=True)}">'
        for s in raw["substances"]  # type: ignore[union-attr]
    )
    body = (
        f'<h1>Xác nhận CQA</h1><div class="card">{warn}'
        f"<p>Nhóm {escape(proposal.group)}, dạng {escape(values['form'])}. Đây chỉ là ứng viên; "
        "chỉ CQA do bạn tích và ký mới được dùng.</p>"
        f'<form method="post" action="/run">{hidden}{boxes}'
        '<label>Người xác nhận</label><input type="text" name="confirmed_by">'
        '<label>Ngày xác nhận</label><input type="date" name="confirmed_on">'
        '<button type="submit">Xác nhận và dựng bản định hướng</button></form></div>'
    )
    return 200, _page("Xác nhận CQA", body)


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


def _execute(ctx: Context, fields: dict[str, list[str]]) -> tuple[int, str]:
    """Returns (status, run id or error text). Nothing is created when the input is rejected."""
    raw = _raw(fields)
    try:
        intake = validate_intake(raw)
    except IntakeRejected as rejected:
        return 400, "Từ chối: " + ", ".join(rejected.codes)
    confirmation = {
        "intake_digest": intake_digest(intake),
        "confirmed_cqa": [c.strip() for c in fields.get("cqa", [])],
        "confirmed_by": (fields.get("confirmed_by") or [""])[0].strip() or None,
        "confirmed_on": (fields.get("confirmed_on") or [""])[0].strip() or None,
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
    payload = (json.dumps(confirmation, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    publish_all({folder / "cqa-confirmation.json": payload})
    sink = io.StringIO()
    with ctx.lock, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        code = run.run(args)
    record = {"exit": code, "message": EXIT_TEXT.get(code, "Lỗi không rõ."), "log": sink.getvalue()}
    publish_all({folder / "run.json": (json.dumps(record, ensure_ascii=False) + "\n").encode()})
    return 200, run_id


def _load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _run_page(ctx: Context, run_id: str) -> tuple[int, bytes]:
    folder = ctx.workdir / run_id
    record = _load_json(folder / "run.json")
    if record is None:
        return 404, _page("Không có", "<h1>Không tìm thấy lần chạy</h1>")
    code = record["exit"]
    cls = "ok" if code == 0 else "err"
    body = f'<h1>Lần chạy {escape(run_id)}</h1><div class="card">'
    body += f'<p class="{cls}">{escape(record["message"])} (mã {code})</p>'
    log = escape(record["log"].strip())
    body += f"<pre>{log}</pre></div>" if log else "</div>"
    draft = _load_json(folder / "draft.json")
    if code == 0 and draft:
        sections = draft["sections"]
        gaps = [s for s in sections if s["status"] == "gap"]
        covered = sum(s["status"] == "covered" for s in sections)
        body += (
            f'<div class="card"><h2>Kết quả</h2><p>{covered} mục có dữ liệu, {len(gaps)} khoảng '
            f'trống. <a href="/runs/{escape(run_id)}/draft">Mở bản định hướng (HTML)</a></p>'
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
    return 200, _page(f"Lần chạy {run_id}", body)


def _runs_page(ctx: Context) -> bytes:
    ids = (
        sorted(
            (p.name for p in ctx.workdir.glob("*") if p.is_dir() and RUN_ID.match(p.name)),
            reverse=True,
        )
        if ctx.workdir.is_dir()
        else []
    )
    rows = ""
    for run_id in ids:
        record = _load_json(ctx.workdir / run_id / "run.json") or {"exit": "?", "message": ""}
        rows += (
            f'<tr><td><a href="/runs/{run_id}">{run_id}</a></td>'
            f"<td>{escape(str(record['exit']))}</td><td>{escape(record['message'])}</td></tr>"
        )
    table = f"<table><tr><th>Lần chạy</th><th>Mã</th><th>Kết quả</th></tr>{rows}</table>"
    return _page("Các lần chạy", f'<h1>Các lần chạy</h1><div class="card">{table}</div>')


def _system_page() -> bytes:
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
    return _page("Hệ thống", body)


class Handler(BaseHTTPRequestHandler):
    ctx: Context

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - base signature
        return

    def _send(self, status: int, body: bytes, kind: str = "text/html; charset=utf-8") -> None:
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "
            "img-src data:; form-action 'self'",
        )
        self.end_headers()
        self.wfile.write(body)

    def _text(self, status: int, text: str) -> None:
        self._send(status, text.encode("utf-8"), "text/plain; charset=utf-8")

    def _host_ok(self) -> bool:
        return self.headers.get("Host", "") in self.ctx.hosts

    def do_GET(self) -> None:  # noqa: N802 - http.server naming
        if not self._host_ok():
            return self._text(403, "host not allowed")
        path = urlsplit(self.path).path
        ctx = self.ctx
        if path == "/":
            return self._send(200, _form_page(ctx))
        if path == "/runs":
            return self._send(200, _runs_page(ctx))
        if path == "/system":
            return self._send(200, _system_page())
        match = re.fullmatch(r"/runs/([^/]+)(/draft)?", path)
        if match and RUN_ID.match(match.group(1)):
            if match.group(2):
                page = ctx.workdir / match.group(1) / "html" / DEFAULT_NAME
                try:
                    return self._send(200, page.read_bytes())
                except OSError:
                    return self._text(404, "not found")
            status, body = _run_page(ctx, match.group(1))
            return self._send(status, body)
        return self._text(404, "not found")

    def _read_form(self) -> dict[str, list[str]] | None:
        if not self._host_ok():
            self._text(403, "host not allowed")
            return None
        length = self.headers.get("Content-Length")
        if length is None or not length.isdigit():
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
        sent = (fields.get("token") or [""])[0]
        if not hmac.compare_digest(sent, self.ctx.token):
            self._text(403, "bad token")
            return None
        return fields

    def do_POST(self) -> None:  # noqa: N802 - http.server naming
        fields = self._read_form()
        if fields is None:
            return
        path = urlsplit(self.path).path
        if path == "/propose":
            status, body = _propose_page(self.ctx, fields)
            return self._send(status, body)
        if path == "/run":
            status, result = _execute(self.ctx, fields)
            if status != 200:
                return self._send(status, _form_page(self.ctx, result))
            self.send_response(303)
            self.send_header("Location", f"/runs/{result}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self._text(404, "not found")


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--documents", required=True, help="JSON list of knowledge documents")
    parser.add_argument("--workdir", default="runs", help="where each run is written")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--provider", choices=sorted(HTTP_PROVIDERS), default=None)
    parser.add_argument("--model", default=None)
    parser.add_argument("--manifest", default=None)


def make_server(args: argparse.Namespace) -> ThreadingHTTPServer:
    """Binds to loopback only. Port 0 picks a free port."""
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    ctx = Context(args, server.server_address[1])
    server.RequestHandlerClass = type("BoundHandler", (Handler,), {"ctx": ctx})
    return server


def serve(args: argparse.Namespace) -> int:
    server = make_server(args)
    port = server.server_address[1]
    print(f"http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0
