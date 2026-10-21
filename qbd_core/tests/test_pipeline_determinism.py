"""The same input gives the same bytes: across processes, hash seeds, folders and environments."""

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node for rendering")
INPUT = ["--substance", "Atorvastatin calcium", "--form", "Viên nén bao phim", "--market", "both"]
FILES = ("draft.json", "draft.quality.json", "html/p2-orientation-draft.html")


def run_cli(folder: Path, env_extra: dict[str, str], date="2026-10-21", form=None):
    folder.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, **env_extra}
    inputs = list(INPUT)
    if form:
        inputs[3] = form
    done = subprocess.run(
        [
            sys.executable,
            "-m",
            "qbd_core",
            "run",
            *inputs,
            "--documents",
            str(DOCS),
            "--out",
            str(folder / "draft.json"),
            "--date",
            date,
            "--render-dir",
            str(folder / "html"),
        ],
        capture_output=True,
        text=True,
        cwd=REPO,
        env=env,
    )
    assert done.returncode == 0, done.stderr
    return {name: hashlib.sha256((folder / name).read_bytes()).hexdigest() for name in FILES}


ENVIRONMENTS = [
    {"PYTHONHASHSEED": "0", "LC_ALL": "C.UTF-8", "TZ": "UTC"},
    {"PYTHONHASHSEED": "1", "LC_ALL": "C", "TZ": "Asia/Ho_Chi_Minh"},
    {"PYTHONHASHSEED": "2718281", "LANG": "en_US.UTF-8", "TZ": "America/Los_Angeles"},
]


def test_three_environments_give_identical_files(tmp_path):
    results = [run_cli(tmp_path / f"run{i}", env) for i, env in enumerate(ENVIRONMENTS)]
    assert results[0] == results[1] == results[2]


def test_outputs_contain_no_machine_specific_text(tmp_path):
    run_cli(tmp_path / "x", ENVIRONMENTS[0])
    for name in FILES:
        text = (tmp_path / "x" / name).read_text(encoding="utf-8")
        assert str(tmp_path) not in text and "/tmp/" not in text and "/home/" not in text


def test_a_different_input_or_date_changes_the_files(tmp_path):
    base = run_cli(tmp_path / "a", ENVIRONMENTS[0])
    other_date = run_cli(tmp_path / "b", ENVIRONMENTS[0], date="2026-10-22")
    other_form = run_cli(tmp_path / "c", ENVIRONMENTS[0], form="Viên nén")
    assert base["draft.json"] != other_date["draft.json"]
    assert base["draft.json"] != other_form["draft.json"]
    assert base["html/p2-orientation-draft.html"] != other_form["html/p2-orientation-draft.html"]
