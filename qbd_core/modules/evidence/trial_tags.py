"""Point at one cell of the team's data, and read the cell back from a tag."""

from __future__ import annotations

import re

from qbd_core.modules.evidence.trial_intake import TrialData, TrialTable

DATA_TAG = re.compile(
    r"\[dữ liệu: (?P<file>[^,\]]+), bảng (?P<table>\d+), hàng (?P<row>\d+), cột (?P<col>\d+)\]"
)
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def tag_for(table: TrialTable, row: int, col: int) -> str:
    """Row and column count from 1 over the table body (the header row is not a row)."""
    return f"[dữ liệu: {table.file}, bảng {table.index}, hàng {row}, cột {col}]"


def cell_text(trial: TrialData, file: str, table: int, row: int, col: int) -> str | None:
    for candidate in trial.tables:
        if candidate.file == file and candidate.index == table:
            if 1 <= row <= len(candidate.rows) and 1 <= col <= len(candidate.rows[row - 1]):
                return candidate.rows[row - 1][col - 1]
            return None
    return None


def numbers_in(text: str) -> set[str]:
    return {n.replace(",", ".") for n in NUMBER.findall(text)}


def first_number(text: str) -> float | None:
    found = NUMBER.search(text)
    return float(found.group().replace(",", ".")) if found else None
