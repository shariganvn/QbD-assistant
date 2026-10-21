import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from qbd_core import run as run_module
from qbd_core.modules.quality_gate.api import Finding, QualityReport

REPO = Path(__file__).resolve().parents[4]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
INPUT = ["--substance", "Atorvastatin calcium", "--form", "Viên nén bao phim", "--market", "both"]


def cli(*args):
    return subprocess.run(
        [sys.executable, "-m", "qbd_core", *args], capture_output=True, text=True, cwd=REPO
    )


@needs_node
def test_run_writes_the_report_and_a_page_with_the_appendix_c_table(tmp_path):
    out = tmp_path / "draft.json"
    done = cli(
        "run",
        *INPUT,
        "--documents",
        str(DOCS),
        "--out",
        str(out),
        "--date",
        "2026-10-21",
        "--render-dir",
        str(tmp_path / "html"),
    )
    assert done.returncode == 0, done.stderr
    report = json.loads((tmp_path / "draft.quality.json").read_text(encoding="utf-8"))
    assert [c["no"] for c in report["checklist"]] == list(range(1, 18))
    page = (tmp_path / "html" / "p2-orientation-draft.html").read_text(encoding="utf-8")
    assert "Danh mục kiểm tra trước khi nộp rà soát (Phụ lục C của SOP)" in page
    assert page.count("Còn khoảng trống") >= 10 and "Chờ người rà soát" in page


def blocked_args(tmp_path):
    return argparse.Namespace(
        substances=["Atorvastatin calcium"],
        form="Viên nén bao phim",
        market="both",
        documents=str(DOCS),
        out=str(tmp_path / "draft.json"),
        date="2026-10-21",
        cqa_confirmation=None,
        render_dir=str(tmp_path / "html"),
    )


def test_a_blocking_finding_writes_the_report_but_no_draft_and_no_page(tmp_path, monkeypatch):
    blocking = QualityReport(findings=(Finding(code="E_UNSOURCED_TEXT", severity="block"),))
    monkeypatch.setattr(run_module, "evaluate_run", lambda *a, **k: blocking)
    assert run_module.run(blocked_args(tmp_path)) == 7
    assert (tmp_path / "draft.quality.json").is_file()
    assert not (tmp_path / "draft.json").exists() and not (tmp_path / "html").exists()


def test_a_blocked_run_leaves_an_earlier_draft_untouched(tmp_path, monkeypatch):
    earlier = tmp_path / "draft.json"
    earlier.write_text("previous", encoding="utf-8")
    blocking = QualityReport(findings=(Finding(code="E_META_MISMATCH", severity="block"),))
    monkeypatch.setattr(run_module, "evaluate_run", lambda *a, **k: blocking)
    assert run_module.run(blocked_args(tmp_path)) == 7
    assert earlier.read_text(encoding="utf-8") == "previous"
