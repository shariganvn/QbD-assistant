"""kho-manifest: the egress manifest from the owner's table, by Drive id, nothing guessed."""

import json
from pathlib import Path

import pytest

from qbd_core import main
from qbd_core.modules.egress_gate.api import try_load_manifest
from qbd_core.tests.test_kho_load import make_xlsx

HEADER = ("file_id", "file_name", "nhom", "tai_len_ngoai", "trang_thai")
ID = {k: k.ljust(31, "x") + "01" for k in "ABCDEF"}
ROWS = [
    (ID["A"], "a.pdf", "A", "Có", "Đã duyệt"),
    (ID["B"], "b.pdf", "A", "Chờ", "Đề xuất theo tên"),
    (ID["C"], "c.pdf", "A", "Không", "Đã duyệt"),
    (ID["D"], "d.pdf", "B", "Không", "Đề xuất theo tên"),
    (ID["E"], "e.pdf", "C", "Không", "Đã duyệt"),
    (ID["F"], "f.pdf", "A", "Có", "Đã kiểm snippet"),
]


def build(tmp_path, rows=ROWS, *extra, out=None):
    table = tmp_path / "table.xlsx"
    make_xlsx(table, rows, HEADER)
    target = out or tmp_path / "manifest.json"
    code = main.main(
        ["kho-manifest", "--table", str(table), "--out", str(target),
         "--approved-by", "Người duyệt", "--approved-on", "2026-10-23", *extra]
    )  # fmt: skip
    return code, target


def entries(path):
    return {e["file_id"]: e for e in json.loads(path.read_text("utf-8"))["entries"]}


def test_only_class_a_with_flag_yes_is_approved(tmp_path):
    code, out = build(tmp_path)
    assert code == 0
    got = entries(out)
    assert {k for k, e in got.items() if "approved_by" in e} == {ID["A"], ID["F"]}
    assert got[ID["A"]] == {
        "file_id": ID["A"], "classification": "A",
        "approved_by": "Người duyệt", "approved_on": "2026-10-23",
    }  # fmt: skip
    assert got[ID["B"]] == {"file_id": ID["B"], "classification": "A"}
    assert try_load_manifest(out) is not None


def test_output_is_sorted_and_repeatable(tmp_path):
    _, first = build(tmp_path)
    _, second = build(tmp_path, out=tmp_path / "again.json")
    assert first.read_bytes() == second.read_bytes()
    ids = [e["file_id"] for e in json.loads(first.read_text("utf-8"))["entries"]]
    assert ids == sorted(ids)


def test_dates_already_in_the_manifest_are_kept(tmp_path):
    code, out = build(tmp_path)
    data = json.loads(out.read_text("utf-8"))
    data["entries"][0]["approved_on"] = "2026-10-22"
    out.write_text(json.dumps(data), "utf-8")
    first = data["entries"][0]["file_id"]
    assert build(tmp_path)[0] == 0
    assert entries(out)[first]["approved_on"] == "2026-10-22"


def test_check_reports_difference_and_writes_nothing(tmp_path, capsys):
    _, out = build(tmp_path)
    assert build(tmp_path, ROWS, "--check")[0] == 0
    assert "same as" in capsys.readouterr().out
    changed = [*ROWS[:5], (ID["F"], "f.pdf", "A", "Chờ", "Đã duyệt")]
    before = out.read_bytes()
    assert build(tmp_path, changed, "--check")[0] == 14
    assert out.read_bytes() == before and "differs" in capsys.readouterr().out


@pytest.mark.parametrize(
    "bad",
    [
        (ID["A"], "a.pdf", "B", "Có", "Đã duyệt"),
        (ID["A"], "a.pdf", "A", "Có?", "Đã duyệt"),
        (ID["A"], "a.pdf", "A", "", "Đã duyệt"),
        (ID["A"], "a.pdf", "Z", "Không", "Đã duyệt"),
    ],
)
def test_unclear_rows_stop_the_build(tmp_path, bad):
    code, out = build(tmp_path, [bad, *ROWS[1:]])
    assert code == 13 and not out.exists()


def test_a_bad_date_or_table_is_refused(tmp_path):
    table = tmp_path / "t.xlsx"
    make_xlsx(table, ROWS, HEADER)
    args = ["kho-manifest", "--table", str(table), "--out", str(tmp_path / "m.json"),
            "--approved-by", "x"]  # fmt: skip
    assert main.main([*args, "--approved-on", "23/10/2026"]) == 13
    table.write_bytes(b"nope")
    assert main.main([*args, "--approved-on", "2026-10-23"]) == 13


def test_the_manifest_in_the_repo_loads_and_allows_only_class_a():
    path = Path(__file__).parents[2] / "docs/kho/manifest.json"
    if not path.exists():
        pytest.skip("no manifest in this checkout")
    for e in json.loads(path.read_text("utf-8"))["entries"]:
        assert ("approved_by" in e) <= (e["classification"] == "A")
