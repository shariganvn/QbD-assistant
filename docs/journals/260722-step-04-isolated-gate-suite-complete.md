# Step 4 Isolated Gate Suite -- All 10 Gates Pass

**Date**: 2026-07-22
**Severity**: Medium
**Component**: ingest/verification/gates
**Status**: Resolved

## What Happened

Step 4 of the QbD P.2 ingest completion plan added gate tests, fixtures, and a verification harness for G-07 through G-10. The full 10-gate suite now runs end-to-end in ~123s with all gates passing. The critical fix was in `liteparse-adapter.mjs`: `isComplex()` was incorrectly classifying valid JSON output (exit code 1) as a parse failure instead of "available."

## The Brutal Truth

This was a straightforward step that almost went wrong in one specific place. The `isComplex()` logic conflated "exit code 1" with "parser unavailable," which masked a real behavioral difference: `lit is-complex` exits 1 for complex pages but still emits valid JSON on stdout. If we had not caught this during gate G-08 testing, the capability discovery gate would have been fundamentally broken and the suite would have passed a false negative.

## Technical Details

- `isComplex()` before: exit code != 0 meant "unsupported." After: exit 1 + valid JSON stdout = "available"; ENOENT or exit 127 = "unsupported"; anything else = "invalid."
- Four new test files created: `admission-negative.test.mjs` (G-07), `capability-discovery.test.mjs` (G-08), `determinism.integration.test.mjs` (G-09), `complete-ingest-verification.test.mjs` (G-10).
- `run-gate.mjs` rewritten with TAP parsing, env validation, and `docs/reports/` evidence path.
- `verify-ingest.mjs` created as suite harness with literal 10-gate mapping and 1200s deadline.
- Gate evidence generated under `docs/reports/qbd-p2-ingest-completion/gates/`.
- `repository-boundary.test.mjs` updated to assert `verify:ingest` script exists in `package.json`.

## What We Tried

1. Initial `isComplex()` treated any non-zero exit as "unsupported" -- failed because `lit is-complex` exits 1 intentionally for complex documents.
2. Admission test initially targeted `product-profile.docx`, but that file sits outside `trials/reference/` directories, so the admission test correctly rejects it. Mutations were redirected to trial files instead.

## Root Cause Analysis

The `isComplex()` bug was an assumption error: we assumed exit code 0 means success and anything else means failure. In reality, `lit` uses exit code 1 to signal "complex" (a valid, non-error state). The fix required checking both the exit code and whether stdout contains valid JSON, not just the exit code alone.

## Lessons Learned

1. Always check stdout content alongside exit codes when wrapping CLI tools. Exit codes are not always binary success/failure.
2. Admission tests that exercise the boundary condition (files outside allowed directories) are critical -- they revealed that `product-profile.docx` is not a trial file and should be rejected.
3. TDD execution order from the plan worked exactly as designed. The plan's step ordering was the right call.

## Next Steps

- Step 5 (code-review closure and handoff) is next in the plan (G-11, G-12).
- Gate evidence is at `docs/reports/qbd-p2-ingest-completion/gates/`.
- All gates G-01 through G-10 pass.
- **Deferred:** TOCTOU hardening remains an accepted out-of-scope follow-up. Green gates do not close it.
