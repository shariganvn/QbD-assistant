"""The Apps Script edition hashes like the command and the offline page, never reaching out."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from qbd_core.modules.egress_gate.api import shingles

TOOL = Path(__file__).resolve().parents[2] / "tools" / "kho-fingerprint-offline"
HARNESS = TOOL / "test" / "run-appsscript.mjs"
SCRIPT = TOOL / "apps-script" / "Code.gs"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None or not SCRIPT.exists(), reason="needs node and Code.gs"
)

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
ID = {k: k.ljust(31, "x") + "01" for k in "ABCDEFG"}
TEXT_B = "Quy trình nội bộ nhóm B mô tả bước nghiền trộn bột siêu mịn trước khi dập viên thuốc"
TEXT_C = "Công thức nhóm C ghi rõ tỷ lệ tá dược độn dính và trơn cho lô thử nghiệm đầu tiên"
TEXT_A = "Tài liệu công khai nhóm A mô tả đặc tính chung của hoạt chất theo dược điển hiện hành"


def run(**args) -> dict:
    done = subprocess.run(
        ["node", str(HARNESS), json.dumps(args)],
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )
    lines = [ln for ln in done.stdout.splitlines() if ln.startswith("{")]
    assert lines, done.stderr[-2000:]
    return json.loads(lines[-1])


def scenario(*, salt="", classes=("B", "C"), extra_files=(), config=None):
    rows = [
        (ID["A"], "a.pdf", "A"),
        (ID["B"], "b.pdf", "B"),
        (ID["C"], "c.docx", "C"),
        (ID["D"], "d.zip", "B"),
        (ID["E"], "e-gone.pdf", "C"),
        (ID["F"], "f-empty.pdf", "C"),
    ]
    files = [
        {"id": ID["A"], "name": "a.pdf", "mime": PDF, "text": TEXT_A},
        {"id": ID["B"], "name": "b.pdf", "mime": PDF, "text": TEXT_B},
        {"id": ID["C"], "name": "c.docx", "mime": DOCX, "text": TEXT_C},
        {"id": ID["D"], "name": "d.zip", "mime": "application/zip", "text": "x"},
        {"id": ID["F"], "name": "f-empty.pdf", "mime": PDF, "text": "   \n  "},
        *extra_files,
    ]
    entries = [{"file_id": i, "classification": g} for i, _, g in rows]
    entries[0].update(approved_by="Người duyệt", approved_on="2026-10-23")
    table = [["file_id", "file_name", "folder", "nhom"], *[[i, n, "", g] for i, n, g in rows]]
    cfg = {"TABLE_SHEET_ID": "sheet", "MANIFEST_FILE_ID": "manifest-file", "SALT": salt}
    cfg.update(config or {})
    return {"files": files, "entries": entries, "table": table, "config": cfg}


def expected_json(entries, salt, hashes):
    out = [
        {
            "file_id": e["file_id"],
            "classification": e["classification"],
            "approved_by": e.get("approved_by"),
            "approved_on": e.get("approved_on"),
            "shingles": hashes.get(e["file_id"], []),
        }
        for e in entries
    ]
    return json.dumps({"entries": out, "salt": salt}, ensure_ascii=False, indent=1) + "\n"


@pytest.mark.parametrize("salt", ["", "muối-1"])
def test_hashes_equal_the_python_ones(salt):
    samples = [
        "Straße ﬁne ǅ ΣΑΣ İstanbul một hai ba bốn năm sáu bảy tám chín mười mười_một",
        "ABC def ghi jkl mno pqr stu vwx yz 123 ٣٤٥ ½ ² x́ý tail words here ok",
        "ngắn thôi",
        "",
    ]
    got = run(vectors=[[t, salt] for t in samples], sha=["", "abc", "héllo"])
    assert got["error"] is None
    for text, hashes in zip(samples, got["shingles"], strict=True):
        assert hashes == sorted(shingles(text, salt=salt)), text


def test_the_built_in_self_test_passes():
    got = run(selfTest=True)
    assert got["error"] is None and got["logs"][-1] == "selfTest passed"


def test_a_full_run_writes_the_same_file_as_the_command_would():
    s = scenario(salt="k")
    got = run(**s, steps=["runBatch", "finalize"])
    assert got["error"] is None, got
    out = got["outputs"]["kho-fingerprints"]
    hashes = {
        ID["B"]: sorted(shingles(TEXT_B, salt="k")),
        ID["C"]: sorted(shingles(TEXT_C, salt="k")),
    }
    assert out["fingerprints.json"] == expected_json(s["entries"], "k", hashes)
    progress = json.loads(out["progress.json"])
    reasons = {r["r"] for r in progress.values() if r["s"] == "skip"}
    assert reasons == {"unsupported_type", "not_found", "no_text"}
    assert ID["A"] not in progress
    assert "fingerprinted 2/5" in "\n".join(got["logs"])


def test_the_trap_runs_on_the_text_and_nothing_leaks():
    got = run(**scenario(), steps=["runBatch", "finalize"])
    report = json.loads(got["outputs"]["kho-fingerprints"]["progress.json"])
    done = [p for p in report.values() if p["s"] == "ok"]
    assert done and all(p["t"] > 0 and p["b"] == p["t"] and p["a"] == p["c"] for p in done)
    assert any("leaked 0" in line for line in got["logs"])


def test_conversion_copies_are_deleted_and_output_has_no_text_or_names():
    got = run(**scenario(), steps=["runBatch", "finalize"])
    assert got["tmpCreated"] == got["tmpRemoved"] == 3  # b.pdf, c.docx, f-empty.pdf
    blob = json.dumps(got["outputs"], ensure_ascii=False) + "\n".join(got["logs"])
    for secret in (TEXT_B, TEXT_C, "nghiền", "b.pdf", "c.docx", "f-empty"):
        assert secret not in blob


def test_a_failed_conversion_is_skipped_and_reported_not_hidden():
    got = run(**scenario(), convertFails=True, steps=["runBatch", "finalize"])
    progress = json.loads(got["outputs"]["kho-fingerprints"]["progress.json"])
    assert {p["r"] for p in progress.values() if p["s"] == "skip"} >= {"convert_failed"}
    assert "fingerprinted 0/5" in "\n".join(got["logs"])


def test_finalize_refuses_while_rows_are_unprocessed():
    got = run(**scenario(), steps=["finalize"])
    assert got["error"] and "still to process" in got["error"]
    assert "fingerprints.json" not in got["outputs"].get("kho-fingerprints", {})


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"config": {"CLASSES": ["A", "B"]}}, "class A"),
        ({"config": {"MANIFEST_FILE_ID": "missing"}}, "not found"),
        ({"config": {"TABLE_SHEET_ID": ""}}, "fill TABLE_SHEET_ID"),
    ],
)
def test_bad_configuration_stops_before_any_output(change, message):
    s = scenario()
    s["config"].update(change["config"])
    got = run(**s, steps=["runBatch"])
    assert got["error"] and message in got["error"]
    assert got["outputs"] == {}


def test_a_class_that_differs_from_the_manifest_stops_the_run():
    s = scenario()
    s["entries"][1]["classification"] = "A"
    got = run(**s, steps=["runBatch"])
    assert got["error"] and "E_TABLE_MISMATCH" in got["error"] and got["outputs"] == {}


def test_a_broken_manifest_stops_the_run():
    got = run(**scenario(), manifestText="{not json", steps=["runBatch"])
    assert got["error"] and "manifest is missing or unreadable" in got["error"]


def test_the_script_cannot_reach_outside_google():
    code = SCRIPT.read_text("utf-8")
    for forbidden in (
        "UrlFetchApp",
        "fetch(",
        "XMLHttpRequest",
        "MailApp",
        "GmailApp",
        "sendBeacon",
    ):
        assert forbidden not in code
    manifest = json.loads((TOOL / "apps-script" / "appsscript.json").read_text("utf-8"))
    assert not any("external_request" in s for s in manifest["oauthScopes"])
    assert "https://www.googleapis.com/auth/spreadsheets" in manifest["oauthScopes"]
    for write_call in ("setValue", "setValues", "appendRow", "clearContents", "deleteRow"):
        assert write_call not in code


def test_the_embedded_case_table_is_the_generated_one():
    table = (TOOL / "casefold-table.json").read_text("utf-8").strip()
    assert table in SCRIPT.read_text("utf-8")


PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'


def run_one(mime, name, zip_members, *, size=None, salt="", extra=None):
    """One class B file of the given type through runBatch and finalize; returns the output."""
    rows = [(ID["B"], name, "B")]
    table = [["file_id", "file_name", "folder", "nhom"], *[[i, n, "", g] for i, n, g in rows]]
    entries = [{"file_id": ID["B"], "classification": "B"}]
    file = {"id": ID["B"], "name": name, "mime": mime, "text": "", "zip": zip_members, "size": size}
    cfg = {"TABLE_SHEET_ID": "sheet", "MANIFEST_FILE_ID": "manifest-file", "SALT": salt}
    got = run(
        files=[file],
        entries=entries,
        table=table,
        config=cfg,
        steps=["runBatch", "finalize"],
        **(extra or {}),
    )
    return got, entries


def docx_xml(paragraphs):
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    return f'<?xml version="1.0"?><w:document {W}><w:body>{body}</w:body></w:document>'


def test_docx_is_read_from_its_xml_like_the_command_does():
    paragraphs = [
        "Công thức nhóm C &amp; tá dược",
        "độn dính và trơn cho lô thử nghiệm đầu tiên",
        "",
    ]
    got, entries = run_one(DOCX, "x.docx", {"word/document.xml": docx_xml(paragraphs)}, salt="k")
    assert got["error"] is None and got["tmpCreated"] == 0, got
    text = "\n".join(["Công thức nhóm C & tá dược", paragraphs[1], ""])
    out = json.loads(got["outputs"]["kho-fingerprints"]["fingerprints.json"])
    assert out["entries"][0]["shingles"] == sorted(shingles(text, salt="k"))


def test_nested_and_empty_paragraphs_follow_the_tree_walk():
    xml = (
        f'<w:document {W}><w:p><w:t>a</w:t><w:p><w:t xml:space="preserve"> b</w:t></w:p>'
        "<w:t>c</w:t></w:p><w:p/><w:p><w:pPr/><w:tab/><w:t/><w:t>d</w:t></w:p></w:document>"
    )
    got = run(paragraphs=[[xml, "w"]])
    assert got["paragraphs"] == [["a bc", " b", "", "d"]]


def slide(text):
    return f"<p {A_NS}><a:p><a:t>{text}</a:t></a:p></p>"


def test_pptx_slides_and_notes_are_read_in_numeric_order():
    tail = "một hai ba bốn năm sáu bảy tám"
    members = {
        "ppt/slides/slide10.xml": slide(f"mười {tail}"),
        "ppt/slides/slide2.xml": slide(f"hai {tail}"),
        "ppt/notesSlides/notesSlide1.xml": slide(f"ghi chú {tail}"),
        "docProps/app.xml": "<x/>",
    }
    got, _ = run_one(PPTX, "x.pptx", members)
    out = json.loads(got["outputs"]["kho-fingerprints"]["fingerprints.json"])
    text = "\n".join([f"hai {tail}", f"mười {tail}", f"ghi chú {tail}"])
    assert out["entries"][0]["shingles"] == sorted(shingles(text))
    assert got["tmpCreated"] == 0


def test_xlsx_shared_and_inline_strings_are_read():
    shared = (
        "<sst><si><t>một hai ba bốn</t></si>"
        "<si><r><t>năm sáu </t></r><r><t>bảy tám</t></r></si></sst>"
    )
    sheet = (
        '<worksheet><sheetData><row><c t="inlineStr"><is><t>chín mười</t></is></c></row>'
        "</sheetData></worksheet>"
    )
    members = {"xl/sharedStrings.xml": shared, "xl/worksheets/sheet1.xml": sheet}
    got, _ = run_one(XLSX, "x.xlsx", members)
    out = json.loads(got["outputs"]["kho-fingerprints"]["fingerprints.json"])
    text = "một hai ba bốn\nnăm sáu bảy tám\nchín mười"
    assert out["entries"][0]["shingles"] == sorted(shingles(text))


def test_an_unreadable_docx_falls_back_to_the_converter():
    got, _ = run_one(DOCX, "x.docx", None)
    assert got["error"] is None and got["tmpCreated"] == got["tmpRemoved"] == 1


def test_images_go_to_the_converter():
    got, _ = run_one("image/png", "x.png", None)
    assert got["tmpCreated"] == got["tmpRemoved"] == 1


def test_a_file_over_the_limit_is_not_sent_to_the_converter():
    got, _ = run_one(PDF, "x.pdf", None, size=300 * 1024 * 1024)
    progress = json.loads(got["outputs"]["kho-fingerprints"]["progress.json"])
    assert progress[ID["B"]] == {"s": "skip", "r": "too_large"}
    assert got["tmpCreated"] == 0


def test_reprocess_clears_only_the_retryable_skips():
    s = scenario()
    first = run(**s, steps=["runBatch"])
    progress = json.loads(first["outputs"]["kho-fingerprints"]["progress.json"])
    assert {p.get("r") for p in progress.values()} >= {"unsupported_type", "not_found", "no_text"}
    # a second harness run starts from an empty Drive, so seed the progress through the files
    seeded = dict(progress)
    seeded[ID["F"]] = {"s": "skip", "r": "too_large"}
    got = run(
        **s,
        steps=["reprocess"],
        seedProgress=seeded,
    )
    kept = json.loads(got["outputs"]["kho-fingerprints"]["progress.json"])
    assert ID["D"] not in kept  # unsupported_type was cleared
    assert kept[ID["F"]] == {"s": "skip", "r": "too_large"}
    assert kept[ID["B"]]["s"] == "ok"
    assert any("cleared" in line for line in got["logs"])


def test_docx_hashes_equal_the_command_output_on_the_same_file(tmp_path):
    import zipfile

    from qbd_core import main
    from qbd_core.modules.egress_gate.api import Manifest
    from qbd_core.tests.docx_factory import make_docx
    from qbd_core.tests.test_kho_load import make_xlsx

    folder = tmp_path / "files"
    folder.mkdir()
    lines = [
        "Tá dược độn và dính",
        "trơn cho lô thử nghiệm đầu tiên của sản phẩm",
        "kết thúc ở đây",
    ]
    make_docx(folder / "x.docx", [], lines)
    rows = [(ID["B"], "x.docx", "B")]
    make_xlsx(tmp_path / "t.xlsx", rows)
    manifest = tmp_path / "m.json"
    manifest.write_text(json.dumps({"entries": [{"file_id": ID["B"], "classification": "B"}]}))
    out = tmp_path / "out" / "f.json"
    code = main.main(
        ["kho-fingerprint", "--table", str(tmp_path / "t.xlsx"), "--folder", str(folder),
         "--manifest", str(manifest), "--out", str(out)]
    )  # fmt: skip
    assert code == 0
    command = Manifest.model_validate_json(out.read_text("utf-8")).get(ID["B"]).shingles
    with zipfile.ZipFile(folder / "x.docx") as z:
        members = {n: z.read(n).decode("utf-8") for n in z.namelist() if n.endswith(".xml")}
    got, _ = run_one(DOCX, "x.docx", members)
    page = json.loads(got["outputs"]["kho-fingerprints"]["fingerprints.json"])
    assert command and set(page["entries"][0]["shingles"]) == set(command)
