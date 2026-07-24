<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260724-qbd-p4-reasoning-step-00.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:28051d345f784fb46e39b74dce74a42fc0b3ff0efa41081b83364b55613b17bc -->

# TEST_PLAN — Active Validation Gates

## T20260724-qbd-p4-reasoning-step-00

Status: **Executed — results recorded**

- Workstream: `qbd-p4-reasoning-layer`
- Date: 2026-07-24
- Plan: `docs/plans/qbd-p4-reasoning-layer/step-00-freeze-store-baseline.md`

## Scope

Freeze a committed, reproducible 17-record Layer B fixture from the current admitted store without changing Layer A or Layer C behavior.

### Changed files

- `cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl`
- `cowork-p2-kit/reasoning/tests/fixtures/store/README.md`
- `docs/plans/qbd-p4-reasoning-layer/gates.yaml`
- `docs/plans/qbd-p4-reasoning-layer/plan.md`
- `artifacts/260724-1116-qbd-p4-step-00/records.jsonl.bak`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-24
- Approved by: human

## Commands

### ingest-record-contract-regression — Preserve the existing frozen JSONL record envelope and deterministic record identity.

```bash
node --test cowork-p2-kit/ingest/tests/record-contract.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260724-1116/test-verdict.json`
Counts: passed=2, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
