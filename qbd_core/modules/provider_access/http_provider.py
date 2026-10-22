"""What every HTTPS text provider shares: off unless enabled, https only, no redirects, bounded
answers, and any problem is an exception. The gateway has already checked the whole payload; nothing
here decides what may leave the machine. No retry and no default answer.
"""

from __future__ import annotations

import json
import urllib.request
from collections.abc import Mapping
from dataclasses import dataclass
from importlib.resources import files
from typing import Any
from urllib.parse import urlsplit

from qbd_core.modules.egress_gate.api import Destination
from qbd_core.modules.provider_access.models import LLMRequest

MAX_ANSWER_BYTES = 1_000_000
# Where each vendor's key may be sent. Fixed in code so a config edit cannot redirect the key.
VENDOR_HOSTS = {
    "anthropic": "api.anthropic.com",
    "openai": "api.openai.com",
    "gemini": "generativelanguage.googleapis.com",
}


class ProviderSetupError(Exception):
    """The provider cannot be built from the configuration and environment."""


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    enabled: bool
    approved_models: tuple[str, ...]
    endpoint: str
    api_version: str
    api_key_env: str
    max_tokens: int
    timeout_seconds: float


def load_config(name: str = "anthropic") -> ProviderConfig:
    text = files("qbd_core.modules.provider_access").joinpath("config", "providers.json")
    raw = json.loads(text.read_text("utf-8"))["providers"]
    if name not in raw:
        raise ProviderSetupError(f"providers.json has no provider {name}")
    vendor = raw[name]
    try:
        _check(name, vendor)
    except (KeyError, TypeError, AttributeError, ValueError) as error:
        raise ProviderSetupError(f"providers.json: {name} is invalid") from error
    return ProviderConfig(
        name=name,
        enabled=vendor["enabled"],
        approved_models=tuple(vendor["approved_models"]),
        endpoint=vendor["endpoint"],
        api_version=vendor.get("api_version", ""),
        api_key_env=vendor["api_key_env"],
        max_tokens=vendor["max_tokens"],
        timeout_seconds=vendor["timeout_seconds"],
    )


def _check(name: str, vendor: dict[str, Any]) -> None:
    models = vendor["approved_models"]
    ok = (
        type(vendor["enabled"]) is bool
        and isinstance(models, list)
        and all(isinstance(m, str) and m for m in models)
        and type(vendor["max_tokens"]) is int
        and vendor["max_tokens"] > 0
        and isinstance(vendor["timeout_seconds"], int | float)
        and not isinstance(vendor["timeout_seconds"], bool)
        and 0 < vendor["timeout_seconds"] <= 600
        and isinstance(vendor["api_key_env"], str)
        and vendor["api_key_env"] != ""
    )
    parts = urlsplit(vendor["endpoint"])
    pinned = (
        parts.scheme == "https"
        and parts.hostname == VENDOR_HOSTS.get(name)
        and parts.port is None
        and not (parts.username or parts.password or parts.query or parts.fragment)
    )
    if not (ok and pinned):
        raise ValueError(name)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect would re-send the key to another host, so it is an error instead."""

    def redirect_request(self, *args, **kwargs):
        return None


def split_parts(request: LLMRequest) -> tuple[str, str]:
    parts = request.payload.parts
    system = "\n\n".join(p.text for p in parts if p.kind == "instruction")
    user = "\n\n".join(p.text for p in parts if p.kind != "instruction")
    return system, user


class HttpProvider:
    """A vendor supplies the address, the key header, the body and how to read a finished answer."""

    def __init__(self, config: ProviderConfig, environ: Mapping[str, str]) -> None:
        if not config.enabled:
            raise ProviderSetupError("provider is switched off in providers.json")
        key = environ.get(config.api_key_env, "")
        if not key:
            raise ProviderSetupError(f"{config.api_key_env} is not set")
        self._config = config
        self._key = key

    @property
    def destination(self) -> Destination:
        return Destination.REMOTE

    def _url(self, request: LLMRequest) -> str:
        return self._config.endpoint

    def _headers(self, key: str) -> dict[str, str]:
        raise NotImplementedError

    def _body(self, request: LLMRequest) -> dict[str, Any]:
        raise NotImplementedError

    def _text(self, data: dict[str, Any]) -> str:
        """The answer text; raises when the answer is not complete."""
        raise NotImplementedError

    def complete(self, request: LLMRequest) -> str:
        http = urllib.request.Request(
            self._url(request),
            data=json.dumps(self._body(request), ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={"content-type": "application/json", **self._headers(self._key)},
        )
        opener = urllib.request.build_opener(_NoRedirect)
        with opener.open(http, timeout=self._config.timeout_seconds) as answer:
            raw = answer.read(MAX_ANSWER_BYTES + 1)
        if len(raw) > MAX_ANSWER_BYTES:
            raise ValueError("answer too large")
        return self._text(json.loads(raw.decode("utf-8")))
