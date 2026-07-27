# Step 1E — Evidence-log v2 contract delta

This is a narrow TDD checkpoint between completed Step 1R and pending Step 2. It implements
`D20260727` and reruns G-P4-01 before any Step 2 behavior edit.

## Goal

Publish one exact-key evidence-log v2 that retains page-level provenance, admitted-but-uncited
records, and named exclusions, and prove that Step 2 output can pass the same validator and CLI used
for publication.

## Assumptions and boundaries

- Evidence log is the sole exclusion ledger; the cohort artifact does not duplicate exclusions.
- v1 is historical and rejected; no compatibility reader/writer is added.
- Existing `E_EVIDENCE_LOG_ENVELOPE` and `E_REASONING_ARTIFACT_BINDING` cover all failures.
- The shared `version()` helper, `cohort.schema.json`, `errors.mjs`, `publication.mjs`, gate runner,
  `package.json`, Step 0 store fixture, and store pin remain byte-identical unless a failing test proves
  an unavoidable incompatibility. Any such incompatibility requires a plan delta before editing.
- Step 2 implementation remains untouched until the revised G-P4-01 passes and its evidence is
  snapshotted.

### Offset-authority correction — 2026-07-27

Layer A persists page-global provenance coordinates and proves their page-text slice. Layer B must
copy and compare the persisted `{file,page,char_start,char_end,quote}` values exactly; it must not
slice segment-local `record.content` with those coordinates. This correction leaves Layer A, the
Step 0 fixture and pin, evidence-log v2 shape/version, `validateEvidenceLog()`, and fact-card local
offset validation unchanged. Reopen G-P4-01 only for this correction; do not evaluate G-P4-02 here.

## Files to touch

| Path | Planned change |
|---|---|
| `cowork-p2-kit/reasoning/evidence-log.schema.json` | Exact version-2 envelope, record entries, page provenance, named exclusions |
| `cowork-p2-kit/reasoning/contracts.mjs` | Mirror the schema and validate deterministic/store/fact-card bindings without changing `version()` |
| `cowork-p2-kit/reasoning/cli.mjs` | Bind evidence-log cohort ID and contents to cohort, fact cards, and store before publication |
| `cowork-p2-kit/reasoning/tests/fixtures/contract/{valid-evidence-log-v2,v1-evidence-log}.json` | Positive v2 and rejected historical v1 fixtures |
| `cowork-p2-kit/reasoning/tests/{contract,output-preservation}.test.mjs` | Contract parity, malformed input, CLI binding, and byte-preservation cases |
| `docs/reports/qbd-p4-reasoning-layer/gates/{red,history,step-close}/` | Machine evidence; preserve the pre-v2 pass before replacing current G-P4-01 evidence |
| `cowork-p2-kit/reasoning/{cohort-evidence.mjs,tests/cohort-evidence.test.mjs}` | Step 2 only, after G-P4-01: emit/validate the canonical v2 artifact instead of a private shape |

`cowork-p2-kit/reasoning/cohort-evidence.mjs` is currently untracked. Preserve its historical
fixture/mock status and review its full diff before editing or staging it.

## Ordered execution

1. Re-run GitNexus impact for `validateEvidenceLog`, `createReasoningCli`, and
   `buildCohortEvidence`; report any HIGH/CRITICAL result before editing.
2. Preserve the 2026-07-26 pre-v2 G-P4-01 snapshot under `gates/history/`; do not relabel it as a v2
   pass.
3. Add failing G-P4-01 tests first for: rejected v1; missing/extra/wrong-type fields; missing page;
   invalid offsets; unsorted/duplicate fact-card IDs; malformed exclusion scope/nullable record ID;
   invalid `E_` reason; cohort-ID mismatch; store/provenance/quote mismatch; unknown fact-card binding;
   and failed-publication byte preservation. Retain machine-produced red evidence.
4. Implement the smallest schema/runtime delta. Keep JSON Schema and `validateEvidenceLog()` exact-key
   behavior in parity. Require deterministic entry/exclusion ordering and exact store/fact-card
   bindings.
5. Through `createReasoningCli()`, prove a valid v2 artifact publishes canonically and every invalid
   binding fails before the first write with all prior output bytes preserved.
6. Run G-P4-01 through the existing wrapper, then the shared Layer A/C smoke. Replace latest and
   step-close G-P4-01 evidence only after the focused gate is green; mark Step 1E completed in the
   ordered table.
7. Handoff to Step 2, without evaluating it here: revise its fixtures/builder for FD-selected package
   policy and v2 attestation scope, build `entries` per admitted record, map zero-or-more fact-card
   IDs, emit named exclusions, and pass the returned artifact through `validateEvidenceLog()`.
8. Step 2 owns the later G-P4-02 CLI integration case, its run/snapshot, and the resulting Step 3
   blocker. Those actions are explicitly out of scope for this Step 1E closure.

## Validation checkpoints

- G-P4-01:
  `node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-01 cowork-p2-kit/reasoning/tests/contract.test.mjs cowork-p2-kit/reasoning/tests/output-preservation.test.mjs cowork-p2-kit/reasoning/tests/run-gate-contract.test.mjs`
- Deferred to Step 2: G-P4-02 runs only after its v2 builder/fixture revision is separately approved.
- Shared regression: the existing Layer A/C smoke named by the canonical test plan.
- Pre-commit: `gitnexus_detect_changes(scope: "staged")`; expected reasoning-contract and cohort
  flows only.

## Risks and stop conditions

- GitNexus currently reports LOW impact for both target functions but misses the visible CLI call to
  `validateEvidenceLog`; source-level CLI integration is mandatory.
- Entry semantics change from singular `fact_card_id` to record-level `fact_card_ids`. If any current
  consumer outside the repository requires v1 rows, stop and choose an explicit migration policy.
- If cohort exclusions are reintroduced, duplicated, or required by another consumer, stop: that is a
  separate cohort-contract decision, not part of this evidence-log-only delta.
- Do not stage unrelated ingest, workflow, or existing P4 worktree changes with this delta.

Status: **completed**. The offset-authority correction passed G-P4-01 at 48/48 and the shared Layer
A/C smoke on 2026-07-27. The 47/47 v2 result remains historical; G-P4-02 was not evaluated here.
