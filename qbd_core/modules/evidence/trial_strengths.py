"""Which strengths the product has, read from the headers of the team's composition tables.

The three inputs do not name strengths, and the draft must not invent them. A composition table
heads each strength's column with its label ("... 5 mg", "... 10 mg"). All composition tables must
agree on the set; if they differ, or the units are mixed, nothing is declared and the reason is
reported.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from qbd_core.modules.evidence.trial_intake import TrialData

STRENGTH = re.compile(r"(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|ml|iu)", re.IGNORECASE)


@dataclass(frozen=True)
class Strengths:
    strengths: tuple[str, ...] = ()
    conflict: str | None = None
    sources: tuple[str, ...] = ()


def _labels(headers: tuple[str, ...]) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2).lower()) for h in headers for m in [STRENGTH.search(h)] if m]


def _value(number: str) -> float:
    return float(number.replace(",", "."))


def read_strengths(trial: TrialData | None) -> Strengths:
    """Declared strengths in ascending order, or none and the reason."""
    if trial is None:
        return Strengths()
    found: dict[str, tuple[tuple[str, str], ...]] = {}
    for table in trial.of_kind("composition"):
        labels = _labels(table.headers)
        if labels:
            found[f"{table.file}, bảng {table.index}"] = tuple(labels)
    if not found:
        return Strengths()
    sets = {frozenset(labels) for labels in found.values()}
    if len(sets) > 1:
        detail = "; ".join(f"{where}: {len(labels)} cột" for where, labels in sorted(found.items()))
        return Strengths(conflict=f"các bảng công thức nêu hàm lượng khác nhau ({detail})")
    labels = next(iter(found.values()))
    if len({unit for _, unit in labels}) > 1:
        return Strengths(conflict="các hàm lượng khác đơn vị")
    if len({_value(n) for n, _ in labels}) != len(set(labels)):
        return Strengths(conflict="một hàm lượng viết theo hai cách")
    ordered = sorted(set(labels), key=lambda item: _value(item[0]))
    texts = tuple(f"{number} {unit}" for number, unit in ordered)
    return Strengths(strengths=texts, sources=tuple(sorted(found)))
