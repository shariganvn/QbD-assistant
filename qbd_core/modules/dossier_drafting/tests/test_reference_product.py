import copy
import dataclasses
import json
import subprocess
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents, load_trial_data
from qbd_core.modules.quality_gate.api import evaluate_run
from qbd_core.tests.docx_factory import make_docx

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
DOCS = Path(__file__).parent / "fixtures" / "documents.json"
REPORT = REPO / "docs/raw/135-00-Pharmaceutical Development-example.docx"
TODAY = date(2026, 10, 21)
COMPOSITION = [["Components", "Concor 5 mg", "Concor 10 mg"], ["a", "1", "2"]]
TESTS = [
    ["Characteristics", "RMP 5 mg (batch A)", "RMP 10 mg (batch B)", "API 5 mg", "API 10 mg"],
    ["Appearance", "White round tablet", "White round tablet", "mine", "mine"],
    ["Mean mass (mg)", "100.2", "200.4", "99.0", "199.0"],
    ["Hardness (N)", "50", "<<to fill>>", "48", "47"],
    ["Notes", "x", "x", "y", "y"],
]
FORM = [
    ["Components", "RMP 5 mg", "RMP 10 mg"],
    ["Pharmaceutical form", "film coated tablet", "film coated tablet"],
]


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
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.2.1.1")


def info(run):
    return {r[0]: r[1:] for r in section(run)["blocks"][1]["rows"]}


def test_only_columns_labelled_as_the_reference_product_fill_the_section(tmp_path):
    run, _ = run_with(tmp_path, COMPOSITION, TESTS, FORM)
    rows = info(run)
    assert rows["Khối lượng trung bình"][0].startswith("100.2 [dữ liệu: trial-1.docx, bảng 2,")
    assert rows["Khối lượng trung bình"][1].startswith("200.4 [dữ liệu:")
    assert "99.0" not in json.dumps(section(run), ensure_ascii=False)  # the product's own column
    assert rows["Độ cứng"][0].startswith("50 [dữ liệu:")
    assert "CẦN BỔ SUNG" in rows["Độ cứng"][1]  # a placeholder is empty
    assert section(run)["blocks"][0]["rows"][1][1].startswith("film coated tablet [dữ liệu:")
    assert "xem hồ sơ hòa tan" in rows["Tương đương độ hòa tan — điều kiện thử"][0]


def test_the_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, TESTS, FORM)
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_columns_without_a_reference_label_never_fill_it(tmp_path):
    brand = [row[:3] for row in TESTS]
    brand[0] = ["Characteristics", "Concor 5 mg", "Concor 10 mg"]
    run, _ = run_with(tmp_path, COMPOSITION, brand)
    assert section(run)["status"] == "gap"
    assert any("agent 3.1" in line and "gắn nhãn thuốc đối chiếu" in line for line in run.agent_log)


def test_two_different_values_for_one_row_are_a_conflict_not_a_choice(tmp_path):
    other = [["Characteristics", "RMP 5 mg"], ["Mean mass (mg)", "101.0"]]
    run, _ = run_with(tmp_path, COMPOSITION, TESTS, other)
    cell = info(run)["Khối lượng trung bình"][0]
    assert cell.startswith("[CHƯA CÓ DỮ LIỆU") and "khác nhau" in cell
    assert any("khác nhau" in line for line in run.agent_log if "agent 3.1" in line)


def test_a_reference_column_without_strength_takes_the_only_strength_of_its_table(tmp_path):
    table = [["Characteristics", "RMP", "API 5 mg"], ["Mean mass (mg)", "100.2", "99.0"]]
    run, _ = run_with(tmp_path, [["Components", "Concor 5 mg"], ["a", "1"]], table)
    assert info(run)["Khối lượng trung bình"][0].startswith("100.2 [dữ liệu:")


def test_a_changed_reference_value_is_blocked(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, TESTS, FORM)
    draft = copy.deepcopy(run.draft)
    block = next(s for s in draft["sections"] if s["id"] == "P.2.2.1.1")["blocks"][1]
    row = next(r for r in block["rows"] if r[0] == "Khối lượng trung bình")
    row[1] = row[1].replace("100.2", "110.2")
    report = evaluate_run(dataclasses.replace(run, draft=draft), knowledge)
    assert "E_DATA_NUMBER_UNSUPPORTED" in {f.code for f in report.blocking}


@pytest.mark.skipif(not REPORT.exists(), reason="example report not in the checkout")
def test_the_example_report_labels_no_column_as_reference_so_nothing_is_filled():
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
