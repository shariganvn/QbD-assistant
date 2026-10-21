"""What a successful render returns."""

from __future__ import annotations

from pydantic import Field

from qbd_core.shared.contracts import Strict


class RenderedDocument(Strict):
    path: str = Field(min_length=1)
    size: int = Field(ge=1)
    html_sha256: str
    draft_sha256: str
