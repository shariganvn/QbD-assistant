"""Read the team's trial reports into typed tables, or say exactly which table was not understood.

Stage A of tools/pharma-dev-draft turns a .docx into tables (called as a command, never imported).
This module adds what that tool leaves to a person: it names the kind of each table from its header
words, and it refuses to guess when a table matches no kind or more than one. Nothing here sends
data anywhere; the records are for deterministic code only.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
import unicodedata
from collections.abc import Callable
from functools import cache
from importlib.resources import files
from pathlib import Path

from pydantic import Field

from qbd_core.shared.contracts import Strict

DEFAULT_TOOL_ROOT = Path(__file__).resolve().parents[3] / "tools" / "pharma-dev-draft"
_EXTRACT_ERROR = re.compile(r"^(E_[A-Z0-9_]+)", re.MULTILINE)


class TrialIntakeError(Exception):
    """A trial file could not be read. The run stops: a file the person gave must not be skipped."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


class TrialTable(Strict):
    file: str
    index: int = Field(ge=1)
    headers: tuple[str, ...]
    rows: tuple[tuple[str, ...], ...]
    kind: str | None = None


class TrialData(Strict):
    files: tuple[tuple[str, str], ...] = ()  # (name, sha256 of the source file)
    tables: tuple[TrialTable, ...] = ()
    unrecognized: tuple[str, ...] = ()

    def of_kind(self, kind: str) -> tuple[TrialTable, ...]:
        return tuple(t for t in self.tables if t.kind == kind)


Extractor = Callable[[Path], dict]


@cache
def kinds() -> tuple[tuple[str, tuple[tuple[str, ...], ...]], ...]:
    text = files("qbd_core.modules.evidence").joinpath("config", "data_kinds.json")
    raw = json.loads(text.read_text("utf-8"))["kinds"]
    return tuple((k["id"], tuple(tuple(g) for g in k["all_of"])) for k in raw)


def _fold(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).lower().split())


def classify(headers: tuple[str, ...]) -> tuple[str | None, str]:
    """(kind, "") for one clear match, else (None, reason)."""
    haystack = _fold(" | ".join(headers))
    matched = [
        kind
        for kind, groups in kinds()
        if all(any(word in haystack for word in group) for group in groups)
    ]
    if len(matched) == 1:
        return matched[0], ""
    if not matched:
        return None, "không khớp loại dữ liệu nào"
    return None, "khớp nhiều loại: " + ", ".join(matched)


def stage_a(path: Path, tool_root: Path = DEFAULT_TOOL_ROOT, node: str = "node") -> dict:
    """Run the pinned extractor as a command and return its tables."""
    script = tool_root / "extract" / "extract.mjs"
    with tempfile.TemporaryDirectory(prefix="qbd-trial-") as scratch:
        out = Path(scratch) / "extracted.json"
        try:
            done = subprocess.run(
                [node, str(script), str(path), "-o", str(out)],
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
        except FileNotFoundError as error:
            raise TrialIntakeError("E_TOOL_MISSING", node) from error
        except subprocess.TimeoutExpired as error:
            raise TrialIntakeError("E_EXTRACT_TIMEOUT", path.name) from error
        if done.returncode != 0:
            text = (done.stdout or "") + (done.stderr or "")
            found = _EXTRACT_ERROR.search(text)
            raise TrialIntakeError(found.group(1) if found else "E_EXTRACT_FAILED", path.name)
        try:
            return json.loads(out.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise TrialIntakeError("E_EXTRACT_OUTPUT", path.name) from error


Shape = tuple[tuple[str, ...], tuple[tuple[str, ...], ...]]


def _strings(items: object) -> bool:
    return isinstance(items, list) and all(isinstance(i, str) for i in items)


def _tables(extracted: object, name: str) -> list[Shape]:
    tables = extracted.get("tables") if isinstance(extracted, dict) else None
    if not isinstance(tables, list):
        raise TrialIntakeError("E_EXTRACT_SHAPE", name)
    out: list[Shape] = []
    for table in tables:
        headers = table.get("headers") if isinstance(table, dict) else None
        rows = table.get("rows") if isinstance(table, dict) else None
        if not _strings(headers) or not isinstance(rows, list) or not all(map(_strings, rows)):
            raise TrialIntakeError("E_EXTRACT_SHAPE", name)
        out.append((tuple(headers), tuple(tuple(r) for r in rows)))
    return out


def load_trial_data(paths: list[str], extract: Extractor | None = None) -> TrialData:
    """All files or an error. Same files give the same data, whatever the order they were given."""
    run = extract or stage_a
    seen: set[str] = set()
    infos: list[tuple[str, str]] = []
    tables: list[TrialTable] = []
    unrecognized: list[str] = []
    for given in sorted(paths, key=lambda p: Path(p).name):
        path = Path(given)
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError as error:
            raise TrialIntakeError("E_TRIAL_UNREADABLE", path.name) from error
        if re.search(r"[,\[\]]", path.name):
            raise TrialIntakeError("E_TRIAL_NAME", path.name)
        if path.name in seen:
            raise TrialIntakeError("E_TRIAL_DUPLICATE_NAME", path.name)
        seen.add(path.name)
        infos.append((path.name, digest))
        for number, (headers, rows) in enumerate(_tables(run(path), path.name), start=1):
            kind, reason = classify(headers)
            tables.append(
                TrialTable(file=path.name, index=number, headers=headers, rows=rows, kind=kind)
            )
            if kind is None:
                unrecognized.append(f"{path.name}, bảng {number}: {reason}")
    return TrialData(files=tuple(infos), tables=tuple(tables), unrecognized=tuple(unrecognized))
