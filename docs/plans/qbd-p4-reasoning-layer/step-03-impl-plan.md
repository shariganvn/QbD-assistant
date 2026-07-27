# Step 3 Implementation Plan — Test-Only Rubric Decision Core

## Context

- Step 3 spec: `docs/plans/qbd-p4-reasoning-layer/step-03-rubric-decision-engine.md`
- Gate definition: `gates.yaml` G-P4-03
- ADR: `D20260727` — test-only amendment approved
- Existing: G-P4-01 (49 assertions pass), G-P4-02 (19 assertions pass)
- Pattern: `node:test` + `assert/strict`, `expectCode()`, `canonicalBytes()` → SHA-256

## Scope

**Create (8 files):**
1. `cowork-p2-kit/rubric/selection-rubric-v2.schema.json` — v2 rubric JSON schema
2. `cowork-p2-kit/rubric/selection-rubric-proposal.v2.json` — unpinned proposal fixture
3. `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json` — synthetic test rubric
4. `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-pin.json` — SHA-256 pin
5. `cowork-p2-kit/reasoning/selection-evaluation.schema.json` — evaluation sidecar schema
6. `cowork-p2-kit/reasoning/selection-contracts.mjs` — v2 rubric/evaluation validators
7. `cowork-p2-kit/reasoning/decision-engine.mjs` — pure decision engine
8. `cowork-p2-kit/reasoning/tests/decision-engine.test.mjs` — G-P4-03 test file

**Do NOT touch:** G-P4-01/02 code/fixtures/evidence, `contracts.mjs`, `errors.mjs`, `package.json`, CLI, publication, SKILL

## Execution Order

### Phase A: TDD Red — Create failing test + fixtures

1. **Create test rubric fixture** — `selection-rubric-test-approved.v2.json`
   - 3 measures: `release_30m` (scalar, >=80 hard gate), `assay` (scalar, >=95 hard gate), `hardness` (range/midpoint)
   - `approval_state: "test-approved"`
   - Synthetic score maps, weights (sum=1), tie threshold, conflict tolerance

2. **Create rubric pin** — `selection-rubric-test-pin.json`
   - Compute `canonicalBytes(fixture)` → SHA-256 → `{ "selection_rubric_sha256": "<hex>" }`

3. **Create proposal fixture** — `selection-rubric-proposal.v2.json`
   - Same structure but `approval_state: "proposal"`

4. **Create v2 rubric schema** — `selection-rubric-v2.schema.json`
   - Exact-key, `additionalProperties: false`
   - Validates measures array with coupled raw_shape/aggregation

5. **Create evaluation sidecar schema** — `selection-evaluation.schema.json`
   - Exact-key: schema_version, evaluation_id, decision_id, decision_sha256, cohort_id, rubric_sha256, matrix_cells, candidate_reviews, sensitivity, outcome_code

6. **Create `selection-contracts.mjs`** — v2 validators
   - `validateSelectionRubricV2(rubric)` — validates against v2 schema
   - `validateSelectionEvaluation(evaluation)` — validates evaluation sidecar
   - Reuse `exactObject`, `string`, `shaOrNull` patterns from `contracts.mjs`
   - Add new error codes to `errors.mjs`: `E_RUBRIC_APPROVAL_REQUIRED`, `E_RUBRIC_PIN_REQUIRED`, `E_RUBRIC_PIN_MISMATCH`, `E_UNIT_NORMALIZATION_REQUIRED`, `E_NORMALIZED_VALUE_MISMATCH`, `E_INSUFFICIENT_ELIGIBLE_CANDIDATES`, `E_TIE_OR_SENSITIVITY_UNSTABLE`, `E_FD_REVIEW_UNCITED_RESULTS`

7. **Write failing test** — `decision-engine.test.mjs`
   - Import test fixtures, create synthetic cohort/evidence/factCards
   - Test: proposal → inconclusive + E_RUBRIC_APPROVAL_REQUIRED
   - Test: missing pin → E_RUBRIC_PIN_REQUIRED
   - Test: mismatched pin → E_RUBRIC_PIN_MISMATCH
   - Test: test-approved + matching pin → selected winner
   - Test: hard gate rejection before scoring
   - Test: missing critical data → inconclusive
   - Test: unit/normalization failure → mapped code
   - Test: conflict → inconclusive
   - Test: uncited results → E_FD_REVIEW_UNCITED_RESULTS
   - Test: tie → E_TIE_OR_SENSITIVITY_UNSTABLE
   - Test: sensitivity instability → E_TIE_OR_SENSITIVITY_UNSTABLE
   - Test: matrix cells carry derived value/unit + sorted IDs
   - Test: non-attested/attested cohort semantics preserved
   - Test: G-P4-01/02 byte-identical after run

8. **Run TDD red** — record `gates/red/G-P4-03.json`

### Phase B: Implement — Decision engine

9. **Create `decision-engine.mjs`** — pure function `evaluateSelection()`
   - Input: `{ cohort, evidenceLog, factCards, rubric, rubricPin, recordRoles, decisionId }`
   - Output: `{ decision, evaluation }`
   - Algorithm per spec (7 steps):
     1. Validate artifacts + hash rubric
     2. Check approval_state → proposal = inconclusive; test-approved = verify pin
     3. Build matrix cells from fact cards + admitted evidence
     4. Check missing critical cells, unit/normalization, conflicts, uncited results
     5. Evaluate hard gates → eligibility
     6. Score + sensitivity analysis (Cartesian product of weight vectors)
     7. Return selected or typed inconclusive
   - Uses `canonicalBytes()` from `publication.mjs`
   - Uses validators from `selection-contracts.mjs` + existing `contracts.mjs`

### Phase C: Green — Verify + gate

10. **Run tests until green** — all assertions pass
11. **Run gate** — `node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-03 cowork-p2-kit/reasoning/tests/decision-engine.test.mjs`
12. **Verify G-P4-01/02 byte-identical** — re-run their gates, compare evidence

## Key Design Decisions

- **New error codes** go in `errors.mjs` (add to `ERROR_CODES` set) — keeps single error registry
- **`canonicalBytes`** imported from `publication.mjs` — DRY, same serializer
- **`selection-contracts.mjs`** is isolated from `contracts.mjs` — v1 validators untouched
- **Engine is pure** — no fs, no API, no model calls; all data injected
- **Test fixtures are synthetic** — not real pharma data; pin is computed, not hand-written

## Risk

- Low: all new files, no modification to passing gates
- Pin computation must be deterministic — use same `canonicalBytes()` as production
