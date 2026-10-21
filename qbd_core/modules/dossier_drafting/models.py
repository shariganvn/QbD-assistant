"""Result and error types of the intake step."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from qbd_core.shared.contracts import IntakeRequest, Strict

IssueCode = Literal[
    "E_FIELD_MISSING",
    "E_FIELD_TYPE",
    "E_FIELD_UNKNOWN",
    "E_SUBSTANCE_COUNT",
    "E_SUBSTANCE_DUPLICATE",
    "E_FORM_UNKNOWN",
    "E_MARKET_UNKNOWN",
]

COMBINATION_OUT_OF_SOP = "COMBINATION_OUT_OF_SOP"


class IntakeIssue(Strict):
    code: IssueCode
    field: str
    detail: str


class IntakeResult(Strict):
    request: IntakeRequest
    form_id: str = Field(min_length=1)
    group: str = Field(min_length=1)
    scope_flags: tuple[str, ...] = ()


class IntakeRejected(Exception):  # noqa: N818 - reads as a verdict, not an error class
    def __init__(self, issues: tuple[IntakeIssue, ...]) -> None:
        super().__init__("; ".join(f"{i.code}({i.field})" for i in issues))
        self.issues = issues

    @property
    def codes(self) -> tuple[str, ...]:
        return tuple(i.code for i in self.issues)
