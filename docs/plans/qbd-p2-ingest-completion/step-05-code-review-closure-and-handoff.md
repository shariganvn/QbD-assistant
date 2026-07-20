# Step 5 — Code-review Closure and Handoff

## Goal

Close Phase 2 from evidence, verify impact, and leave workflow state pointing to the canonical plan.

## Preconditions

- G-01 through G-10 pass and every evidence artifact is readable.

## Files

- Update only the canonical plan status table and gate statuses supported by evidence.
- Save the final review to `docs/reports/qbd-p2-ingest-completion/code-review.md`.
- Update canonical progress and handoff state through agent-baton commands.

## Execution contract

1. Run GitNexus change detection and inspect every affected symbol/module.
2. Review traceability from each gate to fixture, command, expected result, and evidence.
3. Run a fresh Phase 2 code review; resolve every blocking finding without weakening gates.
4. Mark a step completed only after its blocking gates pass.
5. Mark the plan complete only after G-11 and G-12 pass.
6. Keep Phase 3 status open and do not unblock Phase 4 from historical claims.

## Stop conditions

- Unexpected Phase 3/downstream impact requires explicit user approval.
- Missing evidence, skipped tests, or unreadable artifacts keep the plan in progress.
- Do not use an OUTDATED plan or report to satisfy any closure gate.
