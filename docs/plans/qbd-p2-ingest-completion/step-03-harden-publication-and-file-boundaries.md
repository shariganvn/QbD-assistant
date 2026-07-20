# Step 3 — Harden Publication and File Boundaries

## Goal

Make publication atomic under failure and concurrent writers, and keep all file/process operations
inside configured trust boundaries.

## Preconditions

- G-03 passes.
- The publication module accepts an isolated store root and failure injection points.

## Files

- Modify `cowork-p2-kit/ingest/publication.mjs`, `admission.mjs`, and `liteparse-adapter.mjs`.
- Add publication-failure, concurrency, and file-boundary fixtures/tests.

## Execution contract

1. Acquire a single-writer lock with explicit stale-lock behavior.
2. Allocate a unique sibling temp file per invocation.
3. Validate schema, non-empty output, and round-trip invariants before rename.
4. Preserve the previous store on every error path and clean temp/lock state in `finally`.
5. Reject traversal, symlink escape, duplicate normalized paths, and unsupported extensions before
   parser or writer side effects.
6. Pass parser arguments literally through an argument array.
7. Run G-04, G-05, and G-06 with before/after hashes retained.

## Stop conditions

- Any ENOENT, stale temp, stale lock, changed prior-store hash, or path escape is blocking.
- A passing happy path cannot compensate for a failed negative or concurrency gate.
