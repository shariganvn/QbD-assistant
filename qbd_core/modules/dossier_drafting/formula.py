"""Final formula (P.2.2.1.4) written from the team's formula table, one column group per strength.

The table has name and function columns, a header cell per strength and a row of units under it.
The extractor repeats no merged header cell, so the strength labels may sit left of the columns they
head; the groups are therefore taken as equal blocks, in label order, over the columns after the
fixed ones. A layout that does not fit is reported, never guessed. Every copied cell carries its
cell tag.
"""

from __future__ import annotations

from typing import Any

from qbd_core.modules.evidence.api import TrialData, TrialTable, first_number, tag_for
from qbd_core.shared.markers import GAP_LABEL

SECTION = "P.2.2.1.4"
FIXED = ["STT", "Tên thành phần", "Chức năng"]
NAME_WORDS = ("name", "tên")
FUNCTION_WORDS = ("function", "chức năng")


def _gap(reason: str) -> str:
    return f"{GAP_LABEL} {reason}"


def _find(headers: tuple[str, ...], words: tuple[str, ...]) -> int | None:
    for i, header in enumerate(headers):
        if any(word in header.lower() for word in words):
            return i
    return None


def _named(label: str, strengths: tuple[str, ...]) -> str | None:
    hits = [s for s in strengths if s in label]
    return max(hits, key=len) if hits else None


def _layout(table: TrialTable, strengths: tuple[str, ...]):
    """(name col, function col, first group col, group size, strengths in order) or a reason."""
    name, function = _find(table.headers, NAME_WORDS), _find(table.headers, FUNCTION_WORDS)
    if name is None or function is None:
        return "thiếu cột tên hoặc chức năng"
    labelled = [
        (i, _named(h, strengths)) for i, h in enumerate(table.headers) if _named(h, strengths)
    ]
    order = list(dict.fromkeys(s for _, s in labelled))
    if sorted(order) != sorted(strengths):
        return "các hàm lượng trong tiêu đề không khớp danh sách hàm lượng của dữ liệu"
    start = labelled[0][0]
    trailing = len(table.headers) - start
    if trailing % len(order) != 0:
        return "số cột sau cột chức năng không chia đều cho các hàm lượng"
    return name, function, start, trailing // len(order), order


def _columns(start: int, index: int, width: int) -> range:
    """1-based columns of the index-th group."""
    return range(start + index * width + 1, start + (index + 1) * width + 1)


def _units(table: TrialTable, start: int, width: int, count: int) -> tuple[list[str], int]:
    """Unit labels under the group columns, and how many rows to skip before the data rows."""
    if table.rows and all(not c.strip() for c in table.rows[0][:start]):
        cells = table.rows[0][start : start + width * count]
        if cells and all(c.strip() and first_number(c) is None for c in cells):
            return [c.strip() for c in cells], 1
    return [f"cột {i + 1}" for i in range(width * count)], 0


def _copy(table: TrialTable, row: int, col: int) -> str:
    cells = table.rows[row - 1]
    text = cells[col - 1].strip() if col <= len(cells) else ""
    if not text:
        return _gap("ô trống trong bảng thí nghiệm")
    return f"{text} {tag_for(table, row, col)}"


def _from_table(table: TrialTable, strengths: tuple[str, ...]):
    layout = _layout(table, strengths)
    if isinstance(layout, str):
        return layout
    name, function, start, width, order = layout
    units, skip = _units(table, start, width, len(order))
    where = {s: order.index(s) for s in strengths}
    headers = list(FIXED)
    for s in strengths:
        headers += [f"{s} – {u}" for u in units[where[s] * width : (where[s] + 1) * width]]
    rows, numeric = [], False
    for number in range(skip + 1, len(table.rows) + 1):
        cells = table.rows[number - 1]
        values = [
            c
            for s in strengths
            for c in range(start + where[s] * width + 1, start + (where[s] + 1) * width + 1)
        ]
        texts = [cells[c - 1].strip() if c <= len(cells) else "" for c in values]
        lead = [cells[c].strip() if c < len(cells) else "" for c in (0, name, function)]
        if not any(lead) and not any(texts):
            continue
        numeric = numeric or any(first_number(t) is not None for t in texts)
        row = [_copy(table, number, c + 1) for c in (0, name, function)]
        row += [_copy(table, number, c) for c in values]
        rows.append(row)
    if not rows or not numeric:
        return "bảng công thức cuối chưa có số"
    return {"type": "table", "headers": headers, "rows": rows}


def build_section(
    trial: TrialData | None, strengths: tuple[str, ...]
) -> tuple[dict[str, Any] | None, list[str]]:
    if trial is None or not strengths:
        return None, []
    notes = []
    for table in trial.of_kind("final_formula"):
        result = _from_table(table, strengths)
        if isinstance(result, str):
            notes.append(f"{table.file}, bảng {table.index}: {result}")
            continue
        return {"id": SECTION, "status": "covered", "blocks": [result]}, notes
    return None, notes
