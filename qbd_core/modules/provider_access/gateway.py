"""The only route to a provider: model check, egress check, call, response check."""

from __future__ import annotations

from collections.abc import Collection, Sequence

from qbd_core.modules.egress_gate.api import (
    Destination,
    Manifest,
    Payload,
    PayloadPart,
    check_egress,
)
from qbd_core.modules.provider_access.errors import ProviderFailed, ProviderRefused
from qbd_core.modules.provider_access.models import LLMRequest, ProviderResult
from qbd_core.modules.provider_access.port import LLMPort
from qbd_core.modules.provider_access.recorded import request_digest


class ProviderGateway:
    def __init__(
        self, provider: LLMPort, approved_models: Collection[str], manifest: Manifest | None
    ) -> None:
        self._provider = provider
        self._approved = frozenset(approved_models)
        self._manifest = manifest

    @property
    def destination(self) -> Destination:
        return self._provider.destination

    def split_allowed(
        self, parts: Sequence[PayloadPart]
    ) -> tuple[tuple[PayloadPart, ...], tuple[PayloadPart, ...]]:
        """Parts the egress policy lets through for this provider, and the parts it holds back."""
        allowed, held = [], []
        for part in parts:
            ok = check_egress(Payload(parts=(part,)), self.destination, self._manifest).allowed
            (allowed if ok else held).append(part)
        return tuple(allowed), tuple(held)

    def call(self, request: LLMRequest) -> ProviderResult:
        if request.model not in self._approved:
            raise ProviderRefused("E_MODEL_NOT_APPROVED", (request.model,))
        decision = check_egress(request.payload, self._provider.destination, self._manifest)
        if not decision.allowed:
            raise ProviderRefused("E_EGRESS_BLOCKED", tuple(r.code for r in decision.reasons))
        try:
            text = self._provider.complete(request)
        except Exception as error:
            raise ProviderFailed("E_PROVIDER_ERROR") from error
        if not isinstance(text, str) or not text.strip():
            raise ProviderFailed("E_RESPONSE_INVALID")
        digest = request_digest(request)
        return ProviderResult(text=text, model=request.model, request_digest=digest)


__all__ = ["Destination", "ProviderGateway"]
