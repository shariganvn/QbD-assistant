"""Every covered text must come from a verified evidence record or be a marked gap."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from qbd_core.modules.dossier_drafting.api import CQA_SECTION, CalcError, f2
from qbd_core.modules.evidence.api import (
    DATA_TAG,
    KnowledgePort,
    TrialData,
    cell_text,
    first_number,
    numbers_in,
)
from qbd_core.modules.quality_gate.models import Finding
from qbd_core.shared.contracts import EvidenceRecord
from qbd_core.shared.markers import kind_of

CLAIM_TAG = re.compile(
    r"\[tổng hợp: (?P<file>[^,\]]+), trang (?P<page>\d+), (?P<id>E-[0-9a-f]{12})\]"
)
CLAIM_TAGS_AT_END = re.compile(r"(?:\s*\[tổng hợp: [^\]]+\])+\s*$")
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
TAG = re.compile(
    r"\s*\[nguồn: (?P<file>[^,\]]+), trang (?P<page>\d+), (?P<id>E-[0-9a-f]{12})\]\s*$"
)


def _block(code: str, section_id: str | None, detail: str = "") -> Finding:
    return Finding(code=code, severity="block", section_id=section_id, detail=detail)


def _numbers(text: str) -> set[str]:
    return {n.replace(",", ".") for n in NUMBER.findall(text)}


def _check_claim(
    text: str, sid: str, evidence: Mapping[str, EvidenceRecord], knowledge: KnowledgePort
) -> list[Finding]:
    """A synthesized sentence: every tag must resolve to a verified record, and no number may appear
    that is absent from the cited quotes. Whether the wording is faithful is left to a person."""
    tail = CLAIM_TAGS_AT_END.search(text)
    body = text[: tail.start()].strip()
    cited = []
    for tag in CLAIM_TAG.finditer(tail.group()):
        record = evidence.get(tag["id"])
        prov = record.provenance if record else None
        if prov is None or prov.file != tag["file"] or prov.page != int(tag["page"]):
            return [_block("E_SOURCE_MISMATCH", sid, tag["id"])]
        if not knowledge.verify(record):
            return [_block("E_SOURCE_UNVERIFIED", sid, tag["id"])]
        cited.append(record.text)
    if not body:
        return [_block("E_UNSOURCED_TEXT", sid)]
    if not _numbers(body) <= _numbers(" ".join(cited)):
        return [_block("E_CLAIM_NUMBER_UNSUPPORTED", sid)]
    return []


# A running number in a column headed STT is the row's position, not a value from a source.
ORDINAL = re.compile(r"[1-9]\d{0,2}")


CALC_TAG = re.compile(
    r"\[tính: f2, (?P<file>[^,\]]+), bảng (?P<table>\d+), đối chiếu cột (?P<ref>\d+), "
    r"thử cột (?P<test>\d+), hàng (?P<first>\d+)-(?P<last>\d+)\]"
)


def _check_f2_row(row: list[str], sid: str, trial: TrialData | None) -> list[Finding]:
    """The f2 cell of a row must equal f2 recomputed from the cells the row's tag points at."""
    tag = CALC_TAG.search(row[0])
    if tag is None or trial is None or len(row) < 2:
        return [_block("E_CALC_MISMATCH", sid, "f2 tag")]
    pairs = []
    for number in range(int(tag["first"]), int(tag["last"]) + 1):
        cells = [
            cell_text(trial, tag["file"], int(tag["table"]), number, int(tag[key]))
            for key in ("ref", "test")
        ]
        values = [first_number(c) if c is not None else None for c in cells]
        if None in values:
            return [_block("E_CALC_INPUT", sid, "f2 input cell")]
        pairs.append(values)
    try:
        value = f2([p[0] for p in pairs], [p[1] for p in pairs])
    except CalcError:
        return [_block("E_CALC_INPUT", sid, "f2 input")]
    return [] if f"{value:.1f}" == row[1].strip() else [_block("E_CALC_MISMATCH", sid, "f2 value")]


