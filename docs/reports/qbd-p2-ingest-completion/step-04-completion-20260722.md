# Step 4 Completion Report — Isolated Gate Suite

**Date:** 2026-07-22
**Status:** completed
**Gates:** G-07, G-08, G-09, G-10 — all pass

## Summary

Step 4 turned G-07 through G-10 into reproducible, machine-readable release evidence. All gates pass
with readable artifacts under `docs/reports/qbd-p2-ingest-completion/gates/`.

## What changed

### New files
| File | Gate | Purpose |
|------|------|---------|
| `ingest/tests/admission-negative.test.mjs` | G-07 | 6 fail-closed admission cases via real child CLI |
| `ingest/tests/capability-discovery.test.mjs` | G-08 | 15 unit + integration tests for isComplex |
| `ingest/tests/determinism.integration.test.mjs` | G-09 | Two independent real-LiteParse runs, SHA-256 comparison |
| `ingest/tests/complete-ingest-verification.test.mjs` | G-10 | Validates G-01–G-09 evidence + suite.json state |
| `ingest/tests/verify-ingest.mjs` | G-10 | Suite harness — literal 10-gate mapping, 1200s deadline |
| `ingest/tests/gate-evidence-validator.mjs` | G-10 | Reusable strict validator for evidence schema + suite manifests |
| `ingest/tests/gate-evidence.contract.test.mjs` | G-10 | 23 contract tests for validator: keys, types, timeout, manifest |
| `ingest/tests/fixtures/admission/` | G-07 | Admission test fixtures |

### Modified files
| File | Change |
|------|--------|
| `ingest/liteparse-adapter.mjs` | `isComplex()`: trust-validation → invalid (not unsupported), ENOENT/127 → unsupported, valid JSON → available |
| `ingest/tests/run-gate.mjs` | Rewritten: strict timeout validation (`/^[1-9][0-9]*$/`), always creates own temp dir, handles malformed snapshots, validates evidence before writing |
| `ingest/tests/verify-ingest.mjs` | Hard wall-clock deadline (no +30s buffer), runner timeout detection, G-10 evidence + final manifest validation |
| `ingest/tests/repository-boundary.test.mjs` | Asserts verify:ingest script, literal 10-gate mapping, and all Step 4 files tracked by git |
| `ingest/tests/pipeline.test.mjs` | OS temp dirs via mkdtempSync, fixed mock fileOps (isDirectory), updated isComplex expectations |
| `ingest/tests/determinism.integration.test.mjs` | Fixed per-run JSONL binding: each run parses its own JSONL |
| `gates.yaml` | G-07 through G-10 status → pass |
| `plan.md` | Step 4 status → completed |

## Gate results

| Gate | Tests | Duration | Status |
|------|-------|----------|--------|
| G-01 | 4 | 0.43s | pass |
| G-02 | 2 | 0.10s | pass |
| G-03 | 11 | 20.7s | pass |
| G-04 | 5 | 0.12s | pass |
| G-05 | 8 | 1.1s | pass |
| G-06 | 5 | 0.10s | pass |
| G-07 | 1 | 21.2s | pass |
| G-08 | 15 | 21.4s | pass |
| G-09 | 1 | 58.2s | pass |
| G-10 | 2 | 0.08s | pass |

**Total suite duration:** ~124s (within 1,200s deadline)

## Key design decisions

- `isComplex()` trust-validation failure returns `invalid` (not `unsupported`). Only ENOENT or exit 127
  without valid JSON returns `unsupported`. Valid JSON with any exit code returns `available`.
- `run-gate.mjs` always creates its own temp directory via `mkdtempSync` — never accepts inherited
  `GATE_EVIDENCE_PATH`. Malformed snapshot JSON is handled gracefully (snapshots: [] with diagnostic in raw_stderr).
- `INGEST_GATE_TIMEOUT_MS` must match `/^[1-9][0-9]*$/` entirely — `parseInt("123abc")` is rejected.
- `verify-ingest.mjs` uses a hard wall-clock deadline with no grace period. If the runner is killed at
  the deadline, it writes `timed_out: true` with the in-progress gate as `failed_gate_id`.
- A reusable `gate-evidence-validator.mjs` enforces exact key sets and types for all gate evidence and
  suite manifests. G-10 and the suite runner use the same validator.
- G-09 round-trip verification binds each run to its own JSONL output (not shared jsonl1).
- All suite tests use OS temp directories (`mkdtempSync(join(tmpdir(), ...))`) and clean only that root.
- `repository-boundary.test.mjs` asserts all Step 4 files are tracked by git before the final suite claim.

## Deferred work

- **TOCTOU hardening**: The accepted TOCTOU hardening follow-up remains intentionally out of scope for Step 4.
  Green gates do not close it. This was accepted during plan review and is tracked as a future item.

## Next step

Step 5: Code-review closure and handoff (G-11, G-12).
