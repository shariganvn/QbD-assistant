"""Tablet subdivision (P.2.2.3.4) from the team's study tables; the gate rebuilds every sentence.

Two tests are read: the mass uniformity of tablet parts and the mass lost on subdividing. The
acceptance rules are configuration with their source (config/subdivision_rules.json), not code.
A sentence is produced only from complete data (the sample size the rule asks for), carries a tag
that names the cells it was calculated from, and is checked by the quality gate, which recomputes
the whole sentence from those cells and the rule and requires it to match word for word.
"""

from __future__ import annotations

import json
import re
from functools import cache
from importlib.resources import files
from typing import Any

from qbd_core.modules.dossier_drafting.trial_columns import fold, named_strength
from qbd_core.modules.evidence.api import TrialData, TrialTable, cell_text, first_number
from qbd_core.shared.markers import GAP_LABEL

PARENT = "P.2.2.3.4"
MASS_TAG = re.compile(
    r"\[tính: chia viên, (?P<file>[^,\]]+), bảng (?P<table>\d+), cột (?P<col>\d+) "
    r"hàng (?P<first>\d+)-(?P<last>\d+)\]"
)
LOSS_TAG = re.compile(
    r"\[tính: hao hụt, (?P<file>[^,\]]+), bảng (?P<table>\d+), nguyên cột (?P<whole>\d+), "
    r"tổng cột (?P<total>\d+), hàng (?P<first>\d+)-(?P<last>\d+)\]"
)
RULE_TAG = re.compile(r"\[quy tắc: (?P<id>[a-z_]+)\]")
ANY_TAG = re.compile(r"\s*\[(?:tính: (?:chia viên|hao hụt)|quy tắc)[:,] [^\]]*\]")


@cache
def _config() -> dict[str, Any]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "subdivision_rules.json")
    return json.loads(text.read_text("utf-8"))


@cache
def _words() -> dict[str, list[str]]:
    text = files("qbd_core.modules.dossier_drafting").joinpath("config", "trial_words.json")
    return json.loads(text.read_text("utf-8"))


def rules_confirmed() -> bool:
    return bool(_config()["confirmed"])


def _g(value: float) -> str:
    return f"{value:g}"


def rule_sentence(rule_id: str) -> str:
    rule = _config()["rules"][rule_id]
    if rule_id == "ph_eur_mass":
        inner = f"{rule['inner_low']}-{rule['inner_high']}%"
        outer = f"{rule['outer_low']}-{rule['outer_high']}%"
        return (
            f"Tiêu chí {rule['title'].lower()}: lấy {rule['sample_size']} viên, cân từng phần "
            f"viên; không quá {rule['max_outside_inner']} phần ngoài {inner} khối lượng trung "
            f"bình và {rule['max_outside_outer']} phần ngoài {outer} (nguồn: {rule['source']})."
        )
    return (
        f"Tiêu chí {rule['title'].lower()}: đánh giá trên {rule['sample_size']} viên, "
        f"hao hụt dưới {_g(rule['max_loss_percent'])}% (nguồn: {rule['source']})."
    )


def mass_sentence(values: list[float]) -> str | None:
    rule = _config()["rules"]["ph_eur_mass"]
    if len(values) != rule["sample_size"] or min(values) <= 0:
        return None
    mean = sum(values) / len(values)
    inner = sum(
        not rule["inner_low"] / 100 * mean <= v <= rule["inner_high"] / 100 * mean for v in values
    )
    outer = sum(
        not rule["outer_low"] / 100 * mean <= v <= rule["outer_high"] / 100 * mean for v in values
    )
    ok = inner <= rule["max_outside_inner"] and outer <= rule["max_outside_outer"]
    return (
        f"Đồng đều khối lượng phần viên: {len(values)} phần viên, khối lượng trung bình "
        f"{mean:.1f} mg (nhỏ nhất {_g(min(values))} mg, lớn nhất {_g(max(values))} mg); "
        f"{inner} phần ngoài {rule['inner_low']}-{rule['inner_high']}% khối lượng trung bình "
        f"(tối đa {rule['max_outside_inner']}), {outer} phần ngoài "
        f"{rule['outer_low']}-{rule['outer_high']}% (tối đa {rule['max_outside_outer']}): "
        f"{'đáp ứng' if ok else 'không đáp ứng'} tiêu chí."
    )


def loss_sentence(whole: list[float], total: list[float]) -> str | None:
    rule = _config()["rules"]["fda_loss"]
    if len(whole) != rule["sample_size"] or len(total) != len(whole) or min(whole) <= 0:
        return None
    losses = [(w - t) / w * 100 for w, t in zip(whole, total, strict=True)]
    limit = rule["max_loss_percent"]
    failing = sum(x >= limit for x in losses)
    return (
        f"Hao hụt khối lượng khi chia: {len(losses)} viên, hao hụt trung bình "
        f"{sum(losses) / len(losses):.2f}%, lớn nhất {max(losses):.2f}%; {failing} viên không đạt "
        f"tiêu chí dưới {_g(limit)}%: {'đáp ứng' if failing == 0 else 'không đáp ứng'} tiêu chí."
    )


def _numbers(trial: TrialData, file: str, table: int, col: int, first: int, last: int):
    out = []
    for row in range(first, last + 1):
        text = cell_text(trial, file, table, row, col)
        out.append(first_number(text) if text is not None else None)
    return None if None in out else [float(v) for v in out]


