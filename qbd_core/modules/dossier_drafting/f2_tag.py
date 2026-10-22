"""The tag that tells the quality gate which cells an f2 value was calculated from."""

from __future__ import annotations

import re

F2_TAG = re.compile(
    r"\[tính: f2, (?P<file>[^,\]]+), bảng (?P<table>\d+), "
    r"đối chiếu (?P<ref>[^,\]]+), thử (?P<test>[^,\]]+)\]"
)
_BY_COLUMN = re.compile(r"cột (\d+) hàng (\d+)-(\d+)")
_BY_ROW = re.compile(r"hàng (\d+) cột (\d+)-(\d+)")


def by_column(col: int, first: int, last: int) -> str:
    return f"cột {col} hàng {first}-{last}"


def by_row(row: int, first: int, last: int) -> str:
    return f"hàng {row} cột {first}-{last}"


def build(file: str, table: int, reference: str, test: str) -> str:
    return f"[tính: f2, {file}, bảng {table}, đối chiếu {reference}, thử {test}]"


def cells_of(segment: str) -> list[tuple[int, int]] | None:
    """(row, column) pairs a segment names, in order, or None when it is not understood."""
    if found := _BY_COLUMN.fullmatch(segment.strip()):
        col, first, last = map(int, found.groups())
        return [(row, col) for row in range(first, last + 1)]
    if found := _BY_ROW.fullmatch(segment.strip()):
        row, first, last = map(int, found.groups())
        return [(row, col) for col in range(first, last + 1)]
    return None
