<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260727-qbd-p4-reasoning-step-02.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:2200e227965e8c55729bda96917fe2d186cbe2b91ca70635f8897ea22cea6ad7 -->

# TEST_PLAN — Active Validation Gates

## T20260727-qbd-p4-reasoning-step-02

Status: **Executed — results recorded**

- Workstream: `qbd-p4-reasoning-layer`
- Date: 2026-07-27
- Plan: `docs/plans/qbd-p4-reasoning-layer/step-02-cohort-evidence-boundaries.md`

## Scope

Enforce the FD-selected-package cohort boundary, hash-pinned linear-attestation scope, and published evidence-log v2 bindings without scoring or ranking.

### Changed files

- `cowork-p2-kit/reasoning/cohort-evidence.mjs`
- `cowork-p2-kit/reasoning/contracts.mjs`
- `cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs`
- `cowork-p2-kit/reasoning/tests/fixtures/contract/step-2-linear-attestation.json`
- `cowork-p2-kit/reasoning/tests/fixtures/contract/step-2-linear-attestation-pin.json`
- `cowork-p2-kit/reasoning/tests/fixtures/store/selected-internal-package.jsonl`
- `cowork-p2-kit/reasoning/tests/fixtures/store/extraction-quality-negatives.jsonl`
- `docs/plans/qbd-p4-reasoning-layer/`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-02.json`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-27
- Approved by: human

## Commands

### gate-p4-02 — Run the current-policy cohort and evidence-boundary suite through the P4 evidence wrapper.

```bash
node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-02 cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260727-1406/test-verdict.json`
Counts: passed=19, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
