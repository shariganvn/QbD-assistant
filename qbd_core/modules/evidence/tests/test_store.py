import hashlib
import os
from pathlib import Path

import pytest

from qbd_core.modules.evidence.api import (
    DuplicateEvidence,
    InMemoryEvidenceStore,
    JsonFileEvidenceStore,
    StoreCorrupt,
)
from qbd_core.shared.contracts import EvidenceRecord, Provenance


def rec(n):
    return EvidenceRecord(
        id=f"E-{n}", text=f"câu {n}", provenance=Provenance(file="DOC-A", page=1, quote=f"câu {n}")
    )


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_memory_store_adds_and_gets():
    store = InMemoryEvidenceStore()
    store.add_many([rec(1), rec(2)])
    assert store.get("E-1") == rec(1)
    assert store.get("missing") is None
    assert [r.id for r in store.records()] == ["E-1", "E-2"]


def test_duplicate_id_is_refused_and_changes_nothing():
    store = InMemoryEvidenceStore()
    store.add_many([rec(1)])
    with pytest.raises(DuplicateEvidence):
        store.add_many([rec(2), rec(1)])
    assert [r.id for r in store.records()] == ["E-1"]


def test_file_store_round_trips_across_instances(tmp_path):
    path = tmp_path / "run" / "evidence.json"
    JsonFileEvidenceStore(path).add_many([rec(1), rec(2)])
    again = JsonFileEvidenceStore(path)
    assert again.records() == (rec(1), rec(2))


def test_file_content_is_deterministic(tmp_path):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    JsonFileEvidenceStore(a).add_many([rec(1), rec(2)])
    JsonFileEvidenceStore(b).add_many([rec(1), rec(2)])
    assert sha(a) == sha(b)


def test_failed_write_leaves_the_previous_file_untouched(tmp_path, monkeypatch):
    path = tmp_path / "evidence.json"
    store = JsonFileEvidenceStore(path)
    store.add_many([rec(1)])
    before = sha(path)

    def boom(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        store.add_many([rec(2)])
    assert sha(path) == before
    assert [r.id for r in store.records()] == ["E-1"]
    assert list(tmp_path.glob("*.tmp")) == []


@pytest.mark.parametrize(
    "content",
    ["not json", '{"a": 1}', '[{"id": "x"}]', '[{"id":"E-1","text":"t"}]'],
)
def test_corrupt_file_is_refused_not_repaired(tmp_path, content):
    path = tmp_path / "evidence.json"
    path.write_text(content, encoding="utf-8")
    with pytest.raises(StoreCorrupt):
        JsonFileEvidenceStore(path)
    assert path.read_text(encoding="utf-8") == content
