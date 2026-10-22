"""Arithmetic on the team's numbers. Code only: a model never calculates a published value."""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from functools import cache
from importlib.resources import files

F2_MIN_POINTS = 3
F2_PLATEAU = 85.0


@cache
def cap_percent() -> float | None:
    """The ceiling the owner set for a dissolution value in f2, or None for no ceiling."""
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "calc_rules.json")
    value = json.loads(text.read_text("utf-8")).get("dissolution_cap_percent")
    return None if value is None else float(value)


def exceeds_cap(*profiles: Sequence[float]) -> bool:
    cap = cap_percent()
    return cap is not None and any(v > cap for p in profiles for v in p)


class CalcError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def mean(values: Sequence[float]) -> float:
    if not values:
        raise CalcError("E_CALC_EMPTY")
    return math.fsum(values) / len(values)


def rsd_percent(values: Sequence[float]) -> float:
    """Sample standard deviation over the mean, in percent."""
    if len(values) < 2:
        raise CalcError("E_RSD_TOO_FEW_VALUES")
    centre = mean(values)
    if centre == 0:
        raise CalcError("E_RSD_ZERO_MEAN")
    spread = math.sqrt(math.fsum((v - centre) ** 2 for v in values) / (len(values) - 1))
    return spread / centre * 100


def overage_percent(label_amount: float, charged_amount: float) -> float:
    """How far above the labelled amount the batch is charged, in percent of the label."""
    if label_amount <= 0 or charged_amount < 0:
        raise CalcError("E_OVERAGE_AMOUNT")
    return (charged_amount - label_amount) / label_amount * 100


def f2(reference: Sequence[float], test: Sequence[float]) -> float:
    """Similarity factor over paired time points, using points up to the first one at which
    both profiles are at 85 % or more. A value above the owner's ceiling counts as the ceiling.
    Fewer than three usable points, unequal lengths or a negative value are refused."""
    if len(reference) != len(test):
        raise CalcError("E_F2_LENGTH")
    cap = cap_percent()
    ceiling = 100.0 if cap is None else cap
    if any(v < 0 or (cap is None and v > ceiling) for v in (*reference, *test)):
        raise CalcError("E_F2_RANGE")
    if cap is not None:
        reference, test = [min(v, cap) for v in reference], [min(v, cap) for v in test]
    used = []
    for r, t in zip(reference, test, strict=True):
        used.append((r, t))
        if r >= F2_PLATEAU and t >= F2_PLATEAU:
            break
    if len(used) < F2_MIN_POINTS:
        raise CalcError("E_F2_TOO_FEW_POINTS")
    squared = math.fsum((r - t) ** 2 for r, t in used) / len(used)
    return 50 * math.log10(100 / math.sqrt(1 + squared))
