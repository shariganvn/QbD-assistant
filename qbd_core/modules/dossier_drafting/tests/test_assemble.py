import json
import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import (
    DraftingRefused,
    assemble_draft,
    validate_intake,
)
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
DOCS = Path(__file__).parent / "fixtures" / "documents.json"
TODAY = date(2026, 10, 21)
NOT_APPLICABLE = {"P.2.2.3.3.3", "P.2.2.3.4.2", "P.2.3.3.2"}


def intake(form="Viên nén bao phim", substances=("Atorvastatin calcium",)):
    return validate_intake({"substances": list(substances), "dosage_form": form, "market": "both"})


def kb():
    return InMemoryKnowledge(load_documents(DOCS))


def validate(draft, tmp_path):
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(draft, ensure_ascii=False), encoding="utf-8")
    return subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)


def covered(run):
    return {s["id"]: s for s in run.draft["sections"] if s["status"] == "covered"}


def test_thin_slice_draft_passes_the_stage_b_validator(tmp_path):
    run = assemble_draft(intake(), kb(), TODAY)
    result = validate(run.draft, tmp_path)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "43 sections" in result.stdout


def test_only_sections_with_evidence_are_covered_and_every_quote_verifies():
    run = assemble_draft(intake(), kb(), TODAY)
    assert set(covered(run)) == {"P.2.1.1.2", "P.2.2.2"}
    assert len(run.draft["sections"]) == 43
    assert len(run.gaps) == 38
    knowledge = kb()
    assert run.evidence and all(knowledge.verify(r) for r in run.evidence)
    for section in covered(run).values():
        assert all("[nguồn: SYN-" in b["text"] for b in section["blocks"])


def test_every_uncovered_section_is_a_marked_gap():
    run = assemble_draft(intake(), kb(), TODAY)
    for section in run.draft["sections"]:
        if section["status"] == "gap" and section["id"] not in NOT_APPLICABLE:
            assert section["gapReason"].startswith("[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]")


def test_second_strength_sections_are_plainly_not_applicable_and_not_data_requests():
    run = assemble_draft(intake(), kb(), TODAY)
    reasons = {s["id"]: s["gapReason"] for s in run.draft["sections"] if s["id"] in NOT_APPLICABLE}
    assert set(reasons) == NOT_APPLICABLE
    assert all(r.startswith("Không áp dụng") and "[CHƯA" not in r for r in reasons.values())
    assert NOT_APPLICABLE.isdisjoint({g.section_id for g in run.gaps})


def test_no_evidence_means_an_all_gap_draft_that_is_still_valid(tmp_path):
    run = assemble_draft(intake(), InMemoryKnowledge([]), TODAY)
    assert not covered(run) and len(run.gaps) == 40 and not run.evidence
    assert validate(run.draft, tmp_path).returncode == 0


def test_draft_states_what_it_does_not_know():
    meta = assemble_draft(intake(), kb(), TODAY).draft["meta"]
    assert "[CHƯA CÓ DỮ LIỆU" in meta["strengths"][0]
    assert "[CHƯA CÓ DỮ LIỆU" in meta["sourceFiles"][0]
    assert meta["referenceSources"] == [
        "Kho tài liệu nội bộ, file SYN-A",
        "Kho tài liệu nội bộ, file SYN-B",
    ]


def test_restricted_text_in_the_draft_is_flagged():
    assert assemble_draft(intake(), kb(), TODAY).contains_restricted
    only_a = InMemoryKnowledge([d for d in load_documents(DOCS) if d.file_id == "SYN-A"])
    assert not assemble_draft(intake(), only_a, TODAY).contains_restricted


def test_groups_without_internal_documents_carry_their_gaps():
    run = assemble_draft(intake("Siro"), kb(), TODAY)
    reasons = {s["id"]: s["gapReason"] for s in run.draft["sections"] if s["status"] == "gap"}
    assert "technology choice" in reasons["P.2.2.1.1"]
    assert "equivalence direction" in reasons["P.2.2.3.2"]
    plain = assemble_draft(intake(), kb(), TODAY)
    assert all("technology choice" not in s.get("gapReason", "") for s in plain.draft["sections"])


def test_a_combination_is_refused_not_guessed():
    with pytest.raises(DraftingRefused) as caught:
        assemble_draft(intake(substances=("A", "B")), kb(), TODAY)
    assert caught.value.code == "E_COMBINATION_NOT_SUPPORTED"


def test_same_input_gives_the_same_draft():
    a = assemble_draft(intake(), kb(), TODAY).draft
    b = assemble_draft(intake(), kb(), TODAY).draft
    assert json.dumps(a, ensure_ascii=False, sort_keys=True) == json.dumps(
        b, ensure_ascii=False, sort_keys=True
    )


def test_command_line_run_writes_a_valid_draft_and_rejects_bad_input(tmp_path):
    out = tmp_path / "out" / "draft.json"
    base = [sys.executable, "-m", "qbd_core", "run", "--documents", str(DOCS), "--out", str(out)]
    ok = subprocess.run(
        [
            *base,
            "--substance",
            "Atorvastatin calcium",
            "--form",
            "Viên nén bao phim",
            "--market",
            "Cả hai",
            "--date",
            "2026-10-21",
        ],
        capture_output=True,
        text=True,
        cwd=REPO,
    )
    assert ok.returncode == 0, ok.stderr
    assert validate(json.loads(out.read_text(encoding="utf-8")), tmp_path).returncode == 0
    before = out.read_bytes()
    bad = subprocess.run(
        [*base, "--substance", "A", "--form", "no such form", "--market", "eu"],
        capture_output=True,
        text=True,
        cwd=REPO,
    )
    assert bad.returncode == 2 and "E_FORM_UNKNOWN" in bad.stderr
    combo = subprocess.run(
        [*base, "--substance", "A", "--substance", "B", "--form", "Viên nén", "--market", "eu"],
        capture_output=True,
        text=True,
        cwd=REPO,
    )
    assert combo.returncode == 3
    assert out.read_bytes() == before
