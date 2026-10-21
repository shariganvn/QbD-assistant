import hashlib
import os
import shutil
import zipfile
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents
from qbd_core.modules.rendering.api import RenderFailed, content_sha256, render_draft

REPO = Path(__file__).resolve().parents[4]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
VALIDATE_PY = Path(
    os.environ.get("DOCX_SKILL_VALIDATE_PY", "/mnt/skills/public/docx/scripts/office/validate.py")
)
needs_tool = pytest.mark.skipif(
    shutil.which("node") is None or not VALIDATE_PY.is_file(),
    reason="needs node and the docx skill validator (DOCX_SKILL_VALIDATE_PY)",
)


def draft():
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    kb = InMemoryKnowledge(load_documents(DOCS))
    return assemble_draft(intake, kb, date(2026, 10, 21)).draft


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def fake_tool(tmp_path, render_js, verify_js="process.exit(0);"):
    root = tmp_path / "fake-tool"
    (root / "render").mkdir(parents=True)
    (root / "verify").mkdir()
    (root / "render" / "render.mjs").write_text(render_js, encoding="utf-8")
    (root / "verify" / "verify.mjs").write_text(verify_js, encoding="utf-8")
    return root


def writes_a_file(tmp_path, content=None):
    source = tmp_path / "fake-source.docx"
    make_zip(source, STAMPED.format(t="T", c="x"))
    if content is not None:
        source.write_text(content, encoding="utf-8")
    return (
        'import { copyFileSync } from "node:fs";\n'
        "const a = process.argv;\n"
        "const at = (flag) => a[a.indexOf(flag) + 1];\n"
        f'const target = at("--output-root") + "/" + at("--output-name");\n'
        f'copyFileSync("{source}", target);\n'
    )


def leftovers(folder):
    return [p.name for p in Path(folder).iterdir() if p.name.startswith(".stage-")]


@needs_tool
def test_real_tool_renders_and_verifies(tmp_path):
    result = render_draft(draft(), tmp_path / "out")
    assert Path(result.path).is_file() and result.size > 1000
    assert result.docx_sha256 == sha(result.path)
    assert leftovers(tmp_path / "out") == []


@needs_tool
def test_same_draft_gives_the_same_document(tmp_path):
    a = render_draft(draft(), tmp_path / "a")
    b = render_draft(draft(), tmp_path / "b")
    assert a.content_sha256 == b.content_sha256 and a.draft_sha256 == b.draft_sha256


@needs_tool
def test_a_different_draft_gives_a_different_content_hash(tmp_path):
    other = draft()
    other["meta"]["productName"] = other["meta"]["productName"] + " (khác)"
    a = render_draft(draft(), tmp_path / "a")
    b = render_draft(other, tmp_path / "b")
    assert a.content_sha256 != b.content_sha256


@needs_tool
def test_invalid_draft_is_refused_and_the_old_output_stays(tmp_path):
    first = render_draft(draft(), tmp_path)
    before = sha(first.path)
    broken = draft()
    broken["sections"] = broken["sections"][:-1]
    with pytest.raises(RenderFailed) as caught:
        render_draft(broken, tmp_path)
    assert caught.value.code.startswith("E_")
    assert sha(first.path) == before and leftovers(tmp_path) == []


def test_fake_tool_success_publishes_after_verify(tmp_path):
    root = fake_tool(tmp_path, writes_a_file(tmp_path))
    result = render_draft({"x": 1}, tmp_path / "out", tool_root=root)
    assert zipfile.is_zipfile(result.path)
    assert leftovers(tmp_path / "out") == []


def test_verify_failure_publishes_nothing_and_keeps_the_old_file(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    old = out / "p2-orientation-draft.docx"
    old.write_text("previous", encoding="utf-8")
    root = fake_tool(tmp_path, writes_a_file(tmp_path), "console.error('bad'); process.exit(1);")
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, out, tool_root=root)
    assert caught.value.code == "E_VERIFY_FAILED"
    assert old.read_text() == "previous" and leftovers(out) == []


