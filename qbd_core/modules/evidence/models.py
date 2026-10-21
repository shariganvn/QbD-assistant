"""A source document as the knowledge base sees it: classified text split by page."""

from __future__ import annotations

from pydantic import Field

from qbd_core.shared.contracts import Classification, Strict


class KnowledgeDocument(Strict):
    file_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    classification: Classification = Classification.UNKNOWN
    pages: tuple[str, ...] = Field(min_length=1)
