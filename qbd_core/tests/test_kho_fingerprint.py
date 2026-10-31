"""kho-fingerprint: hashes of restricted files reach the output, their text and names never do."""

import hashlib
import json
import unicodedata

import pytest

from qbd_core import main
from qbd_core.modules.egress_gate.api import (
    Destination,
    Payload,
    PayloadPart,
    check_egress,
    try_load_manifest,
)
from qbd_core.tests.docx_factory import make_docx
from qbd_core.tests.test_kho_load import IDS, make_xlsx

SECRET_B = "Quy trình nội bộ nhóm B mô tả bước nghiền trộn bột siêu mịn trước khi dập viên"
SECRET_C = "Công thức nhóm C ghi rõ tỷ lệ tá dược độn dính và trơn cho lô thử nghiệm đầu tiên"
PUBLIC_A = "Tài liệu công khai nhóm A mô tả đặc tính chung của hoạt chất theo dược điển hiện hành"
UNRELATED = "Hôm nay trời nắng đẹp và chúng tôi đi dạo quanh hồ để bàn chuyện khác hoàn toàn"


@pytest.fixture
def kho(tmp_path):
    folder = tmp_path / "downloads"
    folder.mkdir()
    texts = {"A": PUBLIC_A, "B": SECRET_B, "C": SECRET_C}
    rows = []
    for key, text in texts.items():
        make_docx(folder / f"doc-{key}.docx", [], [text])
        rows.append((IDS[key], f"doc-{key}.docx", key))
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps({"entries": [{"file_id": i, "classification": g} for i, _, g in rows]}), "utf-8"
    )
    table = tmp_path / "table.xlsx"
    make_xlsx(table, rows)
    return tmp_path, folder, table, manifest


def fingerprint(folder, table, manifest, out, *extra):
    return main.main(
        ["kho-fingerprint", "--table", str(table), "--folder", str(folder),
         "--manifest", str(manifest), "--out", str(out), *extra]
    )  # fmt: skip


def sends(manifest, text):
    payload = Payload(parts=(PayloadPart(kind="instruction", text=text),))
    return check_egress(payload, Destination.REMOTE, manifest).allowed


def test_output_is_a_manifest_that_blocks_restricted_text(kho):
    tmp, folder, table, manifest = kho
    out = tmp / "out" / "fingerprints.json"
    assert fingerprint(folder, table, manifest, out) == 0
    loaded = try_load_manifest(out)
    assert loaded is not None
    assert not sends(loaded, f"Xin chào. {SECRET_B}. Hết.")
    assert not sends(loaded, SECRET_C)
    assert sends(loaded, UNRELATED)
    assert sends(loaded, PUBLIC_A)


def test_output_holds_no_text_and_no_file_name(kho):
    tmp, folder, table, manifest = kho
    out = tmp / "out" / "fingerprints.json"
    assert fingerprint(folder, table, manifest, out) == 0
    written = out.read_text("utf-8")
    for secret in (SECRET_B, SECRET_C, "nghiền", "doc-B", "doc-C"):
        assert secret not in written


def test_class_a_gets_no_hashes_and_the_report_has_counts_only(kho, capsys):
    tmp, folder, table, manifest = kho
    out = tmp / "out" / "fingerprints.json"
    assert fingerprint(folder, table, manifest, out) == 0
    by_id = {e.file_id: e for e in try_load_manifest(out).entries}
    assert not by_id[IDS["A"]].shingles
    assert by_id[IDS["B"]].shingles and by_id[IDS["C"]].shingles
    said = capsys.readouterr().out
    assert "fingerprinted 2" in said and "doc-B" not in said


def test_same_input_gives_the_same_bytes(kho):
    tmp, folder, table, manifest = kho
    first, second = tmp / "o1" / "f.json", tmp / "o2" / "f.json"
    assert fingerprint(folder, table, manifest, first, "--salt", "s1") == 0
    assert fingerprint(folder, table, manifest, second, "--salt", "s1") == 0
    assert first.read_bytes() == second.read_bytes()


def test_a_salt_changes_the_hashes_and_the_gate_still_blocks(kho):
    tmp, folder, table, manifest = kho
    plain, salted = tmp / "p" / "f.json", tmp / "s" / "f.json"
    assert fingerprint(folder, table, manifest, plain) == 0
    assert fingerprint(folder, table, manifest, salted, "--salt", "s1") == 0
    assert plain.read_bytes() != salted.read_bytes()
    loaded = try_load_manifest(salted)
    assert loaded.salt == "s1" and not sends(loaded, SECRET_B)


def test_nfd_text_from_the_extractor_matches_nfc_payload(kho):
    tmp, folder, table, manifest = kho
    make_docx(folder / "doc-B.docx", [], [unicodedata.normalize("NFD", SECRET_B)])
    out = tmp / "out" / "fingerprints.json"
    assert fingerprint(folder, table, manifest, out) == 0
    assert not sends(try_load_manifest(out), unicodedata.normalize("NFC", SECRET_B))


def test_the_committed_manifest_is_not_touched(kho):
    tmp, folder, table, manifest = kho
    before = hashlib.sha256(manifest.read_bytes()).hexdigest()
    assert fingerprint(folder, table, manifest, tmp / "out" / "f.json") == 0
    assert hashlib.sha256(manifest.read_bytes()).hexdigest() == before


def test_output_inside_a_git_tree_is_refused(kho, capsys):
    tmp, folder, table, manifest = kho
    (tmp / "repo" / ".git").mkdir(parents=True)
    out = tmp / "repo" / "f.json"
    assert fingerprint(folder, table, manifest, out) == 13
    assert "git work tree" in capsys.readouterr().err and not out.exists()


def test_a_missing_manifest_is_refused(kho):
    tmp, folder, table, manifest = kho
    manifest.unlink()
    out = tmp / "out" / "f.json"
    assert fingerprint(folder, table, manifest, out) == 13 and not out.exists()


def test_a_class_that_differs_from_the_manifest_writes_nothing(kho):
    tmp, folder, table, manifest = kho
    data = json.loads(manifest.read_text("utf-8"))
    data["entries"][1]["classification"] = "A"
    manifest.write_text(json.dumps(data), "utf-8")
    out = tmp / "out" / "f.json"
    assert fingerprint(folder, table, manifest, out) == 13 and not out.exists()


def test_class_a_cannot_be_fingerprinted(kho):
    tmp, folder, table, manifest = kho
    out = tmp / "out" / "f.json"
    assert fingerprint(folder, table, manifest, out, "--classes", "A,B") == 13
    assert not out.exists()