def test_renderer_error_code_is_passed_through(tmp_path):
    root = fake_tool(tmp_path, "console.error('E_DRAFT_SHAPE: nope'); process.exit(1);")
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path / "out", tool_root=root)
    assert caught.value.code == "E_DRAFT_SHAPE"


def test_exit_zero_without_a_file_is_a_failure(tmp_path):
    root = fake_tool(tmp_path, "process.exit(0);")
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path / "out", tool_root=root)
    assert caught.value.code == "E_RENDER_NO_OUTPUT"


def test_empty_output_file_is_a_failure(tmp_path):
    root = fake_tool(tmp_path, writes_a_file(tmp_path, content=""))
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path / "out", tool_root=root)
    assert caught.value.code == "E_RENDER_NO_OUTPUT"


def test_output_that_is_not_a_zip_is_invalid(tmp_path):
    root = fake_tool(tmp_path, writes_a_file(tmp_path, content="not a zip"))
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path / "out", tool_root=root)
    assert caught.value.code == "E_OUTPUT_INVALID"
    assert leftovers(tmp_path / "out") == []


def test_hanging_renderer_times_out(tmp_path):
    root = fake_tool(tmp_path, "setTimeout(() => {}, 30000);")
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path / "out", tool_root=root, timeout=1)
    assert caught.value.code == "E_RENDER_TIMEOUT"
    assert leftovers(tmp_path / "out") == []


def test_missing_node_is_reported(tmp_path):
    root = fake_tool(tmp_path, writes_a_file(tmp_path))
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path / "out", tool_root=root, node="no-such-node-binary")
    assert caught.value.code == "E_TOOL_MISSING"


@pytest.mark.parametrize("name", ["../x.docx", "a/b.docx", "plain.txt", ".hidden.docx", ""])
def test_output_name_must_be_a_plain_docx_file(tmp_path, name):
    with pytest.raises(RenderFailed) as caught:
        render_draft({"x": 1}, tmp_path, name)
    assert caught.value.code == "E_OUTPUT_NAME"


def test_unrelated_files_in_the_output_folder_are_left_alone(tmp_path):
    keep = tmp_path / "notes.txt"
    keep.write_text("keep", encoding="utf-8")
    render_draft({"x": 1}, tmp_path, tool_root=fake_tool(tmp_path, writes_a_file(tmp_path)))
    assert keep.read_text() == "keep"


def make_zip(path, core):
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("word/document.xml", "<w:document>same</w:document>")
        archive.writestr("docProps/core.xml", core)
    return path


STAMPED = (
    "<cp:coreProperties><dc:title>{t}</dc:title>"
    '<dcterms:created xsi:type="dcterms:W3CDTF">{c}</dcterms:created>'
    '<dcterms:modified xsi:type="dcterms:W3CDTF">{c}</dcterms:modified></cp:coreProperties>'
)


def test_content_hash_ignores_only_the_two_stamps(tmp_path):
    a = make_zip(tmp_path / "a.docx", STAMPED.format(t="T", c="2026-01-01T00:00:00.000Z"))
    b = make_zip(tmp_path / "b.docx", STAMPED.format(t="T", c="2027-05-05T05:05:05.555Z"))
    other_title = make_zip(tmp_path / "c.docx", STAMPED.format(t="U", c="2026-01-01T00:00:00.000Z"))
    assert content_sha256(a) == content_sha256(b)
    assert content_sha256(a) != content_sha256(other_title)


def test_content_hash_sees_a_change_in_the_body(tmp_path):
    a = make_zip(tmp_path / "a.docx", STAMPED.format(t="T", c="x"))
    with zipfile.ZipFile(tmp_path / "b.docx", "w") as archive:
        archive.writestr("word/document.xml", "<w:document>different</w:document>")
        archive.writestr("docProps/core.xml", STAMPED.format(t="T", c="x"))
    assert content_sha256(a) != content_sha256(tmp_path / "b.docx")
