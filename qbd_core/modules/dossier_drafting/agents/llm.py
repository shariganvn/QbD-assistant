"""Ask a language model for structured output, only with evidence the egress policy lets through."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from qbd_core.modules.dossier_drafting.models import IntakeResult
from qbd_core.modules.egress_gate.api import Payload, PayloadPart
from qbd_core.modules.provider_access.api import (
    LLMRequest,
    ProviderFailed,
    ProviderGateway,
    ProviderRefused,
)
from qbd_core.shared.contracts import EvidenceRecord


@dataclass(frozen=True)
class LlmSetup:
    gateway: ProviderGateway
    model: str


class AgentInfrastructureError(Exception):
    """The provider refused or failed. The run stops; nothing is published."""

    def __init__(self, agent_id: str, code: str) -> None:
        super().__init__(f"{agent_id}: {code}")
        self.agent_id = agent_id
        self.code = code


class AgentOutputError(Exception):
    """The model answered, but not in the agreed shape. The agent's sections stay gaps."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Answer:
    data: dict[str, Any]
    pool: dict[str, EvidenceRecord]
    held_back: int


def _parts(instruction: str, intake: IntakeResult, pool: list[EvidenceRecord]) -> list[PayloadPart]:
    request = intake.request
    given = (
        f"Hoạt chất: {', '.join(request.substances)}; dạng bào chế: {request.dosage_form}; "
        f"thị trường: {request.market.value}."
    )
    parts = [
        PayloadPart(kind="instruction", text=instruction),
        PayloadPart(kind="intake", text=given),
    ]
    for record in pool:
        text = f"[{record.id}] {record.text}"
        parts.append(PayloadPart(kind="evidence", text=text, source_ids=(record.provenance.file,)))
    return parts


def ask(
    setup: LlmSetup,
    agent_id: str,
    instruction: str,
    intake: IntakeResult,
    candidates: list[EvidenceRecord],
) -> Answer | None:
    """None when no evidence may be sent, so the model is not called at all."""
    by_text = {f"[{r.id}] {r.text}": r for r in candidates if r.provenance is not None}
    parts = _parts(instruction, intake, [r for r in candidates if r.provenance is not None])
    allowed, held = setup.gateway.split_allowed(parts)
    sent = [p for p in allowed if p.kind == "evidence"]
    if not sent:
        return None
    pool = {by_text[p.text].id: by_text[p.text] for p in sent}
    request = LLMRequest(model=setup.model, payload=Payload(parts=tuple(allowed)))
    try:
        result = setup.gateway.call(request)
    except (ProviderRefused, ProviderFailed) as error:
        raise AgentInfrastructureError(agent_id, error.code) from error
    try:
        data = json.loads(result.text)
    except ValueError as error:
        raise AgentOutputError("E_AGENT_JSON") from error
    if not isinstance(data, dict):
        raise AgentOutputError("E_AGENT_SHAPE")
    return Answer(data=data, pool=pool, held_back=sum(p.kind == "evidence" for p in held))
