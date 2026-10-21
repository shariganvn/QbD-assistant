"""Load the manifest. Anything unreadable or inconsistent yields no manifest (blocks egress)."""

from __future__ import annotations

from pathlib import Path

from pydantic import ValidationError

from qbd_core.modules.egress_gate.models import Manifest


def try_load_manifest(path: str | Path) -> Manifest | None:
    try:
        manifest = Manifest.model_validate_json(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValidationError, ValueError):
        return None
    ids = [e.file_id for e in manifest.entries]
    if len(ids) != len(set(ids)):
        return None
    return manifest
