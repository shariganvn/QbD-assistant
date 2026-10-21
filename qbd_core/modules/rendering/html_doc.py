"""Build the orientation draft as one self-contained HTML file (inline style, no script)."""

from __future__ import annotations

import html
from typing import Any

from qbd_core.modules.rendering import annex
from qbd_core.modules.rendering.errors import RenderFailed
from qbd_core.modules.rendering.markers import MARKER

TITLE = "3.2.P.2 Phát triển dược học (Pharmaceutical Development) - bản định hướng"
STATUS = "Trạng thái: BẢN NHÁP NỘI BỘ – CHƯA THẨM ĐỊNH"
NOTICE_TITLE = "Lưu ý phạm vi tài liệu"
NOTICE_1 = (
    "Tài liệu này là bản tổng hợp nội bộ theo khung mục CTD 3.2.P.2, dựng từ ba đầu vào "
    "(hoạt chất, dạng bào chế, thị trường) và các nguồn tra cứu được nêu. Chỗ không có dữ liệu "
    "nguồn mang dấu [CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG], không suy diễn và không điền số giả định. "
    "Chỗ có dữ liệu nhưng hai nguồn không khớp, hoặc một giả định chưa được duyệt, mang dấu "
    "[CẦN QUYẾT ĐỊNH – CHƯA CHỐT]. Cuối tài liệu có các danh mục tương ứng, sinh từ chính các "
    "dấu trong tài liệu."
)
NOTICE_2 = (
    "Tài liệu KHÔNG phải hồ sơ P.2 đã phê duyệt, không thay thế thẩm định của FD/QA và không "
    "được dùng để nộp hồ sơ đăng ký cho đến khi được rà soát, bổ sung dữ liệu và phê duyệt "
    "chính thức."
)
SIGNOFF_HEADING = "Ghi nhận soạn thảo và rà soát"
SIGNOFF_ROLES = ("Soạn thảo", "Rà soát FD", "Phê duyệt QA/PO")
BLANK = "________________"
SPOT_HEADERS = ["Mục", "Vị trí", "Nội dung"]
CSS = (
    "body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;"
    "line-height:1.5;color:#1a1a1a}table{border-collapse:collapse;width:100%;margin:.5rem 0}"
    "th,td{border:1px solid #999;padding:.3rem .5rem;vertical-align:top;text-align:left}"
    ".scope-notice{border:1px solid #999;background:#f4f1e6;padding:.8rem 1rem;margin:1rem 0}"
    ".gap{background:#fde8e8}.decision{background:#fff3cd}mark{padding:0 .15rem}"
    ".gap-section{border-left:4px solid #c0392b;padding-left:.8rem}"
    ".toolbar{position:sticky;top:0;background:#fff;padding:.5rem 0;display:flex;gap:.5rem;"
    "align-items:center;border-bottom:1px solid #ccc}"
    ".toolbar button{padding:.4rem .9rem;cursor:pointer}"
    "@page{size:A4;margin:18mm}@media print{.no-print{display:none}body{max-width:none;margin:0}"
    "h1,h2,h3,h4{break-after:avoid}tr{break-inside:avoid}}"
)
WORD_FILE = "p2-orientation-draft.doc"
TOOLBAR = (
    '<div class="toolbar no-print"><button type="button" id="btn-pdf">Xuất PDF</button>'
    '<button type="button" id="btn-word">Xuất Word</button>'
    '<span>PDF: chọn "Lưu thành PDF" trong hộp thoại in. Word: tải file .doc mở được bằng Word.'
    "</span></div>"
)
# Constant text, never built from the draft. Offline: no request is made anywhere in it.
SCRIPT = (
    "document.getElementById('btn-pdf').addEventListener('click',function(){window.print();});"
    "document.getElementById('btn-word').addEventListener('click',function(){"
    "var css=document.querySelector('style').textContent;"
    "var body=document.getElementById('doc').innerHTML;"
    'var head=\'<html xmlns:o="urn:schemas-microsoft-com:office:office" '
    'xmlns:w="urn:schemas-microsoft-com:office:word" '
    'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>\';'
    "var blob=new Blob(['\\ufeff',head+css+'</style></head><body>'+body+'</body></html>'],"
    "{type:'application/msword'});"
    "var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='"
    + WORD_FILE
    + "';"
    "document.body.appendChild(a);a.click();document.body.removeChild(a);"
    "setTimeout(function(){URL.revokeObjectURL(a.href);},0);});"
)


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def marked(text: str) -> str:
    def wrap(match):
        cls = "gap" if match.group().startswith("[CHƯA") else "decision"
        return f'<mark class="{cls}">{match.group()}</mark>'

    return MARKER.sub(wrap, esc(text))


def cell(text: str) -> str:
    lines = text.split("\n")
    out, bullets = [], []
    for line in lines + [""]:
        if line.startswith("- "):
            bullets.append(f"<li>{marked(line[2:])}</li>")
            continue
        if bullets:
            out.append(f"<ul>{''.join(bullets)}</ul>")
            bullets = []
        if line:
            out.append(f"<p>{marked(line)}</p>")
    return "".join(out)


