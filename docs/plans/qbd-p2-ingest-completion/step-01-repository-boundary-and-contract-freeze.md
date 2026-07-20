# Step 1 — Repository Boundary and Contract Freeze

## Goal

Make executable ingest source trackable and freeze the compatibility contract before restructuring.

## Preconditions

- Read the canonical `plan.md` and G-01/G-02 in `gates.yaml`.
- Inspect the current dirty diff for `package.json`, `package-lock.json`, and `.gitignore`.
- Run GitNexus impact before editing any existing symbol.

## Files

- Move behavior from `cowork-p2-kit/store/ingest.mjs` into tracked `cowork-p2-kit/ingest/`.
- Update `cowork-p2-kit/.gitignore` so only generated store artifacts are ignored.
- Update the `ingest` and new `verify:ingest` scripts in `package.json` without altering Phase 3's
  renderer dependency.
- Add repository-boundary and record-contract tests under `cowork-p2-kit/ingest/tests/`.

## Execution contract

1. Capture representative current JSONL records as a reviewed contract fixture with volatile run-log
   fields excluded.
2. Pin the required record fields, deterministic ID input, relative path convention, provenance
   offset basis, sort order, and CLI exit behavior in tests.
3. Create the tracked source directory and thin CLI target without changing record behavior.
4. Prove every runtime module is tracked and not ignored.
5. Run G-01 and G-02 and retain their raw evidence.

## Stop conditions

- Stop if the current JSONL shape contradicts `records.schema.json`; resolve the contract before moving code.
- Stop if editing package scripts would overwrite unrelated Phase 3 changes.
- Do not start Step 2 until G-01 and G-02 pass.
