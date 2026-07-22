# Step 4 — Isolated Gate Suite

## Goal

Turn G-07 through G-10 into reproducible, machine-readable release evidence. This step adds tests,
fixtures, and the verification harness; it must not weaken ingest production behavior to make a test pass.

## Preconditions

- G-01 through G-06 are `pass` with readable evidence.
- `node_modules/.bin/lit` exists, is an absolute path, and `lit --version` exits 0 before G-09 runs.
- Every test creates its own root with `mkdtempSync(join(tmpdir(), ...))`, copies committed inputs into
  that root, and removes only that root in `finally`. Tests must never write below committed fixtures,
  `cowork-p2-kit/inputs/`, `cowork-p2-kit/store/`, `artifacts/`, or the canonical evidence directory.
- `docs/reports/qbd-p2-ingest-completion/gates/` is the version-controlled release-evidence directory.
  Only `run-gate.mjs` may write its canonical `<gate-id>.json` files. Test-owned detail snapshots live in
  a temporary root and are read and removed by the runner.

## Files

- Add `cowork-p2-kit/ingest/tests/admission-negative.test.mjs` and committed
  `cowork-p2-kit/ingest/tests/fixtures/admission/` inputs.
- Add `cowork-p2-kit/ingest/tests/capability-discovery.test.mjs`.
- Add `cowork-p2-kit/ingest/tests/determinism.integration.test.mjs`.
- Add `cowork-p2-kit/ingest/tests/complete-ingest-verification.test.mjs`.
- Add `cowork-p2-kit/ingest/tests/verify-ingest.mjs`.
- Add `cowork-p2-kit/ingest/tests/gate-evidence.contract.test.mjs` and the smallest shared
  evidence-validation helper needed to test runner-only parsing and schema logic without writing canonical
  evidence from a test.
- Update `cowork-p2-kit/ingest/tests/run-gate.mjs`,
  `cowork-p2-kit/ingest/tests/repository-boundary.test.mjs`,
  `cowork-p2-kit/ingest/tests/pipeline.test.mjs`, and `package.json`.
- Regenerate one schema of G-01 through G-10 evidence under
  `docs/reports/qbd-p2-ingest-completion/gates/` and version-control it for Step 5 review.

## Shared harness contract

`verify-ingest.mjs` is the sole implementation of `npm run verify:ingest`. It must create one UUID
`INGEST_SUITE_RUN_ID` and invoke `run-gate.mjs` in this fixed order: G-01 repository-boundary,
G-02 record-contract, G-03 pipeline, G-04 publication-failure, G-05 publication-concurrency, G-06
file-boundaries, G-07 admission-negative, G-08 capability-discovery, G-09 determinism-integration, and
G-10 complete-ingest-verification. It must pass that suite ID to every child, stop at the first nonzero
gate result, and return that result. The package script must be exactly
`node cowork-p2-kit/ingest/tests/verify-ingest.mjs`.

`run-gate.mjs <gate-id> <test-file>` is the only program allowed to write a gate evidence file. It must:

1. execute exactly `node --test <test-file>` from the repository root, with a unique temporary absolute
   `GATE_EVIDENCE_PATH` for optional per-case snapshots;
2. parse the Node TAP summary, rejecting a missing summary and recording `total`, `passed`, `failed`,
   `skipped`, `todo`, and `cancelled` as integers;
3. write `docs/reports/qbd-p2-ingest-completion/gates/<gate-id>.json` even when the child test fails;
4. set evidence `status` to `pass` only when the child exit code is 0, `failed`, `skipped`, `todo`, and
   `cancelled` are all 0, and `passed === total > 0`; otherwise set it to `fail`;
