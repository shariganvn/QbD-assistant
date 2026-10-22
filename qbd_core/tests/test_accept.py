import hashlib
import json
from pathlib import Path

from qbd_core import accept, main

CASES = Path(__file__).parent / "fixtures/acceptance/cases.json"


def _hashes(folder: Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.glob("*"))}


def _write(tmp_path: Path, cases: list[dict]) -> Path:
    spec = json.loads(CASES.read_text("utf-8"))
    spec["cases"] = cases
    spec["documents"] = str((CASES.parent / spec["documents"]).resolve())
    path = tmp_path / "cases.json"
    path.write_text(json.dumps(spec, ensure_ascii=False), "utf-8")
    return path


def _case(**changes):
    case = {
        "id": "c1", "group": "N2", "substances": ["Atorvastatin calcium"],
        "form": "Viên nén bao phim", "market": "both", "expect_exit": 0,
    }  # fmt: skip
    return {**case, **changes}


def test_shipped_cases_all_pass_and_write_one_report_each(tmp_path, capsys):
    out = tmp_path / "out"
    assert main.main(["accept", "--cases", str(CASES), "--out-dir", str(out)]) == 0
    cases = json.loads(CASES.read_text("utf-8"))["cases"]
    assert {p.stem for p in out.glob("*.json")} == {c["id"] for c in cases}
    assert (out / "g-10.txt").exists() and (out / "g-10-data-requests.md").exists()
    assert "failed: none" in capsys.readouterr().out


def test_two_acceptance_runs_write_identical_bytes(tmp_path):
    first, second = tmp_path / "a", tmp_path / "b"
    for out in (first, second):
        assert main.main(["accept", "--cases", str(CASES), "--out-dir", str(out)]) == 0
    assert _hashes(first) == _hashes(second)


def test_a_case_that_misses_its_expectation_fails_and_leaves_old_reports(tmp_path):
    out = tmp_path / "out"
    good = _write(tmp_path, [_case()])
    assert main.main(["accept", "--cases", str(good), "--out-dir", str(out)]) == 0
    before = _hashes(out)
    bad = _write(tmp_path, [_case(), _case(id="c2", expect_exit=2)])
    assert main.main(["accept", "--cases", str(bad), "--out-dir", str(out)]) == accept.EXIT_ACCEPT
    assert _hashes(out) == before


def test_a_refused_case_is_a_pass_when_the_refusal_was_expected(tmp_path):
    cases = _write(tmp_path, [_case(substances=["A", "B", "C", "D"], expect_exit=2)])
    out = tmp_path / "out"
    assert main.main(["accept", "--cases", str(cases), "--out-dir", str(out)]) == 0
    report = json.loads((out / "c1.json").read_text("utf-8"))
    assert report["exit"] == 2 and report["covered"] == 0


def test_unreadable_or_duplicate_cases_are_refused(tmp_path):
    out = tmp_path / "out"
    missing = str(tmp_path / "none.json")
    assert main.main(["accept", "--cases", missing, "--out-dir", str(out)]) == accept.EXIT_CASES
    twin = _write(tmp_path, [_case(), _case()])
    assert main.main(["accept", "--cases", str(twin), "--out-dir", str(out)]) == accept.EXIT_CASES
    assert not out.exists()
