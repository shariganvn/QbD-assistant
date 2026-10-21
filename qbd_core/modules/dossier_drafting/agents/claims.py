"""Check a sentence a model wrote, and turn it into a draft paragraph with its source tags."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence

from qbd_core.shared.contracts import EvidenceRecord
from qbd_core.shared.markers import kind_of

MAX_CLAIM_CHARS = 600
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def _numbers(text: str) -> set[str]:
    return {n.replace(",", ".") for n in NUMBER.findall(text)}


def check_claim(
    text: object, evidence_ids: object, pool: Mapping[str, EvidenceRecord]
) -> str | None:
    """Return an error code, or None when the sentence may be published with its tags."""
    if not isinstance(text, str) or not text.strip():
        return "E_CLAIM_EMPTY"
    if len(text) > MAX_CLAIM_CHARS or "\n" in text:
        return "E_CLAIM_SHAPE"
    if kind_of(text) is not None or "[nguồn" in text or "[tổng hợp" in text:
        return "E_CLAIM_MARKER"
    if not isinstance(evidence_ids, list) or not evidence_ids:
        return "E_CLAIM_UNKNOWN_SOURCE"
    if not all(isinstance(i, str) and i in pool for i in evidence_ids):
        return "E_CLAIM_UNKNOWN_SOURCE"
    cited = " ".join(pool[i].text for i in evidence_ids)
    return None if _numbers(text) <= _numbers(cited) else "E_CLAIM_NUMBER_UNSUPPORTED"


def tagged(text: str, evidence_ids: Sequence[str], pool: Mapping[str, EvidenceRecord]) -> str:
    tags = []
    for evidence_id in dict.fromkeys(evidence_ids):
        prov = pool[evidence_id].provenance
        tags.append(f"[tổng hợp: {prov.file}, trang {prov.page}, {evidence_id}]")
    return f"{text.strip()} {' '.join(tags)}"
