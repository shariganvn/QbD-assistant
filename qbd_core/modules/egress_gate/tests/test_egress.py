import json
from pathlib import Path

import pytest

from qbd_core.modules.egress_gate.api import (
    Destination,
    Payload,
    PayloadPart,
    check_egress,
    try_load_manifest,
)

FIXTURES = Path(__file__).parent / "fixtures"
MANIFEST = try_load_manifest(FIXTURES / "manifest.json")
TEXT = json.loads((FIXTURES / "texts.json").read_text(encoding="utf-8"))
REMOTE = Destination.REMOTE


def evidence(text, *sources):
    return PayloadPart(kind="evidence", text=text, source_ids=tuple(sources))


def send(*parts, manifest=MANIFEST, destination=REMOTE):
    return check_egress(Payload(parts=tuple(parts)), destination, manifest)


def codes(decision):
    return [r.code for r in decision.reasons]


def test_manifest_fixture_loads():
    assert MANIFEST is not None and len(MANIFEST.entries) == 5


def test_approved_class_a_evidence_may_leave():
    decision = send(evidence(TEXT["safe"], "A-APPROVED"))
    assert decision.allowed and not decision.reasons


def test_instruction_and_intake_parts_may_leave():
    decision = send(
        PayloadPart(kind="instruction", text="Write the section."),
        PayloadPart(kind="intake", text="Atorvastatin calcium"),
    )
    assert decision.allowed


@pytest.mark.parametrize(
    ("source", "code"),
    [
        ("B-BOOK", "E_SOURCE_RESTRICTED"),
        ("C-INTERNAL", "E_SOURCE_RESTRICTED"),
        ("Q-UNSORTED", "E_SOURCE_RESTRICTED"),
        ("A-PENDING", "E_SOURCE_UNAPPROVED"),
        ("NOT-IN-MANIFEST", "E_SOURCE_UNKNOWN"),
    ],
)
def test_restricted_or_unproven_sources_are_blocked(source, code):
    decision = send(evidence(TEXT["safe"], source))
    assert not decision.allowed
    assert codes(decision) == [code]
    assert decision.reasons[0].source_id == source


def test_evidence_without_a_source_is_blocked():
    assert codes(send(evidence(TEXT["safe"]))) == ["E_PART_UNATTRIBUTED"]


@pytest.mark.parametrize("secret", ["secret_b", "secret_c"])
@pytest.mark.parametrize("kind", ["instruction", "intake", "evidence"])
def test_restricted_text_is_caught_whatever_the_part_claims(secret, kind):
    sources = ("A-APPROVED",) if kind == "evidence" else ()
    part = PayloadPart(kind=kind, text=f"Tóm tắt: {TEXT[secret]}.", source_ids=sources)
    decision = send(part)
    assert not decision.allowed
    assert "E_RESTRICTED_TEXT" in codes(decision)


def test_one_bad_part_blocks_the_whole_payload():
    decision = send(evidence(TEXT["safe"], "A-APPROVED"), evidence(TEXT["safe"], "B-BOOK"))
    assert not decision.allowed
    assert [r.part_index for r in decision.reasons] == [1]


def test_missing_manifest_blocks_every_remote_send():
    decision = send(PayloadPart(kind="instruction", text="hi"), manifest=None)
    assert codes(decision) == ["E_MANIFEST_MISSING"]
    assert not decision.allowed


def test_local_destination_leaves_nothing_behind():
    decision = send(evidence(TEXT["secret_b"], "B-BOOK"), destination=Destination.LOCAL)
    assert decision.allowed


def test_decision_never_repeats_payload_text():
    decision = send(evidence(TEXT["secret_b"], "B-BOOK"))
    assert TEXT["secret_b"] not in decision.model_dump_json()


@pytest.mark.parametrize(
    "content",
    ["not json", '{"entries": "x"}', '{"entries": [{"file_id": "a", "classification": "Z"}]}'],
)
def test_unreadable_manifest_yields_none(tmp_path, content):
    path = tmp_path / "m.json"
    path.write_text(content, encoding="utf-8")
    assert try_load_manifest(path) is None


def test_missing_and_duplicate_manifest_yield_none(tmp_path):
    assert try_load_manifest(tmp_path / "absent.json") is None
    entry = {"file_id": "a", "classification": "A"}
    path = tmp_path / "dup.json"
    path.write_text(json.dumps({"entries": [entry, entry]}), encoding="utf-8")
    assert try_load_manifest(path) is None
