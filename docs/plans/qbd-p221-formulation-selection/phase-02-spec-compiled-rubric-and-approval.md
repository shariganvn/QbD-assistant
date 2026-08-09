---
phase: 2
title: "Formulation v3 rubric, strict spec compilation and MVP FD-confirm flag"
status: completed
priority: P1
effort: "2-3d"
dependencies: [1]
---

# Phase 2: Formulation v3 rubric, strict spec compilation and MVP FD-confirm flag

## Context links

- Gate: `gates.yaml` → G-02.
- Existing frozen v2: `cowork-p2-kit/rubric/selection-rubric-v2.schema.json`.
- Existing evaluator: `cowork-p2-kit/reasoning/decision-engine.mjs`.
- FD authority decision: `docs/decisions/D20260727-qbd-p4-reasoning-policy.md`.

## Overview

Add an additive formulation-specific v3 contract rather than weakening frozen v2
semantics. V3 supports an exact required cohort, safe single-survivor selection,
multiple/strict hard gates, and spec-to-rubric receipts. Authorization is MVP-
grade for this slice: a simple `fd-confirmed` flag separates proposal from a
human-confirmed decision; cryptographic FD receipts/pins are deferred to a
separate module.

## Requirements

- Preserve v2 behavior and existing v2 fixtures/callers.
- V3 requires exact `required_candidate_ids` and supports
  `minimum_eligible_candidates: 1` only with
  `selection_mode: single-survivor-after-complete-cohort`.
- Define measures explicitly:

| Measure ID | Evidence | Hard gates | Score role |
|---|---|---|---|
| `dissolution_min` | observed minimum | compiled `>=80` proposal | zero weight; eligibility only |
| `dissolution_mean` | observed mean | none | comparison score |
| `dissolution_max` | observed maximum | none | zero weight; raw diagnostic number only (scientific significance is a human/FD call, never system-flagged) |
| `assay` | observed scalar | compiled `>=90` and `<=110` | zero weight; eligibility only |
| `content_uniformity_av` | observed scalar | compiled strict `<15` | zero weight; eligibility only |

- V3 `hard_gates` is an array and supports `<`, `<=`, `>=`, `>` exactly.
- Every operator/threshold comes from typed specification evidence. The compiler
  cannot substitute `<` with `<=`.
- Emit `spec-compile-receipt.json` binding source DOCX hash, store hash,
  cell-receipt-set hash, spec-evidence IDs/hash, compiler version, canonical
  rubric hash and the fd-confirm flag state.
<!-- Updated: Spec-review closeout - confirmed v3 rubric is source-compiled and receipt-bound -->
- Authorization rules (MVP):
  - `proposal` (default): engine keeps `fd_decision` inconclusive
    (`E_RUBRIC_APPROVAL_REQUIRED`), no winner; the engineering proposal is built
    separately in Phase 3;
  - `fd-confirmed`: a trusted FD user sets a flag recording `confirmed_by`,
    `confirmed_at` and a note. When set, the v3 source compiler materializes
    `approval_state: test-approved`; the compile receipt, published rubric,
    decision and evaluation all carry the same rubric hash. This slice ships
    with the flag UNSET.
- The same-run hashes prove byte-identity, not authority — accepted as MVP-grade
  trust; cryptographic authority is the deferred module's job.
- The runner must not accept `--rubric-state` or arbitrary approval values from
  the caller; the fd-confirm flag is the only thing that authorizes the runner to
  emit a test-approved rubric.
- Deferred: cryptographic FD receipt + human-committed, insider-proof pin.

## Phase 1 handoff notes (G-01 pass, 2026-08-08)

- **recordRoles translation (M1):** Phase 1 derives roles as
  `record_id → [observed_result, specification, composition_context]`
  (`inventory-reconciliation.json`). The frozen v2 engine expects
  `record_id → "results"|"context"`. Define the kinds→results/context mapping
  when wiring the G-01 data package into the evaluator.
- **Binding-validator-only cards (H1):** the emitted v1 fact cards satisfy the
  fact-card JSON schema but are NOT fed to the canonical reasoning
  `validateFactCards` (comma-decimal raw cells cannot carry the dot-decimal
  `String(value)` token). The formulation path consumes the evidence envelope +
  `fact-card-evidence-bindings.json` exclusively. Compile/rubric work must reuse
  the binding validator with the exact G-00 `formula-cell-receipts.json` receipt
  authority, never the legacy validator.

## Architecture

```text
typed spec evidence
  -> compile v3 rubric
  -> validate exact operator/threshold provenance
  -> emit spec-compile receipt
  -> fd-confirm flag verifier (MVP)
       unset (default): fd_decision inconclusive
       set by trusted FD user: fd_decision reflects confirmed outcome
  -> v3 evaluator
```

