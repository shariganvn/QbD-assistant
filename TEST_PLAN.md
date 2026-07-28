<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260728-qbd-p4-reasoning-step-05.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:28d6ef732bb159caa2e09c0c2da5710498b209df83ad7a18db7a208d76097374 -->

# TEST_PLAN — Active Validation Gates

## T20260728-qbd-p4-reasoning-step-05

Status: **Executed — results recorded**

- Workstream: `qbd-p4-reasoning-layer`
- Date: 2026-07-28
- Plan: `docs/plans/qbd-p4-reasoning-layer/step-05-integrated-gates-review.md`

## Scope

Run the complete ordered P4 acceptance suite, validate one machine-produced evidence set, and revalidate a temporary deterministic published package at the git-retained decision root against the committed Step 0 store bytes.

### Changed files

- `package.json`
- `cowork-p2-kit/reasoning/tests/verify-reasoning.mjs`
- `cowork-p2-kit/reasoning/tests/verify-reasoning-evidence.mjs`
- `cowork-p2-kit/reasoning/tests/e2e-decision.test.mjs`
- `cowork-p2-kit/reasoning/tests/gate-evidence-validator.mjs`
- `docs/test-plans/active.yaml`
- `docs/test-plans/T20260728-qbd-p4-reasoning-step-05.yaml`
- `TEST_PLAN.md`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-01.json`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-02.json`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-03.json`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-04.json`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-05.json`
- `docs/reports/qbd-p4-reasoning-layer/gates/step-close/G-P4-05.json`
- `docs/reports/qbd-p4-reasoning-layer/code-review.md`
- `docs/plans/qbd-p4-reasoning-layer/plan.md`
- `docs/plans/qbd-p4-reasoning-layer/gates.yaml`
- `docs/progress/P20260728-qbd-p4-reasoning-step-05.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-28
- Approved by: human

## Commands

### verify-reasoning — Run G-P4-01 through G-P4-05 in order through the P4 evidence wrapper under one suite UUID.

```bash
npm run verify:reasoning
```


## Results

Verdict: **passed**
Artifact: `artifacts/260728-0906/test-verdict.json`
Counts: passed=122, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
