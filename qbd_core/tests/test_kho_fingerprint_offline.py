"""The offline page and `kho-fingerprint` agree to the byte, and the page never reaches out."""

import json
import re
import shutil
import subprocess
import unicodedata
import zipfile
from pathlib import Path

import pytest

from qbd_core import main
from qbd_core.modules.egress_gate.api import (
    Destination,
    Manifest,
    Payload,
    PayloadPart,
    check_egress,
    shingles,
)
from qbd_core.tests.docx_factory import make_docx
from qbd_core.tests.test_kho_load import IDS, make_xlsx, needs_pdftotext, tiny_pdf

TOOL = Path(__file__).resolve().parents[2] / "tools" / "kho-fingerprint-offline"
DRIVER = TOOL / "test" / "run-browser.mjs"


def _browser_ready() -> bool:
    node = shutil.which("node")
    if node is None or not (TOOL / "index.html").exists():
        return False
    probe = subprocess.run(
        [node, "-e", "require('playwright')"], capture_output=True, check=False, timeout=60
    )
    return probe.returncode == 0


pytestmark = pytest.mark.skipif(
    not _browser_ready(),
    reason="needs node, playwright and tools/kho-fingerprint-offline/index.html",
)

SECRET_B = "Quy trình nội bộ nhóm B mô tả bước nghiền trộn bột siêu mịn trước khi dập viên"
SECRET_C = "Công thức nhóm C ghi rõ tỷ lệ tá dược độn dính và trơn cho lô thử nghiệm đầu tiên"
PUBLIC_A = "Tài liệu công khai nhóm A mô tả đặc tính chung của hoạt chất theo dược điển hiện hành"
UNRELATED = "Hôm nay trời nắng đẹp và chúng tôi đi dạo quanh hồ để bàn chuyện khác hoàn toàn"


def drive(mode: str, args: dict) -> dict:
    done = subprocess.run(
        ["node", str(DRIVER), mode, json.dumps(args)],
        capture_output=True,
        text=True,
        check=False,
        timeout=300,
    )
    lines = [ln for ln in done.stdout.splitlines() if ln.startswith("{")]
    assert lines, done.stderr[-2000:]
    return json.loads(lines[-1])


def deflate_docx(path: Path, paragraphs: list[str]) -> None:
    make_docx(path, [], paragraphs)
    with zipfile.ZipFile(path) as src:
        members = {n: src.read(n) for n in src.namelist()}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as out:
        for name, data in members.items():
            out.writestr(name, data)


@pytest.fixture
def kho(tmp_path):
    folder = tmp_path / "downloads"
    (folder / "sub").mkdir(parents=True)
    texts = {"A": PUBLIC_A, "B": SECRET_B, "C": SECRET_C}
    rows = []
    for key, text in texts.items():
        deflate_docx(folder / ("sub" if key == "C" else ".") / f"doc-{key}.docx", [text])
        rows.append((IDS[key], f"doc-{key}.docx", key))
    entries = [{"file_id": i, "classification": g} for i, _, g in rows]
    entries[0].update(approved_by="Người duyệt", approved_on="2026-10-23")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"entries": entries}), "utf-8")
    table = tmp_path / "table.xlsx"
    make_xlsx(table, rows)
    return tmp_path, folder, table, manifest


def page_run(kho, **extra):
    tmp, folder, table, manifest = kho
    return drive(
        "run",
        {
            "folder": str(folder),
            "table": str(table),
            "manifest": str(manifest),
            "saveTo": str(tmp / "page.json"),
            "trapTo": str(tmp / "trap.txt"),
            **extra,
        },
    )


def python_run(kho, *extra):
    tmp, folder, table, manifest = kho
    out = tmp / "python" / "fingerprints.json"
    code = main.main(
        ["kho-fingerprint", "--table", str(table), "--folder", str(folder),
         "--manifest", str(manifest), "--out", str(out), *extra]
    )  # fmt: skip
    assert code == 0
    return out


