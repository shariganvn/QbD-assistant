<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260729-qbd-rationale-step-03.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:cde046e807e6315fa7875c735f9a5502ed108fc6ac43d0b67b52f11917de3969 -->

# TEST_PLAN — Active Validation Gates

## T20260729-qbd-rationale-step-03

Status: **Executed — results recorded**

- Workstream: `qbd-rationale-report-layer`
- Date: 2026-07-29
- Plan: `docs/plans/qbd-rationale-report-layer/step-03-deterministic-readable-derivative.md`

## Scope

Derive deterministic, literal-safe rationale Markdown only from the sealed packet and validated rationale JSON, with byte-exact regeneration equality.

### Changed files

- `cowork-p2-kit/rationale/rationale-markdown.mjs`
- `cowork-p2-kit/rationale/errors.mjs`
- `cowork-p2-kit/rationale/tests/rationale-markdown.test.mjs`
- `docs/reports/qbd-rationale-report-layer/gates/`
- `docs/plans/qbd-rationale-report-layer/plan.md`
- `docs/plans/qbd-rationale-report-layer/gates.yaml`
- `docs/progress/P20260729-qbd-rationale-step-03.yaml`
- `docs/test-plans/T20260729-qbd-rationale-step-03.yaml`
- `docs/test-plans/active.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-29
- Approved by: human

## Commands

### rationale-contract-suite — Run the packet, claim-binding, Markdown-derivative, and gate-runner contracts.

```bash
node --test cowork-p2-kit/rationale/tests/packet-contract.test.mjs cowork-p2-kit/rationale/tests/claim-binding.test.mjs cowork-p2-kit/rationale/tests/rationale-markdown.test.mjs cowork-p2-kit/rationale/tests/run-gate-contract.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260729-1024/test-verdict.json`
Counts: passed=25, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
