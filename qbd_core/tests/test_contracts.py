import pytest
from pydantic import ValidationError

from qbd_core.shared.contracts import (
    Citation,
    Classification,
    DraftSection,
    EvidenceRecord,
    GapEntry,
    IntakeRequest,
    Market,
    Provenance,
)

PROV = Provenance(file="a.pdf", page=3, quote="q")
CITE = Citation(source="s", address="https://example.org", accessed="2026-10-21")


@pytest.mark.parametrize(
    "model",
    [
        IntakeRequest(substances=("x",), dosage_form="f", market=Market.BOTH),
        EvidenceRecord(id="e1", text="t", provenance=PROV),
        EvidenceRecord(id="e2", text="t", citation=CITE, classification=Classification.A),
        GapEntry(section_id="P.2.1.1", reason="no source"),
        DraftSection(id="P.2.1.1", title="t", status="content", body="b", evidence_ids=("e1",)),
        DraftSection(
            id="P.2.1.2",
            title="t",
            status="gap",
            gaps=(GapEntry(section_id="P.2.1.2", reason="r"),),
        ),
    ],
)
def test_round_trip(model):
    assert type(model).model_validate_json(model.model_dump_json()) == model


@pytest.mark.parametrize(
    "build",
    [
        lambda: IntakeRequest(substances=(), dosage_form="f", market=Market.EU),
        lambda: IntakeRequest(substances=("x",), dosage_form="", market=Market.EU),
        lambda: IntakeRequest(substances=("x",), dosage_form="f", market="mars"),
        lambda: EvidenceRecord(id="e", text="t"),
        lambda: EvidenceRecord(id="e", text="t", provenance=PROV, citation=CITE),
        lambda: GapEntry(section_id="s", reason="r", marker="N/A"),
        lambda: DraftSection(id="s", title="t", status="content"),
        lambda: DraftSection(id="s", title="t", status="gap"),
        lambda: DraftSection(id="s", title="t", status="content", body="b", extra=1),
    ],
)
def test_invalid_is_rejected(build):
    with pytest.raises(ValidationError):
        build()


def test_unlabeled_evidence_is_most_restricted():
    record = EvidenceRecord(id="e", text="t", provenance=PROV)
    assert record.classification is Classification.UNKNOWN
