"""Agent 3.2 (QTPP Builder): target quality attributes for P.2.2.1.2.1, each sentence sourced.

The model reads only the evidence it is given and answers in JSON; code decides what is published.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from qbd_core.modules.dossier_drafting.agents.claims import (
    check_claim,
    covered,
    items_of,
    tagged,
)
from qbd_core.modules.dossier_drafting.agents.llm import AgentOutputError, LlmSetup, ask
from qbd_core.modules.dossier_drafting.cqa import propose_cqa
from qbd_core.modules.dossier_drafting.models import IntakeResult
from qbd_core.modules.evidence.api import KnowledgePort
from qbd_core.shared.contracts import EvidenceRecord
from qbd_core.shared.markers import kind_of

AGENT_ID = "3.2"
SECTION = "P.2.2.1.2.1"
HEADERS = ["Chỉ tiêu", "Mục tiêu"]
HITS_PER_QUERY = 2
MAX_POOL = 14
MAX_ATTRIBUTE_CHARS = 120
INSTRUCTION = (
    "Bạn là agent QTPP Builder. Chỉ dùng các đoạn bằng chứng có mã [E-...] dưới đây. Trả về MỘT "
    'đối tượng JSON: {"items":[{"attribute":<tên chỉ tiêu chất lượng>,"target":<một câu nêu mục '
    'tiêu>,"evidence_ids":[<mã>...]}]}. Mỗi câu chỉ nêu điều bằng chứng nói, không thêm số hay sự '
    "kiện nào ngoài bằng chứng. Chỉ tiêu không có bằng chứng thì bỏ qua, không đoán."
)


@dataclass
class QtppResult:
    sections: dict[str, dict[str, Any]] = field(default_factory=dict)
    cited: dict[str, EvidenceRecord] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _candidates(intake: IntakeResult, knowledge: KnowledgePort) -> list[EvidenceRecord]:
    substance, form = intake.request.substances[0], intake.request.dosage_form
    queries = [f"{substance} {form} chỉ tiêu chất lượng"]
    queries += [f"{substance} {name}" for name in propose_cqa(intake).candidates]
    found: dict[str, EvidenceRecord] = {}
    for query in queries:
        for record in knowledge.search(query, HITS_PER_QUERY):
            found.setdefault(record.id, record)
    return list(found.values())[:MAX_POOL]


def _attribute_ok(text: object) -> bool:
    return (
        isinstance(text, str)
        and bool(text.strip())
        and len(text) <= MAX_ATTRIBUTE_CHARS
        and "\n" not in text
        and kind_of(text) is None
        and "[nguồn" not in text
        and "[tổng hợp" not in text
    )


def run(setup: LlmSetup, intake: IntakeResult, knowledge: KnowledgePort) -> QtppResult:
    result = QtppResult()
    candidates = _candidates(intake, knowledge)
    try:
        answer = ask(setup, AGENT_ID, INSTRUCTION, intake, candidates)
    except AgentOutputError as error:
        result.notes.append(f"agent {AGENT_ID}: {error.code}")
        return result
    if answer is None:
        result.notes.append(f"agent {AGENT_ID}: no evidence may be sent to the provider")
        return result
    if answer.held_back:
        result.notes.append(f"agent {AGENT_ID}: {answer.held_back} sources held back by egress")
    rows, seen = [], set()
    for item in items_of(answer.data, "items"):
        attribute = item.get("attribute")
        ids = item.get("evidence_ids")
        if not _attribute_ok(attribute) or attribute.strip() in seen:
            continue
        if check_claim(item.get("target"), ids, answer.pool):
            continue
        seen.add(attribute.strip())
        rows.append([attribute.strip(), tagged(item["target"], ids, answer.pool)])
        result.cited.update({i: answer.pool[i] for i in ids})
    if rows:
        table = {"type": "table", "headers": HEADERS, "rows": rows}
        result.sections[SECTION] = covered(SECTION, [table])
    return result
