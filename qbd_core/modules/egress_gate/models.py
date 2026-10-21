"""Types of the egress gate: the manifest it trusts, the payload it inspects, its verdict."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import Field

from qbd_core.shared.contracts import Classification, Strict


class Destination(StrEnum):
    LOCAL = "local"
    REMOTE = "remote"


class ManifestEntry(Strict):
    file_id: str = Field(min_length=1)
    classification: Classification
    approved_by: str | None = None
    approved_on: str | None = None
    # Hashes of word windows of the document text; the text itself is never stored here.
    shingles: frozenset[str] = frozenset()


class Manifest(Strict):
    entries: tuple[ManifestEntry, ...]

    def get(self, file_id: str) -> ManifestEntry | None:
        return next((e for e in self.entries if e.file_id == file_id), None)


class PayloadPart(Strict):
    kind: Literal["instruction", "intake", "evidence"]
    text: str
    source_ids: tuple[str, ...] = ()


class Payload(Strict):
    parts: tuple[PayloadPart, ...]


ReasonCode = Literal[
    "E_MANIFEST_MISSING",
    "E_SOURCE_UNKNOWN",
    "E_SOURCE_RESTRICTED",
    "E_SOURCE_UNAPPROVED",
    "E_PART_UNATTRIBUTED",
    "E_RESTRICTED_TEXT",
]


class Reason(Strict):
    code: ReasonCode
    part_index: int | None = None
    source_id: str | None = None


class EgressDecision(Strict):
    allowed: bool
    destination: Destination
    reasons: tuple[Reason, ...] = ()
