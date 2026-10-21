# SPEC - provider_access

## Purpose
The mechanism that calls a language-model provider: approved models, the egress check, failure handling.
The policy of what may leave the machine belongs to egress_gate; this module only enforces it.

## Ubiquitous nouns owned
LLMPort, LLMRequest, ProviderResult, ProviderGateway, RecordedProvider.

## API contract (api.py)
- `ProviderGateway(provider, approved_models, manifest).call(request) -> ProviderResult` is the only route
  to a provider. Order: (1) model must be approved, else `ProviderRefused("E_MODEL_NOT_APPROVED")`;
  (2) `egress_gate.check_egress` for the provider's destination, else `ProviderRefused("E_EGRESS_BLOCKED")`
  carrying the reason codes; (3) provider call, any exception becomes `ProviderFailed("E_PROVIDER_ERROR")`
  with the cause chained; (4) an empty or non-string answer is `ProviderFailed("E_RESPONSE_INVALID")`.
  A refusal means the provider was never called.
- `LLMPort`: `destination` and `complete(request) -> str`. A destination other than `local` is treated as
  leaving the machine.
- `RecordedProvider(answers, destination=REMOTE)`: replays answers keyed by `request_digest`; an unknown
  request raises `RecordedMiss`, never a made-up answer. Defaults to REMOTE so tests go through the same
  gate as a real provider.

## Invariants
- No provider is reached except through the gateway, and a remote provider is reached only after
  egress_gate allowed the whole payload.
- Failure returns nothing: no partial text, no default answer.
- Until a zero-data-retention contract is on file, a remote provider can receive only what egress_gate
  allows, which is approved class A material.

## Data owned (models.py)
None persisted.

## Exposed to (file-share outside api.py)
None.

## Dependencies
egress_gate (through its api.py): `check_egress`, `Payload`, `Manifest`, `Destination`.

## Non-goals
A concrete network provider (added after a contract and a model list are approved), prompt content,
retries, cost tracking, and any decision about what is classified.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Gateway, port, recorded provider | Single guarded route to a provider; replayable runs | - |
