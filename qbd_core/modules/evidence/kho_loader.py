"""Knowledge documents from files the owner downloaded. Runs on the owner's machine.

The owner's table says which Drive id each file name stands for; the text is taken from the files
themselves, so every stored page is exactly what the extractor read, never a copy typed by hand.
"""

from __future__ import annotations

import re
import subprocess
import unicodedata
import zipfile
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from qbd_core.modules.evidence.models import KnowledgeDocument

MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DRIVE_ID = re.compile(r"[A-Za-z0-9_-]{33}")
PDF_TIMEOUT_SECONDS = 180


class KhoLoadError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code


@dataclass(frozen=True)
class TableRow:
    file_id: str
    file_name: str
    group: str
    upload: str = ""  # the owner's upload flag; empty when the sheet has no such column
    status: str = ""


@dataclass(frozen=True)
class Loaded:
    documents: tuple[KnowledgeDocument, ...]
    skipped: Mapping[str, str]  # file_id -> reason, never the file name


def _cells(row: ET.Element, strings: list[str]) -> dict[str, str]:
    cells: dict[str, str] = {}
    for cell in row:
        column = re.match(r"[A-Z]+", cell.get("r", ""))
        if column is None:
            continue
        if cell.get("t") == "inlineStr":
            text = "".join(t.text or "" for t in cell.iter(MAIN + "t"))
        else:
            value = cell.find(MAIN + "v")
            if value is None or value.text is None:
                continue
            text = strings[int(value.text)] if cell.get("t") == "s" else value.text
        cells[column.group()] = text
    return cells


def read_table(path: str | Path) -> tuple[TableRow, ...]:
    """Rows of the sheet named Manifest: columns file_id, file_name and nhom, found by header."""
    try:
        with zipfile.ZipFile(path) as book:
            workbook = ET.fromstring(book.read("xl/workbook.xml"))
            rels = {
                r.get("Id"): r.get("Target")
                for r in ET.fromstring(book.read("xl/_rels/workbook.xml.rels")).iter(
                    REL + "Relationship"
                )
            }
            target = next(
                rels[
                    s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                ]
                for s in workbook.iter(MAIN + "sheet")
                if s.get("name") == "Manifest"
            )
            strings = []
            if "xl/sharedStrings.xml" in book.namelist():
                shared = ET.fromstring(book.read("xl/sharedStrings.xml"))
                strings = ["".join(t.text or "" for t in si.iter(MAIN + "t")) for si in shared]
            name = target.lstrip("/")
            sheet = ET.fromstring(book.read(name if name.startswith("xl/") else f"xl/{name}"))
    except (OSError, KeyError, StopIteration, ET.ParseError, zipfile.BadZipFile) as error:
        raise KhoLoadError("E_TABLE_UNREADABLE", type(error).__name__) from error
    rows = [_cells(r, strings) for r in sheet.iter(MAIN + "row")]
    header = next((r for r in rows if "file_id" in r.values()), None)
    if header is None:
        raise KhoLoadError("E_TABLE_HEADER")
    column = {v: k for k, v in header.items()}
    if not {"file_id", "file_name", "nhom"} <= set(column):
        raise KhoLoadError("E_TABLE_HEADER")
    table = []
    for r in rows[rows.index(header) + 1 :]:
        file_id = r.get(column["file_id"], "")
        if not file_id:
            continue
        if not DRIVE_ID.fullmatch(file_id):
            raise KhoLoadError("E_TABLE_ID", "a file_id is not a Drive id")
        table.append(
            TableRow(
                file_id,
                r.get(column["file_name"], ""),
                r.get(column["nhom"], ""),
                r.get(column.get("tai_len_ngoai", ""), ""),
                r.get(column.get("trang_thai", ""), ""),
            )
        )
    ids = [t.file_id for t in table]
    if not table or len(set(ids)) != len(ids):
        raise KhoLoadError("E_TABLE_ID", "empty table or repeated file_id")
    return tuple(table)


