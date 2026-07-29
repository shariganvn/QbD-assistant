<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260729-qbd-rationale-step-02.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:7e8c861d488edabacb6d947799435a68792b644dd2e6d983338056305f2c1847 -->

# TEST_PLAN — Active Validation Gates

## T20260729-qbd-rationale-step-02

Status: **Executed — results recorded**

- Workstream: `qbd-rationale-report-layer`
- Date: 2026-07-29
- Plan: `docs/plans/qbd-rationale-report-layer/step-02-rationale-contract-claim-binding.md`

## Scope

Reclose the sealed packet contract at v2 and validate pure, evidence-bound rationale claims, including causal explanations for inconclusive decisions.

### Changed files

- `cowork-p2-kit/rationale/rationale-packet.schema.json`
- `cowork-p2-kit/rationale/packet.mjs`
- `cowork-p2-kit/rationale/errors.mjs`
- `cowork-p2-kit/rationale/rationale.schema.json`
- `cowork-p2-kit/rationale/rationale-contracts.mjs`
- `cowork-p2-kit/rationale/claim-binding.mjs`
- `cowork-p2-kit/rationale/tests/packet-contract.test.mjs`
- `cowork-p2-kit/rationale/tests/claim-binding.test.mjs`
- `docs/reports/qbd-rationale-report-layer/gates/`
- `docs/plans/qbd-rationale-report-layer/`
- `docs/progress/P20260729-qbd-rationale-step-01-causal-delta.yaml`
- `docs/progress/P20260729-qbd-rationale-step-02.yaml`
- `docs/test-plans/T20260729-qbd-rationale-step-02.yaml`
- `docs/test-plans/active.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-29
- Approved by: human

## Commands

### gate-rl-01 — Revalidate the packet-v2 causal-evidence contract.

```bash
node cowork-p2-kit/rationale/tests/run-gate.mjs G-RL-01 cowork-p2-kit/rationale/tests/packet-contract.test.mjs
```

### gate-rl-02 — Validate pure claim-to-source and causal-evidence binding.

```bash
node cowork-p2-kit/rationale/tests/run-gate.mjs G-RL-02 cowork-p2-kit/rationale/tests/claim-binding.test.mjs
```

### upstream-reasoning-regression — Run P4 reasoning verification only in an isolated clean worktree.

```bash
npm run verify:reasoning
```


## Results

Verdict: **passed**
Artifact: `artifacts/260729-0832/test-verdict.json`
Counts: passed=21, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
