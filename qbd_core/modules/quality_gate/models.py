"""Findings, checklist rows and the report of the quality gate."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from qbd_core.shared.contracts import Strict

Requirement = Literal["required", "mandatory", "literature", "recommended", "not_required"]


class Finding(Strict):
    """Codes and ids only: a finding never repeats draft text, so a report can leave the machine."""

    code: str = Field(min_length=1)
    severity: Literal["block", "info"]
    section_id: str | None = None
    detail: str = ""


class ChecklistItem(Strict):
    no: int = Field(ge=1, le=17)
    text: str
    # open: a mapped section is still a marked gap. review: every mapped section has content and a
    # person must judge it. na: nothing applies. pass/fail: items 15-17, which code can decide.
    status: Literal["open", "review", "na", "pass", "fail"]
    detail: str = ""


class NumberingRow(Strict):
    section_id: str
    ctd: str
    actd: str | None = None
    requirement: Requirement


class QualityReport(Strict):
    findings: tuple[Finding, ...] = ()
    checklist: tuple[ChecklistItem, ...] = ()
    numbering: tuple[NumberingRow, ...] = ()
    actd_map_verified: bool = False

    @property
    def blocking(self) -> tuple[Finding, ...]:
        return tuple(f for f in self.findings if f.severity == "block")

    @property
    def passed(self) -> bool:
        return not self.blocking
