# Step 2 — Modularize Ingest Pipeline

## Goal

Split the monolith at real boundaries while preserving the frozen contract and default CLI behavior.

## Preconditions

- G-01 and G-02 pass with retained evidence.
- GitNexus impact is refreshed for every existing helper that will move or change.

## Files

- Create the planned modules listed in `plan.md` under `cowork-p2-kit/ingest/`, including
  `pipeline.mjs` as the only library orchestration entry point.
- Remove `cowork-p2-kit/ingest/legacy-ingest.mjs` in the same change. It is a 639-line
  compatibility bridge, not an approved exception to the 200-line production-file limit.
- Update `cli.mjs`, `repository-boundary.test.mjs`, `record-contract.test.mjs`,
  `cowork-p2-kit/README.md`, and `cowork-p2-kit/store/README.md` to remove the legacy bridge and
  describe the modular command.
- Add `pipeline.test.mjs`, focused unit tests, and the committed happy-path fixture below.
- Keep `cowork-p2-kit/store/` for generated data, schema, and operator documentation only.

## Fixed module interfaces

The implementation must export these named entry points. Internal helpers may remain unexported.
Every production module is measured with `wc -l`, including comments and blank lines, and must be
at most 200 lines.

| Module | Required export and contract |
|---|---|
| `errors.mjs` | `IngestError`, carrying `{ code, message, cause, details }`; it is the only error type thrown for expected ingest failures. |
| `config.mjs` | `createConfig(overrides)`, returning absolute resolved paths and injected collaborators. Defaults preserve the current kit roots; tests may override them. |
| `admission.mjs` | `admitInputs(config)`, returning admitted files sorted by POSIX relative path or throwing an `IngestError`. |
| `liteparse-adapter.mjs` | `createLiteparseAdapter(config)`, whose methods invoke the configured absolute binary through literal argument arrays. |
| `table-reconstruction.mjs` | `reconstructTable(textItems, segment)`, retaining the current best-effort result for the frozen fixture. |
| `records.mjs` | `buildRecords(admitted, adapter, config)` and `verifyRoundTrips(records, adapter, config)`. |
| `publication.mjs` | `publishRecords(records, config)`, supplying the Step 2 happy-path publication seam only. Step 3 owns lock, unique-temp, complete-schema, and failure-path hardening. |
| `pipeline.mjs` | `runIngest(config)`, composing the preceding modules and returning `{ records, storeHash, capabilities }` on success. |
| `cli.mjs` | `main(argv)`, the only code that renders an `IngestError` and maps it to an exit code. |

`createConfig` must expose `inputsRoot`, `trialsRoot`, `referenceRoot`, `manifestPath`, `storeRoot`,
`schemaPath`, `artifactRoot`, `litBinary`, `sofficeBinary`, `ghostscriptBinary`, `tessdataRoot`,
`clock`, `runProcess`, `fileOps`, `pidIsAlive`, and `makeRunId`. Path values are absolute after
resolution. The function collaborators are injectable only through the programmatic API; they are
not loaded from user-supplied modules.

Expected error codes are `E_CONFIG`, `E_PATH_ESCAPE`, `E_SYMLINK`, `E_DUPLICATE_PATH`,
`E_INPUT_UNSUPPORTED`, `E_INPUT_EMPTY`, `E_MANIFEST_MISSING`, `E_MANIFEST_ENTRY_MISSING`,
`E_MANIFEST_INVALID`, `E_NOT_PUBLIC`, `E_DEPENDENCY_UNAVAILABLE`, `E_PARSE`,
`E_CAPABILITY_INVALID`, `E_RECORD_SCHEMA`, `E_ROUND_TRIP`, `E_EMPTY_STORE`,
`E_PUBLICATION_LOCKED`, and `E_PUBLICATION_FAILED`. An absent optional `is-complex` capability is
reported in `capabilities` as `{ status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" }`; it
does not fabricate OCR eligibility or make a required `parse` operation succeed.

## Default and child-CLI contract

- `npm run ingest` invokes `cli.mjs` with no arguments and preserves the current canonical roots,
  supported extensions (`.docx`, `.pdf`), manifest checks, prerequisite probes, stable record sort,
  deterministic ID basis, page-offset basis, segmentation, table reconstruction, and JSONL trailing
  newline.
- OCR is never executed. The existing low-confidence rule remains based on parsed page text below
  50 characters; absent `is-complex` is explicit capability status, not an empty successful result.
- The CLI accepts exactly one optional test/configuration form:
  `node cowork-p2-kit/ingest/cli.mjs --config <absolute-config.json>`. Unknown arguments and a
  relative or malformed config path throw `E_CONFIG`. The JSON contains only absolute path values;
  programmatic seams remain unavailable through this file.
- A successful CLI exits `0`. Every `IngestError` is rendered once to stderr as
  `[<code>] <message>` and exits `1`. No library calls `process.exit()`.

## Happy-path fixture and G-03 oracle

Commit this reviewed, non-sensitive fixture set before G-03:

```text
cowork-p2-kit/ingest/tests/fixtures/happy-path/
  inputs/product-profile.docx
  inputs/trials/formulation-trial-01.docx
  inputs/trials/formulation-trial-02.docx
  inputs/trials/formulation-trial-03.docx
  classification-manifest.json
  records.schema.json
  expected-records.jsonl
  expected.json
```

`expected.json` contains exactly `record_count`, `sha256`, and `liteparse_version`; `sha256` is the
SHA-256 of the UTF-8 bytes of `expected-records.jsonl`, including its final newline. The reviewed
fixture output must contain 17 records and include the exact representative records frozen in
`tests/fixtures/contract/records.jsonl`. It is generated and reviewed before commit, but no G-03
test may invoke `inputs:build` or LibreOffice.

`pipeline.test.mjs` copies this fixture to fresh temporary roots, writes an absolute JSON config,
and starts a child Node process using `cli.mjs --config <path>`. It uses the repo-local absolute
LiteParse binary, asserts child exit `0`, compares the produced `records.jsonl` byte-for-byte with
`expected-records.jsonl`, verifies `expected.json`, and confirms the three frozen representative
records remain byte-identical. Unit tests may use injected adapters only for isolated behavior;
they are not the G-03 happy-path oracle.

## Execution contract

1. Run G-01 and G-02 from their retained Step 1 evidence as the baseline precondition. Do not edit
   the frozen record fixture or schema.
2. Implement the fixed interfaces, move behavior out of the monolith, replace shell strings with
   argument-array process execution, and delete the monolith before compatibility testing.
3. Update the G-01 runtime-module inventory and the G-02 CLI test to exercise the modular CLI;
   rerun G-01 and G-02 as regression checks. Both must pass before G-03 begins.
4. Add the reviewed fixture and execute G-03 through the child CLI. G-03 passes only with the exact
   fixture byte comparison and its machine-readable evidence.
5. Stop for a spec-diff review: compare the changed source, test oracle, and record bytes with this
   Step 2 contract. Step 3 may start only after that review accepts G-03.

## Stop conditions

- Stop on any contract snapshot change not explicitly approved.
- Stop if a library helper still calls `process.exit()` or reaches canonical roots directly.
- Stop if `legacy-ingest.mjs` remains, a production file exceeds 200 lines, the child CLI uses
  canonical test data, or the fixture expected output differs from its checksum.
- Do not start publication hardening until G-03 passes.
