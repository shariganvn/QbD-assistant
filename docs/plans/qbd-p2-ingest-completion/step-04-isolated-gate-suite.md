# Step 4 — Isolated Gate Suite

## Goal

Turn every remaining requirement into reproducible evidence and provide one complete verification command.

## Preconditions

- G-01 through G-06 pass.
- Tests use temporary roots and never mutate canonical inputs or store artifacts.

## Files

- Complete `cowork-p2-kit/ingest/tests/**` fixtures and test files.
- Add or finalize `verify:ingest` in `package.json`.
- Write gate evidence under `artifacts/qbd-p2-ingest-completion/gates/`.

## Execution contract

1. Cover unsupported input, missing manifest entry, non-public classification, invalid metadata,
   dependency error, and forced assertion failure.
2. Verify absent `is-complex` reports `unsupported`; do not claim OCR detection success.
3. Run determinism twice with real repo-local LiteParse and compare raw JSONL hashes.
4. Ensure the full command fails if any blocking test is skipped or evidence is missing.
5. Run G-07 through G-10 and retain machine-readable results.

## Stop conditions

- A mock adapter cannot be used as evidence for the real LiteParse integration or determinism gate.
- No gate may be weakened, marked optional, or deferred merely because implementation fails it.
- Do not begin closure review until G-10 passes.
