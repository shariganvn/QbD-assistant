"""CQA proposal and the confirmation gate. A person confirms; the code only checks the record."""

from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError

from qbd_core.modules.dossier_drafting import config
from qbd_core.modules.dossier_drafting.models import IntakeResult
from qbd_core.shared.contracts import Strict

CqaCode = Literal[
    "E_CQA_NOT_CONFIRMED", "E_CQA_WRONG_INPUT", "E_CQA_EMPTY", "E_CQA_INVALID", "E_CQA_UNSIGNED"
]


class CqaNotConfirmed(Exception):  # noqa: N818 - reads as a verdict, not an error class
    def __init__(self, code: CqaCode) -> None:
        super().__init__(code)
        self.code = code


def intake_digest(intake: IntakeResult) -> str:
    """Identifies the exact input a confirmation was given for. Substance order does not matter."""
    request = intake.request
    canonical = {
        "substances": sorted(config.normalise(s) for s in request.substances),
        "form_id": intake.form_id,
        "market": request.market.value,
    }
    text = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class CqaProposal(Strict):
    intake_digest: str
    group: str
    form_id: str
    status: Literal["candidate_unconfirmed"] = "candidate_unconfirmed"
    candidates: tuple[str, ...]
    confirmation_template: dict[str, object]


class CqaConfirmation(Strict):
    intake_digest: str
    confirmed_cqa: tuple[str, ...] = ()
    confirmed_by: str | None = None
    confirmed_on: date | None = None


class ConfirmedCqa(Strict):
    cqa: tuple[str, ...] = Field(min_length=1)
    added_by_person: tuple[str, ...]
    confirmed_by: str
    confirmed_on: date


def propose_cqa(intake: IntakeResult) -> CqaProposal:
    group = config.groups()[intake.group]
    candidates = tuple(dict.fromkeys([*group["base"], *group["specific"]]))
    digest = intake_digest(intake)
    template = {
        "intake_digest": digest,
        "confirmed_cqa": [],
        "confirmed_by": None,
        "confirmed_on": None,
    }
    return CqaProposal(
        intake_digest=digest,
        group=intake.group,
        form_id=intake.form_id,
        candidates=candidates,
        confirmation_template=template,
    )


def load_confirmation(path: str | Path | None) -> CqaConfirmation | None:
    """None for a missing or unreadable file; the gate then reports the CQA as not confirmed."""
    if path is None:
        return None
    try:
        return CqaConfirmation.model_validate_json(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValidationError, ValueError):
        return None


def require_confirmation(
    intake: IntakeResult, confirmation: CqaConfirmation | None, today: date
) -> ConfirmedCqa:
    if confirmation is None:
        raise CqaNotConfirmed("E_CQA_NOT_CONFIRMED")
    if confirmation.intake_digest != intake_digest(intake):
        raise CqaNotConfirmed("E_CQA_WRONG_INPUT")
    names = tuple(n.strip() for n in confirmation.confirmed_cqa)
    if not names:
        raise CqaNotConfirmed("E_CQA_EMPTY")
    if not all(names) or len({config.normalise(n) for n in names}) != len(names):
        raise CqaNotConfirmed("E_CQA_INVALID")
    by, on = (confirmation.confirmed_by or "").strip(), confirmation.confirmed_on
    if not by or on is None or on > today:
        raise CqaNotConfirmed("E_CQA_UNSIGNED")
    known = {config.normalise(c) for c in propose_cqa(intake).candidates}
    added = tuple(n for n in names if config.normalise(n) not in known)
    return ConfirmedCqa(cqa=names, added_by_person=added, confirmed_by=by, confirmed_on=on)
