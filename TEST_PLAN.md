<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260729-qbd-rationale-step-00.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:5884dab95333e94262413311569d3d75242566235bf9c44d5d11e7218e241b1d -->

# TEST_PLAN — Active Validation Gates

## T20260729-qbd-rationale-step-00

Status: **Executed — results recorded**

- Workstream: `qbd-rationale-report-layer`
- Date: 2026-07-29
- Plan: `docs/plans/qbd-rationale-report-layer/step-00-freeze-source-package-fixtures.md`

## Scope

Generate and pin the selected, inconclusive, and attested P4 decision-package fixtures used as the rationale layer's immutable Step 1 input contract.

### Changed files

- `cowork-p2-kit/rationale/tests/decision-package-fixtures.test.mjs`
- `cowork-p2-kit/rationale/tests/fixtures/decision-package-fixtures.mjs`
- `cowork-p2-kit/rationale/tests/fixtures/decision-package/`
- `docs/plans/qbd-rationale-report-layer/gates.yaml`
- `docs/reports/qbd-rationale-report-layer/gates/`
- `docs/reports/qbd-rationale-report-layer/rationale/`
- `docs/test-plans/T20260729-qbd-rationale-step-00.yaml`
- `docs/test-plans/active.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-29
- Approved by: human

## Commands

### fixture-provenance — Regenerate every decision package through the injected P4 CLI factory and compare all bytes to the committed fixtures.

```bash
node --test cowork-p2-kit/rationale/tests/decision-package-fixtures.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260729-0832/test-verdict.json`
Counts: passed=1, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
