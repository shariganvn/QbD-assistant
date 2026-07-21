---
title: "Step 2 spec-diff review — modular ingest pipeline"
date: 2026-07-21
baseline: d03cf4f
review_head: 21cf9f9
evidence_commit: 21cf9f9
behavior_commit: 8006568
verdict: reject-g-03
---

# Step 2 spec-diff review — G-03

## Verdict

**REJECT G-03.** The modular implementation preserves the tested happy-path output, but it does
not yet meet every frozen Step 2 acceptance clause. The child-CLI G-03 oracle launches
LibreOffice for a version probe, despite the explicit rule that no G-03 test may invoke
LibreOffice. The declared `buildRecords(admitted, adapter, config)` module boundary also differs
from the exported two-parameter function.

This is a review of Step 2 only. It does not declare Phase 2 complete, alter plan status, or pull
Step 3 hardening into this change.

## What this means to the Product Owner

The original promise is that an operator can run the normal ingest command against approved
product/trial source documents and receive a reproducible, citeable JSONL store. Each record must
say where its text came from, rejected/invalid inputs must be explicit, and no OCR is performed.
Step 2 was meant to make that same operating promise testable after breaking a 639-line script
into maintainable parts.

| Original operating promise | Observed Step 2 behaviour | Evidence and interpretation | Status |
|---|---|---|---|
| An operator runs the same default command: `npm run ingest`. | The script still targets `cowork-p2-kit/ingest/cli.mjs`; no-argument CLI creates the canonical configuration and runs the pipeline. | G-01 regression test passed in the fresh 14-test run; `package.json` target is asserted by `repository-boundary.test.mjs`. | PASS |
| Only approved public `.docx`/`.pdf` sources with a valid manifest enter the store. | Admission enumerates trial/reference inputs, rejects unsupported/symlink/escaping paths, and requires a public, citable manifest entry with an allowed language. | `admission.mjs`; typed admission/config tests passed. The full negative admission suite remains a Step 4 gate (G-07), so this is not a claim that every failure path is closed. | PASS for Step 2 scope |
| The same inputs produce stable, useful records: stable ID, relative source path, page/character offsets, quote and classification. | The 17-record fixture output is byte-identical to the reviewed expected JSONL; three frozen representative records also compare equal. | Fresh child-CLI test passed; SHA-256 is `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56`; G-02 contract tests also passed. | PASS |
| Parsing uses the approved local parser and does not run OCR. | The child process uses the absolute repo-local LiteParse binary and literal argument arrays. Missing `is-complex` is reported as unsupported rather than invented as an OCR result. No OCR command exists in the pipeline. | Fresh tests passed for argument arrays and available/unsupported/invalid capability states. | PASS |
| The checked fixture should be self-contained: four non-sensitive DOCX files, copied to temporary roots, without building inputs or invoking LibreOffice. | It copies four DOCX fixture inputs and runs a child CLI with an absolute JSON config. However that child configuration includes `/usr/bin/soffice`, and the pipeline executes `soffice --version`. | `pipeline.test.mjs:60-75` → `pipeline.mjs:51-53` → `probeBinary(...):29`. This violates the literal G-03 isolation promise even though it does not use LibreOffice to transform a document. | **BLOCK** |
| When expected ingest errors occur, the operator sees one clear coded error and a non-zero result. | CLI owns `IngestError` formatting and sets exit code 1; libraries have no `process.exit()`. | Fresh tests passed for config errors and the no-library-exit scan. A malformed schema is not yet proved to normalize to `E_RECORD_SCHEMA`; carry it into the Step 3 failure-path work. | PASS for tested Step 2 boundary; follow-up |

## Review scope and evidence method

| Item | Review basis |
|---|---|
| Frozen baseline | `d03cf4f` — repository boundary and record-contract freeze. |
| Behaviour implementation | `8006568` — introduces the modules, fixture, tests and G-03 attestation. |
| Evidence refresh | `21cf9f9` changes only test-verdict artifacts; it does not change ingest behaviour. |
| Excluded handoff commit | `ad81589` is excluded from behaviour review. |
| Fresh command | `npm run verify:ingest`, run on 2026-07-21: exit 0; 14 passed, 0 failed, 0 skipped. |
| Retained machine evidence | `artifacts/qbd-p2-ingest-completion/gates/G-03.json`: status `pass`, 14/14, timestamp 2026-07-21T13:14:22+07:00. The fresh run corroborates it but does not override this spec review. |
| Manual checks | Inspected source and tests, `git diff --check d03cf4f..21cf9f9` (clean), production line counts, fixture SHA-256, and baseline-to-head diff. GitNexus returned zero indexed execution flows; runtime gates are the usable flow evidence. |

The pre-existing untracked directory
`cowork-p2-kit/ingest/tests/tmp-happy-path-1784605897345/` was observed before verification. It
contains a copied fixture/configuration and was left untouched; it is not review evidence and must
not be committed.

## Frozen spec → implementation and test-evidence matrix

