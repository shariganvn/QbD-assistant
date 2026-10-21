"""What a successful render returns."""

from __future__ import annotations

from pydantic import Field

from qbd_core.shared.contracts import Strict


class RenderedDocument(Strict):
    path: str = Field(min_length=1)
    size: int = Field(ge=1)
    docx_sha256: str
    # Hash of every part with the created/modified stamps neutralised; equal for equal drafts.
    content_sha256: str
    draft_sha256: str
