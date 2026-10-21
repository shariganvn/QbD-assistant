"""The P.2 outline owned by tools/pharma-dev-draft. Read as data; its code is never imported."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEFAULT_OUTLINE = (
    Path(__file__).resolve().parents[3]
    / "tools"
    / "pharma-dev-draft"
    / "schemas"
    / "p2-outline.json"
)


def load_outline(path: str | Path = DEFAULT_OUTLINE) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def leaf_sections(outline: dict[str, Any]) -> list[dict[str, Any]]:
    """Sections the draft must hold an entry for; containers carry a heading and nothing else."""
    return [s for s in outline["sections"] if not s.get("container")]


def per_strength_beyond_first(outline: dict[str, Any]) -> list[str]:
    """Sections that report a second or later strength, which an unknown-strength draft lacks."""
    return [
        s["id"]
        for s in leaf_sections(outline)
        if (s.get("form") or {}).get("strengthIndex", 0) >= 1
    ]


def per_strength_beyond(outline: dict[str, Any], count: int) -> list[str]:
    """Per-strength sections for strength positions beyond the `count` declared strengths."""
    return [
        s["id"]
        for s in leaf_sections(outline)
        if (s.get("form") or {}).get("strengthIndex", 0) >= count
    ]


def most_strength_sections(outline: dict[str, Any]) -> int:
    """How many strengths one per-strength family of the outline can report."""
    families: dict[str, int] = {}
    for s in leaf_sections(outline):
        if "strengthIndex" in (s.get("form") or {}):
            parent = s["id"].rsplit(".", 1)[0]
            families[parent] = families.get(parent, 0) + 1
    return min(families.values()) if families else 1
