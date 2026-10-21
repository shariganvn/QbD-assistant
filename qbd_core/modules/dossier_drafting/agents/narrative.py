"""Narrative agents: sourced literature sentences for sections about the department's own work.

Which agents, sections and search terms exist is data (`config/narratives.json`). The model reads
only the evidence it is given and answers in JSON; code decides what is published. Each section
keeps a marked gap for the experimental part, so literature never stands in for a study.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.modules.dossier_drafting.agents.claims import (
    check_claim,
    covered,
    items_of,
    tagged,
)
from qbd_core.modules.dossier_drafting.agents.llm import AgentOutputError, LlmSetup, ask
from qbd_core.modules.dossier_drafting.models import IntakeResult
from qbd_core.modules.evidence.api import KnowledgePort
from qbd_core.shared.contracts import EvidenceRecord
from qbd_core.shared.markers import GAP_LABEL

HITS_PER_QUERY = 4
MAX_POOL = 14


@dataclass(frozen=True)
class NarrativeSpec:
    id: str
    name: str
    leads: dict[str, str]
    queries: tuple[str, ...]


@dataclass
class NarrativeResult:
    sections: dict[str, dict[str, Any]] = field(default_factory=dict)
    cited: dict[str, EvidenceRecord] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


@cache
def specs() -> tuple[NarrativeSpec, ...]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "narratives.json")
    import json

    return tuple(
        NarrativeSpec(
            id=a["id"],
            name=a["name"],
            leads={s["id"]: s["lead"] for s in a["sections"]},
            queries=tuple(a["queries"]),
        )
        for a in json.loads(text.read_text("utf-8"))["agents"]
    )


def instruction(spec: NarrativeSpec) -> str:
    ids = ", ".join(spec.leads)
    return (
        f"Bạn là agent {spec.name}. Chỉ dùng các đoạn bằng chứng có mã [E-...] dưới đây. Trả về "
        'MỘT đối tượng JSON: {"findings":[{"section":<một trong: '
        f'{ids}>,"text":<một câu>,"evidence_ids":[<mã>...]}}]}}. '
        "Mỗi câu chỉ nêu điều bằng chứng nói, không thêm số hay sự kiện nào ngoài bằng chứng, "
        "không kết luận thay cho nghiên cứu của phòng. Không có bằng chứng thì trả danh sách rỗng."
    )


def _candidates(
    spec: NarrativeSpec, intake: IntakeResult, knowledge: KnowledgePort
) -> list[EvidenceRecord]:
    substance, form = intake.request.substances[0], intake.request.dosage_form
    found: dict[str, EvidenceRecord] = {}
    for template in spec.queries:
        for record in knowledge.search(
            template.format(substance=substance, form=form), HITS_PER_QUERY
        ):
            found.setdefault(record.id, record)
    return list(found.values())[:MAX_POOL]


def run(
    spec: NarrativeSpec, setup: LlmSetup, intake: IntakeResult, knowledge: KnowledgePort
) -> NarrativeResult:
    result = NarrativeResult()
    tag = f"agent {spec.id}"
    try:
        answer = ask(
            setup, spec.id, instruction(spec), intake, _candidates(spec, intake, knowledge)
        )
    except AgentOutputError as error:
        result.notes.append(f"{tag}: {error.code}")
        return result
    if answer is None:
        result.notes.append(f"{tag}: no evidence may be sent to the provider")
        return result
    if answer.held_back:
        result.notes.append(f"{tag}: {answer.held_back} sources held back by egress")
    found: dict[str, list[str]] = {sid: [] for sid in spec.leads}
    for item in items_of(answer.data, "findings"):
        sid = item.get("section")
        if sid not in found or check_claim(item.get("text"), item.get("evidence_ids"), answer.pool):
            continue
        text = tagged(item["text"], item["evidence_ids"], answer.pool)
        if text not in found[sid]:
            found[sid].append(text)
            result.cited.update({i: answer.pool[i] for i in item["evidence_ids"]})
    for sid, texts in found.items():
        if texts:
            lead = {"type": "paragraph", "text": f"{GAP_LABEL} {spec.leads[sid]}."}
            blocks = [lead] + [{"type": "paragraph", "text": t} for t in texts]
            result.sections[sid] = covered(sid, blocks)
    return result
