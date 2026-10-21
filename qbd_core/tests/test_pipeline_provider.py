"""Model agents through the CLI: repeatable from a recording; a provider failure publishes none."""

import argparse
import hashlib
import json
import re
from datetime import date
from pathlib import Path

import pytest

from qbd_core import run as run_module
from qbd_core.modules.dossier_drafting.api import LlmSetup, assemble_draft, validate_intake
from qbd_core.modules.egress_gate.api import Destination, try_load_manifest
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents
from qbd_core.modules.provider_access.api import ProviderGateway, request_digest

MODEL = "recorded-model"
FAKE_PAGE = b"<!DOCTYPE html><html><body>fake page</body></html>"
DOCUMENTS = [
    {
        "file_id": "OPEN-A",
        "name": "open monograph",
        "classification": "A",
        "pages": ["Atorvastatin calcium có số đăng ký CAS 134523-03-8 theo chuyên luận mở."],
    }
]
MANIFEST = {
    "entries": [
        {
            "file_id": "OPEN-A",
            "classification": "A",
            "approved_by": "Lê Thọ Tiển",
            "approved_on": "2026-10-21",
        }
    ]
}
EVIDENCE = re.compile(r"\[(E-[0-9a-f]{12})\] ")


class Capture:
    destination = Destination.REMOTE

    def __init__(self):
        self.requests = []

    def complete(self, request):
        self.requests.append(request)
        if any("QTPP Builder" in p.text for p in request.payload.parts):
            return json.dumps({"items": []})
        if any("Excipient Selector" in p.text for p in request.payload.parts):
            return json.dumps({"excipients": [], "grades": []})
        ids = [m.group(1) for p in request.payload.parts if (m := EVIDENCE.match(p.text))]
        row = {"label": "Số đăng ký CAS", "value": "CAS 134523-03-8.", "evidence_ids": ids[:1]}
        return json.dumps({"properties": [row], "biology": []})


@pytest.fixture(autouse=True)
def fake_render(monkeypatch):
    monkeypatch.setattr(run_module, "_render_bytes", lambda *a, **k: FAKE_PAGE)


@pytest.fixture
def files(tmp_path):
    docs, manifest = tmp_path / "docs.json", tmp_path / "manifest.json"
    docs.write_text(json.dumps(DOCUMENTS, ensure_ascii=False), encoding="utf-8")
    manifest.write_text(json.dumps(MANIFEST, ensure_ascii=False), encoding="utf-8")
    capture = Capture()
    setup = LlmSetup(ProviderGateway(capture, {MODEL}, try_load_manifest(manifest)), MODEL)
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    assemble_draft(intake, InMemoryKnowledge(load_documents(docs)), date(2026, 10, 21), llm=setup)
    answers = {request_digest(r): capture.complete(r) for r in list(capture.requests)}
    recording = tmp_path / "recording.json"
    recording.write_text(json.dumps(answers), encoding="utf-8")
    return docs, manifest, recording


def args(tmp_path, files, **changes):
    docs, manifest, recording = files
    base = {
        "substances": ["Atorvastatin calcium"],
        "form": "Viên nén bao phim",
        "market": "both",
        "documents": str(docs),
        "out": str(tmp_path / "out" / "draft.json"),
        "date": "2026-10-21",
        "cqa_confirmation": None,
        "render_dir": None,
        "provider_recording": str(recording),
        "model": MODEL,
        "manifest": str(manifest),
        "provider_destination": "remote",
    }
    return argparse.Namespace(**{**base, **changes})


def digest_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_a_recorded_run_publishes_the_model_row_and_repeats_byte_for_byte(tmp_path, files):
    assert run_module.run(args(tmp_path, files)) == 0
    draft = tmp_path / "out" / "draft.json"
    first = digest_of(draft)
    assert "[tổng hợp: OPEN-A, trang 1, E-" in draft.read_text(encoding="utf-8")
    assert run_module.run(args(tmp_path, files)) == 0
    assert digest_of(draft) == first


def test_provider_failure_exits_9_and_leaves_the_last_good_files_alone(tmp_path, files):
    assert run_module.run(args(tmp_path, files)) == 0
    before = {p.name: digest_of(p) for p in (tmp_path / "out").iterdir()}
    empty = tmp_path / "empty.json"
    empty.write_text("{}", encoding="utf-8")
    assert run_module.run(args(tmp_path, files, provider_recording=str(empty))) == 9
    assert {p.name: digest_of(p) for p in (tmp_path / "out").iterdir()} == before


@pytest.mark.parametrize(
    "changes",
    [
        {"provider_recording": "absent.json"},
        {"model": None},
        {"model": "not-approved-model"},
    ],
    ids=["recording unreadable", "model missing", "model not in recording"],
)
def test_provider_setup_problems_exit_9_and_write_nothing(tmp_path, files, changes):
    assert run_module.run(args(tmp_path, files, **changes)) == 9
    assert not (tmp_path / "out").exists()


def test_without_a_manifest_nothing_is_sent_and_the_row_stays_a_gap(tmp_path, files, capsys):
    assert run_module.run(args(tmp_path, files, manifest=None)) == 0
    text = (tmp_path / "out" / "draft.json").read_text(encoding="utf-8")
    assert "[tổng hợp:" not in text
    assert "no evidence may be sent" in capsys.readouterr().out
