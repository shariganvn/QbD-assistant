# SPEC - evidence

## Purpose
Turn source documents and lookups into evidence records that carry provenance and a data-classification label.

## Ubiquitous nouns owned
EvidenceRecord, Provenance, Citation, Classification

## API contract (api.py)
Empty until the first slice of this module lands. Each public function is added here first.

## Invariants
An unlabeled record is treated as the most restricted class. A record has either provenance or a citation, never neither.

## Data owned (models.py)
None yet.

## Exposed to (file-share outside api.py)
None.

## Dependencies
None yet; other modules are called only through their api.py.

## Non-goals
Anything outside the purpose above.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