5. reject an absent or non-UUID `INGEST_SUITE_RUN_ID` and an absent or invalid
   `INGEST_GATE_TIMEOUT_MS`. The latter must be a base-10 positive safe integer no greater than `300000`;
   use it as the child-process timeout and write exactly these evidence fields:
   `gate_id`, `status`, `command`, `exit_code`, `raw_tap_output`, `raw_stderr`, `timestamp`, `run_id`,
   `suite_run_id`, `assertions_summary`, `snapshots`, `timeout_ms`, `duration_ms`, `timed_out`, and
   `signal`. `assertions_summary` contains exactly the six integer keys `total`, `passed`, `failed`,
   `skipped`, `todo`, and `cancelled`; `snapshots` is an array. `timed_out: true` always produces
   `status: "fail"`, even if the child process has no exit code.

`verify-ingest.mjs` must contain a literal ten-item gate-to-test-file mapping; it must not use a glob or
dynamic test discovery. `repository-boundary.test.mjs` must assert the exact package script and this
literal mapping, so deleting, reordering, or omitting a gate changes G-01 to fail. G-10 runs last.
The suite deadline is exactly `1_200_000` ms. Before each gate, `verify-ingest.mjs` calculates remaining
time and invokes `run-gate.mjs` with `INGEST_GATE_TIMEOUT_MS` set to the smaller of that remaining time
and `300000`. It must never invoke the runner when remaining time is zero or negative.

`verify-ingest.mjs` is the only writer of the non-gate suite manifest
`docs/reports/qbd-p2-ingest-completion/gates/suite.json`; this does not relax the rule that only
`run-gate.mjs` writes `<gate-id>.json`. The manifest fields are exactly `suite_run_id`, `status`,
`started_at`, `completed_at`, `timeout_ms`, `duration_ms`, `timed_out`, `next_gate_id`,
`completed_gate_ids`, `failed_gate_id`, and `exit_code`. `status` is one of `running`, `pass`, or `fail`.
`started_at` is an ISO timestamp; `completed_at` is `null` while running and an ISO timestamp when final;
`timeout_ms` and `duration_ms` are nonnegative safe integers; `timed_out` is boolean;
`completed_gate_ids` is the ordered, duplicate-free prefix of the literal mapping; `next_gate_id` and
`failed_gate_id` are `null` or a mapped gate ID; and `exit_code` is `null` while running, `0` for pass,
or a nonzero integer for fail.
At suite start, and immediately before each gate, it writes `running` with all prior successful gate IDs
in `completed_gate_ids` and the about-to-run ID in `next_gate_id`. After G-10 passes it overwrites it with
`pass`, all ten gate IDs in `completed_gate_ids`, `next_gate_id: null`, `failed_gate_id: null`, and
`exit_code: 0`; a write failure is a nonzero suite failure. On a gate failure or expired deadline it
overwrites it with `fail`. For deadline expiry before a gate starts, `timed_out` is `true`,
`next_gate_id` is that unstarted gate, `failed_gate_id` is `null`, and `exit_code` is `1`. This is the
timeout evidence even though no gate child was started. Step 5 reviewers inspect the retained G-01 through
G-10 JSON files and `suite.json`, not ignored `artifacts/` files.

## TDD execution order

1. Replace the existing `pipeline.test.mjs` nonzero-is-complex expectation, then add G-08 unit tests. The
   initial red test must use a valid JSON array with exit code `1` and require `isComplex()` to return
   `available`; add the unavailable, invalid, required-parse-failure, argument-array/no-OCR, and mixed-file
   aggregate cases in the same test file.
2. Change only `createLiteparseAdapter.isComplex()` until those adapter tests pass. Do not alter
   `records.mjs`: its existing aggregate rule is locked by the mixed-file tests.
3. Add the real-child G-08 test, requiring the committed DOCX precheck to emit a valid JSON array and
   exit `1`, then requiring CLI capability output `{ "isComplex": { "status": "available" } }`.
4. Add the gate-runner and literal suite mapping, then change the package script and its paired G-01
   boundary assertion together. Run every gate through the runner so G-01 through G-10 use the same
   evidence schema; do not translate or hand-edit legacy evidence.