V3 dispatch may share canonical hashing/scoring helpers with v2, but tests must
freeze v2 outputs before refactoring. Any shared-helper extraction happens only
after v2 characterization tests are green.

### Single-survivor safety rule

The evaluator order is mandatory:

1. Validate exact required candidate IDs and complete source inventory.
2. Validate spec/rubric/data-package hashes and authorization lane.
3. Evaluate all hard gates for all three candidates.
4. Allow a sole survivor only when steps 1-3 passed.
5. A one- or two-candidate input never becomes a selected result.

## Related code files

- Create: `cowork-p2-kit/rubric/selection-rubric-v3.schema.json`.
- Create: `cowork-p2-kit/rubric/compile-rubric-from-spec.mjs`.
- Create: `cowork-p2-kit/rubric/spec-compile-receipt.schema.v1.json`.
- Create: `cowork-p2-kit/rubric/fd-confirm-flag.schema.v1.json` — MVP flag
  (`confirmed_by`, `confirmed_at`, `note`); ships unset.
- Create: `cowork-p2-kit/rubric/fixtures/formulation-selection-rubric.proposal.v3.json`.
- Modify: `cowork-p2-kit/reasoning/selection-contracts.mjs` — additive v3
  validation; preserve v2 entry and semantics.
- Modify: `cowork-p2-kit/reasoning/decision-engine.mjs` — additive v3 dispatch,
  exact cohort/single-survivor/multi-gate logic; preserve v2 results.
- Modify: `cowork-p2-kit/reasoning/publication.mjs` — seal compile receipt and
  refuse any caller-supplied approval state.
- Create: `cowork-p2-kit/workflow-trial/tests/spec-compiled-rubric.test.mjs`.
- Modify tests: existing reasoning contract/decision/publication suites for v2
  non-regression plus new v3 cases.
- Deferred to the authorization module: `fd-approval-receipt.schema` and any
  cryptographic pin.

## Blast radius to protect

- `evaluateSelection`: HIGH — 7 direct callers, 15 impacted symbols, 4 flows.
- `validateSelectionRubricV2`: CRITICAL — 13 impacted symbols, 5 flows.
- Required approach: additive v3 branch; run every existing v2 decision,
  workflow-trial and publication test before accepting the change.

## Implementation steps

1. Characterize and snapshot existing v2 proposal outputs.
2. Add failing v3 schema/validator tests: exact cohort, minimum 1, multi-gate,
   strict operator, spec drift and fd-confirm flag state.
3. Implement v3 schema and compiler; emit canonical compile receipt.
4. Add exact measure mapping above; do not duplicate assay fact cards to fake a
   paired gate.
5. Implement exact-candidate guard followed by safe single-survivor evaluation.
6. Add the fd-confirm flag schema/verifier; the runner rejects caller-supplied
   approval state.
7. Ship the flag UNSET and assert fd_decision stays inconclusive; assert that
   setting the flag (test-only) flips fd_decision to the confirmed outcome.
8. Seal compile receipt into decision publication and reject cross-store/spec/
   rubric substitutions.
9. Run full v2 regression plus v3 focused suite.

## Success criteria

- [x] G-02 passes.
- [x] Existing v2 results remain byte-equivalent.
- [x] Exact three candidates + proposed rule computes CT03 as sole survivor.
- [x] Missing candidate still returns inconclusive; minimum 1 cannot bypass it.
- [x] `assay` uses two gates on one observed value without duplicate cards.
- [x] CU exactly 15 fails strict `<15`.
- [x] Caller-supplied approval state (CLI/arbitrary) is rejected; the fd-confirm
  flag is the only thing that authorizes the v3 source compiler to materialize
  and receipt-bind a `test-approved` rubric.
- [x] With the fd-confirm flag unset, `fd_decision` stays inconclusive.
- [x] Cross-store or modified spec evidence invalidates the compile receipt.

## Risk assessment

- Shared engine change can regress completed P4/demo flows → additive dispatch,
  v2 characterization and broad regression gate.
- `minimum_eligible_candidates:1` can be abused with partial cohorts → exact
  required-candidate and source-inventory checks execute first.
- The MVP fd-confirm flag is trust, not tamper-proof security → documented as
  MVP-grade; cryptographic authorization is the deferred module's job.

## Security considerations

- Authorization cannot come from CLI strings or caller-provided approval values;
  the fd-confirm flag is the only input that authorizes the source compiler to
  materialize and publish the v3 test-approved rubric.
- The fd-confirm flag is MVP-grade trust; it is not a defense against a
  malicious insider. Tamper-proof authorization is the deferred module.
- Hashes prove identity, not authority.
