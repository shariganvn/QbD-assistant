"""Assemble the orientation draft: every section is a gap unless internal evidence covers it."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from qbd_core.modules.dossier_drafting import config
from qbd_core.modules.dossier_drafting.agents import api_properties, excipients, narrative, qtpp
from qbd_core.modules.dossier_drafting.agents.llm import LlmSetup
from qbd_core.modules.dossier_drafting.agents.registry import (
    agents_for_section,
    provisional_decisions,
    status_of,
)
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
from qbd_core.modules.evidence.api import KnowledgePort, TrialData
from qbd_core.shared.contracts import Classification, EvidenceRecord, GapEntry
from qbd_core.shared.markers import GAP_LABEL

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
    # One line per agent that was started or held back, for the report; never part of the draft.
    agent_log: tuple[str, ...] = ()


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


def _agent_note(section_id: str, ran: set[str]) -> str:
    agents = agents_for_section(section_id)
    if not agents:
        return "chưa có agent phụ trách mục này"
    notes = []
    for agent in agents:
        status, why = status_of(agent.id)
        if status == "pending":
            notes.append(f"agent {agent.id} ({agent.name}) chưa được dựng")
        elif status == "blocked":
            notes.append(f"agent {agent.id} ({agent.name}) bị chặn: {why}")
        elif agent.id in ran:
            notes.append(f"agent {agent.id} đã chạy nhưng chưa có kết quả dùng được")
        else:
            notes.append(f"agent {agent.id} ({agent.name}) cần nhà cung cấp mô hình, chưa cấu hình")
    return "; ".join(notes)


def _property_rows(outline: dict[str, Any]) -> list[str]:
    section = next(s for s in outline["sections"] if s["id"] == api_properties.PROPERTIES_SECTION)
    return list(section["form"]["tables"][0]["rows"])


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
    llm: LlmSetup | None = None,
    trial: TrialData | None = None,
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
    agent_log: list[str] = []
    ran: set[str] = set()
    by_agent: dict[str, dict[str, Any]] = {}
    if llm is not None:
        labels = _property_rows(outline)
        result = api_properties.run(llm, intake, knowledge, labels)
        ran.add(api_properties.AGENT_ID)
        by_agent = result.sections
        used.update(result.cited)
        agent_log += result.notes or [f"agent {api_properties.AGENT_ID}: ran"]
        plan = qtpp.run(llm, intake, knowledge)
        ran.add(qtpp.AGENT_ID)
        by_agent.update(plan.sections)
        used.update(plan.cited)
        agent_log += plan.notes or [f"agent {qtpp.AGENT_ID}: ran"]
        picked = excipients.run(llm, intake, knowledge)
        ran.add(excipients.AGENT_ID)
        by_agent.update(picked.sections)
        used.update(picked.cited)
        agent_log += picked.notes or [f"agent {excipients.AGENT_ID}: ran"]
        for spec in narrative.specs():
            found = narrative.run(spec, llm, intake, knowledge)
            ran.add(spec.id)
            by_agent.update(found.sections)
            used.update(found.cited)
            agent_log += found.notes or [f"agent {spec.id}: ran"]
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
        if sid in by_agent:
            sections.append(by_agent[sid])
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
        reason = f"chưa có bằng chứng nội bộ; {_agent_note(sid, ran)}"
        if sid == CQA_SECTION:
            reason = "bộ CQA chưa được người xác nhận ở cổng 3.5"
        extra = _group_reason(sid, intake.group)
        sections.append(
            {"id": sid, "status": "gap", "gapReason": f"{GAP_LABEL} {reason}. {extra}".strip()}
        )
        gaps.append(GapEntry(section_id=sid, reason=f"{reason}. {extra}".strip()))
    if trial is not None:
        counts = {t.kind for t in trial.tables if t.kind}
        agent_log.append(
            f"agent 1.3: {len(trial.files)} file, {len(trial.tables)} bảng, "
            f"{len(trial.tables) - len(trial.unrecognized)} nhận dạng ({', '.join(sorted(counts))})"
        )
        agent_log += [f"agent 1.3: chưa nhận dạng, {item}" for item in trial.unrecognized]
    agent_log += [f"A13: {item}" for item in provisional_decisions()]
    evidence = tuple(used.values())
    cited = sorted({r.provenance.file for r in evidence})
    meta: dict[str, Any] = {
        "productName": f"{substance} – {intake.request.dosage_form}",
        "apiName": substance,
        "strengths": [f"{GAP_LABEL} hàm lượng"],
        "sourceFiles": (
            [name for name, _ in trial.files]
            if trial is not None and trial.files
            else [f"{GAP_LABEL} chưa có file thử nghiệm"]
        ),
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
    return DraftRun(
        intake, draft, evidence, tuple(gaps), restricted, status, confirmed, tuple(agent_log)
    )
