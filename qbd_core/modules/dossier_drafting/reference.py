"""Reference product (P.2.2.1.1) from the columns the team labelled as the reference product.

A column counts as the reference product only when its label says so (RMP, reference, đối chiếu).
Its strength comes from the label, or from the table when the other columns name exactly one.
A form row is filled from a trial-table row whose first cell names it; two different values for
the same row and strength are a conflict and the cell stays a gap. A placeholder such as <<...>> is
empty.
"""

from __future__ import annotations

import json
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.modules.dossier_drafting.trial_columns import is_reference, named_strength
from qbd_core.modules.evidence.api import TrialData, TrialTable, tag_for
from qbd_core.shared.markers import GAP_LABEL

SECTION = "P.2.2.1.1"
IGNORED_KINDS = {"design_table"}
DISSOLUTION_ROWS = ("Tương đương độ hòa tan",)


@cache
def _synonyms() -> dict[str, tuple[str, ...]]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "reference_rows.json")
    return {k: tuple(v) for k, v in json.loads(text.read_text("utf-8"))["rows"].items()}


def _fold(text: str) -> str:
    return " ".join(text.lower().split())


def _row_for(label: str) -> str | None:
    best, winners = 0, []
    for form_row, words in _synonyms().items():
        hit = max((len(w) for w in words if w in _fold(label)), default=0)
        if hit > best:
            best, winners = hit, [form_row]
        elif hit == best and hit:
            winners.append(form_row)
    return winners[0] if len(winners) == 1 else None


def _empty(text: str) -> bool:
    return not text.strip() or "<<" in text


def _strength_columns(table: TrialTable, strengths: tuple[str, ...]) -> dict[str, int]:
    """Strength to 1-based column, for the columns labelled as the reference product."""
    labels = list(table.headers)
    named = {i: named_strength(h, strengths) for i, h in enumerate(labels)}
    in_table = {s for s in named.values() if s}
    found: dict[str, int] = {}
    for i, label in enumerate(labels):
        if not is_reference(label):
            continue
        strength = named[i] or (next(iter(in_table)) if len(in_table) == 1 else None)
        if strength and strength not in found:
            found[strength] = i + 1
    return found


def _collect(trial: TrialData, strengths: tuple[str, ...]):
    """(row, strength) to the list of (text, table, row number, column)."""
    cells: dict[tuple[str, str], list[tuple[str, TrialTable, int, int]]] = {}
    for table in trial.tables:
        if table.kind in IGNORED_KINDS:
            continue
        columns = _strength_columns(table, strengths)
        if not columns:
            continue
        for number, row in enumerate(table.rows, start=1):
            form_row = _row_for(row[0]) if row else None
            if form_row is None:
                continue
            for strength, col in columns.items():
                text = row[col - 1] if col <= len(row) else ""
                if not _empty(text):
                    cells.setdefault((form_row, strength), []).append(
                        (text.strip(), table, number, col)
                    )
    return cells


def _gap(reason: str) -> str:
    return f"{GAP_LABEL} {reason}"


def build_section(
    trial: TrialData | None, strengths: tuple[str, ...], outline: dict[str, Any]
) -> tuple[dict[str, Any] | None, list[str]]:
    if trial is None or not strengths:
        return None, []
    form = next(s for s in outline["sections"] if s["id"] == SECTION)["form"]
    cells = _collect(trial, strengths)
    if not cells:
        return None, ["không có cột nào được gắn nhãn thuốc đối chiếu có số liệu"]
    notes, tables = [], []
    for spec, first in zip(form["tables"], ("Thành phần", "Thông tin"), strict=True):
        rows = []
        for label in spec["rows"]:
            row = [label]
            for strength in strengths:
                found = cells.get((label, strength), [])
                values = {_fold(t) for t, *_ in found}
                if len(values) > 1:
                    notes.append(
                        f"{label}, {strength}: nhiều dòng hoặc bảng cùng khớp, giá trị khác nhau"
                    )
                    row.append(
                        _gap("nhiều dòng hoặc nhiều bảng cùng khớp dòng này với giá trị khác nhau")
                    )
                elif found:
                    text, table, number, col = found[0]
                    row.append(f"{text} {tag_for(table, number, col)}")
                elif label.startswith(DISSOLUTION_ROWS):
                    row.append(_gap("xem hồ sơ hòa tan so sánh"))
                else:
                    row.append(_gap("bảng thí nghiệm chưa có số liệu thuốc đối chiếu cho dòng này"))
            rows.append(row)
        headers = [first] + [f"{s} (thuốc đối chiếu)" for s in strengths]
        tables.append({"type": "table", "headers": headers, "rows": rows})
    return {"id": SECTION, "status": "covered", "blocks": tables}, notes
