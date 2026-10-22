"""generateContent API. The key travels in a header, never in the address."""

from __future__ import annotations

import re
from typing import Any

from qbd_core.modules.provider_access.http_provider import HttpProvider, split_parts
from qbd_core.modules.provider_access.models import LLMRequest

SAFE_MODEL = re.compile(r"[A-Za-z0-9._-]+")


class GeminiProvider(HttpProvider):
    def _url(self, request: LLMRequest) -> str:
        if not SAFE_MODEL.fullmatch(request.model):
            raise ValueError("model name has characters not allowed in an address")
        return self._config.endpoint.replace("{model}", request.model)

    def _headers(self, key: str) -> dict[str, str]:
        return {"x-goog-api-key": key}

    def _body(self, request: LLMRequest) -> dict[str, Any]:
        system, user = split_parts(request)
        body: dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"maxOutputTokens": self._config.max_tokens},
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        return body

    def _text(self, data: dict[str, Any]) -> str:
        candidate = data["candidates"][0]
        if candidate.get("finishReason") != "STOP":
            raise ValueError("answer is not complete")
        return "".join(
            p.get("text", "") for p in candidate["content"]["parts"] if not p.get("thought")
        )
