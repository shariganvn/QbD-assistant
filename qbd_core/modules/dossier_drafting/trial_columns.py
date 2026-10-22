"""Labels of a trial table's columns: which are the reference product, and which strength.

The reference product (RMP) is found from the tables, never named in code. A column is the
reference product when its label says so (RMP, reference, đối chiếu), or when it carries the brand
name that the team's own comparison tables put against the product under development: in a table
with a column that names the substance and a strength, a column that names a strength but not the
substance is the comparator, and its brand name is the one used. Two different brand names found
this way are not resolved; no brand is chosen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from qbd_core.modules.evidence.api import TrialData, TrialTable

REFERENCE_WORDS = ("rmp", "reference", "đối chiếu", "originator", "biệt dược gốc")
MIN_SUBSTANCE_WORD = 5
BRAND_END = re.compile(r"\d|\bbatch\b|\blô\b|\bfilm\b|\btablets?\b|\(|:", re.IGNORECASE)
MARKS = "®™*†‡#"


@dataclass(frozen=True)
class Rmp:
    names: tuple[str, ...] = ()  # folded brand names taken as the reference product
    shown: str | None = None  # the brand as written in the table
    where: tuple[str, ...] = ()  # tables the name was found in
    note: str | None = None  # why no name was chosen


def fold(text: str) -> str:
    return " ".join(text.translate({ord(c): None for c in MARKS}).lower().split())


def is_reference(label: str, names: tuple[str, ...] = ()) -> bool:
    low = fold(label)
    return any(w in low for w in REFERENCE_WORDS) or any(n in low for n in names)


def named_strength(label: str, strengths: tuple[str, ...]) -> str | None:
    """The longest declared strength the label contains ("10 mg" before "0 mg")."""
    hits = [s for s in strengths if s in label]
    return max(hits, key=len) if hits else None


def _labels(table: TrialTable) -> list[str]:
    labels = [h for h in table.headers if h.strip()]
    for row in table.rows[:3]:
        if row and not row[0].strip():
            labels += [c for c in row[1:] if c.strip()]
    for row in table.rows:  # a product name alone on its row heads a block of statistics rows
        if row and row[0].strip() and not any(c.strip() for c in row[1:]):
            labels.append(row[0])
    return labels


def _brand(label: str) -> str | None:
    cut = BRAND_END.search(label)
    text = label[: cut.start()] if cut else label
    text = text.translate({ord(c): None for c in MARKS}).strip()
    return text if len(text) >= 3 and text.replace(" ", "").isalpha() else None


def rmp_names(trial: TrialData | None, substance: str, strengths: tuple[str, ...]) -> Rmp:
    if trial is None or not strengths:
        return Rmp()
    words = [w for w in fold(substance).split() if len(w) >= MIN_SUBSTANCE_WORD]
    if not words:
        return Rmp()
    found: dict[str, tuple[str, list[str]]] = {}
    for table in trial.tables:
        labels = [x for x in _labels(table) if named_strength(x, strengths)]
        own = [x for x in labels if any(w in fold(x) for w in words)]
        others = [x for x in labels if x not in own and not is_reference_word_only(x)]
        if not own:
            continue
        for label in others:
            brand = _brand(label)
            if brand:
                shown, tables = found.setdefault(fold(brand), (brand, []))
                tables.append(f"{table.file}, bảng {table.index}")
    if not found:
        return Rmp()
    if len(found) > 1:
        names = ", ".join(sorted(shown for shown, _ in found.values()))
        return Rmp(note=f"nhiều tên thương mại cùng đứng cạnh sản phẩm ({names}); không chọn")
    key, (shown, tables) = next(iter(found.items()))
    return Rmp(names=(key,), shown=shown, where=tuple(dict.fromkeys(tables)))


def is_reference_word_only(label: str) -> bool:
    """A label that already says "reference" needs no brand."""
    return any(w in fold(label) for w in REFERENCE_WORDS)