5. Add G-07, G-09, and G-10 tests in their specified order. Only after a complete `npm run verify:ingest`
   pass may implementation update G-07 through G-10 to `pass`, then Step 4 from `pending` to
   `in-progress` and `completed` according to the canonical plan transition rule.

## Blocking review-remediation patch

The 2026-07-22 review found blocking contract gaps in the first Step 4 implementation. Until every item
in this section has a fresh passing test and regenerated evidence, G-07 through G-10 are `unverified` and
Step 4 is `in-progress`. This corrects an unsupported completion claim; it is not a normal execution-state
transition. Do not retain or publish a completion report that says all work is closed while this patch is open.

### Exact remediation contract

1. `createLiteparseAdapter.isComplex()` must return `{ status: "invalid", code:
   "E_CAPABILITY_INVALID" }` when trusted-input validation fails. It may return `unsupported` only when
   there is no valid JSON array and the process error is `ENOENT` or its exit status is `127`. Keep
   `records.mjs` unchanged.
2. `INGEST_GATE_TIMEOUT_MS` is valid only when its entire original string matches `/^[1-9][0-9]*$/`, its
   numeric value is a safe integer, and it is at most `300000`. Values such as `"123abc"`, decimal,
   signed, whitespace-padded, zero, and empty values must be rejected before a child starts.
3. `run-gate.mjs` must always create its own absolute detail path below a unique `mkdtempSync(join(tmpdir(),
   "ingest-gate-"))` directory. It must not accept an inherited `GATE_EVIDENCE_PATH` and must remove only
   that directory in `finally`. If the child left malformed snapshot JSON, the runner must still write the
   canonical gate evidence with `snapshots: []`, append a runner diagnostic to `raw_stderr`, and set
   `status: "fail"`; no extra evidence field is allowed.
4. The suite deadline is a hard wall-clock deadline. `verify-ingest.mjs` must not grant the runner an
   extra grace period beyond remaining suite time. If the runner itself is terminated at that deadline
   (`ETIMEDOUT` or timeout signal), it must write a final suite manifest with `status: "fail"`,
   `timed_out: true`, `failed_gate_id` equal to the in-progress gate, `next_gate_id: null`, and a nonzero
   `exit_code`. It must never write `timed_out: false` for that outcome. A deadline reached before a gate
   starts retains the existing `next_gate_id`/`failed_gate_id: null` contract.
5. Define one reusable, strict gate-evidence validator. For G-01 through G-09, G-10 must reject missing
   or extra top-level keys, a missing `raw_stderr`, a non-array `snapshots`, non-safe-integer timing values,
   invalid TAP-summary keys or values, a non-UUID ID, or any field with the wrong type. The suite runner
   must use the same validator on G-10's newly written evidence before it writes final `suite.json: pass`.
   G-10 must similarly validate the exact key set and types of its running suite manifest; the runner
   validates the final pass manifest before returning zero.
6. G-09 must parse `run1`'s JSONL with its `run1` adapter and `run2`'s JSONL with its `run2` adapter.
   The shared loop must carry the matching JSONL bytes rather than closing over `jsonl1`.
7. Every suite test, including G-03's existing happy-path test, must use a root from
   `mkdtempSync(join(tmpdir(), ...))` and clean only that root in `finally`; no test may create a directory
   below `cowork-p2-kit/ingest/tests/`.
8. Before the final suite run, add every new Step 4 test, fixture, harness, design report, and the prior
   canonical G-01 through G-10 evidence to the index. G-01 must assert those required paths are returned
   by `git ls-files`. After the suite regenerates evidence, stage the eleven refreshed JSON files before
   any completion claim. This is required so a fresh checkout has the tests and review evidence.
9. The journal and completion report must state that TOCTOU remains an accepted out-of-scope follow-up.
   Remove the claim that there is "No deferred work". They may state Step 4 is completed only after this
   patch's fresh evidence is staged and all acceptance checks below pass.

### TDD and validation order for the patch

1. Add red G-08 coverage for trusted-input failure returning `invalid`, then change only
   `isComplex()` and keep valid JSON with exit `1` available.
