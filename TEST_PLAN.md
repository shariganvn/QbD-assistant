<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260722-qbd-p2-ingest-step-04.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:9d81661441938c135d59ef7385b8a04644137ab9dbf69662d31f913ba2ad41f7 -->

# TEST_PLAN — Active Validation Gates

## T20260722-qbd-p2-ingest-step-04

Status: **Executed — results recorded**

- Workstream: `qbd-p2-ingest-completion`
- Date: 2026-07-22
- Plan: `docs/plans/qbd-p2-ingest-completion/step-04-isolated-gate-suite.md`

## Scope

Verify the isolated G-01 through G-10 ingest suite, its strict retained evidence schema, hard timeouts, and real LiteParse capability semantics.

### Changed files

- `cowork-p2-kit/ingest/liteparse-adapter.mjs`
- `cowork-p2-kit/ingest/tests/`
- `docs/reports/qbd-p2-ingest-completion/gates/`
- `docs/plans/qbd-p2-ingest-completion/`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-22
- Approved by: human

## Commands

### ingest-step-04-verification — Run the literal G-01 through G-10 isolated gate suite and regenerate canonical evidence.

```bash
npm run verify:ingest
```


## Results

Verdict: **passed**
Artifact: `artifacts/260722-1539/test-verdict.json`
Counts: passed=unknown, failed=unknown, warnings=unknown

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
