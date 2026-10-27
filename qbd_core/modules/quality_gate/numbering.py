"""Section numbers per market: CTD for the EU, ACTD for the domestic market, both for both."""

from __future__ import annotations

from typing import Any

from qbd_core.modules.dossier_drafting.api import leaf_sections, parent_sections, section_map
from qbd_core.modules.quality_gate.models import Finding, NumberingRow, Requirement
from qbd_core.shared.contracts import Market

_NOTE_TO_REQUIREMENT: tuple[tuple[str, Requirement], ...] = (
    ("Bắt buộc", "mandatory"),
    ("Tài liệu khoa học", "literature"),
    ("Không yêu cầu", "not_required"),
    ("Mục đánh dấu", "recommended"),
)


def _entry_for(section_id: str) -> dict[str, Any] | None:
    best = None
    for entry in section_map():
        ctd = entry["ctd"]
        if ctd and (section_id == ctd or section_id.startswith(ctd + ".")):
            if best is None or len(ctd) > len(best["ctd"]):
                best = entry
    return best


def _requirement(market: Market, entry: dict[str, Any]) -> Requirement:
    if market is Market.EU:
        return "required"
    note = entry["generic_actd_note"]
    return next(
        (req for prefix, req in _NOTE_TO_REQUIREMENT if note.startswith(prefix)), "required"
    )


def numbering_for(
    market: Market, outline: dict[str, Any]
) -> tuple[tuple[NumberingRow, ...], list[Finding]]:
    rows, findings = [], []
    for section in leaf_sections(outline):
        entry = _entry_for(section["id"])
        if entry is None:
            findings.append(
                Finding(code="E_NUMBERING_UNMAPPED", severity="block", section_id=section["id"])
            )
            continue
        actd = None if market is Market.EU else entry["actd"]
        rows.append(
            NumberingRow(
                section_id=section["id"],
                ctd=section["ctdReference"],
                actd=actd,
                requirement=_requirement(market, entry),
            )
        )
    return tuple(rows), findings


def actd_numbers(market: Market, outline: dict[str, Any]) -> dict[str, str]:
    """ACTD number of the headings that sit at a mapped level, for this market; empty for the EU.

    Deeper headings belong to the mapped section above them and carry no number of their own."""
    if market is Market.EU:
        return {}
    numbers = {e["ctd"]: e["actd"] for e in section_map() if e["ctd"]}
    numbers.update({p["ctd"]: p["actd"] for p in parent_sections()})
    ids = {s["id"] for s in outline["sections"]}
    return {section: actd for section, actd in numbers.items() if section in ids}