2. Add red unit coverage in `gate-evidence.contract.test.mjs` for every invalid timeout spelling,
   malformed snapshots, exact gate-evidence keys/types, and the timeout-failure evidence outcome. Extract
   only pure validation/normalization logic necessary to test those cases; the test must not write below
   `docs/reports/`.
3. Add deterministic injected-clock/child-result coverage for the suite helper: a deadline before a gate,
   a runner timeout while a gate is in progress, and the final G-10 evidence validation. The tests must
   prove no child receives more than the remaining suite budget and no `+30000` allowance exists.
4. Tighten G-10 using that validator, correct G-09's per-run JSONL binding, and migrate G-03's temporary
   root to the OS temp directory. Add the G-01 tracked-path assertion before staging the new files.
5. Run focused red-to-green tests, stage the required files, run `npm run verify:ingest` once, inspect all
   eleven JSON files with the strict validator, then stage the regenerated evidence. Only then restore
   G-07 through G-10 to `pass`, set Step 4 to `completed`, and correct the report/journal wording.

## G-07 — Fail-closed admission

`admission-negative.test.mjs` must execute the real `cli.mjs` as a child process once per case. For each
case it must copy the committed admission fixture into a new temporary root, seed the temporary store
with a valid `records.schema.json` and a known prior `records.jsonl`, hash every file in that store before
and after the child process, and assert byte-for-byte equality.

The exact cases and expected stderr codes are:

| Case | Temporary-fixture mutation | Required child result |
|---|---|---|
| `unsupported-extension` | Add one `.txt` file under an enumerated input directory. | nonzero; `[E_INPUT_UNSUPPORTED]` |
| `manifest-entry-missing` | Keep a supported input file but remove only its manifest entry. | nonzero; `[E_MANIFEST_ENTRY_MISSING]` |
| `non-public-label` | Set the input's manifest `label` to `internal`. | nonzero; `[E_NOT_PUBLIC]` |
| `invalid-manifest-metadata` | Set `citable` to a non-boolean while retaining the supported input and `public` label. | nonzero; `[E_MANIFEST_INVALID]` |
| `dependency-unavailable` | Set `litBinary` in the absolute child config to a nonexistent absolute pathname. | nonzero; `[E_DEPENDENCY_UNAVAILABLE]` |
| `schema-invariant-failure` | Use a syntactically valid temporary store schema that requires a property never emitted by records. | nonzero; `[E_RECORD_SCHEMA]` |

For the four admission cases and the schema case, the config must use the real absolute repo-local
LiteParse binary; `process.execPath` for both `sofficeBinary` and `ghostscriptBinary`; and a new temporary
`tessdataRoot` containing empty `eng.traineddata` and `vie.traineddata` files. The dependency-unavailable
case may fail before LiteParse invocation. The test must also hash all committed fixture files before the
first case and after the final case, then assert those maps are equal.
When `GATE_EVIDENCE_PATH` is set, append `{ case, before, after, exit_code, stderr_code }` for every
case to its JSON array.

## G-08 — Capability discovery

`capability-discovery.test.mjs` has two required layers:

1. Unit-test `createLiteparseAdapter` using an injected `runProcess` recorder. A valid `is-complex` JSON
   array returns `{ status: "available", results }` whether its exit code is `0` or `1`. Without a valid
   array, only a process `ENOENT` error or exit `127` returns
   `{ status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" }`; status `0` malformed output, every
   other nonzero result, a signal, a timeout, or an input-path trust-validation failure returns
   `{ status: "invalid", code: "E_CAPABILITY_INVALID" }`. A nonzero required `parse` returns `E_PARSE`.
   The recorder must prove that every invocation is an argument array and that no invoked subcommand
   contains `ocr`.
   In the same G-08 test file, call `buildRecords` with multiple admitted files and prove the fixed
   aggregate rule: all unsupported stays unsupported; available plus unsupported is available; any invalid
   is invalid.
