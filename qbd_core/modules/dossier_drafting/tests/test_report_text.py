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
FILLED = [
    "BÁO CÁO NGHIÊN CỨU VI SINH TRONG PHÁT TRIỂN THUỐC KHÔNG VÔ KHUẨN",
    "5. Khung tổng hợp kết quả thực nghiệm",
    "6. Bàn luận",
    "Kết quả TAMC dưới 100 CFU/g ở cả ba lô cho thấy nguy cơ vi sinh của công thức thấp.",
    "Phương pháp thử phù hợp với sản phẩm theo kết quả thu hồi đã nêu.",
    "7. Kết luận",
    "Viên đáp ứng giới hạn nhiễm khuẩn đã chọn tại ba lô thử.",
    "8. Phụ lục",
    "Danh sách hồ sơ gốc.",
]
SUMMARY = [
    ["Hạng mục", "Dữ liệu cần điền", "Kết luận"],
    ["Giới hạn nhiễm khuẩn", "TAMC 20, 30 và 40 CFU/g tại ba lô", "Đạt"],
    ["Hiệu lực bảo quản", "[Chưa có dữ liệu]", "[Chưa có dữ liệu]"],
]
COMPOSITION = [["Components", "Product 5 mg"], ["a", "1"]]


def run_with(tmp_path, paragraphs, *tables):
    trial = load_trial_data([str(make_docx(tmp_path / "micro-1.docx", list(tables), paragraphs))])
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
    return next(s for s in run.draft["sections"] if s["id"] == "P.2.5")


def texts(run):
    return [b["text"] for b in section(run)["blocks"] if b["type"] == "paragraph"]


def test_a_filled_report_gives_its_results_discussion_and_conclusion_word_for_word(tmp_path):
    run, _ = run_with(tmp_path, FILLED, SUMMARY)
    found = texts(run)
    assert found[0].startswith(
        "Giới hạn nhiễm khuẩn: TAMC 20, 30 và 40 CFU/g tại ba lô; kết luận: Đạt."
    )
    assert any(t.startswith("6. Bàn luận [dữ liệu: micro-1.docx, đoạn 3]") for t in found)
    assert any(
        t.startswith("Viên đáp ứng giới hạn nhiễm khuẩn đã chọn tại ba lô thử.") for t in found
    )
    assert not any("Danh sách hồ sơ gốc" in t for t in found)  # the appendix is not carried
    assert not any("Hiệu lực bảo quản" in t for t in found)  # an unfilled row is not carried
    assert any("bỏ 1" in line for line in run.agent_log if "agent 10.2" in line)


def test_the_form_s_two_tables_are_present_and_their_cells_are_marked_gaps(tmp_path):
    run, _ = run_with(tmp_path, FILLED, SUMMARY)
    tables = [b for b in section(run)["blocks"] if b["type"] == "table"]
    assert [t["headers"][0] for t in tables] == ["Chỉ tiêu", "Đối tượng"]
    assert [r[0] for r in tables[0]["rows"]][0].startswith("Tổng số vi sinh vật hiếu khí")
    assert all(c.startswith("[CHƯA CÓ DỮ LIỆU") for r in tables[0]["rows"] for c in r[1:])


def test_the_draft_passes_stage_b_and_the_quality_gate(tmp_path):
    run, knowledge = run_with(tmp_path, FILLED, SUMMARY)
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(run.draft, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    report = evaluate_run(run, knowledge)
    assert report.passed, [f.code for f in report.blocking]


def edited(run, index, change):
    draft = copy.deepcopy(run.draft)
    blocks = [b for s in draft["sections"] if s["id"] == "P.2.5" for b in s["blocks"]]
    paragraphs = [b for b in blocks if b["type"] == "paragraph"]
    paragraphs[index]["text"] = change(paragraphs[index]["text"])
    return dataclasses.replace(run, draft=draft)


@pytest.mark.parametrize(
    "change, code",
    [
        (lambda t: t.replace("dưới 100", "dưới 10", 1), "E_PARAGRAPH_MISMATCH"),
        (lambda t: t.replace("đoạn 4", "đoạn 99"), "E_DATA_SOURCE_MISMATCH"),
        (lambda t: t.split(" [dữ liệu")[0], "E_UNSOURCED_TEXT"),
    ],
)
def test_a_changed_paragraph_or_tag_is_blocked(tmp_path, change, code):
    run, knowledge = run_with(tmp_path, FILLED, SUMMARY)
    index = next(i for i, t in enumerate(texts(run)) if "TAMC dưới 100" in t)
    report = evaluate_run(edited(run, index, change), knowledge)
    assert code in {f.code for f in report.blocking}


def test_a_changed_summary_number_is_blocked(tmp_path):
    run, knowledge = run_with(tmp_path, FILLED, SUMMARY)
    report = evaluate_run(edited(run, 0, lambda t: t.replace("20,", "25,", 1)), knowledge)
    assert "E_DATA_NUMBER_UNSUPPORTED" in {f.code for f in report.blocking}


@pytest.mark.parametrize(
    "paragraphs",
    [
        [
            "BÁO CÁO NGHIÊN CỨU VI SINH",
            "Phạm vi: tài liệu này chưa phải báo cáo kết quả.",
            "6. Bàn luận",
            "Khi có dữ liệu, phần bàn luận cần liên kết kết quả.",
        ],
        [
            "BÁO CÁO NGHIÊN CỨU VI SINH",
            "Tên sản phẩm: [Điền tên sản phẩm]",
            "Quy cách: [Điền thông tin]",
            "Đơn vị: [Điền thông tin]",
            "6. Bàn luận",
            "Nội dung thật nhưng báo cáo còn nhiều chỗ trống.",
        ],
    ],
    ids=["states it is not a results report", "many placeholders"],
)
def test_an_unfilled_template_gives_nothing_to_carry(tmp_path, paragraphs):
    run, _ = run_with(tmp_path, paragraphs, SUMMARY)
    assert section(run)["status"] == "gap"
    assert any("mẫu chưa điền" in line for line in run.agent_log if "agent 10.2" in line)


def test_a_heading_without_its_number_cannot_be_bounded_so_it_is_not_carried(tmp_path):
    bare = ["BÁO CÁO NGHIÊN CỨU VI SINH", "Bàn luận", "Một đoạn rồi hết tài liệu."]
    run, _ = run_with(tmp_path, bare, COMPOSITION)
    assert section(run)["status"] == "gap"
    assert any("không xác định được chỗ kết thúc" in line for line in run.agent_log)


def test_a_report_of_another_kind_is_ignored(tmp_path):
    other = ["BÁO CÁO KHÁC", "6. Bàn luận", "Một đoạn."]
    run, _ = run_with(tmp_path, other, COMPOSITION)
    assert section(run)["status"] == "gap"
