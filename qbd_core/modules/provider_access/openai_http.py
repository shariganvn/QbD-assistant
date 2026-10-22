"""Chat Completions API."""

from __future__ import annotations

from typing import Any

from qbd_core.modules.provider_access.http_provider import HttpProvider, split_parts
from qbd_core.modules.provider_access.models import LLMRequest


class OpenAIProvider(HttpProvider):
    def _headers(self, key: str) -> dict[str, str]:
        return {"authorization": f"Bearer {key}"}

    def _body(self, request: LLMRequest) -> dict[str, Any]:
        system, user = split_parts(request)
        messages = [{"role": "system", "content": system}] if system else []
        messages.append({"role": "user", "content": user})
        return {
            "model": request.model,
            "max_completion_tokens": self._config.max_tokens,
            "messages": messages,
        }

    def _text(self, data: dict[str, Any]) -> str:
        choice = data["choices"][0]
        if choice.get("finish_reason") != "stop":
            raise ValueError("answer is not complete")
        return choice["message"]["content"] or ""
