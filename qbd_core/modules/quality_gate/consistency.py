"""The draft must agree with the input it was built from and with its own registers."""

from __future__ import annotations

from typing import Any

from qbd_core.modules.dossier_drafting.api import CQA_SECTION, DraftRun
from qbd_core.modules.quality_gate.models import Finding
from qbd_core.shared.contracts import Classification
from qbd_core.shared.markers import kind_of


def _block(code: str, section_id: str | None = None, detail: str = "") -> Finding:
    return Finding(code=code, severity="block", section_id=section_id, detail=detail)


def _norm(text: str) -> str:
    return " ".join(text.casefold().split())


def marked_gap_ids(draft: dict[str, Any]) -> set[str]:
    return {
        s["id"]
        for s in draft["sections"]
        if s["status"] == "gap" and kind_of(s["gapReason"]) == "gap"
    }


def check_consistency(run: DraftRun) -> list[Finding]:
    meta, request = run.draft["meta"], run.intake.request
    findings = []
    if _norm(meta["apiName"]) != _norm(request.substances[0]):
        findings.append(_block("E_META_MISMATCH", None, "apiName"))
    product = _norm(meta["productName"])
    if _norm(request.substances[0]) not in product or _norm(request.dosage_form) not in product:
        findings.append(_block("E_META_MISMATCH", None, "productName"))
    registered = {g.section_id for g in run.gaps}
    in_draft = marked_gap_ids(run.draft)
    for sid in sorted(in_draft ^ registered):
        findings.append(_block("E_GAP_REGISTER_MISMATCH", sid))
    by_id = {s["id"]: s for s in run.draft["sections"]}
    cqa = by_id.get(CQA_SECTION)
    if cqa and cqa["status"] == "covered" and run.cqa_status != "confirmed":
        findings.append(_block("E_CQA_UNCONFIRMED_CONTENT", CQA_SECTION))
    restricted = any(r.classification is not Classification.A for r in run.evidence)
    if restricted != run.contains_restricted:
        findings.append(_block("E_RESTRICTED_FLAG_MISMATCH"))
    if restricted:
        findings.append(
            Finding(code="I_RESTRICTED_TEXT", severity="info", detail="keep the draft local")
        )
    return findings
