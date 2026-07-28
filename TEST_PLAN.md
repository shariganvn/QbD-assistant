<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260728-qbd-p2-ingest-post-closure-validation.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:d4ee84e2ff5238b6dafffa8834ec3027da9f3461719ef4759362b0e36d1b2182 -->

# TEST_PLAN — Active Validation Gates

## T20260728-qbd-p2-ingest-post-closure-validation

Status: **Executed — results recorded**

- Workstream: `qbd-p2-ingest-completion`
- Date: 2026-07-28
- Plan: `docs/plans/qbd-p2-ingest-completion/post-closure-toctou-validation-plan-patch.md`

## Scope

Verify the bounded recursive-input, artifact-root, and cooperative publication-lock changes in an isolated checkout, then retain fresh canonical P2 gate evidence.

### Changed files

- `cowork-p2-kit/ingest/admission.mjs`
- `cowork-p2-kit/ingest/config.mjs`
- `cowork-p2-kit/ingest/publication.mjs`
- `cowork-p2-kit/ingest/tests/file-boundaries.test.mjs`
- `cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs`
- `cowork-p2-kit/ingest/tests/publication-failure.test.mjs`
- `docs/reports/qbd-p2-ingest-completion/gates/`
- `docs/plans/qbd-p2-ingest-completion/post-closure-toctou-validation-plan-patch.md`
- `docs/reports/qbd-p2-ingest-completion/code-review.md`
- `docs/test-plans/active.yaml`
- `docs/test-plans/T20260728-qbd-p2-ingest-post-closure-validation.yaml`
- `docs/progress/P20260728-qbd-p2-ingest-post-closure-validation.yaml`
- `docs/progress/P20260728-qbd-p2-ingest-closeout-attestation.yaml`
- `TEST_PLAN.md`
- `PROGRESS.md`
- `DECISIONS.md`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-28
- Approved by: human

## Commands

### isolated-ingest-verification — Run the ordered G-01 through G-10 ingest suite from a byte-identical isolated checkout.

```bash
npm run verify:ingest
```


## Results

Verdict: **passed**
Artifact: `artifacts/260728-1344/test-verdict.json`
Counts: passed=64, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
