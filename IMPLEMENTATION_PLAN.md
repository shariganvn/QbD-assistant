# Implementation Plan

There is **no active implementation plan**. This file remains the single
authoritative router; wait for a scope to be accepted before picking work up.

## Latest completed

- [P.2 figures plan](docs/plans/qbd-p2-figures/plan.md) — `completed` and read-only. G-08..G-11 hold
  evidence in `docs/reports/qbd-p2-figures/`. G-12, the drug-substance property sources, is `blocked`:
  the reference databases are denied by the environment's network policy, and PubMed was the wrong
  database for those fields in any case.
- [Two-strength P.2 plan](docs/plans/qbd-p2-bisoprolol-5-10mg/plan.md) — `completed` and read-only.
  G-00..G-05 and G-07 hold evidence in `docs/reports/qbd-p2-bisoprolol-5-10mg/`. G-06, the
  pharmacopoeia-version discovery gate, is `deferred`: it needs a verifiable source for the effective
  EP version, not code.
- `plans/260809-2001-rationale-explanation/plan.md` — `completed` and read-only.
- [P.2.2.1 formulation-selection plan](docs/plans/qbd-p221-formulation-selection/plan.md) — completed
  and read-only.

## Earlier completed (read-only)

- `plans/260805-1815-template-docx-content-demo/plan.md` — filled one P.2 slice
  with visibly-synthetic content through the five-stage chain so a Product Owner
  could review content and format. Proved content flows end-to-end; its data path
  is synthetic and superseded by the completed plan above. Never citable/promoted.
- `plans/260805-1457-template-docx-end-to-end-spike-run/plan.md` — throwaway
  end-to-end spike; produced one empty-by-design internal DOCX proving the pipe
  connects.

## Queued (not active)

- [Hardened end-to-end trial](plans/260805-1335-template-to-docx-end-to-end-trial/plan.md) —
  two-run determinism, forge negatives, Bubblewrap render,
  red-team gates. Activate only if we choose to harden the pipeline.

## Completed upstream (read-only)

- `docs/plans/qbd-rationale-report-layer/plan.md` — `completed`.
- `docs/plans/qbd-p4-reasoning-layer/plan.md` — `completed` (G-P4-01..05 pass).

This file is a pointer only. It must not duplicate phase status, task status,
gates, or acceptance results.

Agent routing rules:

1. If an active plan is linked above, read its `plan.md` first.
2. Read only the current step file linked from that plan.
3. Do not scan or read `docs/plans/OUTDATED/` or `docs/reports/OUTDATED/` unless the user
   explicitly requests historical investigation.
