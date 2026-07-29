# Step 5 — Run integrated gates and close review

Step 5 proves the layer end to end, publishes the committed reference package, and closes the
workstream. It redefines no contract from Steps 1–4.

## Goal

`npm run verify:rationale` runs every gate in order, drives all three source branches from committed
decision package to published rationale, re-validates the on-disk result, and confirms the completed
P4 workstream is untouched.

## Suite runner

Create `cowork-p2-kit/rationale/tests/verify-rationale.mjs` and its isolated
`verify-rationale-contract.test.mjs`, adapted from
`cowork-p2-kit/reasoning/tests/verify-reasoning.mjs`. It must:

1. Generate one suite UUID and pass it to every wrapper invocation through `RATIONALE_SUITE_RUN_ID`.
2. Run G-RL-01, G-RL-02, G-RL-03, G-RL-04, then the e2e gate G-RL-05, in that order, stopping at the
   first failure.
3. Validate only the current `G-RL-01.json` through `G-RL-05.json` in
   `docs/reports/qbd-rationale-report-layer/gates/` for `status: pass`, canonical schema, and one
   shared suite UUID. `red/` and `step-close/` are immutable historical evidence and are excluded.
   Create local `gate-evidence-validator.mjs` and `verify-rationale-evidence.mjs`; do not import the
   P4 validators or couple their gate-ID patterns.

Add `"verify:rationale": "node cowork-p2-kit/rationale/tests/verify-rationale.mjs"` to `package.json`
**only after** the runner has a passing contract test, mirroring the P4 rule that a runner is tested
before it is scripted. The contract test injects `spawn`, evidence validation, and a short gate map to
prove declared order, first-failure stop, missing-test handling, suite-ID propagation, and post-suite
validation; G-RL-05 executes it alongside the e2e test.

## End-to-end fixture

`cowork-p2-kit/rationale/tests/e2e-rationale.test.mjs` drives each committed branch:

| Branch | Must prove |
|---|---|
| `selected` | Fact, gate, and sensitivity claims publish; `rationale.md` regenerates byte-identically; receipt matches every member |
| `inconclusive` | The FD-action explanation and the recorded missing/conflicting evidence are published; no winner and no recommendation appear; the label is `internal_only` |
| `attested` | The attestation ID and SHA-256 travel from the source package through the packet into the rationale header; removing `linear-attestation.json` from the source package prevents that packet from sealing |

Each branch runs the real command path through `createRationaleCli({ publicationRoot })` with an
injected temporary root; a separate production-root test proves `main()` rejects all other roots.

## Published reference package

Publish the `selected` branch into `docs/reports/qbd-rationale-report-layer/rationale/` and commit it.
This is the layer's inspectable reference output and the target of the on-disk re-validation
assertions. It is a **test-only** artifact: it comes from the test-approved rubric fixture and is not
an FD-approved decision or an approved explanation of one. `rationale.md` states the internal-only
label, and the step-close note records this qualification.

The test must leave the committed package byte-identical after every run. Negative cases and all
non-reference branches use injected temporary roots; only the selected reference package is committed
at the production root.

## Re-validation assertions

Over the committed package on disk:

- Recompute `sha256(canonicalBytes(rationale-packet.json))` and compare with
  `rationale.packet_sha256` and `rationale-receipt.packet_sha256`.
- Recompute each member hash and compare with its receipt entry.
- Re-run the full claim-binding validator against the published packet.
- Re-run `assertRegeneratedRationaleMarkdown()`.
- Compare `source_publication_receipt_sha256` with the matching `gates.yaml` source-package pin; a
  changed fixture fails unless `pins.source_package_repin_reason` is populated.
- Assert that a tampered member, a stale receipt, and a surplus file each fail closed.

## Upstream non-regression

- Run `npm run verify:reasoning` in an isolated clean temporary git worktree at the same commit; discard
  that worktree after collecting its passing result. In the active worktree, compare a pre-run hash set
  for `cowork-p2-kit/reasoning/` and `docs/reports/qbd-p4-reasoning-layer/` after the isolated run and
  assert byte identity.
- Record MCP `gitnexus_detect_changes()` output as review context.

## Documentation closure

- `docs/system-architecture.md` — add the rationale layer as a separate stage consuming a sealed
  packet after the reasoning core, stating that it explains a decision and never makes one, and that
  its output is internal only.
- `cowork-p2-kit/README.md` — describe the two skills and the two publication roots, and state that
  the rationale session is separate from the fact-card session.
- Write the closure report to
  `docs/reports/qbd-rationale-report-layer/from-implementer-to-po-rationale-layer-closure.md`:
  gate results, the deferred items still open, and the residual risks no gate closes.

## Closure checklist

- [ ] G-RL-01 through G-RL-05 pass with machine-produced evidence under one suite UUID.
- [ ] `gates/step-close/G-RL-0{1..5}.json` exist and are unedited copies.
- [ ] `gates.yaml` gate `status` values updated from `unverified` to `pass`.
- [ ] The committed reference package re-validates and is byte-identical after the run.
- [ ] Isolated `npm run verify:reasoning` passes; the active worktree's P4 boundary is byte-identical
      to its pre-run hash set.
- [ ] Architecture, README, and closure report updated.
- [ ] Step 5 row and the workstream `status` in `plan.md` set to `completed`.

## Risks

| Risk | Mitigation |
|---|---|
| The committed reference package is read as an FD-approved explanation | Header label, step-close qualification, and the closure report all state it is test-only |
| The e2e test mutates the committed package | Negative cases publish to temporary roots; the test asserts byte-identity of the committed package afterwards |
| Copying the P4 evidence validator drifts from the original | It is an intentional local copy with its own gate-ID pattern; both are covered by their own gates |
| Closing the workstream implies external display is available | The closure report repeats that external display and its FD-approval mechanism remain deferred |
