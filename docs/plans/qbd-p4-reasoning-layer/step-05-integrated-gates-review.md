# Step 5 — Run integrated gates and close review

Introduce `npm run verify:reasoning` as the ordered suite plus evidence validator, following the
`render/tests/verify-render.mjs` precedent: a declared gate-to-test map executed in order, stopping
at the first failure, then validation of every retained gate evidence record for status pass,
canonical schema, and one shared suite UUID. This script belongs to G-P4-05 only; G-P4-01 through
G-P4-04 each run their own test file through the Step 1 `run-gate.mjs` wrapper.

G-P4-05 is not exempt from that rule. Its e2e and consistency assertions are owned by
`cowork-p2-kit/reasoning/tests/e2e-decision.test.mjs`, which also runs through the wrapper, so
`G-P4-05.json` is machine-produced rather than self-referential or hand-authored. The suite validator
then checks evidence records 01 through 05.

## Re-validate published artifacts, do not trust them

An agent with filesystem write access can skip `cli.mjs` entirely and write a forged, internally
consistent artifact set. So `verify:reasoning` re-runs `cli.mjs` validation over the **actual published
fixture artifacts** against the Step 0 committed store snapshot: quote containment, char-offset
equality, admissibility, candidate map, applied rubric hash, and input-store hash. Publication emits a
validation receipt (input-store and artifact SHA-256 values plus run ID); a missing or mismatched hash
fails closed and also exposes partial publication.

The committed snapshot SHA-256 must equal `pins.store_records_sha256` and the value in G-P4-01
evidence. A changed baseline fails unless `pins.store_records_repin_reason` is populated. Runtime
validation applies the same receipt rule to its explicitly supplied admitted store; no gate depends on
a gitignored live store or a fresh ingest.

## Evidence lifecycle

`docs/reports/qbd-p4-reasoning-layer/gates/` is the "latest" path and is overwritten by every run,
including solo runs that mint their own suite UUID. So on step completion, snapshot that gate's
evidence to `gates/step-close/G-P4-0N.json`; the snapshot is what the step is closed against, and a
later run cannot destroy the artifact a completed step points to. TDD red results live under
`gates/red/G-P4-0N-<date>.json`.

## Change review

After G-P4-05 passes, the closure review runs `git diff --name-only <base>` against the plan's
touchpoint table and records the raw diff plus MCP `gitnexus_detect_changes()` output in
`docs/reports/qbd-p4-reasoning-layer/code-review.md`. These are repository-scope review checks, not
runtime assertions inside `npm run verify:reasoning`.
`CLAUDE.md` and `AGENTS.md` are pre-declared expected diffs whenever `npx gitnexus analyze` runs,
since analyze rewrites them.

Confirm both end-to-end policy branches: without a complete attestation, the 5 mg fixture ranks only
F-01 against F-02 with F-03 recorded as a separate cohort; with matching test-only rubric and
attestation pins, the exact attested F-01/F-02/F-03 set forms one cohort and receives one common
ranking whose decision/Markdown names and hashes the attestation. Also confirm that a selected
internal fixture is not rejected for classification/citable/document-control metadata, while quote,
candidate, extraction-quality, missing-measure, and conflict controls still fail closed.

Confirm `formula-decision.md` regenerates byte-identically from the published
`formula-decision.json` plus hash-bound `selection-evaluation.json`, and that
`evidence-log.md` regenerates byte-identically from `evidence-log.json`. Confirm the published
allowlist is exact and every receipt hash, including the nullable attestation member, agrees with
the on-disk package. Confirm the Step 4 documentation corrections are in place. Confirm no Layer
A/C contract, provider-routing, external egress, or general document-control workflow was changed.

Gate: G-P4-05, run as `npm run verify:reasoning`. Depends on G-P4-04.

<!-- Updated: Validation Session 1 - verify:reasoning scoped to this gate, doc-correction confirmation added -->
<!-- Updated: Red Team Session 2026-07-24 - e2e test file owns G-P4-05 evidence, published-artifact re-validation + receipt, evidence lifecycle, git-diff oracle -->
