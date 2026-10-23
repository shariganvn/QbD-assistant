# SPEC - evidence

## Purpose
Turn source documents and lookups into evidence records that carry provenance and a data-classification
label, and keep them for a run.

## Ubiquitous nouns owned
KnowledgeDocument, KnowledgePort, EvidenceStorePort, EvidenceRecord (shared type), Provenance.

## API contract (api.py)
- `InMemoryKnowledge(documents).search(query, limit=5) -> list[EvidenceRecord]`: every hit is one
  verbatim sentence of one page, with `provenance = {file, page, quote}` and the document's class.
  Matching ignores case and accents; a sentence qualifies when it contains at least half of the distinct
  query words. No qualifying sentence means an empty list, never a guess. Order is score, then file id,
  then page, so equal inputs give equal outputs.
- `InMemoryKnowledge.verify(record) -> bool`: true only if the cited file exists, the page is in range and
  the quote occurs verbatim on that page. A record with only a citation is not internal and returns false.
- `evidence_id(file_id, page, quote)`: `E-` plus 12 hex digits of a hash of those three values.
- `load_documents(path)`: reads documents from JSON (the output shape of the ingest step).
- `JsonFileEvidenceStore(path)` / `InMemoryEvidenceStore`: `add_many`, `get`, `records`. `add_many` is
  all-or-nothing: a duplicate id refuses the whole batch (`DuplicateEvidence`); a failed write leaves the
  previous file byte-for-byte intact and leaves no temporary file. A file that does not parse or validate
  raises `StoreCorrupt` and is not repaired.

## Invariants
- A record has either provenance or a citation, never neither (enforced by the shared type).
- An unclassified document yields records classed `?`, the most restricted class.
- File output is deterministic: same records in the same order give the same bytes.

## Data owned (models.py)
`KnowledgeDocument`. Storage choice, decided here: one JSON file per run, replaced atomically. No database
is introduced; revisit only when a module needs concurrent writers or queries across runs.

## Exposed to (file-share outside api.py)
None.

## Dependencies
`shared.contracts` only. Callers pass records to egress_gate through their own payloads.

## Non-goals
Extracting text from PDF or DOCX (the ingest step does that), searching the web (a later step), ranking
beyond word overlap, and deciding classes (a person approves them).

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Knowledge lookup, verification, file store | Provenance on every hit; atomic persistence without a database | - |
| 2026-10-23 | Kho loader (`kho_loader.py`) | Build knowledge documents from files the owner downloaded; ids from the owner's table, checked against the egress manifest | - |
