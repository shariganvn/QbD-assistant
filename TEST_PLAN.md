<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260721-qbd-p2-ingest-g03-spec-diff-remediation.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:43c2e035fce21702ad8a9e8a6bd98edea366abb5c252b2ee7875b27b42c75c8d -->

# TEST_PLAN — Active Validation Gates

## T20260721-qbd-p2-ingest-g03-spec-diff-remediation

Status: **Executed — results recorded**

- Workstream: `qbd-p2-ingest-completion`
- Date: 2026-07-21
- Plan: `docs/plans/qbd-p2-ingest-completion/step-02-modularize-ingest-pipeline.md`

## Scope

Close the two G-03 spec-diff blockers without adding Step 3 publication hardening.

### Changed files

- `cowork-p2-kit/ingest/records.mjs`
- `cowork-p2-kit/ingest/tests/pipeline.test.mjs`
- `docs/test-plans/T20260721-qbd-p2-ingest-g03-spec-diff-remediation.yaml`
- `docs/test-plans/active.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-21T15:09:05+07:00
- Approved by: human

## Commands

### ingest-g03-remediation-verification — Run tracked-source, frozen-record, and modular-pipeline regressions after the two G-03 corrections.

```bash
npm run verify:ingest
```


## Results

Verdict: **passed**
Artifact: `artifacts/260721-1508/test-verdict.json`
Counts: passed=15, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
