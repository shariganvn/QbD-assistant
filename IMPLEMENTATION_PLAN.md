# Implementation Plan

The single canonical **active** plan is:

`docs/plans/qbd-p221-formulation-selection/plan.md`

Produce a real formulation-selection decision (ICH P.2.2.1) from the filled
mock's three-formula cohort, reusing the existing five-stage pipeline. Replaces
the synthetic demo data path with truthful, source-bound evidence; thresholds are
compiled from extracted specification evidence (never hardcoded); the winner is
gated on FD rubric approval. Read `plan.md`, then `gates.yaml`, then only the
current step file.

## Completed (read-only)

- `plans/260805-1815-template-docx-content-demo/plan.md` — filled one P.2 slice
  with visibly-synthetic content through the five-stage chain so a Product Owner
  could review content and format. Proved content flows end-to-end; its data path
  is synthetic and superseded by the active plan above. Never citable/promoted.
- `plans/260805-1457-template-docx-end-to-end-spike-run/plan.md` — throwaway
  end-to-end spike; produced one empty-by-design internal DOCX proving the pipe
  connects.

## Queued next (activate later)

- `plans/260805-1335-template-to-docx-end-to-end-trial/plan.md` — the hardened
  end-to-end trial (two-run determinism, forge negatives, Bubblewrap render,
  red-team gates). Activate only if we choose to harden the pipeline.

## Completed upstream (read-only)

- `docs/plans/qbd-rationale-report-layer/plan.md` — `completed`.
- `docs/plans/qbd-p4-reasoning-layer/plan.md` — `completed` (G-P4-01..05 pass).

This file is a pointer only. It must not duplicate phase status, task status,
gates, or acceptance results.

Agent routing rules:

1. Read the canonical active `plan.md` first.
2. Read only the current step file linked from that plan.
3. Do not scan or read `docs/plans/OUTDATED/` or `docs/reports/OUTDATED/` unless the user
   explicitly requests historical investigation.
