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
TODAY = date(2026, 10, 21)
SINK = [
    [
        "Medium",
        "Minimum theoretical concentration to meet sink conditions (mg/mL)",
        "Experimental concentration (mg/mL)",
    ],
    ["pH 1.2", "0.03", "0.38 ± 0.017"],
    ["pH 4.5", "0.03", "0.31 ± 0.005"],
    ["pH 6.8", "0.50", "0.11 ± 0.002"],
]


def run_with(tmp_path, tables, name="trial-1.docx"):
    trial = load_trial_data([str(make_docx(tmp_path / name, tables))])
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    knowledge = InMemoryKnowledge(load_documents(DOCS))
    return assemble_draft(intake, knowledge, TODAY, trial=trial), knowledge


def sink_section(run):
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.2.3.1.1")


def test_sink_table_becomes_tagged_sentences_with_a_computed_verdict(tmp_path):
    run, _ = run_with(tmp_path, [SINK])
    texts = [b["text"] for b in sink_section(run)["blocks"]]
    assert len(texts) == 3
    assert "0.38 ± 0.017 mg/mL, đáp ứng điều kiện sink" in texts[0]
    assert "chưa đáp ứng điều kiện sink" in texts[2]
    assert texts[0].count("[dữ liệu: trial-1.docx, bảng 1, hàng 1, cột ") == 3
    assert "P.2.2.3.1.1" not in {g.section_id for g in run.gaps}


def test_the_filled_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, [SINK])
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_missing_unit_or_unreadable_numbers_never_produce_a_number(tmp_path):
    no_unit = [["Medium", "Minimum sink", "Experimental"], ["pH 1.2", "0.03", "0.38"]]
    run, _ = run_with(tmp_path, [no_unit])
    assert sink_section(run)["status"] == "gap"
    blank = [SINK[0], ["pH 1.2", "", ""], ["pH 4.5", "0.03", "0.31"]]
    run, _ = run_with(tmp_path, [blank], name="trial-2.docx")
    texts = [b["text"] for b in sink_section(run)["blocks"]]
    assert texts[0].startswith("[CHƯA CÓ DỮ LIỆU") and "[dữ liệu:" not in texts[0]
    assert "[dữ liệu:" in texts[1]


def edited(run, change):
    draft = copy.deepcopy(run.draft)
    block = next(s for s in draft["sections"] if s["id"] == "P.2.2.3.1.1")["blocks"][0]
    block["text"] = change(block["text"])
    return dataclasses.replace(run, draft=draft)


@pytest.mark.parametrize(
    "change, code",
    [
        (lambda t: t.replace("0.38", "0.58", 1), "E_DATA_NUMBER_UNSUPPORTED"),
        (lambda t: t.replace("hàng 1, cột 3", "hàng 9, cột 3"), "E_DATA_SOURCE_MISMATCH"),
        (lambda t: t.replace("trial-1.docx", "other.docx"), "E_DATA_SOURCE_MISMATCH"),
        (lambda t: t.replace("bảng 1", "bảng 7"), "E_DATA_SOURCE_MISMATCH"),
        (lambda t: "[dữ liệu: trial-1.docx, bảng 1, hàng 1, cột 1]", "E_UNSOURCED_TEXT"),
    ],
)
def test_a_changed_number_or_tag_is_blocked(tmp_path, change, code):
    run, knowledge = run_with(tmp_path, [SINK])
    report = evaluate_run(edited(run, change), knowledge)
    assert code in {f.code for f in report.blocking}


def test_a_file_not_listed_as_a_source_is_blocked(tmp_path):
    run, knowledge = run_with(tmp_path, [SINK])
    draft = copy.deepcopy(run.draft)
    draft["meta"]["sourceFiles"] = ["something-else.docx"]
    report = evaluate_run(dataclasses.replace(run, draft=draft), knowledge)
    assert "E_DATA_FILE_NOT_LISTED" in {f.code for f in report.blocking}


def test_the_gate_cannot_verify_data_when_the_run_carries_no_trial(tmp_path):
    run, knowledge = run_with(tmp_path, [SINK])
    report = evaluate_run(dataclasses.replace(run, trial=None), knowledge)
    assert "E_DATA_SOURCE_MISMATCH" in {f.code for f in report.blocking}
