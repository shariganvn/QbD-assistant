"""Appendix C of the SOP: coverage items 1-14 and the mechanical items 15-17."""

from __future__ import annotations

import json
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.modules.quality_gate.models import ChecklistItem, Finding, NumberingRow
from qbd_core.shared.markers import kind_of, spots

PROVENANCE_CODES = {
    "E_UNSOURCED_TEXT", "E_VALUE_WITHOUT_SOURCE", "E_SOURCE_MISMATCH", "E_SOURCE_UNVERIFIED",
    "E_DUPLICATE_EVIDENCE", "E_REFERENCE_MISSING", "E_CLAIM_NUMBER_UNSUPPORTED",
}  # fmt: skip
CONSISTENCY_CODES = {
    "E_META_MISMATCH", "E_GAP_REGISTER_MISMATCH", "E_CQA_UNCONFIRMED_CONTENT",
    "E_RESTRICTED_FLAG_MISMATCH",
}  # fmt: skip


@cache
def appendix_c() -> dict[str, Any]:
    text = files("qbd_core.modules.quality_gate").joinpath("config", "appendix_c.json")
    return json.loads(text.read_text("utf-8"))


def _section_state(section: dict[str, Any] | None) -> str:
    if section is None:
        return "open"
    if section["status"] == "gap" and kind_of(section["gapReason"]) is None:
        return "na"
    marked = any(kind_of(text) for _, text in spots(section))
    return "open" if marked else "covered"


def _item(entry: dict[str, Any], status: str, detail: str) -> ChecklistItem:
    return ChecklistItem(no=entry["no"], text=entry["text"], status=status, detail=detail)


def coverage_items(draft: dict[str, Any], numbering: tuple[NumberingRow, ...]):
    by_id = {s["id"]: s for s in draft["sections"]}
    skipped = {r.section_id for r in numbering if r.requirement == "not_required"}
    items = []
    for entry in appendix_c()["coverage_items"]:
        states = {
            sid: _section_state(by_id.get(sid)) for sid in entry["sections"] if sid not in skipped
        }
        open_ids = sorted(sid for sid, state in states.items() if state == "open")
        if not states or all(state == "na" for state in states.values()):
            status, detail = "na", "không áp dụng cho dạng bào chế hoặc thị trường này"
        elif open_ids:
            status, detail = "open", f"{len(open_ids)}/{len(states)} mục còn khoảng trống"
        else:
            status, detail = "review", "đủ nội dung; người rà soát xác nhận"
        items.append(
            ChecklistItem(no=entry["no"], text=entry["text"], status=status, detail=detail)
        )
    return items


def mechanical_items(findings: list[Finding], market_has_actd: bool, map_verified: bool):
    codes = {f.code for f in findings if f.severity == "block"}
    texts = {m["check"]: m for m in appendix_c()["mechanical_items"]}
    items = []
    for check, bad, note in (
        ("numbering", {"E_NUMBERING_UNMAPPED"}, ""),
        ("provenance", PROVENANCE_CODES, ""),
        ("consistency", CONSISTENCY_CODES, ""),
    ):
        entry = texts[check]
        status, detail = ("fail", "xem findings") if codes & bad else ("pass", note)
        if check == "numbering" and status == "pass" and market_has_actd and not map_verified:
            status, detail = "review", "ánh xạ ACTD lấy từ SOP, chưa đối chiếu Phụ lục I và TT32"
        items.append(
            ChecklistItem(no=entry["no"], text=entry["text"], status=status, detail=detail)
        )
    return items
