# Implementation Plan

The single canonical **active** plan is:

`plans/260805-1815-template-docx-content-demo/plan.md`

Fill one representative P.2 dossier slice with visibly-synthetic content plus
footnoted citations through the existing five-stage chain, so a Product Owner can
review content and format. Review-only, watermarked, never citable, never
promoted. Builds on the completed end-to-end spike.

## Queued next (activate later)

- `plans/260805-1335-template-to-docx-end-to-end-trial/plan.md` — the hardened
  end-to-end trial (two-run determinism, forge negatives, Bubblewrap render,
  red-team gates). Activate only if we choose to harden after the demo.

## Completed (read-only)

- `plans/260805-1457-template-docx-end-to-end-spike-run/plan.md` — throwaway
  end-to-end spike; produced one empty-by-design internal DOCX proving the pipe
  connects. Superseded as active by the content demo above.

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
