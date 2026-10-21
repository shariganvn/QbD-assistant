"""Run every deterministic check on a draft run. No language model takes part."""

from __future__ import annotations

from typing import Any

from qbd_core.modules.dossier_drafting.api import DraftRun, load_outline, section_map_verified
from qbd_core.modules.evidence.api import KnowledgePort
from qbd_core.modules.quality_gate.checklist import coverage_items, mechanical_items
from qbd_core.modules.quality_gate.consistency import check_consistency
from qbd_core.modules.quality_gate.models import Finding, QualityReport
from qbd_core.modules.quality_gate.numbering import numbering_for
from qbd_core.modules.quality_gate.provenance import check_provenance
from qbd_core.shared.contracts import Market


def evaluate_run(
    run: DraftRun, knowledge: KnowledgePort, outline: dict[str, Any] | None = None
) -> QualityReport:
    outline = outline or load_outline()
    market = run.intake.request.market
    numbering, findings = numbering_for(market, outline)
    findings += check_provenance(
        run.draft,
        run.evidence,
        knowledge,
        cqa_confirmed=run.cqa_status == "confirmed",
        trial=run.trial,
    )
    findings += check_consistency(run)
    verified = section_map_verified()
    if market is not Market.EU and not verified:
        findings.append(
            Finding(code="I_ACTD_MAP_UNVERIFIED", severity="info", detail="SOP appendix A only")
        )
    checklist = [
        *coverage_items(run.draft, numbering),
        *mechanical_items(findings, market is not Market.EU, verified),
    ]
    return QualityReport(
        findings=tuple(findings),
        checklist=tuple(sorted(checklist, key=lambda item: item.no)),
        numbering=numbering,
        actd_map_verified=verified,
    )
