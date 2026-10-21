"""Agent 4.2 (Excipient Selector): excipient table for P.2.1.2.1 and grade rationale for P.2.1.2.3.

The model reads only the evidence it is given and answers in JSON; code decides what is published.
An excipient is listed only if its name occurs in the evidence cited for it.
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
from qbd_core.modules.dossier_drafting.models import IntakeResult
from qbd_core.modules.evidence.api import KnowledgePort
from qbd_core.shared.contracts import EvidenceRecord
from qbd_core.shared.markers import GAP_LABEL, kind_of

AGENT_ID = "4.2"
TABLE_SECTION, GRADE_SECTION = "P.2.1.2.1", "P.2.1.2.3"
HEADERS = ["STT", "Tên tá dược", "Đặc tính lý hóa", "Ứng dụng", "Chức năng"]
CELLS = (("physchem", "đặc tính lý hóa"), ("use", "ứng dụng"), ("function", "chức năng"))
HITS_PER_QUERY = 4
MAX_POOL = 16
MAX_ROWS = 20
MAX_NAME_CHARS = 80
INSTRUCTION = (
    "Bạn là agent Excipient Selector. Chỉ dùng các đoạn bằng chứng có mã [E-...] dưới đây. Trả về "
    'MỘT đối tượng JSON: {"excipients":[{"name":<tên tá dược, đúng như trong bằng chứng>,'
    '"physchem":{"text":<một câu>,"evidence_ids":[<mã>...]},"use":{...},"function":{...}}],'
    '"grades":[{"text":<một câu về lý do chọn grade>,"evidence_ids":[<mã>...]}]}. Mỗi câu chỉ nêu '
    "điều bằng chứng nói, không thêm số hay sự kiện nào ngoài bằng chứng. Ô nào không có bằng "
    "chứng thì bỏ trống (null), tá dược không có trong bằng chứng thì bỏ qua, không đoán."
)


@dataclass
class ExcipientsResult:
    sections: dict[str, dict[str, Any]] = field(default_factory=dict)
    cited: dict[str, EvidenceRecord] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _candidates(intake: IntakeResult, knowledge: KnowledgePort) -> list[EvidenceRecord]:
    substance, form = intake.request.substances[0], intake.request.dosage_form
    queries = [
        f"{substance} {form} tá dược thành phần",
        f"{substance} tá dược",
        f"{form} tá dược chức năng",
        f"{substance} lựa chọn grade tá dược",
    ]
    found: dict[str, EvidenceRecord] = {}
    for query in queries:
        for record in knowledge.search(query, HITS_PER_QUERY):
            found.setdefault(record.id, record)
    return list(found.values())[:MAX_POOL]


def _name_ok(name: object) -> bool:
    return (
        isinstance(name, str)
        and bool(name.strip())
        and len(name) <= MAX_NAME_CHARS
        and "\n" not in name
        and kind_of(name) is None
        and "[nguồn" not in name
        and "[tổng hợp" not in name
    )


def _fold(text: str) -> str:
    return " ".join(text.lower().split())


def _cell(entry: object, pool: dict[str, EvidenceRecord]):
    """(text with tags, ids) when the model's cell passes the claim check, else (None, reason)."""
    if not isinstance(entry, dict):
        return None, "agent 4.2 chưa tìm thấy bằng chứng được phép"
    error = check_claim(entry.get("text"), entry.get("evidence_ids"), pool)
    if error:
        return None, f"câu do mô hình viết bị loại ({error})"
    return tagged(entry["text"], entry["evidence_ids"], pool), list(entry["evidence_ids"])


def _row(item: dict[str, Any], pool: dict[str, EvidenceRecord]):
    name = item.get("name")
    if not _name_ok(name):
        return None
    cells, used = [], []
    for key, _ in CELLS:
        text, detail = _cell(item.get(key), pool)
        cells.append(text if text else f"{GAP_LABEL} {detail}")
        if text:
            used += detail
    evidence = _fold(" ".join(pool[i].text for i in used))
    if not used or _fold(name) not in evidence:
        return None
    return tagged(name.strip(), [used[0]], pool), cells, used


def run(setup: LlmSetup, intake: IntakeResult, knowledge: KnowledgePort) -> ExcipientsResult:
    result = ExcipientsResult()
    try:
        answer = ask(setup, AGENT_ID, INSTRUCTION, intake, _candidates(intake, knowledge))
    except AgentOutputError as error:
        result.notes.append(f"agent {AGENT_ID}: {error.code}")
        return result
    if answer is None:
        result.notes.append(f"agent {AGENT_ID}: no evidence may be sent to the provider")
        return result
    if answer.held_back:
        result.notes.append(f"agent {AGENT_ID}: {answer.held_back} sources held back by egress")
    rows, seen = [], set()
    for item in items_of(answer.data, "excipients"):
        row = _row(item, answer.pool)
        key = _fold(str(item.get("name")))
        if row is None or key in seen or len(rows) >= MAX_ROWS:
            continue
        seen.add(key)
        rows.append([str(len(rows) + 1), row[0], *row[1]])
        result.cited.update({i: answer.pool[i] for i in row[2]})
    if rows:
        table = {"type": "table", "headers": HEADERS, "rows": rows}
        result.sections[TABLE_SECTION] = covered(TABLE_SECTION, [table])
    blocks = []
    for item in items_of(answer.data, "grades"):
        if check_claim(item.get("text"), item.get("evidence_ids"), answer.pool):
            continue
        blocks.append(
            {"type": "paragraph", "text": tagged(item["text"], item["evidence_ids"], answer.pool)}
        )
        result.cited.update({i: answer.pool[i] for i in item["evidence_ids"]})
    if blocks:
        result.sections[GRADE_SECTION] = covered(GRADE_SECTION, blocks)
    return result
