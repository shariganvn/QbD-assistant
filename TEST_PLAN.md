<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260729-qbd-rationale-step-01.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:cfac003959cef7ad36142bef0c6e3200fb01a150f24c613e5b89f3689306f073 -->

# TEST_PLAN — Active Validation Gates

## T20260729-qbd-rationale-step-01

Status: **Executed — results recorded**

- Workstream: `qbd-rationale-report-layer`
- Date: 2026-07-29
- Plan: `docs/plans/qbd-rationale-report-layer/step-01-packet-contract-and-sealer.md`

## Scope

Seal a canonical, receipt-bound rationale packet from a fully re-validated P4 decision package, without exposing store bytes, raw record content, or execution-report content to the rationale author.

### Changed files

- `cowork-p2-kit/rationale/rationale-packet.schema.json`
- `cowork-p2-kit/rationale/packet.mjs`
- `cowork-p2-kit/rationale/errors.mjs`
- `cowork-p2-kit/rationale/cli.mjs`
- `cowork-p2-kit/rationale/tests/packet-contract.test.mjs`
- `cowork-p2-kit/rationale/tests/gate-evidence-validator.mjs`
- `cowork-p2-kit/rationale/tests/run-gate.mjs`
- `cowork-p2-kit/rationale/tests/run-gate-contract.test.mjs`
- `cowork-p2-kit/rationale/tests/fixtures/rationale-packet/selected.json`
- `docs/reports/qbd-rationale-report-layer/gates/`
- `docs/plans/qbd-rationale-report-layer/plan.md`
- `docs/plans/qbd-rationale-report-layer/gates.yaml`
- `docs/progress/P20260729-qbd-rationale-step-01.yaml`
- `docs/test-plans/T20260729-qbd-rationale-step-01.yaml`
- `docs/test-plans/active.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-29
- Approved by: human

## Commands

### gate-rl-01 — Run packet and local gate-runner contract assertions through the rationale evidence wrapper.

```bash
node cowork-p2-kit/rationale/tests/run-gate.mjs G-RL-01 cowork-p2-kit/rationale/tests/packet-contract.test.mjs cowork-p2-kit/rationale/tests/run-gate-contract.test.mjs
```

### upstream-reasoning-regression — Re-run the completed P4 reasoning suite in its isolated clean worktree.

```bash
npm run verify:reasoning
```


## Results

Verdict: **passed**
Artifact: `artifacts/260729-0832/test-verdict.json`
Counts: passed=11, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
