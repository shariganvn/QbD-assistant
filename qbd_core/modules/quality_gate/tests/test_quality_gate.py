import copy
import dataclasses
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import (
    CqaConfirmation,
    assemble_draft,
    intake_digest,
    load_outline,
    propose_cqa,
    validate_intake,
)
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents
from qbd_core.modules.quality_gate.api import evaluate_run
from qbd_core.shared.contracts import EvidenceRecord, Provenance

DOCS = Path(__file__).resolve().parents[2] / "dossier_drafting/tests/fixtures/documents.json"
TODAY = date(2026, 10, 21)
OUTLINE = load_outline()
LEAVES = [s["id"] for s in OUTLINE["sections"] if not s.get("container")]


def kb():
    return InMemoryKnowledge(load_documents(DOCS))


def make_run(market="both", form="Viên nén bao phim", confirmation=None):
    intake = validate_intake(
        {"substances": ["Atorvastatin calcium"], "dosage_form": form, "market": market}
    )
    return assemble_draft(intake, kb(), TODAY, confirmation=confirmation)


def with_draft(run, edit):
    draft = copy.deepcopy(run.draft)
    edit(draft)
    return dataclasses.replace(run, draft=draft)


def codes(report):
    return sorted({f.code for f in report.blocking})


def section(draft, sid):
    return next(s for s in draft["sections"] if s["id"] == sid)


def test_a_clean_run_passes_with_seventeen_checklist_rows():
    report = evaluate_run(make_run(), kb())
    assert report.passed and codes(report) == []
    assert [c.no for c in report.checklist] == list(range(1, 18))
    status = {c.no: c.status for c in report.checklist}
    assert status[16] == "pass" and status[17] == "pass" and status[8] == "review"
    assert status[1] == "open"


def test_a_content_item_is_never_passed_by_code():
    statuses = {c.status for c in evaluate_run(make_run(), kb()).checklist if c.no <= 14}
    assert statuses <= {"open", "review", "na"}


def test_same_run_gives_the_same_report_and_it_repeats_no_draft_text():
    a, b = evaluate_run(make_run(), kb()), evaluate_run(make_run(), kb())
    assert a.model_dump_json() == b.model_dump_json()
    assert "Câu tổng hợp" not in a.model_dump_json()


def test_unsourced_covered_text_is_blocked():
    run = with_draft(
        make_run(),
        lambda d: section(d, "P.2.1.1.2")["blocks"].append(
            {"type": "paragraph", "text": "Tự viết."}
        ),
    )
    report = evaluate_run(run, kb())
    assert "E_UNSOURCED_TEXT" in codes(report) and not report.passed
    assert {c.no: c.status for c in report.checklist}[16] == "fail"


def tag_edit(old, new):
    def edit(draft):
        block = section(draft, "P.2.1.1.2")["blocks"][0]
        block["text"] = block["text"].replace(old, new)

    return edit


@pytest.mark.parametrize(
    "old_new",
    [("trang 2", "trang 1"), ("SYN-A", "SYN-B"), ("Câu tổng hợp", "Câu đã sửa")],
)
def test_a_tag_that_does_not_match_its_record_is_blocked(old_new):
    report = evaluate_run(with_draft(make_run(), tag_edit(*old_new)), kb())
    assert "E_SOURCE_MISMATCH" in codes(report)


def test_an_unknown_evidence_id_is_blocked():
    run = make_run()
    bad = dataclasses.replace(run, evidence=())
    assert "E_SOURCE_MISMATCH" in codes(evaluate_run(bad, kb()))


def test_a_record_whose_quote_is_not_on_the_cited_page_is_unverified():
    run = make_run()
    forged = []
    for record in run.evidence:
        if record.provenance.file == "SYN-A":
            prov = Provenance(file="SYN-A", page=2, quote="Một câu không có trên trang.")
            record = EvidenceRecord(
                id=record.id,
                text=record.text,
                classification=record.classification,
                provenance=prov,
            )
        forged.append(record)
    report = evaluate_run(dataclasses.replace(run, evidence=tuple(forged)), kb())
    assert "E_SOURCE_UNVERIFIED" in codes(report)


def test_table_cells_with_numbers_need_a_source_unless_marked():
    def add(draft):
        table = {
            "type": "table",
            "headers": ["A", "B"],
            "rows": [["x", "12,5"], ["y", "[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]"], ["z", "chữ"]],
        }
        section(draft, "P.2.1.1.2")["blocks"].append(table)

    report = evaluate_run(with_draft(make_run(), add), kb())
    findings = [f for f in report.blocking if f.code == "E_VALUE_WITHOUT_SOURCE"]
    assert len(findings) == 1 and findings[0].section_id == "P.2.1.1.2"


def test_a_cited_file_must_be_listed_as_a_reference():
    run = with_draft(make_run(), lambda d: d["meta"].update(referenceSources=["Kho, file SYN-B"]))
    findings = [f for f in evaluate_run(run, kb()).blocking if f.code == "E_REFERENCE_MISSING"]
    assert [f.detail for f in findings] == ["SYN-A"]


