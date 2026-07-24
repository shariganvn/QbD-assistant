<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260724-qbd-p4-reasoning-step-01.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:585d3506cccdf84fa5259b60acba014467d30b97251655f53af2aaa0a70710ad -->

# TEST_PLAN — Active Validation Gates

## T20260724-qbd-p4-reasoning-step-01

Status: **Executed — results recorded**

- Workstream: `qbd-p4-reasoning-layer`
- Date: 2026-07-24
- Plan: `docs/plans/qbd-p4-reasoning-layer/step-01-contracts-and-harness.md`

## Scope

Freeze strict Layer B artifact contracts, validate-before-publication behavior, and the machine-evidence gate harness without changing Layer A or Layer C.

### Changed files

- `cowork-p2-kit/reasoning/`
- `cowork-p2-kit/rubric/selection-rubric.schema.json`
- `package.json`
- `docs/plans/qbd-p4-reasoning-layer/`
- `docs/decisions/D20260724-qbd-reasoning-before-rationale.md`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-24
- Approved by: human

## Commands

### gate-p4-01 — Run the contract, publication-preservation, and gate-runner tests through the P4 evidence wrapper.

```bash
node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-01 cowork-p2-kit/reasoning/tests/contract.test.mjs cowork-p2-kit/reasoning/tests/output-preservation.test.mjs cowork-p2-kit/reasoning/tests/run-gate-contract.test.mjs
```

### shared-contract-smoke — Confirm existing ingest/render contract and publication-boundary tests remain green.

```bash
node --test cowork-p2-kit/ingest/tests/record-contract.test.mjs cowork-p2-kit/render/tests/contract.test.mjs cowork-p2-kit/render/tests/output-preservation.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260724-1241/test-verdict.json`
Counts: passed=14, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
