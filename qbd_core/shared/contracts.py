"""Base data contracts shared by the modules. Types only; no business logic."""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

GAP_MARKER = "CẦN DỮ LIỆU"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Market(StrEnum):
    EU = "eu"
    DOMESTIC = "domestic"
    BOTH = "both"


class Classification(StrEnum):
    """Data-classification class of a source document. Unknown is the most restricted."""

    A = "A"
    B = "B"
    C = "C"
    UNKNOWN = "?"


class IntakeRequest(Strict):
    """The three researcher inputs. Catalogue and count rules are enforced by the intake step."""

    substances: tuple[str, ...] = Field(min_length=1)
    dosage_form: str = Field(min_length=1)
    market: Market


class Provenance(Strict):
    file: str = Field(min_length=1)
    page: int = Field(ge=1)
    quote: str = Field(min_length=1)


class Citation(Strict):
    source: str = Field(min_length=1)
    address: str = Field(min_length=1)
    accessed: date


class EvidenceRecord(Strict):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    classification: Classification = Classification.UNKNOWN
    provenance: Provenance | None = None
    citation: Citation | None = None

    @model_validator(mode="after")
    def _has_a_source(self) -> Self:
        if (self.provenance is None) == (self.citation is None):
            raise ValueError("exactly one of provenance or citation is required")
        return self


class GapEntry(Strict):
    section_id: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    marker: Literal["CẦN DỮ LIỆU"] = GAP_MARKER
    owner: str | None = None


class DraftSection(Strict):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    status: Literal["content", "gap"]
    body: str = ""
    evidence_ids: tuple[str, ...] = ()
    gaps: tuple[GapEntry, ...] = ()

    @model_validator(mode="after")
    def _status_matches_content(self) -> Self:
        if self.status == "content" and not self.body:
            raise ValueError("a content section needs a body")
        if self.status == "gap" and not self.gaps:
            raise ValueError("a gap section needs at least one gap entry")
        return self
