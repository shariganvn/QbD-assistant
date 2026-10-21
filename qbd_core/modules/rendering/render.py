"""Render a draft to .docx by running the existing Node tool as a command-line program."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from qbd_core.modules.rendering.content_hash import content_sha256
from qbd_core.modules.rendering.errors import RenderFailed
from qbd_core.modules.rendering.models import RenderedDocument

DEFAULT_TOOL_ROOT = Path(__file__).resolve().parents[3] / "tools" / "pharma-dev-draft"
DEFAULT_NAME = "p2-orientation-draft.docx"
_CODE = re.compile(r"^(E_[A-Z0-9_]+):", re.MULTILINE)
_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.docx$")


def _run(command: list[str], timeout: float, step: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except FileNotFoundError as error:
        raise RenderFailed("E_TOOL_MISSING", command[0]) from error
    except subprocess.TimeoutExpired as error:
        raise RenderFailed("E_RENDER_TIMEOUT", step) from error


def _code_of(result: subprocess.CompletedProcess[str], fallback: str) -> RenderFailed:
    found = _CODE.search(result.stderr or "")
    return RenderFailed(found.group(1) if found else fallback, (result.stderr or "").strip()[-400:])


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render_draft(
    draft: dict[str, Any],
    output_dir: str | Path,
    name: str = DEFAULT_NAME,
    *,
    tool_root: str | Path = DEFAULT_TOOL_ROOT,
    node: str = "node",
    timeout: float = 120,
) -> RenderedDocument:
    """Render and verify in a staging folder, then replace the output in one step.

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
        staged_docx = stage / name
        render = _run(
            [
                node,
                str(tool / "render" / "render.mjs"),
                str(draft_path),
                "--output-root",
                str(stage),
                "--output-name",
                name,
            ],
            timeout,
            "render",
        )
        if render.returncode != 0:
            raise _code_of(render, "E_RENDER_FAILED")
        if not staged_docx.is_file() or staged_docx.stat().st_size == 0:
            raise RenderFailed("E_RENDER_NO_OUTPUT", name)
        verify = _run(
            [
                node,
                str(tool / "verify" / "verify.mjs"),
                str(staged_docx),
                "--draft",
                str(draft_path),
            ],
            timeout,
            "verify",
        )
        if verify.returncode != 0:
            raise RenderFailed(
                "E_VERIFY_FAILED", ((verify.stdout or "") + (verify.stderr or ""))[-400:]
            )
        final = out_dir / name
        digest, draft_digest = _sha256(staged_docx), _sha256(draft_path)
        try:
            content = content_sha256(staged_docx)
        except zipfile.BadZipFile as error:
            raise RenderFailed("E_OUTPUT_INVALID", name) from error
        os.replace(staged_docx, final)
        return RenderedDocument(
            path=str(final),
            size=final.stat().st_size,
            docx_sha256=digest,
            content_sha256=content,
            draft_sha256=draft_digest,
        )
    finally:
        shutil.rmtree(stage, ignore_errors=True)
