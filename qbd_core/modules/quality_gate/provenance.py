"""Every covered text must come from a verified evidence record or be a marked gap."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from qbd_core.modules.dossier_drafting.api import CQA_SECTION
from qbd_core.modules.evidence.api import KnowledgePort
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


def _check_text(
    text: str,
    sid: str,
    evidence: Mapping[str, EvidenceRecord],
    knowledge: KnowledgePort,
    authored: bool,
    table_cell: bool,
) -> list[Finding]:
    if kind_of(text) is not None:
        return []
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
) -> list[Finding]:
    by_id = {r.id: r for r in evidence}
    findings = []
    if len(by_id) != len(evidence):
        findings.append(_block("E_DUPLICATE_EVIDENCE", None))
    cited: set[str] = set()
    for section in draft["sections"]:
        if section["status"] != "covered":
            continue
        sid = section["id"]
        authored = sid == CQA_SECTION and cqa_confirmed
        for block in section["blocks"]:
            if block["type"] == "paragraph":
                cells = [(block["text"], False)]
            elif block["type"] == "table":
                cells = [(c, True) for row in block["rows"] for c in row]
            else:
                continue
            for text, is_cell in cells:
                findings += _check_text(text, sid, by_id, knowledge, authored, is_cell)
                if (tag := TAG.search(text)) is not None:
                    cited.add(tag["file"])
                cited.update(t["file"] for t in CLAIM_TAG.finditer(text))
    sources = draft["meta"].get("referenceSources", [])
    findings += [
        _block("E_REFERENCE_MISSING", None, f)
        for f in sorted(cited)
        if not any(f in entry for entry in sources)
    ]
    return findings
