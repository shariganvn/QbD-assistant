"""Evidence storage. A JSON file per run, replaced atomically; no database until one is needed."""

from __future__ import annotations

import json
import os
import tempfile
from collections.abc import Iterable
from pathlib import Path
from typing import Protocol

from pydantic import ValidationError

from qbd_core.shared.contracts import EvidenceRecord


class DuplicateEvidence(ValueError):
    pass


class StoreCorrupt(RuntimeError):
    pass


class EvidenceStorePort(Protocol):
    def add_many(self, records: Iterable[EvidenceRecord]) -> None: ...

    def get(self, evidence_id: str) -> EvidenceRecord | None: ...

    def records(self) -> tuple[EvidenceRecord, ...]: ...


class InMemoryEvidenceStore:
    def __init__(self) -> None:
        self._records: dict[str, EvidenceRecord] = {}

    def _merged(self, records: Iterable[EvidenceRecord]) -> dict[str, EvidenceRecord]:
        merged = dict(self._records)
        for record in records:
            if record.id in merged:
                raise DuplicateEvidence(record.id)
            merged[record.id] = record
        return merged

    def add_many(self, records: Iterable[EvidenceRecord]) -> None:
        self._records = self._merged(records)

    def get(self, evidence_id: str) -> EvidenceRecord | None:
        return self._records.get(evidence_id)

    def records(self) -> tuple[EvidenceRecord, ...]:
        return tuple(self._records.values())


class JsonFileEvidenceStore(InMemoryEvidenceStore):
    """All-or-nothing: a failed write leaves the previous file byte-for-byte intact."""

    def __init__(self, path: str | Path) -> None:
        super().__init__()
        self._path = Path(path)
        if self._path.exists():
            self._records = self._read()

    def _read(self) -> dict[str, EvidenceRecord]:
        try:
            items = json.loads(self._path.read_text(encoding="utf-8"))
            records = [EvidenceRecord.model_validate(item) for item in items]
        except (OSError, ValueError, TypeError, ValidationError) as error:
            raise StoreCorrupt(str(self._path)) from error
        if len({r.id for r in records}) != len(records):
            raise StoreCorrupt(f"duplicate ids in {self._path}")
        return {r.id: r for r in records}

    def add_many(self, records: Iterable[EvidenceRecord]) -> None:
        merged = self._merged(records)
        body = json.dumps(
            [r.model_dump(mode="json") for r in merged.values()], ensure_ascii=False, indent=2
        )
        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self._path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(body)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, self._path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
        self._records = merged
