"""Trial files through the CLI: recognised tables are reported, a bad file stops the run."""

import argparse
import json
import subprocess
from pathlib import Path

import pytest

from qbd_core import run as run_module
from qbd_core.tests.docx_factory import make_docx

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
VALIDATOR = REPO / "tools/pharma-dev-draft/draft/validate-draft.mjs"
SOLUBILITY = [["Media", "Solubility (mg/ml)"], ["Water", "0,5"]]
NOTES = [["Ghi chú", "x"], ["a", "b"]]


@pytest.fixture(autouse=True)
def fake_render(monkeypatch):
    monkeypatch.setattr(run_module, "_render_bytes", lambda *a, **k: b"<!DOCTYPE html><html/>")


def args(tmp_path, trial_files):
    return argparse.Namespace(
        substances=["Atorvastatin calcium"],
        form="Viên nén bao phim",
        market="both",
        documents=str(DOCS),
        out=str(tmp_path / "out" / "draft.json"),
        date="2026-10-21",
        cqa_confirmation=None,
        render_dir=None,
        trial_files=trial_files,
    )


def test_a_trial_file_is_named_in_the_draft_and_the_summary(tmp_path, capsys):
    trial = make_docx(tmp_path / "trial-1.docx", [SOLUBILITY, NOTES])
    assert run_module.run(args(tmp_path, [str(trial)])) == 0
    out = capsys.readouterr().out
    assert "agent 1.3: 1 file, 2 bảng, 1 nhận dạng (solubility)" in out
    assert "chưa nhận dạng, trial-1.docx, bảng 2" in out
    draft = tmp_path / "out" / "draft.json"
    assert json.loads(draft.read_text(encoding="utf-8"))["meta"]["sourceFiles"] == ["trial-1.docx"]
    check = subprocess.run(["node", str(VALIDATOR), str(draft)], capture_output=True, text=True)
    assert check.returncode == 0, check.stdout + check.stderr


def test_a_bad_trial_file_exits_10_and_publishes_nothing(tmp_path):
    bad = tmp_path / "bad.docx"
    bad.write_bytes(b"not a zip")
    assert run_module.run(args(tmp_path, [str(bad)])) == 10
    assert not (tmp_path / "out").exists()


def test_without_trial_files_the_draft_is_unchanged(tmp_path):
    assert run_module.run(args(tmp_path, None)) == 0
    meta = json.loads((tmp_path / "out" / "draft.json").read_text(encoding="utf-8"))["meta"]
    assert "chưa có file thử nghiệm" in meta["sourceFiles"][0]


def test_trial_text_never_reaches_a_provider_payload(tmp_path):
    """The intake keeps trial tables out of every request built for a model."""
    from qbd_core.modules.dossier_drafting.api import LlmSetup
    from qbd_core.modules.egress_gate.api import Destination
    from qbd_core.modules.provider_access.api import ProviderGateway

    sent = []

    class Spy:
        destination = Destination.LOCAL

        def complete(self, request):
            sent.append(" ".join(p.text for p in request.payload.parts))
            return "{}"

    trial = make_docx(
        tmp_path / "trial-1.docx", [[["Media", "Solubility (mg/ml)"], ["SECRETROW", "7"]]]
    )
    llm = LlmSetup(ProviderGateway(Spy(), {"m"}, None), "m")
    namespace = args(tmp_path, [str(trial)])
    knowledge = run_module._knowledge(namespace.documents)
    from datetime import date

    from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
    from qbd_core.modules.evidence.api import load_trial_data

    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    assemble_draft(
        intake, knowledge, date(2026, 10, 21), llm=llm, trial=load_trial_data([str(trial)])
    )
    assert sent and not any("SECRETROW" in text for text in sent)
