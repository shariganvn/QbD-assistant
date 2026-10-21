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


def composition(*labels):
    return [["Components", *labels], ["Atorvastatin", *["5"] * len(labels)]]


def trial_of(tmp_path, *tables, name="trial-1.docx"):
    return load_trial_data([str(make_docx(tmp_path / name, list(tables)))])


def run_with(tmp_path, *tables):
    trial = trial_of(tmp_path, *tables)
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    knowledge = InMemoryKnowledge(load_documents(DOCS))
    return assemble_draft(intake, knowledge, TODAY, trial=trial), knowledge


def test_strengths_are_read_in_ascending_order_from_the_headers(tmp_path):
    trial = trial_of(tmp_path, composition("API 10 mgfilm coated", "API 5 mgfilm coated"))
    found = read_strengths(trial)
    assert found.strengths == ("5 mg", "10 mg") and found.conflict is None


def test_several_tables_that_agree_give_one_list(tmp_path):
    a = composition("Concor 5 mg", "Concor 10 mg")
    b = composition("API 10 mg", "API 5 mg")
    assert read_strengths(trial_of(tmp_path, a, b)).strengths == ("5 mg", "10 mg")


@pytest.mark.parametrize(
    "tables, why",
    [
        ([composition("A 5 mg", "A 10 mg"), composition("B 5 mg", "B 20 mg")], "khác nhau"),
        ([composition("A 5 mg", "A 500 mcg")], "khác đơn vị"),
        ([composition("A 5 mg", "A 5.0 mg")], "hai cách"),
    ],
)
def test_disagreeing_tables_declare_nothing_and_say_why(tmp_path, tables, why):
    found = read_strengths(trial_of(tmp_path, *tables))
    assert found.strengths == () and why in found.conflict


def test_reference_and_test_product_columns_with_the_same_strength_are_one_strength(tmp_path):
    table = composition("Concor 5 mg", "Concor 10 mg", "API 5 mg", "API 10 mg")
    assert read_strengths(trial_of(tmp_path, table)).strengths == ("5 mg", "10 mg")


def test_no_composition_table_or_no_trial_means_no_strengths(tmp_path):
    assert read_strengths(None).strengths == ()
    assert read_strengths(trial_of(tmp_path, [["Ghi chú", "x"], ["a", "b"]])).strengths == ()


def section(run, sid):
    return next(s for s in run.draft["sections"] if s["id"] == sid)


def test_two_strengths_open_the_second_strength_sections(tmp_path):
    run, knowledge = run_with(tmp_path, composition("Concor 5 mg", "Concor 10 mg"))
    meta = run.draft["meta"]
    assert meta["strengths"] == ["5 mg", "10 mg"] and meta["notApplicableSections"] == []
    registered = {g.section_id for g in run.gaps}
    assert {"P.2.2.3.3.3", "P.2.2.3.4.2", "P.2.3.3.2"} <= registered
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_one_strength_keeps_the_second_strength_sections_not_applicable(tmp_path):
    run, _ = run_with(tmp_path, composition("Concor 5 mg"))
    assert run.draft["meta"]["strengths"] == ["5 mg"]
    assert run.draft["meta"]["notApplicableSections"] == ["P.2.2.3.3.3", "P.2.2.3.4.2", "P.2.3.3.2"]


def test_a_conflict_keeps_the_gap_marker_and_is_reported(tmp_path):
    run, knowledge = run_with(
        tmp_path, composition("A 5 mg", "A 10 mg"), composition("B 5 mg", "B 20 mg")
    )
    assert "CẦN BỔ SUNG" in run.draft["meta"]["strengths"][0]
    assert any("không khai báo hàm lượng" in line for line in run.agent_log)
    assert evaluate_run(run, knowledge).passed


def test_more_strengths_than_the_outline_can_report_are_not_declared(tmp_path):
    run, knowledge = run_with(tmp_path, composition("A 5 mg", "A 10 mg", "A 20 mg"))
    assert "CẦN BỔ SUNG" in run.draft["meta"]["strengths"][0]
    assert any("chỉ có chỗ cho 2" in line for line in run.agent_log)
    assert evaluate_run(run, knowledge).passed


def test_a_strength_not_in_the_data_is_blocked(tmp_path):
    run, knowledge = run_with(tmp_path, composition("Concor 5 mg", "Concor 10 mg"))
    draft = copy.deepcopy(run.draft)
    draft["meta"]["strengths"] = ["5 mg", "20 mg"]
    report = evaluate_run(dataclasses.replace(run, draft=draft), knowledge)
    assert "E_STRENGTH_NOT_IN_DATA" in {f.code for f in report.blocking}
    report = evaluate_run(dataclasses.replace(run, trial=None), knowledge)
    assert "E_STRENGTH_NOT_IN_DATA" in {f.code for f in report.blocking}


@pytest.mark.skipif(not REPORT.exists(), reason="example report not in the checkout")
def test_the_example_report_gives_5_and_10_mg():
    assert read_strengths(load_trial_data([str(REPORT)])).strengths == ("5 mg", "10 mg")
