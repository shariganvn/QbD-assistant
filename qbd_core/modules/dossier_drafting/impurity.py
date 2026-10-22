"""Impurity profile (P.2.2.3.3.1) from the team's impurity tables, one sentence per impurity.

An impurity table lists batch numbers, then for each impurity a pair of cells (retention time,
result) per batch. The extractor repeats no merged header cell, so a batch is tied to a product by
the labels elsewhere in the same files that carry both a product name and that batch number; a
batch with no such label stays unattributed and the table is reported, not guessed. Every number is
copied from a cell and tagged. Limits come from the monograph, which is not in the data, so they
stay a marked gap.
"""

from __future__ import annotations

import re
from typing import Any

from qbd_core.modules.dossier_drafting.trial_columns import fold, is_reference, named_strength
from qbd_core.modules.evidence.api import TrialData, TrialTable, tag_for
from qbd_core.shared.markers import GAP_LABEL

SECTION = "P.2.2.3.3.1"
BATCH_WORDS = ("batch no", "số lô", "lô")
IMPURITY_WORDS = ("impurity", "tạp chất")
BATCH_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9/-]{3,}")
LIMIT_GAP = (
    f"{GAP_LABEL} giới hạn từng tạp chất theo chuyên luận áp dụng chưa có trong dữ liệu thí nghiệm."
)


def _owner_of(
    batch: str, trial: TrialData, rmp: tuple[str, ...], substance_words: list[str]
) -> str | None:
    """ "reference", "product" or None, from the labels that carry this batch number."""
    kinds = set()
    for table in trial.tables:
        labels = (
            *table.headers,
            *(c for r in table.rows[:3] for c in r),
            *(r[0] for r in table.rows if r),
        )
        for label in labels:
            if batch.lower() not in label.lower() or label.strip().lower() == batch.lower():
                continue
            if is_reference(label, rmp):
                kinds.add("reference")
            elif any(w in fold(label) for w in substance_words):
                kinds.add("product")
    return next(iter(kinds)) if len(kinds) == 1 else None


def _inherit(ids, owners: dict[str, str | None], groups: int) -> dict[str, str | None]:
    """Columns of one product are contiguous, so a batch that no label names takes the product of
    the batch before it, but only when the table has no more product groups than products found."""
    if len({o for o in owners.values() if o}) != groups:
        return owners
    result, previous = dict(owners), None
    for _, batch in ids:
        if result[batch] is None:
            result[batch] = previous
        previous = result[batch]
    return result


def _layout(table: TrialTable):
    """(batch row, header row, first data row, batch columns) or a reason."""
    batch_row = next(
        (
            i
            for i, r in enumerate(table.rows, start=1)
            if r and any(w in fold(r[0]) for w in BATCH_WORDS)
        ),
        None,
    )
    if batch_row is None:
        return "không thấy hàng số lô"
    ids = [
        (i, c.strip())
        for i, c in enumerate(table.rows[batch_row - 1], start=1)
        if i > 1 and c.strip()
    ]
    pairs = (len(table.rows[batch_row - 1]) - 1) // 2
    if not ids or len(ids) != pairs:
        return "số lô không khớp số cặp cột (RRT, kết quả)"
    return batch_row, ids


def build_section(
    trial: TrialData | None,
    strengths: tuple[str, ...],
    rmp: tuple[str, ...],
    substance: str,
) -> tuple[dict[str, Any] | None, list[str]]:
    if trial is None or not strengths:
        return None, []
    words = [w for w in fold(substance).split() if len(w) >= 5]
    blocks, notes = [], []
    for table in trial.of_kind("impurity") or ():
        where = f"{table.file}, bảng {table.index}"
        layout = _layout(table)
        if isinstance(layout, str):
            notes.append(f"{where}: {layout}")
            continue
        batch_row, ids = layout
        owners = {batch: _owner_of(batch, trial, rmp, words) for _, batch in ids}
        groups = len([h for h in table.headers if named_strength(h, strengths)])
        owners = _inherit(ids, owners, groups)
        if None in owners.values():
            lost = ", ".join(b for b, o in owners.items() if o is None)
            notes.append(f"{where}: không xác định được sản phẩm của lô {lost}")
            continue
        labelled = [
            (i, h) for i, h in enumerate(table.headers, start=1) if named_strength(h, strengths)
        ]
        named = {named_strength(h, strengths) for _, h in labelled}
        if len(named) != 1:
            notes.append(f"{where}: không xác định được một hàm lượng duy nhất")
            continue
        strength, (strength_col, _) = next(iter(named)), labelled[0]
        strength_tag = tag_for(table, 0, strength_col)
        for number, row in enumerate(table.rows, start=1):
            if number <= batch_row + 1 or not row or not row[0].strip():
                continue
            if len(row) < 1 + 2 * len(ids):
                continue
            label = row[0].strip()
            parts, tags = [], [tag_for(table, number, 1), strength_tag]
            for position, (col, batch) in enumerate(ids):
                rrt_col, result_col = 2 + 2 * position, 3 + 2 * position
                role = "thuốc đối chiếu" if owners[batch] == "reference" else "sản phẩm"
                rrt, result = row[rrt_col - 1].strip(), row[result_col - 1].strip()
                if not rrt and not result:
                    continue
                parts.append(f"{role} lô {batch}: RRT {rrt or '-'}, kết quả {result or '-'}")
                tags += [tag_for(table, batch_row, col), tag_for(table, number, rrt_col)]
                tags += [tag_for(table, number, result_col)]
            if parts:
                text = f"{label}, hàm lượng {strength}: " + "; ".join(parts) + ". " + " ".join(tags)
                blocks.append({"type": "paragraph", "text": text})
    if not blocks:
        return None, notes
    return {"id": SECTION, "status": "covered", "blocks": [*blocks, _gap_block()]}, notes


def _gap_block() -> dict[str, str]:
    return {"type": "paragraph", "text": LIMIT_GAP}
