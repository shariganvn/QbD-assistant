"""The port a language-model provider implements. Called only by the gateway."""

from __future__ import annotations

from typing import Protocol

from qbd_core.modules.egress_gate.api import Destination
from qbd_core.modules.provider_access.models import LLMRequest


class LLMPort(Protocol):
    @property
    def destination(self) -> Destination:
        """Where the request is processed. Anything but LOCAL is treated as leaving the machine."""

    def complete(self, request: LLMRequest) -> str: ...