def table(headers: list[str], rows: list[list[str]], align: list[str] | None = None) -> str:
    def style(i):
        return f' style="text-align:{align[i]}"' if align else ""

    head = "".join(f"<th{style(i)}>{esc(h)}</th>" for i, h in enumerate(headers))
    body = "".join(
        "<tr>" + "".join(f"<td{style(i)}>{cell(c)}</td>" for i, c in enumerate(row)) + "</tr>"
        for row in rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def block(item: dict[str, Any], section_id: str) -> str:
    kind = item["type"]
    if kind == "heading2":
        return f"<h5>{marked(item['text'])}</h5>"
    if kind == "heading3":
        return f"<h6>{marked(item['text'])}</h6>"
    if kind == "paragraph":
        text = marked(item["text"])
        text = f"<em>{text}</em>" if item.get("italic") else text
        text = f"<strong>{text}</strong>" if item.get("bold") else text
        return f"<p>{text}</p>"
    if kind == "table":
        align = item.get("columnAlign")
        return table(item["headers"], item["rows"], align)
    raise RenderFailed("E_BLOCK_UNSUPPORTED", f"{section_id}: {kind}")


def heading_text(entry: dict[str, Any], meta: dict[str, Any]) -> str:
    text = entry["headingVi"]
    index = (entry.get("form") or {}).get("strengthIndex")
    if index is not None and "{strength}" in text:
        strengths = meta["strengths"]
        name = strengths[index] if index < len(strengths) else "hàm lượng khác (không áp dụng)"
        text = text.replace("{strength}", name)
    return f"{entry['ctdReference']} {text}"


def level(entry: dict[str, Any]) -> int:
    return min(2 + entry["id"].count(".") - 1, 4)


def sections_html(draft: dict[str, Any], outline: dict[str, Any]) -> str:
    by_id = {s["id"]: s for s in draft["sections"]}
    parts = []
    for entry in outline["sections"]:
        lvl = level(entry)
        title = marked(heading_text(entry, draft["meta"]))
        parts.append(f'<h{lvl} id="s-{esc(entry["id"])}">{title}</h{lvl}>')
        section = by_id.get(entry["id"])
        if section is None:
            continue
        if section["status"] == "gap":
            parts.append(f'<div class="gap-section"><p>{marked(section["gapReason"])}</p></div>')
        else:
            parts.extend(block(b, entry["id"]) for b in section["blocks"])
    return "".join(parts)


def registers_html(draft: dict[str, Any], outline: dict[str, Any]) -> str:
    requests, decisions = annex.collect(draft, outline)
    status = [
        [e["ctdReference"], "Đã có nội dung" if s["status"] == "covered" else "Khoảng trống"]
        for e in outline["sections"]
        if (s := next((x for x in draft["sections"] if x["id"] == e["id"]), None))
    ]
    out = ["<h2>Bảng tổng hợp khoảng trống dữ liệu</h2>", table(["Mục", "Trạng thái"], status)]
    out.append("<h2>Danh mục dữ liệu cần bổ sung</h2>")
    for experiment, rows in requests.items():
        out.append(
            f"<h3>{esc(experiment)}</h3>"
            + table(["Mục", "Vị trí", "Nội dung"], [list(r) for r in rows])
        )
    out.append("<h2>Danh mục điểm cần quyết định</h2>")
    out.append(
        table(["Mục", "Vị trí", "Nội dung"], [list(r) for r in decisions])
        if decisions
        else "<p>Không có.</p>"
    )
    return "".join(out)


def build_html(draft: dict[str, Any], outline: dict[str, Any]) -> str:
    meta = draft["meta"]
    provenance = (
        f"Xuất xứ bản nháp: dựng tự động bởi {meta['assembledBy']}; "
        f"lần sửa cuối {meta['draftDate']}. Mọi vai trò trong bảng ký duyệt ở cuối tài liệu "
        "để trống, chờ người có thẩm quyền ký."
    )
    facts = [
        ["Sản phẩm", meta["productName"]],
        ["Hoạt chất", meta["apiName"]],
        ["Hàm lượng", "; ".join(meta["strengths"])],
        ["File thử nghiệm", "; ".join(meta["sourceFiles"])],
    ]
    if meta.get("referenceSources"):
        facts.append(["Tài liệu tham khảo", "\n".join(f"- {r}" for r in meta["referenceSources"])])
    signoff = [[role, BLANK, BLANK, ""] for role in SIGNOFF_ROLES]
    return (
        '<!DOCTYPE html>\n<html lang="vi"><head><meta charset="utf-8">'
        f"<title>{esc(TITLE)}</title><style>{CSS}</style></head><body>"
        + TOOLBAR
        + '<main id="doc">'
        + f"<h1>{esc(TITLE)}</h1><p><strong>{esc(STATUS)}</strong></p>"
        f'<div class="scope-notice"><p><strong>{esc(NOTICE_TITLE)}</strong></p>'
        f"<p>{marked(NOTICE_1)}</p>"
        f"<p>{esc(provenance)}</p><p><strong>{esc(NOTICE_2)}</strong></p></div>"
        + table(["Thông tin", "Giá trị"], facts)
        + sections_html(draft, outline)
        + registers_html(draft, outline)
        + f"<h2>{esc(SIGNOFF_HEADING)}</h2>"
        + table(["Vai trò", "Họ tên", "Chữ ký", "Ngày"], signoff)
        + f"</main><script>{SCRIPT}</script></body></html>\n"
    )
