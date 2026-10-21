"""One failure type; the code says which step failed."""

from __future__ import annotations


class RenderFailed(Exception):  # noqa: N818 - reads as a verdict, not an error class
    """Codes: E_OUTPUT_NAME, E_TOOL_MISSING, E_RENDER_TIMEOUT, E_RENDER_NO_OUTPUT, E_OUTPUT_INVALID,
    E_VERIFY_FAILED, or the E_* code the renderer printed (for example a contract violation)."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail
