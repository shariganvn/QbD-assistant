"""Labels of a trial table's columns: which are the reference product, and which strength."""

from __future__ import annotations

REFERENCE_WORDS = ("rmp", "reference", "đối chiếu", "originator", "biệt dược gốc")


def is_reference(label: str) -> bool:
    return any(word in label.lower() for word in REFERENCE_WORDS)


def named_strength(label: str, strengths: tuple[str, ...]) -> str | None:
    """The longest declared strength the label contains ("10 mg" before "0 mg")."""
    hits = [s for s in strengths if s in label]
    return max(hits, key=len) if hits else None