| Frozen Step 2 requirement | Observed implementation | Direct evidence | Result |
|---|---|---|---|
| Nine production module boundaries and named exports exist. | `errors`, `config`, `admission`, `liteparse-adapter`, `table-reconstruction`, `records`, `publication`, `pipeline`, and `cli` exist under tracked `ingest/`. | `git ls-tree -r 21cf9f9`; G-01 runtime inventory passed. | PASS, except `buildRecords` signature below |
| `IngestError` carries code/message/cause/details; libraries use it for expected failures. | `errors.mjs` exposes the specified fields and taxonomy; config/admission/adapter/pipeline use it. | Source inspection; typed error tests pass. | PASS for covered cases |
| `createConfig(overrides)` exposes absolute roots, binaries and injectable collaborators. | Roots and binaries pass `isAbsolute`; derived trial/reference/manifest/schema paths are joined from absolute roots. `clock`, `runProcess`, `fileOps`, `pidIsAlive`, `makeRunId` are programmatic overrides. | `config.mjs:89-118`; programmatic absolute-binary tests pass. | PASS |
| User JSON config contains only absolute path values; collaborators cannot be supplied by JSON. | CLI accepts only the documented path-key allowlist, rejects unknown/relative/non-object values. | `cli.mjs:21-90`; fresh config-negative tests pass. | PASS |
| `admitInputs(config)` returns deterministically sorted admitted files or a typed error. | Files are sorted by POSIX relative path after manifest and path checks. | `admission.mjs`; happy-path and malformed-manifest test pass. | PASS |
| Adapter uses an absolute configured binary with literal argument arrays, not shell commands. | `runProcess(litBinary, ["parse", ...])` and `runProcess(litBinary, ["is-complex", ...])`. | `liteparse-adapter.mjs`; fresh argument-array test passes. | PASS |
| `reconstructTable`, `verifyRoundTrips`, `publishRecords`, and `runIngest` have their required seams. | All named exports exist; pipeline composes admission → parse/build → round-trip → publication. | Source inspection and child-CLI oracle. | PASS |
| `buildRecords(admitted, adapter, config)` is the fixed public module interface. | Pipeline calls it with three arguments, but the export is declared `buildRecords(admitted, adapter)` and has no documented/config parameter. JavaScript silently ignores the third argument. | `pipeline.mjs:72`; `records.mjs:67-107`. No assertion guards this interface. | **BLOCK** |
| Only CLI maps typed errors to an exit; no library calls `process.exit()`. | `main` formats `IngestError` as `[code] message` and sets exit 1; library scan is clean. | `cli.mjs:97-116`; fresh no-library-exit test passes. | PASS |
| Default roots/behaviour and JSONL compatibility stay frozen. | 17 fixture records, final newline, expected checksum/version, deterministic sorting/IDs/offsets, and three representative records match. | Fresh child-CLI + G-02 tests; `expected.json`; fixture SHA-256 above. | PASS |
| Remove the 639-line compatibility monolith; every production module is at most 200 lines. | `legacy-ingest.mjs` is absent. Counts are 54–186 lines across nine modules. | Tree inspection; fresh limit test; retained G-03 line-count evidence. | PASS |
| Re-run G-01 and G-02 as regressions before G-03. | `verify:ingest` includes repository-boundary, record-contract and pipeline tests. | Fresh run: all 14 tests pass; G-01/G-02 are `pass` in `gates.yaml`. | PASS |
| G-03 copies four DOCX files to fresh roots; uses child CLI + absolute config + repo-local LiteParse; output is byte-identical. | All of these occur; fixture cleanup is in `finally`. | `pipeline.test.mjs:45-105`; fresh test pass. | PASS, subject to LibreOffice blocker |
| G-03 must not call `inputs:build` **or LibreOffice**. | No `inputs:build` call was found. LibreOffice is nevertheless launched for a version probe through the child pipeline. | `pipeline.test.mjs:65,71` and `pipeline.mjs:22-30,52`. | **BLOCK** |
| OCR is never executed; absent optional capability is explicit. | `is-complex` non-zero result becomes `{ status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" }`; parsing remains required. | Adapter/records source; fresh capability tests. | PASS |
| Step 3 work stays excluded: lock, unique temp, complete-schema and failure-path hardening. | Publication deliberately still uses a fixed temp path and partial schema check, and has no lock/failure/concurrency suite. | `publication.mjs` header; Step 3 plan and G-04/G-05/G-06 remain unverified. | PASS — correctly deferred, not an acceptance claim |

## Extra or unproven behaviour

| Item | Assessment | Required disposition |
|---|---|---|
| `runIngest` returns `recordCount` and `storePath` in addition to the frozen `{ records, storeHash, capabilities }`. | Extra, benign for the current CLI, but not explicitly justified by the fixed return contract. | Either document the additive return shape or remove the extras when correcting the G-03 blockers. |
| Publication has a fixed `records.jsonl.tmp` and only partial schema validation. | Deliberately incomplete, not a Step 2 regression: these are named Step 3 responsibilities. | Keep out of this correction except where a test seam is needed; close under G-04/G-05/G-06. |
| A malformed schema is not covered as a typed `E_RECORD_SCHEMA` failure. | Evidence gap against the broad typed-error promise; not needed to decide the two present blockers. | Add to Step 3 failure-path tests/implementation; ensure no raw `SyntaxError` reaches CLI. |

## Required correction before accepting G-03

1. Make the child happy-path route independent of LibreOffice: it must not spawn or probe
   `soffice`. Preserve real LiteParse parsing, the absolute JSON config and byte-for-byte oracle.
2. Declare the fixed boundary exactly as `buildRecords(admitted, adapter, config)` and add a focused
   contract assertion so later refactoring cannot silently drop it again.
3. Re-run `npm run verify:ingest`, refresh the machine-readable G-03 evidence, then repeat this
   spec-diff review. Do not begin Step 3 until the verdict is **ACCEPT G-03**.

## Non-blocking follow-ups carried forward

- Step 3 must prove store bytes survive all failed publication paths, use unique temp files and a
  single-writer lock, complete schema validation, cleanup and artifact logs (G-04/G-05/G-06).
- Step 4 must exercise the full negative/capability/determinism gate suite (G-07–G-10).
- The final Phase 2 closure still requires change-impact review and code-review closure (G-11/G-12).
