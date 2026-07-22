# Step 4 G-08 Contract Design — 2026-07-22

## Decision

The installed LiteParse CLI may emit a valid `is-complex --compact` JSON array and exit `1` when it
detects complex pages. A valid JSON array is therefore an available capability result regardless of
the process exit status. Exit status is retained as diagnostic evidence; it is not the capability
classification criterion.

| Process observation | Capability result |
|---|---|
| Valid JSON array, any exit status | `available` with the parsed results |
| No valid JSON array and process unavailable (`ENOENT` or exit `127`) | `unsupported`, `E_CAPABILITY_UNSUPPORTED` |
| No valid JSON array for every other completed, signalled, or timed-out invocation | `invalid`, `E_CAPABILITY_INVALID` |

`parse` remains required: a nonzero parse result is `E_PARSE` and prevents publication. G-08 must
not invoke, claim invocation of, or claim success of OCR.

## Evidence and review policy

The canonical retained evidence is version-controlled JSON at
`docs/reports/qbd-p2-ingest-completion/gates/G-01.json` through `G-10.json`. `artifacts/` remains a
gitignored local scratch location and is not release evidence. The single gate runner writes this
canonical location; G-10 reads it. Step 5 reviews every JSON file and records its conclusion in the
Step 5 code-review report.

Each evidence file has one schema, including gate and suite UUIDs, raw TAP/stdout/stderr, parsed TAP
counters, snapshots, duration, configured timeout, timeout flag, and termination signal. A timeout
is always evidence `status: "fail"`.

## Timing policy

- Per gate: 300,000 ms.
- Whole `verify:ingest` suite: 1,200,000 ms.
- The suite supplies each child through `INGEST_GATE_TIMEOUT_MS`, a base-10 positive safe integer no
  greater than 300,000 and equal to the smaller of remaining suite time and the per-gate limit.
- The gate runner always writes gate evidence after a child timeout. If the suite deadline expires before
  another child starts, `verify-ingest.mjs` writes canonical `suite.json` timeout evidence with that
  unstarted gate ID and stops.

## Mixed-file capability contract

G-08 covers the aggregate state emitted for multiple admitted files:

| Per-file outcomes | Required aggregate |
|---|---|
| All `unsupported` | `unsupported` |
| At least one `available`, no `invalid` | `available` |
| At least one `invalid` | `invalid` |

This formalizes the current `mergeCapability` behavior without changing it.

## Scope and acceptance

Implementation is limited to the agreed G-08 adapter semantics, its tests, the Step 4 suite/evidence
harness, package script and paired boundary assertion, then G-07–G-10 status updates after all gates
pass. The accepted TOCTOU follow-up remains out of scope and must not be represented as closed.

Success requires one ordered G-01–G-10 execution, schema-consistent retained evidence for every gate,
and a passing G-10 that verifies the current suite identity. The design does not approve a mock
adapter or parser binary for G-09.
