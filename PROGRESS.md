<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/progress/*.yaml and docs/decisions/D*.md -->
<!-- Regenerate: baton render-workflow -->
<!-- Source fingerprint: sha256:58d73a2a156f9b138029f3180b439b819a5e21bfe64d5b948839005cd97cd054 -->

# PROGRESS

> Generated compatibility view. Canonical state lives in `project-state.yaml` and `docs/progress/*.yaml`.

## Current workstream

- ID: `qbd-p2-ingest-post-closure-spec-diff`
- Status: `in-progress`
- Plan: `docs/plans/qbd-p2-ingest-completion/post-closure-toctou-validation-plan-patch.md`
- Current pickup: Conduct the final P2 publication-lock spec-diff against D20260722 after the completed rationale layer closeout; do not claim hostile same-host TOCTOU is resolved.
- Pickup files: `docs/plans/qbd-p2-ingest-completion/post-closure-toctou-validation-plan-patch.md`, `docs/decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md`, `docs/reports/qbd-p2-ingest-completion/spec-diff-step-03-publication-lock-debt-20260724.md`

## Latest progress

| Date | ID | Status | Summary |
|---|---|---|---|
| 2026-07-28 | `P20260728-qbd-p2-ingest-closeout-attestation` | done | Recorded the final accepting closeout verdict and synchronized the canonical P2 validation plan after the final independent review; D20260722 remains open. |
| 2026-07-29 | `P20260729-qbd-rationale-step-05` | done | Completed rationale Step 5: the integrated suite creates and validates shared-UUID gate evidence, exercises all sealed decision branches end to end, publishes the test-only selected reference package, and verifies P4 unchanged in an isolated clean worktree. |

## Blockers

- No blocker recorded in the latest progress events.

## History

- Structured events: `docs/progress/*.yaml`
- Pre-cutover prose: `docs/archive/PROGRESS-ARCHIVE.md`
- Search older context with qmd.
