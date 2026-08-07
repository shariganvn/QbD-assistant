<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260806-qbd-p221-phase-00.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:67c57ff56c91006cdc56ab6111d3f997c6f3c6f6b53650c824987f68d66ceff1 -->

# TEST_PLAN — Active Validation Gates

## T20260806-qbd-p221-phase-00

Status: **Executed — results recorded**

- Workstream: `qbd-p221-formulation-selection`
- Date: 2026-08-06
- Plan: `docs/plans/qbd-p221-formulation-selection/plan.md`

## Scope

Verify the hash-pinned, isolated Phase 0 formula-cell extraction. The DOCX XML receipt is authority for table/row/column ownership; ingest records prove one admitted page/quote binding and are not cell-owner authority.

### Changed files

- `cowork-p2-kit/workflow-trial/formulation-spike-run.mjs`
- `cowork-p2-kit/workflow-trial/formula-cell-receipt.mjs`
- `cowork-p2-kit/workflow-trial/contracts/formula-cell-receipt.schema.v1.json`
- `cowork-p2-kit/workflow-trial/tests/formulation-spike-run.test.mjs`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-08-06
- Approved by: human

## Commands

### qbd-p221-phase-00-tests — Run the focused G-00 test suite.

```bash
node --test cowork-p2-kit/workflow-trial/tests/formulation-spike-run.test.mjs
```

### qbd-p221-phase-00-evidence — Emit G-00 evidence from two fresh isolated ingests.

```bash
node cowork-p2-kit/workflow-trial/formulation-spike-run.mjs --out docs/reports/qbd-p221-formulation-selection
```


## Results

Verdict: **passed**
Artifact: `artifacts/260806-1550/test-verdict.json`
Counts: passed=unknown, failed=unknown, warnings=unknown

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
