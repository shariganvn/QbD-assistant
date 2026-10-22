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
COMPOSITION = [["Components", "Concor 5 mg", "Concor 10 mg"], ["Atorvastatin", "5", "10"]]


def profile(ref, test, strength="10 mg", conditions="Medium: 500 mL HCl 0.01 N", times=(5, 10, 15)):
    head = ["Average dissolution (%) ± SD", "", ""]
    rows = [
        ["Time (min.)", conditions, "Rotation speed: 50 rpm"],
        ["", "RMP (Biobatch)", f"API {strength} film coated tablets (Biobatch)"],
    ]
    for t, r, x in zip(times, ref, test, strict=True):
        rows.append([str(t), r, x])
    rows.append(["f2", "", ""])
    return [head, *rows]


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
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.2.3.2")


GOOD_REF, GOOD_TEST = ["50", "70", "90"], ["45", "65", "85"]
GOOD = profile(["50", "70 ± 3", "90"], ["45", "65 ± 2", "85"])


def test_f2_is_computed_by_code_and_the_section_fills_both_tables(tmp_path):
    run, _ = run_with(tmp_path, COMPOSITION, GOOD)
    first, second = section(run)["blocks"]
    assert first["headers"][0] == "Thời điểm lấy mẫu"
    assert first["headers"][3:] == ["10 mg – đối chiếu", "10 mg – thử"]
    assert first["rows"][1][3].startswith("70 ± 3 [dữ liệu: trial-1.docx, bảng 2, hàng ")
    assert second["rows"][0][1] == "64.6"
    assert (
        "[tính: f2, trial-1.docx, bảng 2, đối chiếu cột 2, thử cột 3, hàng 3-5]"
        in second["rows"][0][0]
    )
    assert "5 mg" in first["headers"][1] and "chưa có số liệu" in first["rows"][0][1]


def test_the_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, GOOD)
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def swap_columns(row):
    row[0] = row[0].replace("thử cột 3", "thử cột 2")


def edit_f2(run, change):
    draft = copy.deepcopy(run.draft)
    second = section(dataclasses.replace(run, draft=draft))["blocks"][1]
    change(second["rows"][0])
    return dataclasses.replace(run, draft=draft)


@pytest.mark.parametrize(
    "change, code",
    [
        (lambda row: row.__setitem__(1, "99.9"), "E_CALC_MISMATCH"),
        (lambda row: row.__setitem__(0, row[0].replace("hàng 3-5", "hàng 3-9")), "E_CALC_INPUT"),
        (
            lambda row: row.__setitem__(0, row[0].replace("thử cột 3", "thử cột 2")),
            "E_CALC_MISMATCH",
        ),
        (lambda row: row.__setitem__(0, row[0].split("[tính")[0]), "E_VALUE_WITHOUT_SOURCE"),
    ],
)
def test_a_wrong_f2_or_a_tag_that_does_not_support_it_is_blocked(tmp_path, change, code):
    run, knowledge = run_with(tmp_path, COMPOSITION, GOOD)
    report = evaluate_run(edit_f2(run, change), knowledge)
    assert code in {f.code for f in report.blocking}


def test_a_changed_profile_value_is_blocked_by_the_data_tag(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, GOOD)
    draft = copy.deepcopy(run.draft)
    first = next(s for s in draft["sections"] if s["id"] == "P.2.2.3.2")["blocks"][0]
    first["rows"][0][3] = first["rows"][0][3].replace("50", "55", 1)
    report = evaluate_run(dataclasses.replace(run, draft=draft), knowledge)
    assert "E_DATA_NUMBER_UNSUPPORTED" in {f.code for f in report.blocking}


@pytest.mark.parametrize(
    "tables, note",
    [
        ([COMPOSITION, profile(["50", "70", ""], ["45", "65", "85"])], "thiếu số liệu"),
        ([COMPOSITION, profile(["50", "70"], ["45", "65"], times=(5, 10))], "E_F2_TOO_FEW_POINTS"),
        (
            [COMPOSITION, profile(["50", "70", "90"], ["45", "65", "85"], strength="20 mg")],
            "hàm lượng",
        ),
    ],
)
def test_what_cannot_be_computed_is_a_marked_gap_row_never_a_number(tmp_path, tables, note):
    run, knowledge = run_with(tmp_path, *tables)
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]
    notes = [line for line in run.agent_log if line.startswith("agent 8.2:")]
    assert any(note in line for line in notes)
    text = json.dumps(section(run), ensure_ascii=False)
    assert '"64.6"' not in text


def test_without_declared_strengths_the_section_stays_a_gap(tmp_path):
    run, _ = run_with(tmp_path, GOOD)
    assert section(run)["status"] == "gap"


def test_a_table_without_a_reference_column_is_left_out_and_reported(tmp_path):
    lab = [
        ["Average dissolution (%) ± SD", "", ""],
        ["Time (min.)", "Medium: HCl", "Rotation"],
        ["", "Lab batch", "Pilot batch"],
        ["5", "50", "52"],
        ["10", "70", "72"],
        ["15", "90", "91"],
    ]
    run, _ = run_with(tmp_path, COMPOSITION, lab)
    assert section(run)["status"] == "gap"
    assert any("không có đủ cột đối chiếu" in line for line in run.agent_log)


def test_a_profile_above_100_percent_gives_a_readable_gap_row_that_the_gate_accepts(tmp_path):
    high = profile(["107.7", "105.9", "105.4"], ["82.4", "90.6", "94.8"])
    run, knowledge = run_with(tmp_path, COMPOSITION, GOOD, high)
    cell = section(run)["blocks"][1]["rows"][1][1]
    assert cell.startswith("[CHƯA CÓ DỮ LIỆU") and "ngoài khoảng 0–100" in cell
    assert "E_F2_RANGE" not in cell
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]
