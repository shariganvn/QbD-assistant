"""Comparative dissolution (P.2.2.3.2) written from the team's profile tables, f2 by code.

A profile table has a row of conditions, a row of column labels, one row per time point and often a
blank f2 row. The tables are read by position and by label words; a table that does not fit is
reported, never guessed. A column that names no strength takes the strength of its table when the
other columns of the table name exactly one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from qbd_core.modules.dossier_drafting.calc import CalcError, f2
from qbd_core.modules.dossier_drafting.trial_columns import is_reference, named_strength
from qbd_core.modules.evidence.api import TrialData, TrialTable, first_number, tag_for
from qbd_core.shared.markers import GAP_LABEL

SECTION = "P.2.2.3.2"
PLAIN_NUMBER = re.compile(r"\s*\d+(?:[.,]\d+)?\s*")
TIME_HEADER = "Thời điểm lấy mẫu"


@dataclass(frozen=True)
class Column:
    label: str
    col: int  # 1-based position in the row


@dataclass(frozen=True)
class Profile:
    table: TrialTable
    label_row: int  # 1-based
    time_rows: tuple[int, ...]
    columns: tuple[Column, ...]


@dataclass(frozen=True)
class Comparison:
    profile: Profile
    strength: str
    reference: Column
    test: Column


def parse_profile(table: TrialTable) -> Profile | str:
    """A profile, or the reason the table does not have the expected layout."""
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
    row = table.rows[label_row - 1]
    columns = tuple(Column(c.strip(), i) for i, c in enumerate(row, start=1) if i > 1 and c.strip())
    times = []
    for number in range(label_row + 1, len(table.rows) + 1):
        first = table.rows[number - 1][0] if table.rows[number - 1] else ""
        if not PLAIN_NUMBER.fullmatch(first):
            break
        times.append(number)
    if len(times) < 1:
        return "không thấy hàng thời điểm lấy mẫu"
    return Profile(table, label_row, tuple(times), columns)


def comparisons(profile: Profile, strengths: tuple[str, ...]) -> tuple[list[Comparison], list[str]]:
    where = f"{profile.table.file}, bảng {profile.table.index}"
    refs = [c for c in profile.columns if is_reference(c.label)]
    tests = [c for c in profile.columns if not is_reference(c.label)]
    if not refs or not tests:
        return [], [f"{where}: không có đủ cột đối chiếu và cột thử"]
    named = {c: named_strength(c.label, strengths) for c in profile.columns}
    in_table = {s for s in named.values() if s}
    out, notes = [], []
    for test in tests:
        for ref in refs:
            strength = named[test] or named[ref]
            if strength is None and len(in_table) == 1:
                strength = next(iter(in_table))
            if strength is None:
                notes.append(f"{where}: không xác định hàm lượng của cột {test.label}")
                continue
            if named[ref] not in (None, strength) or named[test] not in (None, strength):
                notes.append(f"{where}: hai cột nêu hàm lượng khác nhau")
                continue
            out.append(Comparison(profile, strength, ref, test))
    return out, notes


def _values(comparison: Comparison, column: Column) -> list[float | None]:
    rows = comparison.profile.table.rows
    return [
        first_number(rows[r - 1][column.col - 1]) if column.col <= len(rows[r - 1]) else None
        for r in comparison.profile.time_rows
    ]


def f2_of(comparison: Comparison) -> tuple[str | None, str]:
    """(f2 text with one decimal, "") or (None, reason)."""
    ref, test = _values(comparison, comparison.reference), _values(comparison, comparison.test)
    if None in ref or None in test:
        return None, "thiếu số liệu ở một thời điểm"
    try:
        return f"{f2([float(v) for v in ref], [float(v) for v in test]):.1f}", ""
    except CalcError as error:
        return None, error.code


def _gap(reason: str) -> str:
    return f"{GAP_LABEL} {reason}"


def _cell(profile: Profile, row: int, col: int) -> str:
    rows = profile.table.rows
    text = rows[row - 1][col - 1] if col <= len(rows[row - 1]) else ""
    if not text.strip():
        return _gap("ô trống trong bảng thí nghiệm")
    return f"{text.strip()} {tag_for(profile.table, row, col)}"


REASONS = {
    "E_F2_RANGE": "có giá trị hòa tan ngoài khoảng 0–100 %",
    "E_F2_TOO_FEW_POINTS": "dưới ba thời điểm dùng được để tính f2",
    "E_F2_LENGTH": "hai cột không cùng số thời điểm",
}


def _label(comparison: Comparison, with_calc: bool = True) -> str:
    profile = comparison.profile
    cond_row = profile.label_row - 1
    conditions = ""
    tags = ""
    if cond_row >= 1:
        cells = profile.table.rows[cond_row - 1]
        used = [i for i, c in enumerate(cells, start=1) if i > 1 and c.strip()]
        conditions = "; ".join(cells[i - 1].strip() for i in used)
        tags = " ".join(tag_for(profile.table, cond_row, i) for i in used)
    head = f"{conditions}: " if conditions else ""
    names = " ".join(
        tag_for(profile.table, profile.label_row, c.col)
        for c in (comparison.test, comparison.reference)
    )
    text = f"{head}{comparison.test.label} so với {comparison.reference.label}"
    first, last = profile.time_rows[0], profile.time_rows[-1]
    if not with_calc:
        plain = f"{head}{comparison.test.label} so với {comparison.reference.label}"
        return f"{plain} {tags} {names}".replace("  ", " ")
    calc = (
        f"[tính: f2, {profile.table.file}, bảng {profile.table.index}, "
        f"đối chiếu cột {comparison.reference.col}, thử cột {comparison.test.col}, "
        f"hàng {first}-{last}]"
    )
    return f"{text} {tags} {names} {calc}".replace("  ", " ")


def build_section(
    trial: TrialData | None, strengths: tuple[str, ...]
) -> tuple[dict[str, Any] | None, list[str]]:
    """The covered section, or None; plus one note per table or pair left out."""
    if trial is None or not strengths:
        return None, []
    notes: list[str] = []
    chosen: dict[str, Comparison] = {}
    rows2: list[list[str]] = []
    for table in trial.of_kind("dissolution_profile"):
        profile = parse_profile(table)
        if isinstance(profile, str):
            notes.append(f"{table.file}, bảng {table.index}: {profile}")
            continue
        found, why = comparisons(profile, strengths)
        notes += why
        for comparison in found:
            value, reason = f2_of(comparison)
            if value is None:
                rows2.append(
                    [_label(comparison, with_calc=False), _gap(REASONS.get(reason, reason)), ""]
                )
                notes.append(f"{table.file}, bảng {table.index}: không tính được f2 ({reason})")
                continue
            rows2.append([_label(comparison), value, ""])
            chosen.setdefault(comparison.strength, comparison)
    if not chosen:
        return None, notes
    primary = next(iter(chosen.values()))
    grid = tuple(primary.profile.time_rows)
    headers = [TIME_HEADER]
    for strength in strengths:
        headers += [f"{strength} – đối chiếu", f"{strength} – thử"]
    rows1 = []
    for position, row_no in enumerate(grid):
        row = [_cell(primary.profile, row_no, 1)]
        for strength in strengths:
            comparison = chosen.get(strength)
            same_grid = comparison is not None and len(comparison.profile.time_rows) == len(grid)
            if not same_grid:
                reason = (
                    "chưa có số liệu hòa tan của hàm lượng này"
                    if comparison is None
                    else ("lưới thời điểm khác bảng chính")
                )
                row += [_gap(reason), _gap(reason)]
                continue
            r = comparison.profile.time_rows[position]
            row += [_cell(comparison.profile, r, comparison.reference.col)]
            row += [_cell(comparison.profile, r, comparison.test.col)]
        rows1.append(row)
    first = {"type": "table", "headers": headers, "rows": rows1}
    second = {
        "type": "table",
        "headers": ["Môi trường và cặp so sánh", "f2", "Điều kiện không áp dụng f2"],
        "rows": rows2,
    }
    return {"id": SECTION, "status": "covered", "blocks": [first, second]}, notes
