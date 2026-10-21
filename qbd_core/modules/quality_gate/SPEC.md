# SPEC - quality_gate

## Purpose
Check a draft by code against the checklist, consistency, provenance and market numbering rules.

## Ubiquitous nouns owned
QualityReport

## API contract (api.py)
Empty until the first slice of this module lands. Each public function is added here first.

## Invariants
Checks are deterministic code; no language-model self-scoring. A failed check blocks publication.

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
