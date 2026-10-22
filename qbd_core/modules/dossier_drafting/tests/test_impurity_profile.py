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
TODAY = date(2026, 10, 22)
COMPOSITION = [["Components", "Product 5 mg", "Product 10 mg"], ["a", "1", "2"]]
# A comparison table gives the brand and ties each batch number to a product.
PROFILE = [
    ["Time (min.)", "Medium: HCl", "Rotation speed"],
    ["", "Atorvastatin 5 mg film coated tablets batch no. T200", "Zetix® 5 mg batch no. R100"],
    ["5", "50", "45"],
    ["10", "70", "65"],
    ["15", "90", "85"],
]


def impurity(ids=("R100", "T200", "T300"), groups=("Zetix® 5 mg", "Atorvastatin 5 mg tablets")):
    width = 1 + 2 * len(ids)
    pad = lambda cells: [*cells, *[""] * (width - len(cells))]  # noqa: E731
    return [
        pad(["", *groups]),
        pad(["Batch no.", *ids]),
        pad(["Impurity", *["RRT", "Results (%)"] * len(ids)]),
        pad(["Impurity A", *["0.5", "0.05", "0.5", "0.02", "0.5", "<0.01"][: 2 * len(ids)]]),
        pad(["", "0.5", "", "0.5", "", "0.5", ""][:width]),
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
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.2.3.3.1")


def test_each_impurity_becomes_one_tagged_sentence_naming_reference_and_product(tmp_path):
    run, _ = run_with(tmp_path, COMPOSITION, PROFILE, impurity())
    blocks = section(run)["blocks"]
    text = blocks[0]["text"]
    assert text.startswith(
        "Impurity A, hàm lượng 5 mg: thuốc đối chiếu lô R100: RRT 0.5, kết quả 0.05;"
    )
    assert "sản phẩm lô T200: RRT 0.5, kết quả 0.02" in text and "sản phẩm lô T300" in text
    assert "<0.01" in text and "[dữ liệu: trial-1.docx, bảng 3," in text
    assert len(blocks) == 2 and blocks[1]["text"].startswith("[CHƯA CÓ DỮ LIỆU")  # limits


def test_the_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, PROFILE, impurity())
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_a_changed_result_is_blocked_by_its_cell_tag(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, PROFILE, impurity())
    draft = copy.deepcopy(run.draft)
    block = next(s for s in draft["sections"] if s["id"] == "P.2.2.3.3.1")["blocks"][0]
    block["text"] = block["text"].replace("kết quả 0.05;", "kết quả 0.04;")
    report = evaluate_run(dataclasses.replace(run, draft=draft), knowledge)
    assert "E_DATA_NUMBER_UNSUPPORTED" in {f.code for f in report.blocking}


def test_a_batch_no_label_names_takes_the_product_of_the_batch_before_it(tmp_path):
    run, _ = run_with(tmp_path, COMPOSITION, PROFILE, impurity())
    assert "sản phẩm lô T300" in section(run)["blocks"][0]["text"]


def test_a_batch_with_no_label_and_room_for_another_product_stays_unattributed(tmp_path):
    table = impurity(groups=("Zetix® 5 mg", "Atorvastatin 5 mg tablets", "Other 5 mg"))
    run, _ = run_with(tmp_path, COMPOSITION, PROFILE, table)
    assert section(run)["status"] == "gap"
    notes = [line for line in run.agent_log if "agent 8.3" in line]
    assert any("không xác định được sản phẩm của lô" in n and "T300" in n for n in notes)


NO_BATCH = [
    ["", "Zetix® 5 mg"],
    ["Impurity", "RRT", "Results (%)"],
    ["Impurity A", "0.5", "0.1"],
]


@pytest.mark.parametrize(
    "table, note",
    [
        (
            [["", "Zetix® 5 mg"], ["Impurity", "RRT", "Results (%)"], ["Impurity A", "0.5", "0.1"]],
            "số lô",
        ),
    ],
)
def test_a_table_without_batch_numbers_is_reported_not_guessed(tmp_path, table, note):
    run, _ = run_with(tmp_path, COMPOSITION, PROFILE, table)
    assert section(run)["status"] == "gap"
    assert any(note in line for line in run.agent_log if "agent 8.3" in line)
