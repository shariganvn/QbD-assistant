"""Request and result types of the provider gateway."""

from __future__ import annotations

from pydantic import Field

from qbd_core.modules.egress_gate.api import Payload
from qbd_core.shared.contracts import Strict


class LLMRequest(Strict):
    model: str = Field(min_length=1)
    payload: Payload


class ProviderResult(Strict):
    text: str = Field(min_length=1)
    model: str
    request_digest: str
