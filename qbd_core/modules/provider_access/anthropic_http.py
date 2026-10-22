"""Messages API over HTTPS with the standard library. Reached only through the gateway.

Nothing here decides what may leave the machine; the gateway has already checked the whole payload.
Any problem raises, and the gateway turns it into ProviderFailed. No retry, no default answer.
"""

from __future__ import annotations

import json
import urllib.request
from collections.abc import Mapping
from dataclasses import dataclass
from importlib.resources import files
from typing import Any

from qbd_core.modules.egress_gate.api import Destination
from qbd_core.modules.provider_access.models import LLMRequest


class ProviderSetupError(Exception):
    """The provider cannot be built from the configuration and environment."""


@dataclass(frozen=True)
class ProviderConfig:
    enabled: bool
    zdr_on_file: bool
    approved_models: tuple[str, ...]
    endpoint: str
    api_version: str
    api_key_env: str
    max_tokens: int
    timeout_seconds: float


def load_config() -> ProviderConfig:
    text = files("qbd_core.modules.provider_access").joinpath("config", "providers.json")
    raw = json.loads(text.read_text("utf-8"))
    vendor = raw["anthropic"]
    return ProviderConfig(
        enabled=raw["enabled"],
        zdr_on_file=raw["zdr_on_file"],
        approved_models=tuple(raw["approved_models"]),
        endpoint=vendor["endpoint"],
        api_version=vendor["api_version"],
        api_key_env=vendor["api_key_env"],
        max_tokens=vendor["max_tokens"],
        timeout_seconds=vendor["timeout_seconds"],
    )


class AnthropicProvider:
    def __init__(self, config: ProviderConfig, environ: Mapping[str, str]) -> None:
        key = environ.get(config.api_key_env, "")
        if not key:
            raise ProviderSetupError(f"{config.api_key_env} is not set")
        self._config = config
        self._key = key

    @property
    def destination(self) -> Destination:
        return Destination.REMOTE

    def _body(self, request: LLMRequest) -> bytes:
        parts = request.payload.parts
        system = "\n\n".join(p.text for p in parts if p.kind == "instruction")
        user = "\n\n".join(p.text for p in parts if p.kind != "instruction")
        body: dict[str, Any] = {
            "model": request.model,
            "max_tokens": self._config.max_tokens,
            "messages": [{"role": "user", "content": user}],
        }
        if system:
            body["system"] = system
        return json.dumps(body, ensure_ascii=False).encode("utf-8")

    def complete(self, request: LLMRequest) -> str:
        http = urllib.request.Request(
            self._config.endpoint,
            data=self._body(request),
            method="POST",
            headers={
                "content-type": "application/json",
                "x-api-key": self._key,
                "anthropic-version": self._config.api_version,
            },
        )
        with urllib.request.urlopen(http, timeout=self._config.timeout_seconds) as answer:  # noqa: S310
            data = json.loads(answer.read().decode("utf-8"))
        blocks = data["content"]
        return "".join(b["text"] for b in blocks if b.get("type") == "text")
