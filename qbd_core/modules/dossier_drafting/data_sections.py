"""Sections written from the team's own data by code, each number carrying a cell tag."""

from __future__ import annotations

import re
from typing import Any

from qbd_core.modules.evidence.api import TrialData, TrialTable, first_number, tag_for
from qbd_core.shared.markers import GAP_LABEL

SINK_SECTION = "P.2.2.3.1.1"
MEDIUM_WORDS = ("medium", "media", "môi trường")
MINIMUM_WORDS = ("minimum", "tối thiểu")
EXPERIMENT_WORDS = ("experimental", "thực nghiệm")
UNIT = re.compile(r"\(([^()]+)\)\s*$")


def _column(headers: tuple[str, ...], words: tuple[str, ...]) -> int | None:
    for index, header in enumerate(headers):
        if any(word in header.lower() for word in words):
            return index
    return None


def _unit(header: str) -> str | None:
    found = UNIT.search(header.strip())
    return found.group(1).strip() if found else None


def _gap(text: str) -> dict[str, str]:
    return {"type": "paragraph", "text": f"{GAP_LABEL} {text}."}


def _sink_rows(table: TrialTable) -> list[dict[str, str]]:
    medium = _column(table.headers, MEDIUM_WORDS)
    low = _column(table.headers, MINIMUM_WORDS)
    high = _column(table.headers, EXPERIMENT_WORDS)
    where = f"{table.file}, bảng {table.index}"
    if medium is None or low is None or high is None:
        return [
            _gap(f"bảng điều kiện sink ({where}) thiếu cột môi trường, tối thiểu hoặc thực nghiệm")
        ]
    unit_low, unit_high = _unit(table.headers[low]), _unit(table.headers[high])
    if unit_low is None or unit_low != unit_high:
        return [_gap(f"bảng điều kiện sink ({where}) thiếu đơn vị hoặc hai cột khác đơn vị")]
    blocks = []
    for number, row in enumerate(table.rows, start=1):
        if max(medium, low, high) >= len(row) or not any(c.strip() for c in row):
            continue
        floor, found = first_number(row[low]), first_number(row[high])
        if floor is None or found is None:
            blocks.append(_gap(f"hàng {number} của bảng ({where}) không đọc được số"))
            continue
        verdict = "đáp ứng" if found >= floor else "chưa đáp ứng"
        tags = " ".join(tag_for(table, number, c + 1) for c in (medium, low, high))
        text = (
            f"Môi trường {row[medium]}: nồng độ tối thiểu theo lý thuyết {row[low]} {unit_low}, "
            f"nồng độ thực nghiệm {row[high]} {unit_low}, {verdict} điều kiện sink. {tags}"
        )
        blocks.append({"type": "paragraph", "text": text})
    return blocks


def data_sections(trial: TrialData | None) -> dict[str, dict[str, Any]]:
    """Section id to a covered section, for every section the data can fill."""
    if trial is None:
        return {}
    blocks = [b for table in trial.of_kind("sink_condition") for b in _sink_rows(table)]
    if not any(b["text"].find("[dữ liệu:") >= 0 for b in blocks):
        return {}
    return {SINK_SECTION: {"id": SINK_SECTION, "status": "covered", "blocks": blocks}}
