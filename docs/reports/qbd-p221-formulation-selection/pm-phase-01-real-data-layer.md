# PM Report — Phase 1: Typed evidence, complete inventory and safe fact-card bindings

- Date: 2026-08-08
- Gate: G-01 — **pass** (evidence below)
- Mode: ak-cook `code` (validated plan, TDD)
- Workstream: `qbd-p221-formulation-selection`

## What landed

| File | Kind |
|---|---|
| `cowork-p2-kit/workflow-trial/real-data-pack.mjs` | data-package builder + validators + CLI |
| `cowork-p2-kit/workflow-trial/contracts/formulation-evidence.schema.v1.json` | typed evidence envelope (observed/spec/composition) |
| `cowork-p2-kit/workflow-trial/contracts/fact-card-evidence-bindings.schema.v1.json` | mandatory card→evidence binding map |
| `cowork-p2-kit/workflow-trial/contracts/formulation-data-package.schema.v1.json` | sealed package (artifact + bound hashes) |
| `cowork-p2-kit/workflow-trial/tests/real-data-pack.test.mjs` | G-01 suite (8 tests) |
| `docs/reports/qbd-p221-formulation-selection/formulation-evidence.json` | typed evidence envelope |
| `docs/reports/qbd-p221-formulation-selection/fact-cards.json` | 18 v1 cards (15 scoring + 3 rationale) |
| `docs/reports/qbd-p221-formulation-selection/fact-card-evidence-bindings.json` | 18 bindings |
| `docs/reports/qbd-p221-formulation-selection/inventory-reconciliation.json` | 4/4 admitted, derived roles |
| `docs/reports/qbd-p221-formulation-selection/formulation-data-package.json` | sealed package |
| `docs/reports/qbd-p221-formulation-selection/hashes.json` | determinism proof |

## Gate evidence

- Test: `node --test cowork-p2-kit/workflow-trial/tests/real-data-pack.test.mjs` → **18/18 pass**.
- Determinism: two in-process builds identical; CLI re-emission byte-identical
  (`package_sha256 0d6620d2…`, `byte_identical:true`).
- G-00 regression: `formulation-spike-run.test.mjs` → **10/10 pass**.
- Reasoning regression: 73/73 pass (pre-existing `G-P4-04` stale baton-era test
  excluded — checks for removed `session-handoff.yaml`, unrelated to Phase 1).
- Non-negotiable contracts held: spec-not-result (structural `E_SPEC_AS_RESULT`),
  exact cohort `formula-01/02/03`, source-derived inventory + derived roles,
  strict `<15` CU operator, atomic source/store/receipt/evidence sealing.

## Negative paths covered (G-01)

`E_SPEC_AS_RESULT` · `E_EXACT_COHORT` (missing/extra/duplicate) ·
`E_INVENTORY_RECONCILIATION` (omitted record) · `E_ROLE_OVERRIDE` (role downgrade) ·
`E_BINDING_AMBIGUOUS` (wrong kind/record, ambiguous join) ·
`E_BINDING_INCOMPLETE` (dropped adverse binding) · `E_FACT_PROVENANCE`
(receipt, quote, offset, candidate, statistic, and specification drift).

## Review outcome

`code-reviewer` → DONE_WITH_CONCERNS; 0 critical, 0 security, 0 breaking.
Resolved in this phase:

- **H2** (binding coverage) — completeness pass added to `validateBindings`:
  every observed/composition evidence must have exactly one binding; dropped
  binding → `E_BINDING_INCOMPLETE`; negative test added.
- **M2** (fail-closed pin) — `receiptSetSha256` is now required, not optional.
- **H1** (documented decision) — emitted cards are binding-validator-only by
  design: comma-decimal raw cells cannot carry the dot-decimal token the
  canonical `validateFactCards` requires. Formulation path consumes evidence
  envelope + bindings, never the legacy validator. G-02 note added.
- **M1** (noted for G-02) — Phase 1 roles are `record_id → [evidence kinds]`;
  v2 engine expects `results|context`; translation defined at G-02 boundary.

Subsequent remediation closes the reviewer-discovered provenance gaps: every
evidence item, including specifications, is validated against the exact
hash-pinned G-00 receipt set before card bindings are accepted. Duplicate card
IDs, altered quotes/offsets, coordinated evidence/card mutation, candidate or
statistic substitution, and rehashed specification threshold/range changes are
all negative-tested.

## Open / next

- Phase 2 (`phase-02-spec-compiled-rubric-and-approval.md`) is unblocked (G-01
  pass). Start by the `recordRoles` kinds→results/context mapping and carry the
  exact G-00 receipt authority into the binding validator, then add the v3
  rubric + spec compilation + MVP `fd-confirm` flag.
- Pre-existing `G-P4-04` skill-artifact test failure (baton-era) is tracked as a
  stale test unrelated to this slice; touch only under explicit authorization.

Status: DONE
Summary: G-01 passes with 18/18 green tests, cross-process byte-identical
determinism, receipt-authority provenance validation, and final review with no
Critical/High findings; Phase 1 is complete and Phase 2 is unblocked.