def _pdf_pages(path: Path) -> tuple[str, ...]:
    try:
        done = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", str(path), "-"],
            capture_output=True,
            timeout=PDF_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as error:
        raise KhoLoadError("E_TOOL_MISSING", "pdftotext") from error
    except subprocess.TimeoutExpired:
        return ()
    if done.returncode != 0:
        return ()
    pages = done.stdout.decode("utf-8", errors="replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    return tuple(pages)


def _docx_pages(path: Path) -> tuple[str, ...]:
    try:
        with zipfile.ZipFile(path) as book:
            body = ET.fromstring(book.read("word/document.xml"))
    except (OSError, KeyError, ET.ParseError, zipfile.BadZipFile):
        return ()
    paragraphs = ["".join(t.text or "" for t in p.iter(WORD + "t")) for p in body.iter(WORD + "p")]
    return ("\n".join(paragraphs),)


EXTRACTORS = {".pdf": _pdf_pages, ".docx": _docx_pages}


def _normal(name: str) -> str:
    return unicodedata.normalize("NFC", name)


def build_documents(
    folder: str | Path,
    table: tuple[TableRow, ...],
    known_groups: Mapping[str, str],
    groups: Collection[str] = ("A", "B", "C"),
) -> Loaded:
    """One document per table row whose file was downloaded and has text. Nothing is guessed:
    a row unknown to the manifest, or in another class there, stops the load."""
    for row in table:
        if known_groups.get(row.file_id) != row.group:
            raise KhoLoadError("E_TABLE_MISMATCH", f"{row.file_id} differs from the manifest")
    by_name: dict[str, list[Path]] = {}
    for path in Path(folder).rglob("*"):
        if path.is_file():
            by_name.setdefault(_normal(path.name), []).append(path)
    documents, skipped = [], {}
    for row in sorted(table, key=lambda r: r.file_id):
        if row.group not in groups:
            continue
        found = by_name.get(_normal(row.file_name), [])
        if len(found) != 1:
            skipped[row.file_id] = "not_found" if not found else "ambiguous_name"
            continue
        extract = EXTRACTORS.get(found[0].suffix.lower())
        if extract is None:
            skipped[row.file_id] = "unsupported_type"
            continue
        pages = extract(found[0])
        if not any(page.strip() for page in pages):
            skipped[row.file_id] = "no_text"
            continue
        documents.append(
            KnowledgeDocument(
                file_id=row.file_id, name=row.file_name, classification=row.group, pages=pages
            )
        )
    return Loaded(tuple(documents), skipped)


def inside_a_git_tree(path: str | Path) -> bool:
    """True when the path sits in a git work tree: such a file could be committed by mistake."""
    return any((parent / ".git").exists() for parent in Path(path).resolve().parents)


GROUPS = ("A", "B", "C", "?")
ALLOWED_FLAG = "Có"
FLAGS = (ALLOWED_FLAG, "Chờ", "Không")


def manifest_entries(
    table: tuple[TableRow, ...],
    approved_by: str,
    approved_on: str,
    kept_dates: Mapping[str, str] | None = None,
) -> list[dict[str, str]]:
    """Egress manifest entries by Drive id and class, no names. Only a class A file whose upload
    flag is "Có" is approved; everything unclear stops the build instead of being guessed."""
    kept = kept_dates or {}
    entries = []
    for row in sorted(table, key=lambda r: r.file_id):
        flag = unicodedata.normalize("NFC", row.upload)
        if row.group not in GROUPS:
            raise KhoLoadError("E_TABLE_GROUP", row.file_id)
        if flag not in FLAGS:
            raise KhoLoadError("E_TABLE_FLAG", f"{row.file_id}: unknown upload flag")
        if flag == ALLOWED_FLAG and row.group != "A":
            raise KhoLoadError("E_TABLE_FLAG", f"{row.file_id}: only class A can be allowed")
        entry = {"file_id": row.file_id, "classification": row.group}
        if flag == ALLOWED_FLAG:
            entry["approved_by"] = approved_by
            entry["approved_on"] = kept.get(row.file_id, approved_on)
        entries.append(entry)
    return entries
