import copy
import dataclasses
import json
import subprocess
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting import subdivision
from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents, load_trial_data
from qbd_core.modules.quality_gate.api import evaluate_run
from qbd_core.tests.docx_factory import make_docx

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
DOCS = Path(__file__).parent / "fixtures" / "documents.json"
TODAY = date(2026, 10, 22)
COMPOSITION = [["Components", "Product 5 mg", "Product 10 mg"], ["a", "1", "2"]]
INFO = [
    ["Thông tin", "Nội dung"],
    ["Tên sản phẩm", "Viên X"],
    ["Dược chất - hàm lượng", "Atorvastatin 10 mg"],
]
MASSES = [100 + (i % 7) - 3 for i in range(30)]  # 97 to 103, mean near 100


def mass_table(masses=MASSES):
    head = ["STT", "Khối lượng phần viên, mg", "Tỷ lệ, %", "Trong 85-115%?"]
    return [head, *[[str(i + 1), str(m), "", ""] for i, m in enumerate(masses)]]


def loss_table(n=15, lost=1.0):
    head = ["STT", "Khối lượng viên nguyên, mg", "Tổng khối lượng các phần, mg", "Hao hụt, %"]
    rows = [[str(i + 1), "200", f"{200 * (1 - lost / 100):g}", ""] for i in range(n)]
    return [head, *rows]


def run_with(tmp_path, *tables, name="study-1.docx"):
    trial = load_trial_data([str(make_docx(tmp_path / name, list(tables)))])
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    knowledge = InMemoryKnowledge(load_documents(DOCS))
    return assemble_draft(intake, knowledge, TODAY, trial=trial), knowledge


def section(run, sid):
    return next(s for s in run.draft["sections"] if s["id"] == sid)


def test_mass_uniformity_is_computed_and_filed_under_the_strength_of_the_report(tmp_path):
    run, _ = run_with(tmp_path, COMPOSITION, INFO, mass_table(), loss_table())
    second = section(run, "P.2.2.3.4.2")  # 10 mg is the second declared strength
    texts = [b["text"] for b in second["blocks"]]
    assert any(t.startswith("Đồng đều khối lượng phần viên: 30 phần viên") for t in texts)
    assert any("đáp ứng tiêu chí" in t and "[tính: chia viên," in t for t in texts)
    assert any(t.startswith("Hao hụt khối lượng khi chia: 15 viên") and "1.00%" in t for t in texts)
    assert section(run, "P.2.2.3.4.1")["status"] == "gap"  # the 5 mg report is absent
    parent = section(run, "P.2.2.3.4")
    assert parent["status"] == "covered" and "[quy tắc: ph_eur_mass]" in parent["blocks"][0]["text"]


def test_the_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, COMPOSITION, INFO, mass_table(), loss_table())
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def test_the_verdict_follows_the_rule_not_the_team_s_words(tmp_path):
    bad = [100] * 27 + [80, 80, 100]  # three parts outside 85-115 %
    run, _ = run_with(tmp_path, COMPOSITION, INFO, mass_table(bad))
    text = section(run, "P.2.2.3.4.2")["blocks"][0]["text"]
    assert "không đáp ứng tiêu chí" in text


def flip_verdict(text):
    return text.replace("đáp ứng tiêu chí", "không đáp ứng tiêu chí", 1)


def edited(run, sid, change):
    draft = copy.deepcopy(run.draft)
    block = next(s for s in draft["sections"] if s["id"] == sid)["blocks"][0]
    block["text"] = change(block["text"])
    return dataclasses.replace(run, draft=draft)


@pytest.mark.parametrize(
    "sid, change, code",
    [
        (
            "P.2.2.3.4.2",
            lambda t: t.replace("đáp ứng tiêu chí", "không đáp ứng tiêu chí", 1),
            "E_CALC_MISMATCH",
        ),
        ("P.2.2.3.4.2", lambda t: t.replace("30 phần viên", "29 phần viên", 1), "E_CALC_MISMATCH"),
        ("P.2.2.3.4.2", lambda t: t.replace("hàng 1-30", "hàng 1-9"), "E_CALC_INPUT"),
        ("P.2.2.3.4", lambda t: t.replace("30 viên", "20 viên", 1), "E_RULE_MISMATCH"),
    ],
)
def test_a_changed_sentence_or_tag_is_blocked(tmp_path, sid, change, code):
    run, knowledge = run_with(tmp_path, COMPOSITION, INFO, mass_table())
    report = evaluate_run(edited(run, sid, change), knowledge)
    assert code in {f.code for f in report.blocking}


@pytest.mark.parametrize(
    "tables, note",
    [
        ([mass_table(MASSES[:29])], "cần đúng 30"),
        ([loss_table(n=14)], "cần đúng 15"),
        ([[["STT", "Khối lượng viên nguyên, mg", "Hao hụt, %"], ["1", "200", ""]]], "thiếu cột"),
    ],
)
def test_incomplete_data_gives_no_sentence_and_a_note(tmp_path, tables, note):
    run, _ = run_with(tmp_path, COMPOSITION, INFO, *tables)
    assert section(run, "P.2.2.3.4.2")["status"] == "gap"
    assert any(note in line for line in run.agent_log if "agent 8.4" in line)


def test_two_strengths_and_no_strength_in_the_report_means_no_attribution(tmp_path):
    run, _ = run_with(tmp_path, COMPOSITION, mass_table())
    assert section(run, "P.2.2.3.4.2")["status"] == "gap"
    assert any("không xác định được hàm lượng" in line for line in run.agent_log)


def test_the_rules_come_from_configuration_with_a_source_and_are_flagged_unconfirmed(tmp_path):
    assert not subdivision.rules_confirmed()
    assert "Ph. Eur." in subdivision.rule_sentence("ph_eur_mass")
    run, _ = run_with(tmp_path, COMPOSITION, INFO, mass_table())
    assert any(line.startswith("A13: tiêu chí chia viên") for line in run.agent_log)
