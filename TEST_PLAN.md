<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260721-qbd-p2-ingest-step-03.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:1a527020e8696891d04b714b648a5c15d3a69c94dd889057592f6eb05fdffec1 -->

# TEST_PLAN — Active Validation Gates

## T20260721-qbd-p2-ingest-step-03

Status: **Executed — results recorded**

- Workstream: `qbd-p2-ingest-completion`
- Date: 2026-07-21
- Plan: `docs/plans/qbd-p2-ingest-completion/step-03-harden-publication-and-file-boundaries.md`

## Scope

Verify atomic failure handling, concurrent-writer exclusion, and configured file/process trust boundaries for publication.

### Changed files

- `cowork-p2-kit/ingest/admission.mjs`
- `cowork-p2-kit/ingest/config.mjs`
- `cowork-p2-kit/ingest/liteparse-adapter.mjs`
- `cowork-p2-kit/ingest/publication.mjs`
- `cowork-p2-kit/ingest/publication-support.mjs`
- `cowork-p2-kit/ingest/schema-validation.mjs`
- `cowork-p2-kit/ingest/tests/file-boundaries.test.mjs`
- `cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs`
- `cowork-p2-kit/ingest/tests/publication-failure.test.mjs`
- `cowork-p2-kit/ingest/tests/run-gate.mjs`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-21
- Approved by: reviewer

## Commands

### gate-g04-publication-failure — Generate machine-readable evidence for publication failure preservation.

```bash
node cowork-p2-kit/ingest/tests/run-gate.mjs G-04 cowork-p2-kit/ingest/tests/publication-failure.test.mjs
```

### gate-g05-publication-concurrency — Generate machine-readable evidence for concurrent-writer safety.

```bash
node cowork-p2-kit/ingest/tests/run-gate.mjs G-05 cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs
```

### gate-g06-file-boundaries — Generate machine-readable evidence for configured-root and parser boundaries.

```bash
node cowork-p2-kit/ingest/tests/run-gate.mjs G-06 cowork-p2-kit/ingest/tests/file-boundaries.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260721-1617/test-verdict.json`
Counts: passed=unknown, failed=unknown, warnings=unknown

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
