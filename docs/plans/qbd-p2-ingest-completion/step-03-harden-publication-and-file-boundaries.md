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

1. Acquire the lock atomically. A second concurrent writer must return the typed
   `E_PUBLICATION_LOCKED` result immediately; it must not wait, queue, write, or remove another
   run's files.
2. Write lock metadata containing the owner PID, creation time, and crypto-random run identifier.
   Reclaim a pre-existing lock only when its metadata is well-formed, its owner process is absent,
   and it is at least five minutes old. Treat a live, fresh, malformed, or indeterminate lock as
   locked.
3. Allocate a unique sibling temp file named from an at-least-128-bit crypto-random run identifier.
   A run may clean only its own temp file and lock.
4. Before rename, validate every record against the complete `records.schema.json` contract, then
   verify non-empty output and every applicable round-trip invariant. A partial required-field
   check is insufficient.
5. Preserve every file below the prior store root byte-for-byte on every error path. Clean this
   run's temp file and lock in `finally`; retain a structured failure log only below the injected
   artifact root at `artifacts/qbd-p2-ingest-completion/runs/`, never in the store root.
6. Canonicalize configured roots. Reject traversal, absolute paths outside those roots, every
   symlink, duplicate normalized paths, and unsupported extensions before parser or writer side
   effects.
7. Invoke only the configured absolute LiteParse binary through a literal argument array with no
   shell evaluation.
8. Use committed, non-sensitive DOCX happy-path fixtures with expected JSONL checksums. Run
   G-04, G-05, and G-06 with automatically generated, machine-readable evidence containing the
   command, result, before/after hashes, run identifier, and timestamp.

## Stop conditions

- Any ENOENT, incorrectly reclaimed lock, leftover temp or lock, changed store-root bytes, path
  escape, or store-root failure log is blocking.
- A passing happy path cannot compensate for a failed negative or concurrency gate.
