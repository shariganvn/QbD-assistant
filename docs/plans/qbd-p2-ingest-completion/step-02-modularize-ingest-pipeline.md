# Step 2 — Modularize Ingest Pipeline

## Goal

Split the monolith at real boundaries while preserving the frozen contract and default CLI behavior.

## Preconditions

- G-01 and G-02 pass with retained evidence.
- GitNexus impact is refreshed for every existing helper that will move or change.

## Files

- Create the planned modules listed in `plan.md` under `cowork-p2-kit/ingest/`.
- Add `pipeline.test.mjs` and focused unit tests beside the module test suite.
- Keep `cowork-p2-kit/store/` for generated data, schema, and operator documentation only.

## Execution contract

1. Introduce typed errors and ensure only `cli.mjs` maps them to exit codes.
2. Inject input, manifest, store, binary, and clock roots through configuration.
3. Replace shell command strings with `execFile`/`spawn` argument arrays.
4. Separate admission, parsing, record construction, table reconstruction, and publication.
5. Keep every production file below 200 lines unless the active plan records an approved exception.
6. Run G-03 and compare output against the Step 1 contract fixture.

## Stop conditions

- Stop on any contract snapshot change not explicitly approved.
- Stop if a library helper still calls `process.exit()` or reaches canonical roots directly.
- Do not start publication hardening until G-03 passes.
