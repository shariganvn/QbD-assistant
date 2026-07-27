<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260727-qbd-p4-reasoning-step-03.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:9a81b34b3394f9e206d023453dd066c4377577b81e5928fba31555f7d22f4cb2 -->

# TEST_PLAN — Active Validation Gates

## T20260727-qbd-p4-reasoning-step-03

Status: **Executed — results recorded**

- Workstream: `qbd-p4-reasoning-layer`
- Date: 2026-07-27
- Plan: `docs/plans/qbd-p4-reasoning-layer/step-03-rubric-decision-engine.md`

## Scope

Verify the isolated, test-only v2 rubric decision core: admitted-evidence selection, exact-one score maps, deterministic evaluation binding, typed fail-closed outcomes, and frozen Step 1/2 inputs.

### Changed files

- `cowork-p2-kit/reasoning/decision-engine.mjs`
- `cowork-p2-kit/reasoning/selection-contracts.mjs`
- `cowork-p2-kit/reasoning/selection-evaluation.schema.json`
- `cowork-p2-kit/reasoning/step3-error-codes.mjs`
- `cowork-p2-kit/reasoning/tests/decision-engine.test.mjs`
- `cowork-p2-kit/reasoning/tests/fixtures/rubric/`
- `cowork-p2-kit/rubric/selection-rubric-v2.schema.json`
- `cowork-p2-kit/rubric/selection-rubric-proposal.v2.json`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-27
- Approved by: human

## Commands

### gate-p4-03 — Run the test-only selection-decision core through the P4 evidence wrapper.

```bash
node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-03 cowork-p2-kit/reasoning/tests/decision-engine.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260727-2330/test-verdict.json`
Counts: passed=42, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
