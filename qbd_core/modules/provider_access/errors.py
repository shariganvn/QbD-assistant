"""Refusals happen before any provider call; failures happen during or after one."""

from __future__ import annotations

from typing import Literal

RefusalCode = Literal["E_MODEL_NOT_APPROVED", "E_EGRESS_BLOCKED"]
FailureCode = Literal["E_PROVIDER_ERROR", "E_RESPONSE_INVALID"]


class ProviderRefused(Exception):  # noqa: N818 - reads as a verdict, not an error class
    def __init__(self, code: RefusalCode, detail: tuple[str, ...] = ()) -> None:
        super().__init__(f"{code}: {', '.join(detail)}" if detail else code)
        self.code = code
        self.detail = detail


class ProviderFailed(Exception):  # noqa: N818
    def __init__(self, code: FailureCode) -> None:
        super().__init__(code)
        self.code = code