@pytest.mark.parametrize("extra", [[], ["--salt", "muối-1"]])
def test_page_output_equals_command_output_byte_for_byte(kho, extra):
    result = page_run(kho, **({"salt": extra[1]} if extra else {}))
    assert result["status"].startswith("Xong"), result
    assert (kho[0] / "page.json").read_bytes() == python_run(kho, *extra).read_bytes()


def test_decomposed_source_text_gives_the_same_bytes(kho):
    deflate_docx(kho[1] / "doc-B.docx", [unicodedata.normalize("NFD", SECRET_B)])
    result = page_run(kho)
    assert result["status"].startswith("Xong"), result
    assert (kho[0] / "page.json").read_bytes() == python_run(kho).read_bytes()


def test_page_makes_no_request_and_blocks_every_connection(kho):
    result = page_run(kho, trap=True)
    assert result["requests"] == [] and result["errors"] == []
    csp = result["csp"]
    assert "default-src 'none'" in csp and "connect-src 'none'" in csp
    source = (TOOL / "src" / "app.js").read_text("utf-8")
    for forbidden in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource"):
        assert forbidden not in source


def test_output_holds_no_text_and_no_file_name(kho):
    page_run(kho)
    written = (kho[0] / "page.json").read_text("utf-8")
    for secret in (SECRET_B, SECRET_C, "nghiền", "doc-B", "doc-C"):
        assert secret not in written


def test_trap_report_passes_and_holds_counts_only(kho):
    result = page_run(kho, trap=True)
    report = (kho[0] / "trap.txt").read_text("utf-8")
    assert "Kết quả bẫy: ĐẠT" in report and "rò rỉ 0" in report
    assert "Mọi dòng B/C trong bảng đã có hash" in report
    for secret in (SECRET_B, SECRET_C, "nghiền", "doc-B"):
        assert secret not in report and secret not in result["trap"]


def test_trap_fails_when_the_hashes_are_missing(kho):
    tmp, folder, table, manifest = kho
    (folder / "doc-B.docx").unlink()
    (folder / "sub" / "doc-C.docx").unlink()
    result = page_run(kho, trap=True)
    assert "Kết quả bẫy: KHÔNG ĐẠT" in result["trap"]
    assert "G-03 chưa đóng" in result["trap"]


@pytest.mark.parametrize(
    "tamper",
    ["class_differs", "manifest_broken", "table_broken"],
)
def test_bad_inputs_stop_the_page_and_nothing_is_offered(kho, tamper):
    tmp, folder, table, manifest = kho
    if tamper == "class_differs":
        data = json.loads(manifest.read_text("utf-8"))
        data["entries"][1]["classification"] = "A"
        manifest.write_text(json.dumps(data), "utf-8")
    elif tamper == "manifest_broken":
        manifest.write_text("{not json", "utf-8")
    else:
        table.write_bytes(b"not a workbook")
    result = page_run(kho)
    assert result["status"].startswith("Dừng") and result["downloadVisible"] is False
    assert not (tmp / "page.json").exists()


def test_class_a_is_refused(kho):
    result = page_run(kho, classes="A,B")
    assert result["status"].startswith("Dừng") and "class A" in result["status"]


def test_files_without_a_match_are_counted_by_reason(kho):
    (kho[1] / "doc-B.docx").unlink()
    shutil.copy(kho[1] / "sub" / "doc-C.docx", kho[1] / "doc-C.docx")
    result = page_run(kho)
    assert "not_found" in result["shown"] and "ambiguous_name" in result["shown"]
    assert "doc-" not in result["shown"]


