import json
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import (
    CqaConfirmation,
    CqaNotConfirmed,
    assemble_draft,
    intake_digest,
    load_confirmation,
    propose_cqa,
    require_confirmation,
    validate_intake,
)
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents

REPO = Path(__file__).resolve().parents[4]
VALIDATOR = REPO / "tools" / "pharma-dev-draft" / "draft" / "validate-draft.mjs"
DOCS = Path(__file__).parent / "fixtures" / "documents.json"
TODAY = date(2026, 10, 21)
SECTION = "P.2.2.1.2.2"


def intake(form="Viên nén bao phim", market="both", substances=("Atorvastatin calcium",)):
    return validate_intake({"substances": list(substances), "dosage_form": form, "market": market})


def confirmation(i=None, **changes):
    i = i or intake()
    base = {
        "intake_digest": intake_digest(i),
        "confirmed_cqa": list(propose_cqa(i).candidates[:3]),
        "confirmed_by": "Lê Thọ Tiển",
        "confirmed_on": "2026-10-20",
    }
    return CqaConfirmation.model_validate({**base, **changes})


def kb():
    return InMemoryKnowledge(load_documents(DOCS))


def section(run):
    return next(s for s in run.draft["sections"] if s["id"] == SECTION)


def validate(draft, tmp_path):
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(draft, ensure_ascii=False), encoding="utf-8")
    return subprocess.run(["node", str(VALIDATOR), str(path)], capture_output=True, text=True)


def test_proposal_is_a_candidate_list_bound_to_the_input():
    proposal = propose_cqa(intake())
    assert proposal.status == "candidate_unconfirmed" and proposal.group == "N2"
    assert "Dissolution" in proposal.candidates
    assert proposal.confirmation_template["confirmed_by"] is None
    assert proposal.confirmation_template["intake_digest"] == intake_digest(intake())


def test_digest_ignores_substance_order_and_case_but_not_form_or_market():
    a = intake(substances=("A", "B"), form="Viên nén")
    b = intake(substances=("b", "a"), form="Viên nén")
    assert intake_digest(a) == intake_digest(b)
    assert intake_digest(intake()) != intake_digest(intake(form="Viên nén"))
    assert intake_digest(intake()) != intake_digest(intake(market="eu"))


def test_without_confirmation_the_dependent_section_stays_open(tmp_path):
    run = assemble_draft(intake(), kb(), TODAY)
    assert run.cqa_status == "pending" and run.confirmed_cqa is None
    assert section(run)["status"] == "gap"
    assert "cổng 3.5" in section(run)["gapReason"]
    assert validate(run.draft, tmp_path).returncode == 0


def test_with_a_valid_confirmation_the_section_lists_the_confirmed_set(tmp_path):
    i = intake()
    conf = confirmation(i, confirmed_cqa=[*propose_cqa(i).candidates[:2], "Độ bền cơ học"])
    run = assemble_draft(i, kb(), TODAY, confirmation=conf)
    assert run.cqa_status == "confirmed"
    texts = [b["text"] for b in section(run)["blocks"]]
    assert "Lê Thọ Tiển" in texts[0] and "2026-10-20" in texts[0]
    assert any("bổ sung ngoài đề xuất: Độ bền cơ học" in t for t in texts)
    assert sum("[CHƯA CÓ DỮ LIỆU" in t for t in texts) == 3
    assert validate(run.draft, tmp_path).returncode == 0


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"intake_digest": "0" * 64}, "E_CQA_WRONG_INPUT"),
        ({"confirmed_cqa": []}, "E_CQA_EMPTY"),
        ({"confirmed_cqa": ["Assay", "assay"]}, "E_CQA_INVALID"),
        ({"confirmed_cqa": ["Assay", "  "]}, "E_CQA_INVALID"),
        ({"confirmed_by": None}, "E_CQA_UNSIGNED"),
        ({"confirmed_by": "  "}, "E_CQA_UNSIGNED"),
        ({"confirmed_on": None}, "E_CQA_UNSIGNED"),
        ({"confirmed_on": (TODAY + timedelta(days=1)).isoformat()}, "E_CQA_UNSIGNED"),
    ],
)
def test_a_flawed_confirmation_stops_the_run(changes, code):
    with pytest.raises(CqaNotConfirmed) as caught:
        assemble_draft(intake(), kb(), TODAY, confirmation=confirmation(**changes))
    assert caught.value.code == code


def test_a_confirmation_for_another_input_is_refused():
    other = confirmation(intake(form="Viên nén"))
    with pytest.raises(CqaNotConfirmed) as caught:
        require_confirmation(intake(), other, TODAY)
    assert caught.value.code == "E_CQA_WRONG_INPUT"


def test_missing_or_unreadable_confirmation_file_means_not_confirmed(tmp_path):
    assert load_confirmation(None) is None
    assert load_confirmation(tmp_path / "absent.json") is None
    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    assert load_confirmation(broken) is None
    with pytest.raises(CqaNotConfirmed) as caught:
        require_confirmation(intake(), None, TODAY)
    assert caught.value.code == "E_CQA_NOT_CONFIRMED"


def test_command_line_flow_propose_confirm_run(tmp_path):
    cwd = REPO
    inputs = [
        "--substance",
        "Atorvastatin calcium",
        "--form",
        "Viên nén bao phim",
        "--market",
        "both",
    ]
    proposal = tmp_path / "proposal.json"
    made = subprocess.run(
        [sys.executable, "-m", "qbd_core", "cqa-propose", *inputs, "--out", str(proposal)],
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    assert made.returncode == 0, made.stderr
    template = json.loads(proposal.read_text(encoding="utf-8"))["confirmation_template"]
    template.update(
        confirmed_cqa=["Assay", "Dissolution"], confirmed_by="Tiển", confirmed_on="2026-10-20"
    )
    signed = tmp_path / "signed.json"
    signed.write_text(json.dumps(template, ensure_ascii=False), encoding="utf-8")
    out = tmp_path / "draft.json"
    run = [
        sys.executable,
        "-m",
        "qbd_core",
        "run",
        *inputs,
        "--documents",
        str(DOCS),
        "--out",
        str(out),
        "--date",
        "2026-10-21",
    ]
    pending = subprocess.run(run, capture_output=True, text=True, cwd=cwd)
    assert pending.returncode == 0 and "cqa=pending" in pending.stdout
    confirmed = subprocess.run(
        [*run, "--cqa-confirmation", str(signed)], capture_output=True, text=True, cwd=cwd
    )
    assert confirmed.returncode == 0 and "cqa=confirmed" in confirmed.stdout
    before = out.read_bytes()
    template["intake_digest"] = "f" * 64
    signed.write_text(json.dumps(template), encoding="utf-8")
    wrong = subprocess.run(
        [*run, "--cqa-confirmation", str(signed)], capture_output=True, text=True, cwd=cwd
    )
    assert wrong.returncode == 5 and "E_CQA_WRONG_INPUT" in wrong.stderr
    assert out.read_bytes() == before