def _check_data(text: str, sid: str, trial: TrialData | None) -> list[Finding]:
    """A sentence built from the team's data: each tag must name a real cell, and no number may
    appear that is absent from the cited cells."""
    body = CALC_TAG.sub("", DATA_TAG.sub("", text)).strip()
    if not body:
        return [_block("E_UNSOURCED_TEXT", sid)]
    cells = []
    for tag in DATA_TAG.finditer(text):
        cell = None
        if trial is not None:
            cell = cell_text(
                trial, tag["file"], int(tag["table"]), int(tag["row"]), int(tag["col"])
            )
        if cell is None:
            return [_block("E_DATA_SOURCE_MISMATCH", sid, tag.group())]
        cells.append(cell)
    if not numbers_in(body) <= numbers_in(" ".join(cells)):
        return [_block("E_DATA_NUMBER_UNSUPPORTED", sid)]
    return []


def _check_text(
    text: str,
    sid: str,
    evidence: Mapping[str, EvidenceRecord],
    knowledge: KnowledgePort,
    authored: bool,
    table_cell: bool,
    trial: TrialData | None = None,
) -> list[Finding]:
    if kind_of(text) is not None:
        return []
    if DATA_TAG.search(text):
        return _check_data(text, sid, trial)
    if CLAIM_TAGS_AT_END.search(text):
        return _check_claim(text, sid, evidence, knowledge)
    tag = TAG.search(text)
    if tag is None:
        if authored:
            return []
        if table_cell:
            return [_block("E_VALUE_WITHOUT_SOURCE", sid)] if re.search(r"\d", text) else []
        return [_block("E_UNSOURCED_TEXT", sid)]
    record = evidence.get(tag["id"])
    prov = record.provenance if record else None
    if prov is None or prov.file != tag["file"] or prov.page != int(tag["page"]):
        return [_block("E_SOURCE_MISMATCH", sid, tag["id"])]
    if TAG.sub("", text).strip() != record.text.strip():
        return [_block("E_SOURCE_MISMATCH", sid, tag["id"])]
    if not knowledge.verify(record):
        return [_block("E_SOURCE_UNVERIFIED", sid, tag["id"])]
    return []


def check_provenance(
    draft: dict[str, Any],
    evidence: tuple[EvidenceRecord, ...],
    knowledge: KnowledgePort,
    cqa_confirmed: bool,
    trial: TrialData | None = None,
) -> list[Finding]:
    by_id = {r.id: r for r in evidence}
    findings = []
    if len(by_id) != len(evidence):
        findings.append(_block("E_DUPLICATE_EVIDENCE", None))
    cited: set[str] = set()
    data_files: set[str] = set()
    for section in draft["sections"]:
        if section["status"] != "covered":
            continue
        sid = section["id"]
        authored = sid == CQA_SECTION and cqa_confirmed
        for block in section["blocks"]:
            if block["type"] == "paragraph":
                cells = [(block["text"], False)]
            elif block["type"] == "table":
                ordinal = {i for i, h in enumerate(block["headers"]) if h.strip().upper() == "STT"}
                is_f2 = len(block["headers"]) > 1 and block["headers"][1].strip().lower() == "f2"
                cells = []
                for row in block["rows"]:
                    skip = set()
                    if is_f2 and CALC_TAG.search(row[0]):
                        findings += _check_f2_row(row, sid, trial)
                        skip.add(1)
                        data_files.update(t["file"] for t in CALC_TAG.finditer(row[0]))
                    cells += [
                        (c, True)
                        for i, c in enumerate(row)
                        if i not in skip and not (i in ordinal and ORDINAL.fullmatch(c.strip()))
                    ]
            else:
                continue
            for text, is_cell in cells:
                findings += _check_text(text, sid, by_id, knowledge, authored, is_cell, trial)
                if (tag := TAG.search(text)) is not None:
                    cited.add(tag["file"])
                cited.update(t["file"] for t in CLAIM_TAG.finditer(text))
                data_files.update(t["file"] for t in DATA_TAG.finditer(text))
    sources = draft["meta"].get("referenceSources", [])
    findings += [
        _block("E_REFERENCE_MISSING", None, f)
        for f in sorted(cited)
        if not any(f in entry for entry in sources)
    ]
    listed = draft["meta"].get("sourceFiles", [])
    findings += [
        _block("E_DATA_FILE_NOT_LISTED", None, f) for f in sorted(data_files) if f not in listed
    ]
    return findings
