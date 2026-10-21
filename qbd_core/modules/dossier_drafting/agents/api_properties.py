"""Agent 4.1 (API Properties): drug substance properties for P.2.1.1.1 and P.2.1.1.2.

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
from qbd_core.modules.dossier_drafting.agents.llm import (
    AgentOutputError,
    Answer,
    LlmSetup,
    ask,
)
from qbd_core.modules.dossier_drafting.models import IntakeResult
from qbd_core.modules.evidence.api import KnowledgePort
from qbd_core.shared.contracts import EvidenceRecord
from qbd_core.shared.markers import GAP_LABEL

AGENT_ID = "4.1"
PROPERTIES_SECTION, BIOLOGY_SECTION = "P.2.1.1.1", "P.2.1.1.2"
NEEDS_AN_IMAGE = {"Công thức cấu tạo"}
CANDIDATES_PER_LABEL = 3
MAX_POOL = 14
INSTRUCTION = (
    "Bạn là agent API Properties. Chỉ dùng các đoạn bằng chứng có mã [E-...] dưới đây. Trả về MỘT "
    'đối tượng JSON: {"properties":[{"label":<nhãn thuộc tính>,"value":<một câu>,"evidence_ids":'
    '[<mã>...]}],"biology":[{"text":<một câu>,"evidence_ids":[<mã>...]}]}. Mỗi câu chỉ nêu điều '
    "bằng chứng nói, không thêm số hay sự kiện nào ngoài bằng chứng. Thuộc tính không có bằng "
    "chứng thì bỏ qua, không đoán."
)


@dataclass
class ApiPropertiesResult:
    sections: dict[str, dict[str, Any]] = field(default_factory=dict)
    cited: dict[str, EvidenceRecord] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _candidates(
    intake: IntakeResult, knowledge: KnowledgePort, labels: list[str]
) -> list[EvidenceRecord]:
    substance = intake.request.substances[0]
    found: dict[str, EvidenceRecord] = {}
    queries = [f"{substance} {label.lstrip('– ')}" for label in labels]
    queries += [f"{substance} phân loại BCS tính thấm sinh khả dụng"]
    for query in queries:
        for record in knowledge.search(query, CANDIDATES_PER_LABEL):
            found.setdefault(record.id, record)
    return list(found.values())[:MAX_POOL]


def _gap_cell(reason: str) -> str:
    return f"{GAP_LABEL} {reason}"


def run(
    setup: LlmSetup, intake: IntakeResult, knowledge: KnowledgePort, row_labels: list[str]
) -> ApiPropertiesResult:
    result = ApiPropertiesResult()
    candidates = _candidates(intake, knowledge, row_labels)
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
    values, rejected = _properties(answer, row_labels, result)
    if values:
        rows = [
            [label, values.get(label) or _gap_cell(_why(label, rejected))] for label in row_labels
        ]
        table = {
            "type": "table",
            "headers": ["Thuộc tính", "Giá trị"],
            "rows": rows,
            "headerless": True,
        }
        block = [table]
        result.sections[PROPERTIES_SECTION] = covered(PROPERTIES_SECTION, block)
    blocks = _biology(answer, result)
    if blocks:
        result.sections[BIOLOGY_SECTION] = covered(BIOLOGY_SECTION, blocks)
    return result


def _properties(answer: Answer, row_labels: list[str], result: ApiPropertiesResult):
    values: dict[str, str] = {}
    rejected: dict[str, str] = {}
    for item in items_of(answer.data, "properties"):
        label = item.get("label")
        skip = label not in row_labels or label in NEEDS_AN_IMAGE
        if skip or label in values or label in rejected:
            continue
        error = check_claim(item.get("value"), item.get("evidence_ids"), answer.pool)
        if error:
            rejected[label] = error
            continue
        values[label] = tagged(item["value"], item["evidence_ids"], answer.pool)
        result.cited.update({i: answer.pool[i] for i in item["evidence_ids"]})
    return values, rejected


def _biology(answer: Answer, result: ApiPropertiesResult) -> list[dict[str, Any]]:
    blocks = []
    for item in items_of(answer.data, "biology"):
        if check_claim(item.get("text"), item.get("evidence_ids"), answer.pool):
            continue
        text = tagged(item["text"], item["evidence_ids"], answer.pool)
        blocks.append({"type": "paragraph", "text": text})
        result.cited.update({i: answer.pool[i] for i in item["evidence_ids"]})
    return blocks


def _why(label: str, rejected: dict[str, str]) -> str:
    if label in NEEDS_AN_IMAGE:
        return "cần hình công thức cấu tạo"
    if label in rejected:
        return f"câu do mô hình viết bị loại ({rejected[label]})"
    return f"agent {AGENT_ID} chưa tìm thấy bằng chứng được phép"
