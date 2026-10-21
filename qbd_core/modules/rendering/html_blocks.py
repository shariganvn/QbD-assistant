"""Block-level HTML helpers: escaping, markers, tables, blocks and headings."""

from __future__ import annotations

import html
from typing import Any

from qbd_core.modules.rendering.errors import RenderFailed
from qbd_core.shared.markers import MARKER


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


LONG_CELL = 80


def cell_class(text: str, risk: dict[str, str] | None) -> str:
    """Risk levels get the sample's fill; long prose is justified, short values are centred."""
    if risk and text.strip() in risk:
        return risk[text.strip()]
    return "long" if len(text) > LONG_CELL else ""


def risk_classes(outline: dict[str, Any]) -> dict[str, str]:
    """Lowest level green, highest red, anything between yellow (the sample's fills)."""
    scale = outline.get("riskScale") or []
    names = {}
    for index, level in enumerate(scale):
        names[level] = (
            "risk-low" if index == 0 else "risk-high" if index == len(scale) - 1 else "risk-mid"
        )
    return names


def table(
    headers: list[str],
    rows: list[list[str]],
    align: list[str] | None = None,
    header: bool = True,
    risk: dict[str, str] | None = None,
) -> str:
    def style(i):
        return f' style="text-align:{align[i]}"' if align else ""

    def td(i, text):
        cls = cell_class(text, risk)
        return f"<td{style(i)}{f' class={chr(34)}{cls}{chr(34)}' if cls else ''}>{cell(text)}</td>"

    head = "".join(f"<th{style(i)}>{esc(h)}</th>" for i, h in enumerate(headers))
    body = "".join("<tr>" + "".join(td(i, c) for i, c in enumerate(row)) + "</tr>" for row in rows)
    top = f"<thead><tr>{head}</tr></thead>" if header else ""
    return f"<table>{top}<tbody>{body}</tbody></table>"


def block(
    item: dict[str, Any], section_id: str, header: bool = True, risk: dict[str, str] | None = None
) -> str:
    kind = item["type"]
    if kind == "heading2":
        return f"<h6>{marked(item['text'])}</h6>"
    if kind == "heading3":
        return f"<h6>{marked(item['text'])}</h6>"
    if kind == "paragraph":
        text = marked(item["text"])
        text = f"<em>{text}</em>" if item.get("italic") else text
        text = f"<strong>{text}</strong>" if item.get("bold") else text
        return f"<p>{text}</p>"
    if kind == "table":
        align = item.get("columnAlign")
        return table(item["headers"], item["rows"], align, header, risk)
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
    """P.2.n is H2, one level deeper per number, capped at H5 (H1 is the chapter title)."""
    return min(entry["id"].count("."), 5)
