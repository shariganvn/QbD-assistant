# SPEC - rendering

## Purpose
Turn a valid draft.json into a docx by invoking the existing renderer as a command-line tool.

## Ubiquitous nouns owned
RenderedDocument

## API contract (api.py)
Empty until the first slice of this module lands. Each public function is added here first.

## Invariants
The docx is produced only by the Node renderer. No output is written when the draft is invalid.

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
