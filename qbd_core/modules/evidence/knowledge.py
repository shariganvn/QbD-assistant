"""Internal knowledge lookup. A hit is a verbatim sentence with file, page and class."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from math import ceil
from pathlib import Path
from typing import Protocol

from qbd_core.modules.evidence.models import KnowledgeDocument
from qbd_core.modules.evidence.text import sentences, squash, tokens
from qbd_core.shared.contracts import EvidenceRecord, Provenance


class KnowledgePort(Protocol):
    def search(self, query: str, limit: int = 5) -> list[EvidenceRecord]: ...

    def verify(self, record: EvidenceRecord) -> bool: ...


def evidence_id(file_id: str, page: int, quote: str) -> str:
    digest = hashlib.sha256(f"{file_id}|{page}|{squash(quote)}".encode()).hexdigest()
    return f"E-{digest[:12]}"


def load_documents(path: str | Path) -> tuple[KnowledgeDocument, ...]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("a document set is a JSON list")
    return tuple(KnowledgeDocument.model_validate(item) for item in raw)


class InMemoryKnowledge:
    def __init__(self, documents: Iterable[KnowledgeDocument]) -> None:
        self._docs = {}
        for doc in documents:
            if doc.file_id in self._docs:
                raise ValueError(f"duplicate file_id {doc.file_id}")
            self._docs[doc.file_id] = doc

    def search(self, query: str, limit: int = 5) -> list[EvidenceRecord]:
        wanted = tokens(query)
        if not wanted or limit < 1:
            return []
        need = max(1, ceil(len(wanted) / 2))
        hits = []
        for doc in self._docs.values():
            for number, page in enumerate(doc.pages, start=1):
                for sentence in sentences(page):
                    score = len(wanted & tokens(sentence))
                    if score >= need:
                        hits.append((-score, doc.file_id, number, sentence))
        hits.sort()
        return [self._record(self._docs[f], n, s) for _, f, n, s in hits[:limit]]

    def verify(self, record: EvidenceRecord) -> bool:
        """True only when the record's quote occurs verbatim on the cited page of a known file."""
        prov = record.provenance
        doc = self._docs.get(prov.file) if prov else None
        if doc is None or not 1 <= prov.page <= len(doc.pages):
            return False
        return squash(prov.quote) in squash(doc.pages[prov.page - 1])

    @staticmethod
    def _record(doc: KnowledgeDocument, page: int, quote: str) -> EvidenceRecord:
        return EvidenceRecord(
            id=evidence_id(doc.file_id, page, quote),
            text=quote,
            classification=doc.classification,
            provenance=Provenance(file=doc.file_id, page=page, quote=quote),
        )
