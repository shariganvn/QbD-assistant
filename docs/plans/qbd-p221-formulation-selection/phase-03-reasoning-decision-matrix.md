---
phase: 3
title: "Proposal diagnostics, inconclusive fd_decision and watermarked CT03 engineering proposal"
status: completed
priority: P1
effort: "1-2d"
dependencies: [1, 2]
---

# Phase 3: Proposal diagnostics, inconclusive fd_decision and watermarked CT03 engineering proposal

## Context links

- Gate: `gates.yaml` → G-03.
- Inputs: Phase 1 data package and Phase 2 v3 rubric/compile receipt.
- Existing publication boundary: `cowork-p2-kit/reasoning/publication.mjs`.

## Overview

Build one production-shaped runner that publishes three separate artifacts: a raw
evidence diagnostic, an inconclusive `fd_decision`, and — as its own object — an
`engineering_proposal` that names CT03 as the sole survivor under the proposed
(NOT FD-approved) rule. The three are never merged: `fd_decision` stays
inconclusive/`winner:null`, and the proposal is explicitly `fd_approved:false`.

## Requirements

### Evidence diagnostic (raw, non-decisional)

- Build `formula-evidence-diagnostic.json` before calling the engine.
- Diagnostic contains all three candidate IDs, raw observed measures, extracted
  specs, composition context, provenance/missing states and package hashes.
- Diagnostic carries fixed fields:
  `artifact_kind=non-decisional-evidence-diagnostic`,
  `decision_status=not-evaluated`, `winner=null`.
- Do not include `eligible`, `passed`, scores, sensitivity leader or a winner.

### fd_decision (fail-closed)

- Call the v3 evaluator with the proposal rubric while the fd-confirm flag is
  unset; `fd_decision` must be `inconclusive`, `winner:null`,
  `fd_action:E_RUBRIC_APPROVAL_REQUIRED`.
- `fd_decision` and the engineering proposal are published as distinct objects
  and never merged into one selected/winner statement.

### engineering_proposal object

- Compute the proposed-rule outcome (dissolution min-gate + mean-score, strict
  CU<15, assay 90–110) over the exact three-candidate cohort and emit a separate
  `engineering_proposal` object with fixed fields:

```json
{
  "artifact_kind": "engineering-proposal-not-fd-approved",
  "proposed_survivor": "formula-03",
  "conditional_on": "proposed rule (dissolution min-gate + mean-score, strict CU<15), NOT FD-approved",
  "fd_approved": false
}
```

- The object may state which candidates the proposed rule filters out, but must
  not use `winner`, `selected`, `decision`, `eligible/ineligible` or
  `recommendation` language — those words belong only to a real FD decision.
- Exact three-candidate, inventory and binding guards run before the proposed-rule
  computation; a partial cohort yields no proposed survivor.
- Publish diagnostic, inconclusive `fd_decision`, empty selection evaluation,
  `engineering_proposal`, data package, compile receipt and store/source hashes
  plus the complete template field map/filled-template receipt atomically in one
  receipt.

## Architecture

```text
validated real-data package + v3 proposal rubric (fd-confirm flag UNSET)
  -> raw non-decisional diagnostic
  -> evaluateSelectionV3 -> inconclusive fd_decision + empty evaluation
  -> proposed-rule computation over exact cohort
       -> engineering_proposal { proposed_survivor: CT03, fd_approved: false }
  -> one atomic review publication receipt binding all artifacts
```

## Related code files

- Create: `cowork-p2-kit/workflow-trial/formulation-selection-run.mjs` — emits
  diagnostic, inconclusive fd_decision and engineering_proposal; no caller
  approval flag.
- Create: `cowork-p2-kit/workflow-trial/formula-evidence-diagnostic.mjs`.
- Create: `cowork-p2-kit/workflow-trial/contracts/formula-evidence-diagnostic.schema.v1.json`.
- Create: `cowork-p2-kit/workflow-trial/contracts/engineering-proposal.schema.v1.json`.
- Create: `cowork-p2-kit/workflow-trial/tests/formulation-selection-decision.test.mjs`.
- Modify: `cowork-p2-kit/reasoning/publication.mjs` and receipt contracts to
  require source/data/compile/diagnostic/proposal artifact hashes.
- Read/reuse: `cowork-p2-kit/workflow-trial/content-demo-run.mjs` orchestration
  shape only; do not import synthetic candidates.

## Implementation steps

1. Write failing tests showing the selection evaluation is empty and cannot
   satisfy any winner/eligibility claim while the fd-confirm flag is unset.
2. Implement non-decisional diagnostic schema/builder from validated Phase 1
   evidence; prohibit decision fields beyond fixed null/not-evaluated values.
3. Implement the runner with no approval-state or pin CLI arguments; assert
   `fd_decision` is inconclusive.
4. Implement the engineering_proposal schema/builder: exact-cohort guard first,
   then the proposed-rule computation naming CT03 with `fd_approved:false`.
5. Assert the proposal names CT03 only from exact three-candidate real-mock
   evidence, and that a partial cohort yields no proposed survivor.
6. Assert the proposal object rejects `winner`/`selected`/`decision`/`eligible`/
   `recommendation` language.
7. Publish diagnostic, fd_decision, proposal and hashes via one atomic receipt;
   add cross-run and artifact-substitution negatives.

## Success criteria

- [x] G-03 passes.
- [x] Evidence diagnostic has all evidence but no pass/fail/eligibility/winner.
- [x] `fd_decision` is valid inconclusive with empty selection evaluation.
- [x] `engineering_proposal` names CT03 with `fd_approved:false`, derived only
  from exact three-candidate real-mock evidence.
- [x] The proposal object contains no winner/selected/decision/recommendation token.
- [x] Omitted formula, omitted record, role downgrade and cross-run substitution
  fail with specific codes, and a partial cohort yields no proposed survivor.
- [x] `fd_decision` and `engineering_proposal` are separate objects in the receipt.
- [x] The official template map and all 146 filled values are sealed into the
  same publication receipt.

## Risk assessment

- Consumers may confuse the diagnostic or proposal with a decision → separate
  schemas/names, fixed `not-evaluated`/null fields on the diagnostic and
  `fd_approved:false` plus banned-token checks on the proposal.
- The proposal naming CT03 may be read as an FD winner → mandatory
  `fd_approved:false`, banned decision language, and the watermark added in
  Phase 4.
- Atomic publication extension may regress prior receipts → version additive
  receipt schema and run existing reasoning publication tests.

## Security considerations

- No caller-controlled authorization state; only the fd-confirm flag can move
  `fd_decision` past inconclusive.
- Receipt hashes must bind artifacts from one run and one source/store.
- Diagnostic and proposal source text remain untrusted and non-citable.
