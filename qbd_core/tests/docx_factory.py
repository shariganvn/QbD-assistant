"""Build a minimal .docx with tables, for tests of the trial-file intake."""

import zipfile
from pathlib import Path

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
MAIN = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
CONTENT_TYPES = (
    '<?xml version="1.0"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="xml" ContentType="application/xml"/>'
    f'<Override PartName="/word/document.xml" ContentType="{MAIN}"/></Types>'
)
RELS = (
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
    'relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/'
    '2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
)


def table_xml(rows):
    cell = "<w:tc><w:p><w:r><w:t>{}</w:t></w:r></w:p></w:tc>"
    body = "".join("<w:tr>" + "".join(cell.format(c) for c in row) + "</w:tr>" for row in rows)
    return f"<w:tbl>{body}</w:tbl>"


def make_docx(path: Path, tables, paragraphs=()) -> Path:
    lead = "".join(f"<w:p><w:r><w:t>{t}</w:t></w:r></w:p>" for t in (paragraphs or ["Báo cáo"]))
    body = lead + "".join(table_xml(t) for t in tables)
    head = f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W}">'
    doc = f"{head}<w:body>{body}</w:body></w:document>"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", RELS)
        z.writestr("word/document.xml", doc)
    return path
