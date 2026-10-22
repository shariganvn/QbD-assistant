"""Comparative dissolution (P.2.2.3.2) written from the team's profile tables, f2 by code.

Two layouts are read. In a column layout each product is a column under a row of labels and each
time point a row. In a summary layout the time points head the columns and each product is a block
of rows (label, Average, Max, Min, RSD); its Average row is the profile. A table that fits neither
is reported, never guessed. A product that names no strength takes the strength of its table when
the others name exactly one. f2 comes from code and the quality gate recomputes it from the cells
the tag names.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.modules.dossier_drafting import f2_tag
from qbd_core.modules.dossier_drafting.calc import CalcError, exceeds_cap, f2
from qbd_core.modules.dossier_drafting.trial_columns import (
    fold,
    is_reference,
    named_strength,
)
from qbd_core.modules.evidence.api import TrialData, TrialTable, first_number, tag_for
from qbd_core.shared.markers import GAP_LABEL

SECTION = "P.2.2.3.2"
PLAIN_NUMBER = re.compile(r"\s*\d+(?:[.,]\d+)?\s*")
TIME_HEADER = "Thời điểm lấy mẫu"
CAP_NOTE = "Giá trị hòa tan trên mức trần được tính bằng mức trần."
REASONS = {
    "E_F2_RANGE": "có giá trị hòa tan âm",
    "E_F2_TOO_FEW_POINTS": "dưới ba thời điểm dùng được để tính f2",
    "E_F2_LENGTH": "hai cột không cùng số thời điểm",
}
Cell = tuple[int, int]  # (row, column), row 0 is the header row


@cache
def _words() -> dict[str, tuple[str, ...]]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "trial_words.json")
    raw = json.loads(text.read_text("utf-8"))
    return {k: tuple(raw[k]) for k in ("average", "statistics")}


@dataclass(frozen=True)
class Series:
    table: TrialTable
    label: str
    label_cell: Cell
    cells: tuple[Cell, ...]  # one value per time point, in time order
    time_cells: tuple[Cell, ...]
    spec: str  # how the f2 tag names the value cells
    conditions: str = ""
    condition_cells: tuple[Cell, ...] = ()


@dataclass(frozen=True)
class Comparison:
    strength: str
    reference: Series
    test: Series


def _text(table: TrialTable, cell: Cell) -> str:
    row, col = cell
    source = table.headers if row == 0 else (table.rows[row - 1] if row <= len(table.rows) else ())
    return source[col - 1] if 1 <= col <= len(source) else ""


def _column_layout(table: TrialTable) -> list[Series] | str:
    label_row = next(
        (
            i
            for i, row in enumerate(table.rows, start=1)
            if row and not row[0].strip() and sum(bool(c.strip()) for c in row[1:]) >= 2
        ),
        None,
    )
    if label_row is None:
        return "không thấy hàng nhãn cột"
    times = []
    for number in range(label_row + 1, len(table.rows) + 1):
        row = table.rows[number - 1]
        if not row or not PLAIN_NUMBER.fullmatch(row[0]):
            break
        times.append(number)
    if not times:
        return "không thấy hàng thời điểm lấy mẫu"
    above = table.rows[label_row - 2] if label_row >= 2 else ()
    used = [i for i, c in enumerate(above, start=1) if i > 1 and c.strip()]
    conditions = "; ".join(above[i - 1].strip() for i in used)
    cond_cells = tuple((label_row - 1, i) for i in used)
    first, last = times[0], times[-1]
    return [
        Series(
            table,
            c.strip(),
            (label_row, i),
            tuple((r, i) for r in times),
            tuple((r, 1) for r in times),
            f2_tag.by_column(i, first, last),
            conditions,
            cond_cells,
        )
        for i, c in enumerate(table.rows[label_row - 1], start=1)
        if i > 1 and c.strip()
    ]


def _summary_layout(table: TrialTable) -> list[Series] | str:
    grid = [i for i, h in enumerate(table.headers, start=1) if i > 1 and PLAIN_NUMBER.fullmatch(h)]
    if len(grid) < 3 or grid != list(range(grid[0], grid[0] + len(grid))):
        return "tiêu đề không có dãy thời điểm lấy mẫu"
    words = _words()
    series, label, label_row = [], None, 0
    for number, row in enumerate(table.rows, start=1):
        head = fold(row[0]) if row else ""
        if (
            head
            and not any(c.strip() for c in row[1:])
            and head
            not in (
                *words["average"],
                *words["statistics"],
            )
        ):
            label, label_row = row[0].strip(), number
        elif head in words["average"] and label is not None:
            cells = tuple((number, c) for c in grid)
            series.append(
                Series(
                    table,
                    label,
                    (label_row, 1),
                    cells,
                    tuple((0, c) for c in grid),
                    f2_tag.by_row(number, grid[0], grid[-1]),
                )
            )
            label = None
    return series or "không thấy hàng Average của sản phẩm nào"


def read_series(table: TrialTable) -> list[Series] | str:
    first = _column_layout(table)
    if not isinstance(first, str):
        return first
    second = _summary_layout(table)
    return second if not isinstance(second, str) else f"{first}; {second}"


def comparisons(
    table: TrialTable, series: list[Series], strengths: tuple[str, ...], rmp: tuple[str, ...]
) -> tuple[list[Comparison], list[str]]:
    where = f"{table.file}, bảng {table.index}"
    refs = [s for s in series if is_reference(s.label, rmp)]
    tests = [s for s in series if not is_reference(s.label, rmp)]
    if not refs or not tests:
        return [], [f"{where}: không có đủ cột đối chiếu và cột thử"]
    named = {id(s): named_strength(s.label, strengths) for s in series}
    in_table = {v for v in named.values() if v}
    out, notes = [], []
    for test in tests:
        for ref in refs:
            strength = named[id(test)] or named[id(ref)]
            if strength is None and len(in_table) == 1:
                strength = next(iter(in_table))
            if strength is None:
                notes.append(f"{where}: không xác định hàm lượng của cột {test.label}")
            elif named[id(ref)] not in (None, strength) or named[id(test)] not in (None, strength):
                notes.append(f"{where}: hai cột nêu hàm lượng khác nhau")
            else:
                out.append(Comparison(strength, ref, test))
    return out, notes


def _values(series: Series) -> list[float | None]:
    return [first_number(_text(series.table, c)) for c in series.cells]


def f2_of(comparison: Comparison) -> tuple[str | None, str, bool]:
    """(f2 text with one decimal, "", capped) or (None, reason, False)."""
    ref, test = _values(comparison.reference), _values(comparison.test)
    if None in ref or None in test:
        return None, "thiếu số liệu ở một thời điểm", False
    ref_f, test_f = [float(v) for v in ref], [float(v) for v in test]
    try:
        return f"{f2(ref_f, test_f):.1f}", "", exceeds_cap(ref_f, test_f)
    except CalcError as error:
        return None, error.code, False


def _gap(reason: str) -> str:
    return f"{GAP_LABEL} {reason}"


def _cell(table: TrialTable, cell: Cell) -> str:
    text = _text(table, cell).strip()
    return f"{text} {tag_for(table, *cell)}" if text else _gap("ô trống trong bảng thí nghiệm")


def _label(comparison: Comparison, with_calc: bool = True) -> str:
    test, ref = comparison.test, comparison.reference
    table = test.table
    head = f"{test.conditions}: " if test.conditions else ""
    tags = [tag_for(table, *c) for c in (*test.condition_cells, test.label_cell, ref.label_cell)]
    text = f"{head}{test.label} so với {ref.label} {' '.join(tags)}"
    if with_calc:
        text += " " + f2_tag.build(table.file, table.index, ref.spec, test.spec)
    return text.replace("  ", " ")


def build_section(
    trial: TrialData | None, strengths: tuple[str, ...], rmp: tuple[str, ...] = ()
) -> tuple[dict[str, Any] | None, list[str]]:
    """The covered section, or None; plus one note per table or pair left out."""
    if trial is None or not strengths:
        return None, []
    notes: list[str] = []
    chosen: dict[str, Comparison] = {}
    rows2: list[list[str]] = []
    for table in trial.of_kind("dissolution_profile"):
        series = read_series(table)
        if isinstance(series, str):
            notes.append(f"{table.file}, bảng {table.index}: {series}")
            continue
        found, why = comparisons(table, series, strengths, rmp)
        notes += why
        for comparison in found:
            value, reason, capped = f2_of(comparison)
            if value is None:
                rows2.append([_label(comparison, False), _gap(REASONS.get(reason, reason)), ""])
                notes.append(f"{table.file}, bảng {table.index}: không tính được f2 ({reason})")
                continue
            rows2.append([_label(comparison), value, CAP_NOTE if capped else ""])
            chosen.setdefault(comparison.strength, comparison)
    if not chosen:
        return None, notes
    primary = next(iter(chosen.values()))
    size = len(primary.test.cells)
    headers = [TIME_HEADER]
    for strength in strengths:
        headers += [f"{strength} – đối chiếu", f"{strength} – thử"]
    rows1 = []
    for position in range(size):
        row = [_cell(primary.test.table, primary.test.time_cells[position])]
        for strength in strengths:
            comparison = chosen.get(strength)
            if comparison is None or len(comparison.test.cells) != size:
                reason = "chưa có số liệu hòa tan của hàm lượng này"
                if comparison is not None:
                    reason = "lưới thời điểm khác bảng chính"
                row += [_gap(reason), _gap(reason)]
                continue
            row.append(_cell(comparison.reference.table, comparison.reference.cells[position]))
            row.append(_cell(comparison.test.table, comparison.test.cells[position]))
        rows1.append(row)
    first = {"type": "table", "headers": headers, "rows": rows1}
    second = {
        "type": "table",
        "headers": ["Môi trường và cặp so sánh", "f2", "Điều kiện không áp dụng f2"],
        "rows": rows2,
    }
    return {"id": SECTION, "status": "covered", "blocks": [first, second]}, notes
