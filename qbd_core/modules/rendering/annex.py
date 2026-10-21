"""Registers derived from the draft's own markers, so they cannot disagree with it."""

from __future__ import annotations

from typing import Any

from qbd_core.shared.markers import kind_of, spots

OTHER = "Khác"


def collect(draft: dict[str, Any], outline: dict[str, Any]):
    """Return (data requests grouped by experiment, decisions), in outline order."""
    by_id = {s["id"]: s for s in draft["sections"]}
    requests: dict[str, list[tuple[str, str, str]]] = {}
    decisions: list[tuple[str, str, str]] = []
    for entry in outline["sections"]:
        section = by_id.get(entry["id"])
        if section is None:
            continue
        experiment = ((entry.get("form") or {}).get("workOrder") or {}).get("experiment", OTHER)
        for where, text in spots(section):
            kind = kind_of(text)
            if kind == "gap":
                requests.setdefault(experiment, []).append((entry["ctdReference"], where, text))
            elif kind == "decision":
                decisions.append((entry["ctdReference"], where, text))
    return requests, decisions
