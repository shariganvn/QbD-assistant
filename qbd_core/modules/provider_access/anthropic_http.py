"""Messages API."""

from __future__ import annotations

from typing import Any

from qbd_core.modules.provider_access.http_provider import HttpProvider, split_parts
from qbd_core.modules.provider_access.models import LLMRequest


class AnthropicProvider(HttpProvider):
    def _headers(self, key: str) -> dict[str, str]:
        return {"x-api-key": key, "anthropic-version": self._config.api_version}

    def _body(self, request: LLMRequest) -> dict[str, Any]:
        system, user = split_parts(request)
        body: dict[str, Any] = {
            "model": request.model,
            "max_tokens": self._config.max_tokens,
            "messages": [{"role": "user", "content": user}],
        }
        if system:
            body["system"] = system
        return body

    def _text(self, data: dict[str, Any]) -> str:
        if data.get("stop_reason") != "end_turn":
            raise ValueError("answer is not complete")
        return "".join(b["text"] for b in data["content"] if b.get("type") == "text")
