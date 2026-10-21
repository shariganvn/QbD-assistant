import glob
import hashlib
import shutil
from datetime import date
from pathlib import Path

import pytest

from qbd_core.modules.dossier_drafting.api import assemble_draft, validate_intake
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents
from qbd_core.modules.rendering.api import RenderFailed, render_draft, verify_html
from qbd_core.modules.rendering.html_doc import SCRIPT, build_html

REPO = Path(__file__).resolve().parents[4]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
OUTLINE = REPO / "tools/pharma-dev-draft/schemas/p2-outline.json"
needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="needs node for Stage B")


def draft():
    intake = validate_intake(
        {
            "substances": ["Atorvastatin calcium"],
            "dosage_form": "Viên nén bao phim",
            "market": "both",
        }
    )
    return assemble_draft(intake, InMemoryKnowledge(load_documents(DOCS)), date(2026, 10, 21)).draft


def outline():
    import json

    return json.loads(OUTLINE.read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def leftovers(folder):
    return [p.name for p in Path(folder).iterdir() if p.name.startswith(".stage-")]


def fake_tool(tmp_path, validate_js):
    root = tmp_path / "fake-tool"
    (root / "draft").mkdir(parents=True)
    (root / "schemas").mkdir()
    (root / "draft" / "validate-draft.mjs").write_text(validate_js, encoding="utf-8")
    (root / "schemas" / "p2-outline.json").write_text(OUTLINE.read_text(encoding="utf-8"))
    return root


@needs_node
def test_real_validator_then_render_publishes_a_verified_page(tmp_path):
    result = render_draft(draft(), tmp_path / "out")
    page = Path(result.path).read_text(encoding="utf-8")
    assert result.html_sha256 == sha(result.path) and leftovers(tmp_path / "out") == []
    assert verify_html(page, draft()) == []
    assert page.count('class="scope-notice"') == 1


@needs_node
def test_same_draft_gives_identical_bytes(tmp_path):
    a = render_draft(draft(), tmp_path / "a")
    b = render_draft(draft(), tmp_path / "b")
    assert a.html_sha256 == b.html_sha256 and a.draft_sha256 == b.draft_sha256


@needs_node
def test_invalid_draft_is_refused_and_the_old_output_stays(tmp_path):
    first = render_draft(draft(), tmp_path)
    before = sha(first.path)
    broken = draft()
    broken["sections"] = broken["sections"][:-1]
    with pytest.raises(RenderFailed) as caught:
        render_draft(broken, tmp_path)
    assert caught.value.code.startswith("E_")
    assert sha(first.path) == before and leftovers(tmp_path) == []


@needs_node
def test_a_figure_block_stops_the_render_instead_of_vanishing(tmp_path):
    figured = draft()
    figured["sections"][0] = {
        "id": figured["sections"][0]["id"],
        "status": "covered",
        "blocks": [{"type": "figure", "kind": "flow", "fromTable": "x", "caption": "c"}],
    }
    with pytest.raises(RenderFailed) as caught:
        render_draft(figured, tmp_path)
    assert caught.value.code in {
        "E_BLOCK_UNSUPPORTED",
        "E_FIGURE_SOURCE",
    } or caught.value.code.startswith("E_")
    assert leftovers(tmp_path) == []


def test_validator_error_code_is_passed_through(tmp_path):
    root = fake_tool(tmp_path, "console.log('E_DRAFT_SHAPE: nope'); process.exit(1);")
    with pytest.raises(RenderFailed) as caught:
        render_draft(draft(), tmp_path / "out", tool_root=root)
    assert caught.value.code == "E_DRAFT_SHAPE"
    assert leftovers(tmp_path / "out") == []


def test_validator_hang_times_out(tmp_path):
    root = fake_tool(tmp_path, "setTimeout(() => {}, 30000);")
    with pytest.raises(RenderFailed) as caught:
        render_draft(draft(), tmp_path / "out", tool_root=root, timeout=1)
    assert caught.value.code == "E_RENDER_TIMEOUT"


def test_missing_node_is_reported(tmp_path):
    root = fake_tool(tmp_path, "process.exit(0);")
    with pytest.raises(RenderFailed) as caught:
        render_draft(draft(), tmp_path / "out", tool_root=root, node="no-such-node-binary")
    assert caught.value.code == "E_TOOL_MISSING"


@pytest.mark.parametrize("name", ["../x.html", "a/b.html", "plain.docx", ".hidden.html", ""])
def test_output_name_must_be_a_plain_html_file(tmp_path, name):
    with pytest.raises(RenderFailed) as caught:
        render_draft(draft(), tmp_path, name)
    assert caught.value.code == "E_OUTPUT_NAME"


def test_unrelated_files_in_the_output_folder_are_left_alone(tmp_path):
    keep = tmp_path / "notes.txt"
    keep.write_text("keep", encoding="utf-8")
    root = fake_tool(tmp_path, "process.exit(0);")
    render_draft(draft(), tmp_path, tool_root=root)
    assert keep.read_text() == "keep"


def test_text_from_the_draft_is_escaped_and_cannot_add_a_script():
    hostile = draft()
    hostile["sections"][0] = {
        "id": hostile["sections"][0]["id"],
        "status": "covered",
        "blocks": [{"type": "paragraph", "text": "<script>alert(1)</script> & <b>x</b>"}],
    }
    page = build_html(hostile, outline())
    assert "&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;x&lt;/b&gt;" in page
    assert page.count("<script>") == 1
    assert verify_html(page, hostile) == []


def test_markers_are_highlighted_and_listed_in_the_registers():
    page = build_html(draft(), outline())
    assert '<mark class="gap">[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]</mark>' in page
    assert "Danh mục dữ liệu cần bổ sung" in page and "Danh mục điểm cần quyết định" in page


def test_signoff_rows_are_blank_and_the_notice_is_fixed():
    page = build_html(draft(), outline())
    for role in ("Soạn thảo", "Rà soát FD", "Phê duyệt QA/PO"):
        assert (
            f"<td><p>{role}</p></td><td><p>________________</p></td><td><p>________________</p></td>"
            in page
        )
    assert "BẢN NHÁP NỘI BỘ – CHƯA THẨM ĐỊNH" in page


def test_export_script_is_one_constant_with_no_network_call():
    assert build_html(draft(), outline()).count(SCRIPT) == 1
    other = draft()
    other["meta"]["productName"] = "Another product"
    assert SCRIPT in build_html(other, outline())
    for word in ("fetch", "XMLHttpRequest", "WebSocket", "sendBeacon", "eval(", "import("):
        assert word not in SCRIPT
    assert SCRIPT.count("http") == 1 and "http://www.w3.org/TR/REC-html40" in SCRIPT


def tamper(page):
    return {
        "second notice": page.replace(
            '<div class="scope-notice">',
            '<div class="scope-notice"></div><div class="scope-notice">',
            1,
        ),
        "extra script": page.replace("</body>", "<script>alert(1)</script></body>"),
        "link out": page.replace("</main>", '<a href="https://example.org">x</a></main>'),
        "filled signature": page.replace(
            "<td><p>________________</p></td>", "<td><p>Claude</p></td>", 1
        ),
        "image": page.replace("</main>", '<img src="data:image/png;base64,AAAA"></main>'),
        "missing button": page.replace('id="btn-pdf"', 'id="other"'),
        "gap text removed": page.replace("chưa có bằng chứng nội bộ", "ok"),
    }


@pytest.mark.parametrize(
    "kind",
    list(tamper("x"))
    if False
    else [
        "second notice",
        "extra script",
        "link out",
        "filled signature",
        "image",
        "missing button",
        "gap text removed",
    ],
)
def test_the_verifier_catches_tampering(kind):
    page = build_html(draft(), outline())
    assert verify_html(page, draft()) == []
    assert verify_html(tamper(page)[kind], draft()) != []


def test_browser_export_buttons(tmp_path):
    playwright = pytest.importorskip("playwright.sync_api")
    shells = glob.glob("/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell")
    if not shells:
        pytest.skip("no headless shell")
    page_file = tmp_path / "page.html"
    page_file.write_text(build_html(draft(), outline()), encoding="utf-8")
    with playwright.sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shells[0])
        page = browser.new_context(accept_downloads=True).new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(page_file.as_uri())
        with page.expect_download() as download:
            page.click("#btn-word")
        text = Path(download.value.path()).read_bytes().decode("utf-8-sig")
        assert download.value.suggested_filename == "p2-orientation-draft.doc"
        assert text.startswith("<html xmlns:o=") and 'class="scope-notice"' in text
        assert "btn-word" not in text
        page.emulate_media(media="print")
        assert page.eval_on_selector(".toolbar", "e => getComputedStyle(e).display") == "none"
        assert page.pdf(format="A4")[:4] == b"%PDF"
        browser.close()
    assert errors == []
