"""Assemble the orientation draft: every section is a gap unless internal evidence covers it."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from qbd_core.modules.dossier_drafting import config
from qbd_core.modules.dossier_drafting.cqa import (
    ConfirmedCqa,
    CqaConfirmation,
    CqaNotConfirmed,
    require_confirmation,
)
from qbd_core.modules.dossier_drafting.models import COMBINATION_OUT_OF_SOP, IntakeResult
from qbd_core.modules.dossier_drafting.outline import (
    leaf_sections,
    load_outline,
    per_strength_beyond_first,
)
from qbd_core.modules.evidence.api import KnowledgePort
from qbd_core.shared.contracts import Classification, EvidenceRecord, GapEntry

GAP_LABEL = "[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]"
# Free-form sections the slice may fill from retrieved sentences. {substance} is the only variable.
SECTION_QUERIES = {
    "P.2.1.1.2": "{substance} phân loại BCS tính thấm sinh khả dụng",
    "P.2.2.2": "{substance} lượng đóng dư overage",
    "P.2.6": "{substance} tương thích dung môi pha loãng",
}
HITS_PER_SECTION = 3
CQA_SECTION = "P.2.2.1.2.2"


class DraftingRefused(Exception):  # noqa: N818 - reads as a verdict, not an error class
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class DraftRun:
    intake: IntakeResult
    draft: dict[str, Any]
    evidence: tuple[EvidenceRecord, ...]
    gaps: tuple[GapEntry, ...]
    # True when a sentence of a class-B, class-C or unclassified document is in the draft text.
    contains_restricted: bool
    # "pending" until a person confirms the CQA set; sections that need it stay gaps meanwhile.
    cqa_status: str = "pending"
    confirmed_cqa: ConfirmedCqa | None = None


def _group_reason(section_id: str, group_id: str) -> str:
    reasons = [
        g.reason for g in config.group_gaps(group_id) if section_id.startswith(g.section_id + ".")
    ]
    return " ".join(reasons)


def _confirmed(
    intake: IntakeResult, confirmation: CqaConfirmation | None, today: date
) -> ConfirmedCqa | None:
    """No confirmation leaves the CQA-dependent sections open; a wrong one stops the run."""
    try:
        return require_confirmation(intake, confirmation, today)
    except CqaNotConfirmed as error:
        if error.code == "E_CQA_NOT_CONFIRMED":
            return None
        raise


def _cqa_blocks(confirmed: ConfirmedCqa, intake: IntakeResult) -> list[dict[str, str]]:
    intro = (
        f"Bộ CQA do {confirmed.confirmed_by} xác nhận ngày {confirmed.confirmed_on.isoformat()}, "
        f"đề xuất ban đầu theo nhóm dạng bào chế {intake.group}: {'; '.join(confirmed.cqa)}."
    )
    blocks = [{"type": "paragraph", "text": intro}]
    if confirmed.added_by_person:
        added = "; ".join(confirmed.added_by_person)
        blocks.append(
            {"type": "paragraph", "text": f"Do người xác nhận bổ sung ngoài đề xuất: {added}."}
        )
    blocks += [
        {
            "type": "paragraph",
            "text": f"{name}: {GAP_LABEL} biện luận mức trọng yếu và cách kiểm soát.",
        }
        for name in confirmed.cqa
    ]
    return blocks


def _paragraph(record: EvidenceRecord) -> dict[str, str]:
    prov = record.provenance
    return {
        "type": "paragraph",
        "text": f"{record.text} [nguồn: {prov.file}, trang {prov.page}, {record.id}]",
    }


def assemble_draft(
    intake: IntakeResult,
    knowledge: KnowledgePort,
    today: date,
    outline: dict[str, Any] | None = None,
    confirmation: CqaConfirmation | None = None,
) -> DraftRun:
    if COMBINATION_OUT_OF_SOP in intake.scope_flags:
        raise DraftingRefused("E_COMBINATION_NOT_SUPPORTED")
    outline = outline or load_outline()
    confirmed = _confirmed(intake, confirmation, today)
    substance = intake.request.substances[0]
    used: dict[str, EvidenceRecord] = {}
    sections: list[dict[str, Any]] = []
    gaps: list[GapEntry] = []
    not_applicable = set(per_strength_beyond_first(outline))
    for section in leaf_sections(outline):
        sid = section["id"]
        if sid in not_applicable:
            reason = "Không áp dụng: bản định hướng chưa khai hàm lượng thứ hai trở đi."
            sections.append({"id": sid, "status": "gap", "gapReason": reason})
            continue
        if sid == CQA_SECTION and confirmed:
            sections.append(
                {"id": sid, "status": "covered", "blocks": _cqa_blocks(confirmed, intake)}
            )
            continue
        template = SECTION_QUERIES.get(sid)
        hits = (
            knowledge.search(template.format(substance=substance), HITS_PER_SECTION)
            if template
            else []
        )
        if hits:
            used.update({h.id: h for h in hits})
            sections.append(
                {"id": sid, "status": "covered", "blocks": [_paragraph(h) for h in hits]}
            )
            continue
        reason = "chưa có bằng chứng nội bộ và chưa có agent soạn mục này"
        if sid == CQA_SECTION:
            reason = "bộ CQA chưa được người xác nhận ở cổng 3.5"
        extra = _group_reason(sid, intake.group)
        sections.append(
            {"id": sid, "status": "gap", "gapReason": f"{GAP_LABEL} {reason}. {extra}".strip()}
        )
        gaps.append(GapEntry(section_id=sid, reason=f"{reason}. {extra}".strip()))
    evidence = tuple(used.values())
    cited = sorted({r.provenance.file for r in evidence})
    meta: dict[str, Any] = {
        "productName": f"{substance} – {intake.request.dosage_form}",
        "apiName": substance,
        "strengths": [f"{GAP_LABEL} hàm lượng"],
        "sourceFiles": [f"{GAP_LABEL} chưa có file thử nghiệm"],
        "draftDate": today.isoformat(),
        "assembledBy": "qbd_core, bản định hướng từ ba đầu vào, chưa FD duyệt",
        "extractionMethod": "xml-walk",
        "notApplicableSections": sorted(not_applicable),
    }
    if cited:
        meta["referenceSources"] = [f"Kho tài liệu nội bộ, file {file}" for file in cited]
    draft = {"schemaVersion": "1.0", "meta": meta, "sections": sections}
    restricted = any(r.classification is not Classification.A for r in evidence)
    status = "confirmed" if confirmed else "pending"
    return DraftRun(intake, draft, evidence, tuple(gaps), restricted, status, confirmed)