2. Run the real child CLI against copied happy-path inputs with the absolute repo-local LiteParse binary.
   First execute `<litBinary> is-complex <one copied DOCX> --compact`; this precheck must emit a valid JSON
   array and exit `1` for the committed `product-profile.docx` fixture.
   Its absolute child config must set both non-LiteParse binary paths to `process.execPath` and use a
   temporary `tessdataRoot` containing empty `eng.traineddata` and `vie.traineddata` files. Then assert
   the child CLI exits 0 and its stdout contains the exact JSON capability state
   `"isComplex":{"status":"available"}`. Append the precheck and child stdout, stderr, exit code, and
   parsed JSON result to the temporary G-08 snapshot so the runner retains it in canonical evidence.

This gate must not claim OCR ran or OCR succeeded. An unavailable optional capability is a successful
ingest with explicit `unsupported`; a valid complex-page result is `available`, and a required parse
failure is a failed ingest with no publication.

## G-09 — Determinism with real LiteParse

`determinism.integration.test.mjs` must run the full child CLI twice, once in each independently created
temporary root. Each root receives a recursive copy of
`tests/fixtures/happy-path/inputs/`, a copy of the committed `records.schema.json`, and an absolute JSON
config. Both configs must set `litBinary` to the resolved repository path
`node_modules/.bin/lit`; they must not inject `runProcess`, an adapter, a parser response, or a mock
binary. Each config must set both non-LiteParse binary paths to `process.execPath` and give `tessdataRoot`
its own temporary directory containing empty `eng.traineddata` and `vie.traineddata` files. The test must
precheck `lit --version` successfully.

For both runs, require exit code 0, a non-empty `records.jsonl`, and successful `validateJsonl` against
the copied schema. Compute SHA-256 from the raw bytes of each `records.jsonl` and require equality. Parse
every non-empty record and run `verifyRoundTrips` with a real adapter configured for that root; require
`failed === 0` and `verified > 0`. Finally, compare hashes of every committed happy-path fixture file from
before and after the test. The test must delete only its two temporary roots in `finally`.

## G-10 — Complete verification

`complete-ingest-verification.test.mjs` runs only after G-01 through G-09 have completed. It must read
their nine evidence files from `docs/reports/qbd-p2-ingest-completion/gates/` and assert all of the following for each file: `gate_id` matches its filename,
`status === "pass"`, `exit_code === 0`, the TAP summary has `total > 0`, `passed === total`, and
`failed === skipped === todo === cancelled === 0`. It must also assert every evidence file contains a
non-empty raw TAP output, raw command array, ISO timestamp, gate UUID run ID, and a `suite_run_id` equal
to `process.env.INGEST_SUITE_RUN_ID`, plus integer `timeout_ms`/`duration_ms`, boolean `timed_out === false`,
and a null or string `signal`. Missing, malformed, failed, timed-out, or a prior-suite evidence file is a
G-10 test failure. While G-10 runs, it must also assert that `suite.json` is `running` for the current
suite ID, has `completed_gate_ids` exactly G-01 through G-09, `next_gate_id === "G-10"`,
`failed_gate_id === null`, `timed_out === false`, and `exit_code === null`. Only after G-10 exits zero may
`verify-ingest.mjs` replace that manifest with its final `pass` state. The G-10 evidence is then created
by its own `run-gate.mjs` invocation.

## Stop conditions

- A mock adapter, injected `runProcess`, or mock parser binary cannot satisfy G-09.
- G-07 and G-09 may not write canonical input, store, fixture, or canonical evidence data; a hash mismatch is a
  blocking failure.
- A missing TAP summary, skipped/todo/cancelled test, absent evidence field, or nonzero child exit is not
  a pass and cannot be papered over by manually editing evidence.
- No gate may be weakened, marked optional, or deferred merely because implementation fails it.
- Do not begin Step 5 closure review until G-10 passes.
- The accepted TOCTOU hardening follow-up remains out of scope; no Step 4 test or evidence may claim it is
  resolved.
