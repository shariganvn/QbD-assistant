# Step 5 — Review Closure and Handoff

## Goal

Close Phase 3 only from current evidence and leave canonical workflow routing ready for the next workstream.

## Preconditions

- G-P3-01 through G-P3-05 are `pass` with readable retained evidence.

## Exact review inputs

- `docs/plans/qbd-p3-render-layer/{plan.md,gates.yaml,step-01-freeze-render-contract.md,step-02-fail-closed-renderer.md,step-03-fidelity-offline-spike.md,step-04-determinism-viewer-evidence.md,step-05-review-closure-handoff.md}`
- `docs/reports/qbd-p3-render-layer/gates/G-P3-01.json` through `G-P3-05.json`,
  `G-P3-05-viewer.md`, and `code-review.md`
- The final diff, `project-state.yaml`, `session-handoff.yaml`, and the active test-plan view

## Work

1. Run `npm run verify:render` and `npm run verify:ingest`; record their suite identifiers and retain
   no partial success claim if either command has a failed, skipped, todo, cancelled, or timed-out test.
2. Run `gitnexus_detect_changes()` before commit; compare changed symbols and execution flows with this plan.
3. Conduct a traceability review from every gate requirement to fixture, command, raw result, and evidence.
4. Update structured progress and handoff through the repository workflow, then generated compatibility views.

## Validation

- Run G-P3-06.
- Confirm no Phase 2 gate/evidence was rewritten and no fallback renderer was introduced without approval.