def test_duplicate_evidence_is_blocked():
    run = make_run()
    doubled = dataclasses.replace(run, evidence=run.evidence + run.evidence[:1])
    assert "E_DUPLICATE_EVIDENCE" in codes(evaluate_run(doubled, kb()))


def confirmed(i):
    return CqaConfirmation.model_validate(
        {
            "intake_digest": intake_digest(i),
            "confirmed_cqa": list(propose_cqa(i).candidates[:2]),
            "confirmed_by": "Tiển",
            "confirmed_on": "2026-10-20",
        }
    )


def test_confirmed_cqa_text_is_authored_and_allowed():
    i = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    run = assemble_draft(i, kb(), TODAY, confirmation=confirmed(i))
    assert run.cqa_status == "confirmed" and evaluate_run(run, kb()).passed


def test_cqa_content_without_a_confirmation_is_blocked():
    i = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    confirmed_run = assemble_draft(i, kb(), TODAY, confirmation=confirmed(i))
    pending = dataclasses.replace(confirmed_run, cqa_status="pending")
    found = codes(evaluate_run(pending, kb()))
    assert "E_CQA_UNCONFIRMED_CONTENT" in found and "E_UNSOURCED_TEXT" in found


@pytest.mark.parametrize(
    ("edit", "detail"),
    [
        (lambda d: d["meta"].update(apiName="Another substance"), "apiName"),
        (lambda d: d["meta"].update(productName="Atorvastatin calcium"), "productName"),
    ],
)
def test_meta_must_match_the_input(edit, detail):
    report = evaluate_run(with_draft(make_run(), edit), kb())
    assert [f.detail for f in report.blocking if f.code == "E_META_MISMATCH"] == [detail]
    assert {c.no: c.status for c in report.checklist}[17] == "fail"


def test_the_gap_register_must_match_the_draft():
    run = make_run()
    short = dataclasses.replace(run, gaps=run.gaps[1:])
    found = [f for f in evaluate_run(short, kb()).blocking if f.code == "E_GAP_REGISTER_MISMATCH"]
    assert [f.section_id for f in found] == [run.gaps[0].section_id]


def test_the_restricted_flag_must_be_truthful():
    run = make_run()
    assert run.contains_restricted
    lying = dataclasses.replace(run, contains_restricted=False)
    assert "E_RESTRICTED_FLAG_MISMATCH" in codes(evaluate_run(lying, kb()))
    assert any(f.code == "I_RESTRICTED_TEXT" for f in evaluate_run(run, kb()).findings)


def test_numbering_follows_the_market():
    eu = {r.section_id: r for r in evaluate_run(make_run("eu"), kb()).numbering}
    domestic = {r.section_id: r for r in evaluate_run(make_run("domestic"), kb()).numbering}
    both = {r.section_id: r for r in evaluate_run(make_run("both"), kb()).numbering}
    assert set(eu) == set(domestic) == set(both) == set(LEAVES)
    assert all(r.actd is None and r.requirement == "required" for r in eu.values())
    assert (
        domestic["P.2.2.1.1"].actd == "P2.3.1" and domestic["P.2.2.1.1"].requirement == "mandatory"
    )
    assert (
        domestic["P.2.1.2.1"].actd == "P2.2.2"
        and domestic["P.2.1.2.1"].requirement == "not_required"
    )
    assert domestic["P.2.3.2"].requirement == "recommended"
    assert both["P.2.5"].ctd == "3.2.P.2.5" and both["P.2.5"].actd == "P2.6"


def test_an_unmapped_section_blocks():
    odd = {"sections": [{"id": "P.2.9.9", "ctdReference": "3.2.P.2.9.9", "headingVi": "x"}]}
    report = evaluate_run(make_run(), kb(), odd)
    assert "E_NUMBERING_UNMAPPED" in codes(report)
    assert {c.no: c.status for c in report.checklist}[15] == "fail"


def test_actd_numbering_is_flagged_as_not_yet_checked_against_the_official_text():
    both = evaluate_run(make_run("both"), kb())
    eu = evaluate_run(make_run("eu"), kb())
    assert not both.actd_map_verified and any(
        f.code == "I_ACTD_MAP_UNVERIFIED" for f in both.findings
    )
    assert {c.no: c.status for c in both.checklist}[15] == "review"
    assert {c.no: c.status for c in eu.checklist}[15] == "pass"


def test_items_that_do_not_apply_to_the_market_are_na():
    domestic = {c.no: c.status for c in evaluate_run(make_run("domestic"), kb()).checklist}
    assert domestic[4] == "na"
    assert {c.no: c.status for c in evaluate_run(make_run("eu"), kb()).checklist}[4] == "open"


def test_a_fully_covered_item_is_for_review_and_an_all_na_item_is_na():
    def cover(draft):
        text = {"type": "paragraph", "text": "Không áp dụng."}
        draft["sections"] = [
            {"id": s["id"], "status": "covered", "blocks": [text]}
            if s["id"] in ("P.2.5", "P.2.6")
            else s
            for s in draft["sections"]
        ]

    report = evaluate_run(with_draft(make_run("eu"), cover), kb())
    assert {c.no: c.status for c in report.checklist}[14] == "review"
