"""The project's Kho manifest: ids and classes only; only approved class A may leave the machine."""

import re
from collections import Counter
from pathlib import Path

import pytest

from qbd_core.modules.egress_gate.api import (
    Destination,
    Payload,
    PayloadPart,
    check_egress,
    try_load_manifest,
)

PATH = Path(__file__).parents[4] / "docs/kho/manifest.json"
pytestmark = pytest.mark.skipif(not PATH.exists(), reason="no Kho manifest in this checkout")


@pytest.fixture(scope="module")
def manifest():
    loaded = try_load_manifest(PATH)
    assert loaded is not None
    return loaded


def allowed(manifest, file_id):
    part = PayloadPart(kind="evidence", text="câu hỏi", source_ids=(file_id,))
    return check_egress(Payload(parts=(part,)), Destination.REMOTE, manifest).allowed


def test_counts_by_class(manifest):
    counts = Counter(e.classification for e in manifest.entries)
    assert counts == {"A": 19, "B": 82, "C": 10}
    assert len({e.file_id for e in manifest.entries}) == 111


def test_only_class_a_is_approved(manifest):
    for entry in manifest.entries:
        approved = entry.approved_by is not None and entry.approved_on is not None
        assert approved == (entry.classification == "A"), entry.file_id


def test_entries_hold_opaque_ids_not_document_names(manifest):
    assert all(re.fullmatch(r"[A-Za-z0-9_-]{33}", e.file_id) for e in manifest.entries)
    assert not PATH.read_text("utf-8").count(".pdf")


def test_egress_follows_the_class(manifest):
    for entry in manifest.entries:
        assert allowed(manifest, entry.file_id) == (entry.classification == "A")
    assert not allowed(manifest, "NOT-IN-THE-MANIFEST")
