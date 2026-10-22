"""Results, discussion and conclusion of a study report carried into P.2 word for word.

The team's own report holds the findings; this module copies what it says and never writes a
finding. A report is carried only when it is filled: one that calls itself not a results report, or
that still holds placeholders, is left out and reported. A paragraph is copied whole with a tag that
names it, and the quality gate requires the text to equal that paragraph.
"""

from __future__ import annotations

import json
import re
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.modules.dossier_drafting.subdivision import file_strength
from qbd_core.modules.dossier_drafting.trial_columns import fold
from qbd_core.modules.evidence.api import TrialData, paragraph_tag, tag_for
from qbd_core.shared.markers import GAP_LABEL

NUMBERED_HEADING = re.compile(r"^\d+(?:\.\d+)*\.?\s+\D")
TITLE_LINES = 5


@cache
def _config() -> dict[str, Any]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "reports.json")
    return json.loads(text.read_text("utf-8"))


def _is_placeholder(text: str) -> bool:
    return any(m in fold(text) for m in _config()["placeholder_markers"])


def _is_template(paragraphs: tuple[str, ...]) -> bool:
    config = _config()
    low = [fold(p) for p in paragraphs]
    if any(m in p for p in low for m in config["template_markers"]):
        return True
    count = sum(m in p for p in low for m in config["placeholder_markers"])
    return count > config["max_placeholders_in_a_filled_report"]


def _is_heading(text: str) -> bool:
    return len(text) <= _config()["heading_max_chars"] and bool(
        NUMBERED_HEADING.match(text.strip())
    )


def _bare_heading(text: str, words: list[str]) -> bool:
    """A heading written without its number: the whole paragraph is the keyword."""
    return len(text) <= _config()["heading_max_chars"] and fold(text).strip(" .:") in words


def _carried(
    paragraphs: tuple[str, ...], words: list[str], all_words: list[str]
) -> tuple[list[int], int, str | None]:
    """Numbers of the heading and body paragraphs under a heading, how many were skipped, and a
    reason when the section could not be bounded."""
    start = next(
        (
            i
            for i, p in enumerate(paragraphs)
            if (_is_heading(p) and any(w in fold(p) for w in words)) or _bare_heading(p, words)
        ),
        None,
    )
    if start is None:
        return [], 0, None
    numbered = _is_heading(paragraphs[start])
    picked, skipped, ended = [start + 1], 0, numbered
    for i in range(start + 1, len(paragraphs)):
        text = paragraphs[i]
        if _is_heading(text) or _bare_heading(text, all_words):
            ended = True
            break
        if not text.strip():
            continue
        if _is_placeholder(text):
            skipped += 1
            continue
        picked.append(i + 1)
    if not ended:
        return [], 0, "tiêu đề không có số nên không xác định được chỗ kết thúc của mục"
    return picked, skipped, None


def _summary_blocks(trial: TrialData, file: str) -> tuple[list[dict[str, str]], int]:
    blocks, skipped = [], 0
    for table in trial.of_kind("report_summary"):
        if table.file != file:
            continue
        for number, row in enumerate(table.rows, start=1):
            cells = [c.strip() for c in row]
            if len(cells) < 3 or not cells[0]:
                continue
            if any(not c or _is_placeholder(c) for c in cells[:3]):
                skipped += 1
                continue
            tags = " ".join(tag_for(table, number, c) for c in (1, 2, 3))
            text = f"{cells[0]}: {cells[1]}; kết luận: {cells[2]}. {tags}"
            blocks.append({"type": "paragraph", "text": text})
    return blocks, skipped


def _gap(reason: str) -> str:
    return f"{GAP_LABEL} {reason}"


def _strength_section(target: str, strength_index: int, outline: dict[str, Any]) -> str | None:
    for section in outline["sections"]:
        form = section.get("form") or {}
        if section["id"].startswith(target + ".") and form.get("strengthIndex") == strength_index:
            return section["id"]
    return None


def build_sections(
    trial: TrialData | None, outline: dict[str, Any], strengths: tuple[str, ...] = ()
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    if trial is None:
        return {}, []
    notes: list[str] = []
    sections: dict[str, dict[str, Any]] = {}
    for file, paragraphs in trial.texts:
        head = " ".join(fold(p) for p in paragraphs[:TITLE_LINES])
        for report in _config()["reports"]:
            if not any(w in head for w in report["title_words"]):
                continue
            if _is_template(paragraphs):
                notes.append(f"{file}: báo cáo là mẫu chưa điền, không có kết quả để chuyển")
                continue
            results, skipped = (
                _summary_blocks(trial, file) if report.get("summary", True) else ([], 0)
            )
            blocks = list(results)
            every = [w for group in report["carry"] for w in group]
            for words in report["carry"]:
                numbers, left, problem = _carried(paragraphs, words, every)
                if problem:
                    notes.append(f"{file}: {words[0]}: {problem}")
                skipped += left
                blocks += [
                    {
                        "type": "paragraph",
                        "text": f"{paragraphs[n - 1].strip()} {paragraph_tag(file, n)}",
                    }
                    for n in numbers
                ]
            if skipped:
                notes.append(f"{file}: bỏ {skipped} đoạn hoặc dòng còn chỗ trống chưa điền")
            if not blocks:
                notes.append(f"{file}: không thấy kết quả, bàn luận hay kết luận để chuyển")
                continue
            target = report["target"]
            if report.get("per_strength"):
                strength = file_strength(trial, file, strengths) if strengths else None
                target = (
                    _strength_section(target, strengths.index(strength), outline)
                    if strength
                    else None
                )
                if target is None:
                    notes.append(f"{file}: không xác định được hàm lượng của báo cáo")
                    continue
            existing = sections.get(target)
            if existing is not None:
                existing["blocks"] += blocks
            else:
                sections[target] = _build(target, outline, blocks)
    return sections, notes


def _build(target: str, outline: dict[str, Any], blocks: list[dict[str, str]]) -> dict[str, Any]:
    """The section's tables as the form asks, with the carried text after them."""
    form = next(s for s in outline["sections"] if s["id"] == target).get("form") or {}
    tables = []
    for spec in form.get("tables", []):
        columns = spec["columns"]
        rows = spec["rows"] if isinstance(spec["rows"], list) else ["—"]
        reason = _gap("báo cáo chưa nêu số liệu theo từng dòng của biểu mẫu này")
        tables.append(
            {
                "type": "table",
                "headers": list(columns),
                "rows": [[label, *[reason] * (len(columns) - 1)] for label in rows],
            }
        )
    return {"id": target, "status": "covered", "blocks": [*tables, *blocks]}
