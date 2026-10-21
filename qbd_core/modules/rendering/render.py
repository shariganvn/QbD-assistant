"""Render a draft to a single HTML file, after the Stage B validator accepted it."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from qbd_core.modules.rendering.errors import RenderFailed
from qbd_core.modules.rendering.html_doc import build_html
from qbd_core.modules.rendering.models import RenderedDocument
from qbd_core.modules.rendering.verify import verify_html

DEFAULT_TOOL_ROOT = Path(__file__).resolve().parents[3] / "tools" / "pharma-dev-draft"
DEFAULT_NAME = "p2-orientation-draft.html"
_CODE = re.compile(r"^(E_[A-Z0-9_]+):", re.MULTILINE)
_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.html$")


def _validate(draft_path: Path, tool: Path, node: str, timeout: float) -> None:
    command = [node, str(tool / "draft" / "validate-draft.mjs"), str(draft_path)]
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=timeout, check=False
        )
    except FileNotFoundError as error:
        raise RenderFailed("E_TOOL_MISSING", node) from error
    except subprocess.TimeoutExpired as error:
        raise RenderFailed("E_RENDER_TIMEOUT", "validate") from error
    if result.returncode != 0:
        output = (result.stdout or "") + (result.stderr or "")
        found = _CODE.search(output)
        raise RenderFailed(found.group(1) if found else "E_DRAFT_INVALID", output.strip()[-400:])


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render_draft(
    draft: dict[str, Any],
    output_dir: str | Path,
    name: str = DEFAULT_NAME,
    *,
    tool_root: str | Path = DEFAULT_TOOL_ROOT,
    node: str = "node",
    timeout: float = 60,
) -> RenderedDocument:
    """Validate, build, verify in a staging folder, then replace the output in one step.

    Any failure leaves the previous output (if any) untouched and removes the staging folder.
    """
    if not _NAME.fullmatch(name):
        raise RenderFailed("E_OUTPUT_NAME", name)
    tool = Path(tool_root)
    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(dir=out_dir, prefix=".stage-"))
    try:
        draft_path = stage / "draft.json"
        draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
        _validate(draft_path, tool, node, timeout)
        outline = json.loads((tool / "schemas" / "p2-outline.json").read_text(encoding="utf-8"))
        page = build_html(draft, outline)
        failures = verify_html(page, draft)
        if failures:
            raise RenderFailed("E_VERIFY_FAILED", "; ".join(failures[:5]))
        staged = stage / name
        staged.write_text(page, encoding="utf-8")
        final = out_dir / name
        digest, draft_digest = _sha256(staged), _sha256(draft_path)
        os.replace(staged, final)
        return RenderedDocument(
            path=str(final),
            size=final.stat().st_size,
            html_sha256=digest,
            draft_sha256=draft_digest,
        )
    finally:
        shutil.rmtree(stage, ignore_errors=True)
