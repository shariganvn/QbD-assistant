"""The draft page prints the ACTD number next to the CTD number when the market has one."""

import re
import shutil
from pathlib import Path

import pytest

from qbd_core import main
from qbd_core.modules.rendering.api import DEFAULT_NAME, verify_html

DOCS = Path(__file__).parents[1] / "modules/dossier_drafting/tests/fixtures/documents.json"
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node for rendering")
HEADING = re.compile(r"<h[2-5] id=\"s-([^\"]+)\">([^<]*)")


def page(tmp_path, market):
    out = tmp_path / market
    code = main.main(
        ["run", "--substance", "Atorvastatin calcium", "--form", "Viên nén bao phim",
         "--market", market, "--documents", str(DOCS), "--out", str(out / "draft.json"),
         "--date", "2026-10-22", "--render-dir", str(out / "html")]
    )  # fmt: skip
    assert code == 0
    return (out / "html" / DEFAULT_NAME).read_text(encoding="utf-8")


def headings(html):
    return {m.group(1): m.group(2).strip() for m in HEADING.finditer(html)}


def test_the_eu_page_has_no_actd_numbers(tmp_path):
    assert "ACTD" not in " ".join(headings(page(tmp_path, "eu")).values())


@pytest.mark.parametrize("market", ["domestic", "both"])
def test_other_markets_print_the_actd_number_on_every_mapped_heading(tmp_path, market):
    found = headings(page(tmp_path, market))
    expected = {
        "P.2": "P2", "P.2.1": "P2.2", "P.2.1.1": "P2.2.1", "P.2.1.2": "P2.2.2",
        "P.2.2": "P2.3", "P.2.2.1": "P2.3.1", "P.2.2.2": "P2.3.2", "P.2.2.3": "P2.3.3",
        "P.2.3": "P2.4", "P.2.4": "P2.5", "P.2.5": "P2.6", "P.2.6": "P2.7",
    }  # fmt: skip
    for section, number in expected.items():
        if section in found:
            assert f"(ACTD {number})" in found[section], section
    assert any("(ACTD P2.3.3)" in text for text in found.values())


def test_the_verifier_rejects_a_page_missing_a_number(tmp_path):
    html = page(tmp_path, "both")
    draft = {"sections": []}
    assert "heading without its ACTD number P2.3.3" not in verify_html(
        html, draft, None, {"P.2.2.3": "P2.3.3"}
    )
    stripped = html.replace("(ACTD P2.3.3)", "")
    failures = verify_html(stripped, draft, None, {"P.2.2.3": "P2.3.3"})
    assert "heading without its ACTD number P2.3.3" in failures
