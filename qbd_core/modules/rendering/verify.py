"""Check a rendered HTML file against the draft it came from. Returns failures; empty means pass."""

from __future__ import annotations

from collections.abc import Sequence
from html.parser import HTMLParser
from typing import Any

from qbd_core.modules.rendering.html_doc import (
    BLANK,
    SCRIPT,
    SIGNOFF_HEADING,
    SIGNOFF_ROLES,
    STATUS,
)

FORBIDDEN_TAGS = {"iframe", "object", "embed", "link", "img", "form", "base"}
LINK_ATTRS = {"href", "src", "action", "data", "srcset"}


class _Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []
        self.scripts: list[str] = []
        self.buttons: set[str] = set()
        self._in: str | None = None
        self.tags: list[str] = []
        self.bad_links: list[str] = []
        self.notices = 0
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        if tag in ("script", "style"):
            self._in = tag
            if tag == "script":
                self.scripts.append("")
        if tag == "button":
            self.buttons.add(dict(attrs).get("id") or "")
        for name, value in attrs:
            if name in LINK_ATTRS and not (value or "").startswith("#"):
                self.bad_links.append(f"{tag}[{name}]")
            if name == "class" and "scope-notice" in (value or "").split():
                self.notices += 1
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._in = None
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._in == "script":
            self.scripts[-1] += data
            return
        if self._in == "style":
            return
        self.text.append(data)
        if self._cell is not None:
            self._cell.append(data)


def _norm(text: str) -> str:
    return " ".join(text.split())


def verify_html(
    page: str, draft: dict[str, Any], checklist: Sequence[Sequence[str]] | None = None
) -> list[str]:
    parsed = _Page()
    parsed.feed(page)
    visible = _norm(" ".join(parsed.text))
    failures = []
    if not page.startswith("<!DOCTYPE html>"):
        failures.append("missing doctype")
    if parsed.notices != 1:
        failures.append(f"scope notice appears {parsed.notices} times, expected once")
    if visible.count(STATUS) != 1:
        failures.append("draft status line is not present exactly once")
    failures += [f"forbidden tag <{t}>" for t in sorted(FORBIDDEN_TAGS & set(parsed.tags))]
    if parsed.scripts != [SCRIPT]:
        failures.append("the page script is not the one fixed export script")
    if parsed.buttons != {"btn-pdf", "btn-word"}:
        failures.append("export buttons are not exactly the PDF and Word buttons")
    failures += [f"link out: {link}" for link in parsed.bad_links]
    if visible.count(SIGNOFF_HEADING) != 1:
        failures.append("sign-off heading is not present exactly once")
    signed = [r for r in parsed.rows if r and r[0] in SIGNOFF_ROLES]
    if signed != [[role, BLANK, BLANK, ""] for role in SIGNOFF_ROLES]:
        failures.append("sign-off rows are not the three blank rows")
    if checklist:
        present = [r for r in parsed.rows if r and r[0] in {row[0] for row in checklist}]
        wanted = [[_norm(c) for c in row] for row in checklist]
        if [[_norm(c) for c in r] for r in present if len(r) == 4] != wanted:
            failures.append("the checklist rows differ from the report")
    for section in draft["sections"]:
        texts = (
            [section["gapReason"]]
            if section["status"] == "gap"
            else [b["text"] for b in section["blocks"] if b["type"] == "paragraph"]
        )
        failures += [f"{section['id']}: text missing" for t in texts if _norm(t) not in visible]
    return failures
