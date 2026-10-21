"""Validate the three researcher inputs. Rejects, never repairs."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from qbd_core.modules.dossier_drafting import config
from qbd_core.modules.dossier_drafting.models import (
    COMBINATION_OUT_OF_SOP,
    IntakeIssue,
    IntakeRejected,
    IntakeResult,
)
from qbd_core.shared.contracts import IntakeRequest, Market

MAX_SUBSTANCES = 3
_FIELDS = ("substances", "dosage_form", "market")
_MARKETS = {
    "eu": Market.EU,
    "domestic": Market.DOMESTIC,
    "trong nước": Market.DOMESTIC,
    "both": Market.BOTH,
    "cả hai": Market.BOTH,
}


def _issue(code: str, field: str, detail: str) -> IntakeIssue:
    return IntakeIssue(code=code, field=field, detail=detail)  # type: ignore[arg-type]


def _substances(value: Any, issues: list[IntakeIssue]) -> tuple[str, ...]:
    if not isinstance(value, list | tuple) or not all(isinstance(v, str) for v in value):
        issues.append(_issue("E_FIELD_TYPE", "substances", "expected a list of strings"))
        return ()
    names = tuple(v.strip() for v in value)
    if not names or not all(names):
        issues.append(_issue("E_FIELD_MISSING", "substances", "at least one non-empty name"))
        return ()
    if len(names) > MAX_SUBSTANCES:
        issues.append(_issue("E_SUBSTANCE_COUNT", "substances", f"at most {MAX_SUBSTANCES}"))
    if len({config.normalise(n) for n in names}) != len(names):
        issues.append(_issue("E_SUBSTANCE_DUPLICATE", "substances", "same substance listed twice"))
    return names


def validate_intake(raw: Mapping[str, Any]) -> IntakeResult:
    issues: list[IntakeIssue] = [
        _issue("E_FIELD_UNKNOWN", key, "not an input field") for key in raw if key not in _FIELDS
    ]
    for field in _FIELDS:
        if raw.get(field) in (None, "", []):
            issues.append(_issue("E_FIELD_MISSING", field, "required"))
    names: tuple[str, ...] = ()
    if raw.get("substances") not in (None, "", []):
        names = _substances(raw["substances"], issues)

    form = market = None
    form_raw, market_raw = raw.get("dosage_form"), raw.get("market")
    if form_raw not in (None, ""):
        if not isinstance(form_raw, str):
            issues.append(_issue("E_FIELD_TYPE", "dosage_form", "expected a string"))
        elif (form := config.find_form(form_raw)) is None:
            issues.append(_issue("E_FORM_UNKNOWN", "dosage_form", "not one of the 38 forms"))
    if market_raw not in (None, ""):
        if not isinstance(market_raw, str):
            issues.append(_issue("E_FIELD_TYPE", "market", "expected a string"))
        elif (market := _MARKETS.get(config.normalise(market_raw))) is None:
            issues.append(_issue("E_MARKET_UNKNOWN", "market", "expected eu, domestic or both"))
    if issues or form is None or market is None:
        raise IntakeRejected(tuple(issues))

    flags = (COMBINATION_OUT_OF_SOP,) if len(names) > 1 else ()
    request = IntakeRequest(substances=names, dosage_form=form["name"], market=market)
    return IntakeResult(request=request, form_id=form["id"], group=form["group"], scope_flags=flags)
