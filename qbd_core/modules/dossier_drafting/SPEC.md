# SPEC - dossier_drafting

## Purpose
Turn a validated intake request into a gap-flagged draft of the P.2 sections, with every value tied to evidence.

## Ubiquitous nouns owned
IntakeRequest, DraftSection, GapEntry

## API contract (api.py)
Empty until the first slice of this module lands. Each public function is added here first.

## Invariants
A value without a source is a gap, never a filled number. Dependent agents do not run before the CQA set is confirmed by a person.

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
