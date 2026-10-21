"""The two markers of an unfinished spot, and how they are found in draft text (shared)."""

from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Any

GAP_PREFIX = "[CHƯA CÓ DỮ LIỆU"
DECISION_PREFIX = "[CẦN QUYẾT ĐỊNH"
MARKER = re.compile(r"\[(?:CHƯA CÓ DỮ LIỆU|CẦN QUYẾT ĐỊNH)[^\]]*\]")


def spots(section: dict[str, Any]) -> Iterator[tuple[str, str]]:
    """Yield (where, text) for every text of a section that can carry a marker."""
    if section["status"] == "gap":
        yield "lý do", section["gapReason"]
        return
    for block in section.get("blocks", []):
        if block["type"] == "paragraph":
            yield "đoạn văn", block["text"]
        elif block["type"] == "table":
            headers = block["headers"]
            for row in block["rows"]:
                for header, cell in zip(headers, row, strict=True):
                    yield f"bảng, dòng {row[0]}, cột {header}", cell


def kind_of(text: str) -> str | None:
    if DECISION_PREFIX in text:
        return "decision"
    if GAP_PREFIX in text:
        return "gap"
    return None
