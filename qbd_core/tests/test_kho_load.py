"""The Kho loader: text from the files, ids from the owner table, nothing written into a repo."""

import json
import shutil
import zipfile
from pathlib import Path

import pytest

from qbd_core import main
from qbd_core.modules.evidence.api import KhoLoadError, load_documents, read_table
from qbd_core.tests.docx_factory import make_docx

IDS = {k: f"{k}".ljust(31, "x") + "01" for k in "ABCDEFG"}
SENTENCE = "Atorvastatin calcium thuộc nhóm BCS 2 theo tài liệu mô phỏng."
needs_pdftotext = pytest.mark.skipif(shutil.which("pdftotext") is None, reason="needs pdftotext")


def tiny_pdf(path: Path, text: str) -> None:
    body = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(body) + body + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    path.write_bytes(out)


def make_xlsx(path: Path, rows: list[tuple[str, str, str]]) -> None:
    def cell(ref, text):
        return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'

    sheet_rows = [("file_id", "file_name", "nhom"), *rows]
    xml = "".join(
        f'<row r="{i}">' + "".join(cell(f"{'ABC'[j]}{i}", v) for j, v in enumerate(r)) + "</row>"
        for i, r in enumerate(sheet_rows, 1)
    )
    main_ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rel_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with zipfile.ZipFile(path, "w") as book:
        book.writestr(
            "xl/workbook.xml",
            f'<workbook xmlns="{main_ns}" xmlns:r="{rel_ns}"><sheets>'
            '<sheet name="Tổng hợp" sheetId="1" r:id="rId1"/>'
            '<sheet name="Manifest" sheetId="2" r:id="rId2"/></sheets></workbook>',
        )
        book.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
        )
        book.writestr(
            "xl/worksheets/sheet1.xml", f'<worksheet xmlns="{main_ns}"><sheetData/></worksheet>'
        )
        book.writestr(
            "xl/worksheets/sheet2.xml",
            f'<worksheet xmlns="{main_ns}"><sheetData>{xml}</sheetData></worksheet>',
        )


@pytest.fixture
def kho(tmp_path):
    folder = tmp_path / "downloads"
    (folder / "sub").mkdir(parents=True)
    make_docx(folder / "guide.docx", [], [SENTENCE])
    (folder / "blank.pdf").write_bytes(b"not a pdf")
    (folder / "bundle.zip").write_bytes(b"PK")
    rows = [
        (IDS["A"], "guide.docx", "A"),
        (IDS["B"], "blank.pdf", "B"),
        (IDS["C"], "bundle.zip", "C"),
        (IDS["D"], "missing.pdf", "A"),
    ]
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps({"entries": [{"file_id": i, "classification": g} for i, _, g in rows]}), "utf-8"
    )
    table = tmp_path / "table.xlsx"
    make_xlsx(table, rows)
    return tmp_path, folder, table, manifest


def run_load(tmp, folder, table, manifest, out, *extra):
    return main.main(
        ["kho-load", "--table", str(table), "--folder", str(folder), "--manifest", str(manifest),
         "--out", str(out), *extra]
    )  # fmt: skip


def test_table_is_read_by_header(kho):
    _, _, table, _ = kho
    assert [r.file_id for r in read_table(table)] == [IDS[k] for k in "ABCD"]


def test_documents_carry_drive_ids_and_skips_carry_reasons(kho, capsys):
    tmp, folder, table, manifest = kho
    out = tmp / "out" / "documents.json"
    assert run_load(tmp, folder, table, manifest, out) == 0
    docs = load_documents(out)
    assert [(d.file_id, d.classification.value) for d in docs] == [(IDS["A"], "A")]
    assert SENTENCE in docs[0].pages[0]
    said = capsys.readouterr().out
    assert "loaded 1" in said and "no_text" in said and "unsupported_type" in said
    assert "not_found" in said and "guide.docx" not in said


@needs_pdftotext
def test_pdf_text_is_exactly_what_the_extractor_read(kho):
    tmp, folder, table, manifest = kho
    tiny_pdf(folder / "blank.pdf", "Hello Kho")
    out = tmp / "out" / "documents.json"
    assert run_load(tmp, folder, table, manifest, out) == 0
    docs = {d.file_id: d for d in load_documents(out)}
    assert "Hello Kho" in docs[IDS["B"]].pages[0]


def test_class_filter(kho):
    tmp, folder, table, manifest = kho
    out = tmp / "out" / "documents.json"
    assert run_load(tmp, folder, table, manifest, out, "--classes", "B") == 0
    assert load_documents(out) == ()


def test_a_class_that_differs_from_the_manifest_stops_the_load(kho, capsys):
    tmp, folder, table, manifest = kho
    data = json.loads(manifest.read_text("utf-8"))
    data["entries"][0]["classification"] = "B"
    manifest.write_text(json.dumps(data), "utf-8")
    out = tmp / "out" / "documents.json"
    assert run_load(tmp, folder, table, manifest, out) == 13
    assert "E_TABLE_MISMATCH" in capsys.readouterr().err and not out.exists()


def test_an_id_unknown_to_the_manifest_stops_the_load(kho):
    tmp, folder, table, manifest = kho
    data = json.loads(manifest.read_text("utf-8"))
    data["entries"].pop()
    manifest.write_text(json.dumps(data), "utf-8")
    assert run_load(tmp, folder, table, manifest, tmp / "o.json") == 13


def test_output_inside_a_git_tree_is_refused(kho, capsys):
    tmp, folder, table, manifest = kho
    (tmp / "repo" / ".git").mkdir(parents=True)
    out = tmp / "repo" / "documents.json"
    assert run_load(tmp, folder, table, manifest, out) == 13
    assert "git work tree" in capsys.readouterr().err and not out.exists()


def test_a_broken_table_is_refused(kho):
    tmp, folder, table, manifest = kho
    table.write_bytes(b"not a workbook")
    with pytest.raises(KhoLoadError):
        read_table(table)
    assert run_load(tmp, folder, table, manifest, tmp / "o.json") == 13
