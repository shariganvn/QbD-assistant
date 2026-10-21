# SPEC - provider_access

## Purpose
Call the language-model provider mechanism: approved models, contract status, local fallback.

## Ubiquitous nouns owned
ProviderCall

## API contract (api.py)
Empty until the first slice of this module lands. Each public function is added here first.

## Invariants
Only payloads that passed egress_gate are sent to a remote provider. A provider failure publishes nothing.

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
