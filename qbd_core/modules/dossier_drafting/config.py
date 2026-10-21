"""Read-only access to the dosage-form catalogue, group data and CTD/ACTD numbering."""

from __future__ import annotations

import json
import unicodedata
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.shared.contracts import GAP_MARKER, GapEntry

_NO_INTERNAL_DOCS = (
    ("P.2.2.1", "technology choice: Appendix B.2 gives no basis for this group"),
    ("P.2.2.3", "equivalence direction (BE or waiver): no internal document for this group"),
    ("P.2.2.3", "surrogate for dissolution: no internal document for this group"),
)


def _load(name: str) -> dict[str, Any]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", name).read_text("utf-8")
    return json.loads(text)


def normalise(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).casefold().split())


@cache
def forms() -> tuple[dict[str, str], ...]:
    return tuple(_load("dosage_forms.json")["forms"])


@cache
def groups() -> dict[str, dict[str, Any]]:
    return {g["id"]: g for g in _load("groups.json")["groups"]}


@cache
def section_map() -> tuple[dict[str, Any], ...]:
    return tuple(_load("ctd_actd_map.json")["sections"])


def find_form(raw: str) -> dict[str, str] | None:
    """Match by id (F09), by number (9) or by name, ignoring case and spacing."""
    key = normalise(raw)
    if key.isdigit():
        key = f"f{int(key):02d}"
    for form in forms():
        if key in (form["id"].casefold(), normalise(form["name"])):
            return form
    return None


def group_gaps(group_id: str) -> tuple[GapEntry, ...]:
    """Gaps owed by a group with no internal document; empty for groups that have one."""
    if groups()[group_id]["internal_documents"]:
        return ()
    return tuple(
        GapEntry(section_id=section, reason=f"{GAP_MARKER}: {reason}", owner="Trưởng bộ phận R&D")
        for section, reason in _NO_INTERNAL_DOCS
    )
