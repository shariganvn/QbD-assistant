from pathlib import Path

import pytest

from qbd_core.modules.evidence.api import InMemoryKnowledge, evidence_id, load_documents
from qbd_core.shared.contracts import Classification

DOCS = load_documents(Path(__file__).parent / "fixtures" / "documents.json")
KB = InMemoryKnowledge(DOCS)


def test_hit_carries_file_page_and_a_verbatim_quote():
    (hit, *_) = KB.search("độ tan trong nước của atorvastatin")
    assert (hit.provenance.file, hit.provenance.page) == ("DOC-A", 1)
    assert hit.provenance.quote in DOCS[0].pages[0]
    assert hit.text == hit.provenance.quote
    assert KB.verify(hit)


def test_search_ignores_accents_but_quotes_the_original_text():
    (hit, *_) = KB.search("vien nen bao phim bao quan o noi kho rao")
    assert hit.provenance.quote.startswith("Viên nén bao phim")


def test_classification_travels_with_the_hit():
    by_file = {r.provenance.file: r.classification for r in KB.search("tá dược lactose bôi trơn")}
    assert by_file["DOC-B"] is Classification.B
    unsorted = KB.search("tương kỵ hoạt chất tá dược DSC")[0]
    assert unsorted.classification is Classification.UNKNOWN


def test_no_match_returns_nothing_rather_than_a_guess():
    assert KB.search("polymorph screening of an unrelated molecule") == []
    assert KB.search("") == []
    assert KB.search("statin", limit=0) == []


def test_limit_and_order_are_stable():
    first = KB.search("hoạt chất tá dược statin", limit=2)
    assert len(first) <= 2
    assert first == KB.search("hoạt chất tá dược statin", limit=2)


def test_evidence_id_is_deterministic_and_content_bound():
    (hit, *_) = KB.search("độ tan trong nước")
    assert hit.id == evidence_id("DOC-A", 1, hit.provenance.quote)
    assert hit.id != evidence_id("DOC-A", 2, hit.provenance.quote)


@pytest.mark.parametrize(
    ("file", "page", "quote"),
    [
        ("DOC-A", 1, "A sentence that the page never contained."),
        ("DOC-A", 9, "Độ tan trong nước rất thấp."),
        ("NO-SUCH", 1, "Độ tan trong nước rất thấp."),
    ],
)
def test_tampered_provenance_fails_verification(file, page, quote):
    (hit, *_) = KB.search("độ tan trong nước")
    forged = hit.model_copy(
        update={
            "provenance": hit.provenance.model_copy(
                update={"file": file, "page": page, "quote": quote}
            )
        }
    )
    assert not KB.verify(forged)


def test_a_record_with_only_a_citation_cannot_be_verified_as_internal():
    from qbd_core.shared.contracts import Citation, EvidenceRecord

    external = EvidenceRecord(
        id="x",
        text="t",
        citation=Citation(source="s", address="https://e.org", accessed="2026-10-21"),
    )
    assert not KB.verify(external)


def test_duplicate_file_ids_are_refused():
    with pytest.raises(ValueError, match="duplicate"):
        InMemoryKnowledge([DOCS[0], DOCS[0]])


def test_a_document_set_must_be_a_list(tmp_path):
    path = tmp_path / "docs.json"
    path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="list"):
        load_documents(path)
    path.write_text("[]", encoding="utf-8")
    assert load_documents(path) == ()
