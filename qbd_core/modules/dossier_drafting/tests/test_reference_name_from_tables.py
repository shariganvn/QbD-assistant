import json
from datetime import date
from pathlib import Path

from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
from qbd_core.modules.dossier_drafting.trial_columns import rmp_names
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents, load_trial_data
from qbd_core.modules.quality_gate.api import evaluate_run
from qbd_core.tests.docx_factory import make_docx

REPO = Path(__file__).resolve().parents[4]
DOCS = Path(__file__).parent / "fixtures" / "documents.json"
TODAY = date(2026, 10, 22)
STRENGTHS = ("5 mg", "10 mg")
COMPOSITION = [["Components", "Product 5 mg", "Product 10 mg"], ["a", "1", "2"]]


def pair(brand, own="Atorvastatin 5 mg film coated tablets"):
    """A dissolution profile table: own product against a brand, as the team writes it."""
    return [
        ["Time (min.)", "Medium: HCl", "Rotation speed"],
        ["", own, f"{brand}® 5 mg Batch no.: G01"],
        ["5", "50", "45"],
        ["10", "70", "65"],
        ["15", "90", "85"],
    ]


def rmp_of(tmp_path, *tables, substance="Atorvastatin calcium"):
    trial = load_trial_data([str(make_docx(tmp_path / "t.docx", list(tables)))])
    return rmp_names(trial, substance, STRENGTHS)


def test_the_brand_next_to_the_own_product_is_taken_as_the_reference(tmp_path):
    found = rmp_of(tmp_path, pair("Zetix"))
    assert found.names == ("zetix",) and found.shown == "Zetix" and found.note is None


def test_a_brand_with_no_own_product_beside_it_is_not_taken(tmp_path):
    alone = [["Item", "Zetix® 5 mg Batch no.: G01"], ["Mass", "100"]]
    assert rmp_of(tmp_path, alone).names == ()


def test_two_different_brands_are_not_resolved(tmp_path):
    found = rmp_of(tmp_path, pair("Zetix"), pair("Quorix"))
    assert found.names == () and "không chọn" in found.note


def test_the_name_comes_from_the_substance_given_not_from_the_code(tmp_path):
    table = pair("Zetix", own="Bisoprolol 5 mg film coated tablets")
    assert rmp_of(tmp_path, table, substance="Bisoprolol fumarate").names == ("zetix",)
    assert rmp_of(tmp_path, table, substance="Atorvastatin calcium").names == ()


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


def test_the_brand_found_in_a_comparison_table_marks_reference_columns_elsewhere(tmp_path):
    info = [
        [
            "Characteristics",
            "Zetix® 5 mg",
            "Zetix® 10 mg",
            "Atorvastatin 5 mg",
            "Atorvastatin 10 mg",
        ],
        ["Mean mass (mg)", "100.2", "200.4", "99.0", "199.0"],
    ]
    run, knowledge = run_with(tmp_path, COMPOSITION, pair("Zetix"), info)
    section = next(s for s in run.draft["sections"] if s["id"] == "P.2.2.1.1")
    text = json.dumps(section, ensure_ascii=False)
    assert "100.2 [dữ liệu:" in text and "99.0" not in text
    assert any("suy ra từ tiêu đề bảng: Zetix" in line for line in run.agent_log)
    assert any(line.startswith("A13: tên thuốc đối chiếu Zetix") for line in run.agent_log)
    assert evaluate_run(run, knowledge).passed


def test_a_source_in_the_knowledge_base_is_named_when_it_agrees(tmp_path):
    from qbd_core.modules.evidence.api import KnowledgeDocument

    doc = KnowledgeDocument(
        file_id="OPEN-A",
        name="monograph",
        pages=("Zetix là biệt dược gốc của Atorvastatin calcium trên thị trường.",),
    )
    trial = load_trial_data([str(make_docx(tmp_path / "t.docx", [COMPOSITION, pair("Zetix")]))])
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    run = assemble_draft(intake, InMemoryKnowledge([doc]), TODAY, trial=trial)
    assert any("có nguồn E-" in line for line in run.agent_log if line.startswith("A13"))


def test_no_brand_name_is_written_into_the_code_or_its_configuration():
    root = REPO / "qbd_core"
    offenders = []
    for path in root.rglob("*"):
        if path.suffix not in {".py", ".json"} or "tests" in path.parts:
            continue
        if "concor" in path.read_text(encoding="utf-8").lower():
            offenders.append(str(path.relative_to(REPO)))
    assert offenders == []
