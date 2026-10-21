# SPEC - egress_gate

## Purpose
Decide which classified material may leave the machine and for which destination.

## Ubiquitous nouns owned
Classification, EgressDecision

## API contract (api.py)
Empty until the first slice of this module lands. Each public function is added here first.

## Invariants
Class B, class C and unclassified material never leaves. A missing label or manifest blocks everything.

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