def verify(text: str, trial: TrialData | None) -> list[str]:
    """Error codes for a sentence with a calculation or rule tag; none when it checks out."""
    body = " ".join(ANY_TAG.sub("", text).split())
    if rule := RULE_TAG.search(text):
        try:
            expected = rule_sentence(rule["id"])
        except KeyError:
            return ["E_RULE_MISMATCH"]
        return [] if body == expected else ["E_RULE_MISMATCH"]
    if trial is None:
        return ["E_DATA_SOURCE_MISMATCH"]
    if tag := MASS_TAG.search(text):
        values = _numbers(
            trial,
            tag["file"],
            int(tag["table"]),
            int(tag["col"]),
            int(tag["first"]),
            int(tag["last"]),
        )
        expected = mass_sentence(values) if values else None
    elif tag := LOSS_TAG.search(text):
        args = (tag["file"], int(tag["table"]))
        span = (int(tag["first"]), int(tag["last"]))
        whole = _numbers(trial, *args, int(tag["whole"]), *span)
        total = _numbers(trial, *args, int(tag["total"]), *span)
        expected = loss_sentence(whole, total) if whole and total else None
    else:
        return []
    if expected is None:
        return ["E_CALC_INPUT"]
    return [] if body == expected else ["E_CALC_MISMATCH"]


def files_in(text: str) -> set[str]:
    return {m["file"] for m in (*MASS_TAG.finditer(text), *LOSS_TAG.finditer(text))}


def _column(table: TrialTable, words: list[str]) -> int | None:
    for i, header in enumerate(table.headers, start=1):
        if any(w in fold(header) for w in words):
            return i
    return None


def _run(table: TrialTable, col: int) -> tuple[int, int] | None:
    """First and last row of the first unbroken run of numbers in a column."""
    first = None
    for number, row in enumerate(table.rows, start=1):
        value = first_number(row[col - 1]) if col <= len(row) else None
        if value is not None and first is None:
            first = number
        if value is None and first is not None:
            return first, number - 1
    return (first, len(table.rows)) if first is not None else None


def file_strength(trial: TrialData, file: str, strengths: tuple[str, ...]) -> str | None:
    """The strength a report is about: its general-information table, or the only declared one."""
    words = _words()["strength_row"]
    found = set()
    for table in trial.of_kind("report_info"):
        if table.file != file:
            continue
        for row in table.rows:
            if len(row) > 1 and any(w in fold(row[0]) for w in words):
                if s := named_strength(row[1], strengths):
                    found.add(s)
    if len(found) == 1:
        return next(iter(found))
    return strengths[0] if len(strengths) == 1 and not found else None


def _gap(reason: str) -> dict[str, str]:
    return {"type": "paragraph", "text": f"{GAP_LABEL} {reason}."}


def build_sections(
    trial: TrialData | None, strengths: tuple[str, ...], outline: dict[str, Any]
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    if trial is None or not strengths:
        return {}, []
    words = _words()
    per_strength: dict[str, list[dict[str, str]]] = {}
    notes: list[str] = []
    for table in (*trial.of_kind("subdivision_mass"), *trial.of_kind("subdivision_loss")):
        where = f"{table.file}, bảng {table.index}"
        strength = file_strength(trial, table.file, strengths)
        if strength is None:
            notes.append(f"{where}: không xác định được hàm lượng của báo cáo")
            continue
        if table.kind == "subdivision_mass":
            col = _column(table, words["part_mass"])
            span = _run(table, col) if col else None
            values = _numbers(trial, table.file, table.index, col, *span) if span else None
            sentence = mass_sentence(values) if values else None
            if sentence is None:
                size = _config()["rules"]["ph_eur_mass"]["sample_size"]
                notes.append(f"{where}: cần đúng {size} khối lượng phần viên đọc được")
                continue
            tag = (
                f"[tính: chia viên, {table.file}, bảng {table.index}, cột {col} "
                f"hàng {span[0]}-{span[1]}]"
            )
        else:
            whole_col = _column(table, words["whole_mass"])
            total_col = _column(table, words["parts_total"])
            span = _run(table, whole_col) if whole_col else None
            if not (whole_col and total_col and span):
                notes.append(f"{where}: thiếu cột khối lượng viên nguyên hoặc tổng các phần")
                continue
            args = (table.file, table.index)
            whole = _numbers(trial, *args, whole_col, *span)
            total = _numbers(trial, *args, total_col, *span)
            sentence = loss_sentence(whole, total) if whole and total else None
            if sentence is None:
                size = _config()["rules"]["fda_loss"]["sample_size"]
                notes.append(f"{where}: cần đúng {size} viên có đủ hai khối lượng")
                continue
            tag = (
                f"[tính: hao hụt, {table.file}, bảng {table.index}, nguyên cột {whole_col}, "
                f"tổng cột {total_col}, hàng {span[0]}-{span[1]}]"
            )
        per_strength.setdefault(strength, []).append(
            {"type": "paragraph", "text": f"{sentence} {tag}"}
        )
    if not per_strength:
        return {}, notes
    sections: dict[str, dict[str, Any]] = {}
    for section in outline["sections"]:
        index = (section.get("form") or {}).get("strengthIndex")
        if section["id"].startswith(PARENT + ".") and index is not None and index < len(strengths):
            blocks = per_strength.get(strengths[index])
            if blocks:
                sections[section["id"]] = {
                    "id": section["id"],
                    "status": "covered",
                    "blocks": blocks,
                }
    if not sections:
        return {}, notes
    rule_blocks = [
        {"type": "paragraph", "text": f"{rule_sentence(r)} [quy tắc: {r}]"}
        for r in _config()["rules"]
    ]
    sections[PARENT] = {"id": PARENT, "status": "covered", "blocks": rule_blocks}
    return sections, notes