def test_hashes_of_arbitrary_text_equal_the_python_ones():
    samples = [
        "Straße ﬁne ǅ ΣΑΣ İstanbul một hai ba bốn năm sáu bảy tám chín mười mười_một",
        "ABC def ghi jkl mno pqr stu vwx yz 123 ٣٤٥ ½ ² x́ý tail words here ok",
        "ngắn thôi",
        "",
    ]
    texts = [[t, s] for t in samples for s in ("", "s")]
    got = drive(
        "eval",
        {"texts": texts, "words": samples, "sha": ["", "abc", "héllo", "a" * 1000]},
    )
    assert got["errors"] == []
    for (text, salt), hashes in zip(texts, got["shingles"], strict=True):
        assert hashes == sorted(shingles(text, salt=salt)), (text, salt)
    import hashlib

    for given, sha in zip(["", "abc", "héllo", "a" * 1000], got["sha"], strict=True):
        assert sha == hashlib.sha256(given.encode()).hexdigest()
    for text, words in zip(samples, got["words"], strict=True):
        expected = [w.casefold() for w in re.findall(r"\w+", unicodedata.normalize("NFC", text))]
        assert words == expected


def test_word_characters_agree_except_where_unicode_versions_differ():
    got = drive("eval", {"wordRanges": True})["wordCps"]
    mine = set(got)
    theirs = {
        cp for cp in range(0x110000) if not 0xD800 <= cp <= 0xDFFF and re.fullmatch(r"\w", chr(cp))
    }
    differ = mine ^ theirs
    assigned_in_python = [cp for cp in differ if unicodedata.category(chr(cp)) != "Cn"]
    assert len(assigned_in_python) <= 40, sorted(assigned_in_python)[:20]


def test_check_decisions_equal_the_python_gate():
    entries = [
        {"file_id": "a-ok", "classification": "A", "approved_by": "x", "approved_on": "2026-01-01"},
        {"file_id": "a-pending", "classification": "A"},
        {
            "file_id": "b-doc",
            "classification": "B",
            "shingles": sorted(shingles(SECRET_B, salt="k")),
        },
        {"file_id": "q-doc", "classification": "?"},
    ]
    manifest = {"entries": entries, "salt": "k"}
    cases = [
        [{"kind": "instruction", "text": SECRET_B}],
        [{"kind": "intake", "text": UNRELATED}],
        [{"kind": "evidence", "text": UNRELATED}],
        [{"kind": "evidence", "text": UNRELATED, "source_ids": ["a-ok"]}],
        [{"kind": "evidence", "text": SECRET_B, "source_ids": ["a-pending", "b-doc", "zz"]}],
        [
            {"kind": "instruction", "text": UNRELATED},
            {"kind": "intake", "text": f"x {SECRET_B} y"},
        ],
    ]
    got = drive("eval", {"checks": [{"manifest": manifest, "parts": p} for p in cases]})["checks"]
    gate = Manifest.model_validate(manifest)
    for parts, reasons in zip(cases, got, strict=True):
        payload = Payload(parts=tuple(PayloadPart(**p) for p in parts))
        decision = check_egress(payload, Destination.REMOTE, gate)
        python = [(r.code, r.part_index, r.source_id) for r in decision.reasons]
        page = [(r["code"], r.get("part_index"), r.get("source_id")) for r in reasons]
        assert page == python, parts


@needs_pdftotext
def test_pdf_text_hashes_overlap_with_the_command_output(kho):
    tmp, folder, table, manifest = kho
    line = " ".join(f"alpha{i} beta{i} gamma{i}" for i in range(12))
    tiny_pdf(folder / "doc-B.pdf", line)
    (folder / "doc-B.docx").unlink()
    rows = [
        (IDS["A"], "doc-A.docx", "A"),
        (IDS["B"], "doc-B.pdf", "B"),
        (IDS["C"], "doc-C.docx", "C"),
    ]
    make_xlsx(table, rows)
    result = page_run(kho)
    assert result["status"].startswith("Xong"), result
    page = Manifest.model_validate_json((tmp / "page.json").read_text("utf-8"))
    python = Manifest.model_validate_json(python_run(kho).read_text("utf-8"))
    mine = page.get(IDS["B"]).shingles
    theirs = python.get(IDS["B"]).shingles
    assert mine and theirs and len(mine & theirs) / len(theirs) >= 0.9
