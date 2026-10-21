"""A provider that replays stored answers, so a run is repeatable and needs no network."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from pathlib import Path

from qbd_core.modules.egress_gate.api import Destination
from qbd_core.modules.provider_access.models import LLMRequest


class RecordedMiss(LookupError):
    """No stored answer exists for this request."""


def request_digest(request: LLMRequest) -> str:
    canonical = json.dumps(
        request.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class RecordedProvider:
    """Defaults to REMOTE so tests exercise the egress gate exactly as a real provider would."""

    def __init__(
        self, answers: Mapping[str, str], destination: Destination = Destination.REMOTE
    ) -> None:
        self._answers = dict(answers)
        self._destination = destination
        self.calls = 0

    @classmethod
    def from_file(cls, path: str | Path, destination: Destination = Destination.REMOTE):
        return cls(json.loads(Path(path).read_text(encoding="utf-8")), destination)

    @property
    def destination(self) -> Destination:
        return self._destination

    def complete(self, request: LLMRequest) -> str:
        self.calls += 1
        try:
            return self._answers[request_digest(request)]
        except KeyError:
            raise RecordedMiss(request_digest(request)) from None
