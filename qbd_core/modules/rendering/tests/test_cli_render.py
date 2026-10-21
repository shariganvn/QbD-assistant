import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")


def cli(*args):
    return subprocess.run(
        [sys.executable, "-m", "qbd_core", *args], capture_output=True, text=True, cwd=REPO
    )


def test_run_then_render_gives_one_html_file(tmp_path):
    draft = tmp_path / "draft.json"
    made = cli(
        "run",
        "--substance",
        "Atorvastatin calcium",
        "--form",
        "Viên nén bao phim",
        "--market",
        "both",
        "--documents",
        str(DOCS),
        "--out",
        str(draft),
        "--date",
        "2026-10-21",
    )
    assert made.returncode == 0, made.stderr
    out = tmp_path / "out"
    done = cli("render", "--draft", str(draft), "--out-dir", str(out))
    assert done.returncode == 0, done.stderr
    assert [p.name for p in out.iterdir()] == ["p2-orientation-draft.html"]
    before = (out / "p2-orientation-draft.html").read_bytes()
    broken = json.loads(draft.read_text(encoding="utf-8"))
    broken["sections"] = broken["sections"][:-1]
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(broken, ensure_ascii=False), encoding="utf-8")
    failed = cli("render", "--draft", str(bad), "--out-dir", str(out))
    assert failed.returncode == 6 and "render failed: E_" in failed.stderr
    assert (out / "p2-orientation-draft.html").read_bytes() == before
    assert (
        cli("render", "--draft", str(tmp_path / "absent.json"), "--out-dir", str(out)).returncode
        == 6
    )
