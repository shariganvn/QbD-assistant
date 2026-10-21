import copy
import dataclasses
import json
import subprocess
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
from qbd_core.modules.evidence.api import (
    InMemoryKnowledge,
    classify,
    load_documents,
    load_trial_data,
    read_strengths,
)
from qbd_core.modules.quality_gate.api import evaluate_run
from qbd_core.tests.docx_factory import make_docx

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
DOCS = Path(__file__).parent / "fixtures" / "documents.json"
REPORT = REPO / "docs/raw/135-00-Pharmaceutical Development-example.docx"
TODAY = date(2026, 10, 21)
HEAD = [
    "No.",
    "Name of ingredient",
    "Function",
    "API 5 mg film coated",
    "API 10 mg film coated",
    "",
    "",
]
UNITS = ["", "", "", "mg", "%", "mg", "%"]


def formula(*rows, head=HEAD):
    return [head, UNITS, *rows]


FILLED = formula(
    ["1", "Active fumarate", "Active ingredient", "5.0", "5.2", "10.0", "10.4"],
    ["2", "Calcium hydrogen phosphate", "Filler", "90.0", "93.8", "90.0", "93.6"],
    ["", "Purified water", "Solvent", "q.s", "-", "q.s", "-"],
    ["Total 1", "-", "", "95.0", "100", "100.0", "100"],
)


def run_with(tmp_path, *tables):
    trial = load_trial_data([str(make_docx(tmp_path / "trial-1.docx", list(tables)))])
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    knowledge = InMemoryKnowledge(load_documents(DOCS))
    return assemble_draft(intake, knowledge, TODAY, trial=trial), knowledge


def section(run):
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.2.1.4")


def test_a_formula_table_is_its_own_kind_not_a_composition_table():
    assert classify(tuple(HEAD))[0] == "final_formula"
    assert classify(("Components", "Concor 5 mg", "Concor 10 mg"))[0] == "composition"


def test_strengths_are_read_from_the_formula_table_too(tmp_path):
    trial = load_trial_data([str(make_docx(tmp_path / "t.docx", [FILLED]))])
    assert read_strengths(trial).strengths == ("5 mg", "10 mg")


def test_the_formula_fills_one_column_group_per_strength(tmp_path):
    run, _ = run_with(tmp_path, FILLED)
    table = section(run)["blocks"][0]
    assert table["headers"] == [
        "STT",
        "Tên thành phần",
        "Chức năng",
        "5 mg – mg",
        "5 mg – %",
        "10 mg – mg",
        "10 mg – %",
    ]
    assert len(table["rows"]) == 4
    assert table["rows"][1][1].startswith(
        "Calcium hydrogen phosphate [dữ liệu: trial-1.docx, bảng 1,"
    )
    assert table["rows"][1][3].startswith("90.0 [dữ liệu:") and table["rows"][1][5].startswith(
        "90.0"
    )
    assert "CẦN BỔ SUNG" in table["rows"][2][0]  # the blank STT cell is a marked gap


def test_the_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, FILLED)
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_a_changed_amount_is_blocked_by_its_cell_tag(tmp_path):
    run, knowledge = run_with(tmp_path, FILLED)
    draft = copy.deepcopy(run.draft)
    row = next(s for s in draft["sections"] if s["id"] == "P.2.2.1.4")["blocks"][0]["rows"][1]
    row[3] = row[3].replace("90.0", "91.0", 1)
    report = evaluate_run(dataclasses.replace(run, draft=draft), knowledge)
    assert "E_DATA_NUMBER_UNSUPPORTED" in {f.code for f in report.blocking}


COMPOSITION = [["Components", "Concor 5 mg", "Concor 10 mg"], ["a", "1", "2"]]
ODD_WIDTH = [
    ["No.", "Name of ingredient", "Function", "API 5 mg", "API 10 mg", "x"],
    ["", "", "", "mg", "%", "mg"],
    ["1", "A", "B", "1", "2", "3"],
]
NO_FUNCTION = [["No.", "Name of ingredient", "API 5 mg", "API 10 mg"], ["1", "A", "1", "2"]]


@pytest.mark.parametrize(
    "table, why",
    [
        (formula(["", "A", "B", "", "", "", ""]), "chưa có số"),
        (ODD_WIDTH, "chia đều"),
        (NO_FUNCTION, None),
    ],
)
def test_a_table_that_does_not_fit_is_reported_not_guessed(tmp_path, table, why):
    run, _ = run_with(tmp_path, COMPOSITION, table)
    assert section(run)["status"] == "gap"
    if why:
        assert any(why in line for line in run.agent_log if line.startswith("agent 6.4"))


def test_without_declared_strengths_the_section_stays_a_gap(tmp_path):
    head = ["No.", "Name", "Function", "Dose", "Dose", "", ""]
    run, _ = run_with(tmp_path, formula(["1", "A", "B", "1", "2", "3", "4"], head=head))
    assert section(run)["status"] == "gap"


@pytest.mark.skipif(not REPORT.exists(), reason="example report not in the checkout")
def test_the_example_report_has_an_empty_formula_so_nothing_is_filled():
    trial = load_trial_data([str(REPORT)])
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    run = assemble_draft(intake, InMemoryKnowledge(load_documents(DOCS)), TODAY, trial=trial)
    assert section(run)["status"] == "gap"
    assert any("bảng công thức cuối chưa có số" in line for line in run.agent_log)
