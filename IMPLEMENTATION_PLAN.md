# Implementation Plan

There is **no active implementation plan**. This file remains the single
authoritative router; wait for a scope to be accepted before picking work up.

## Latest completed

- [Process diagram plan](docs/plans/qbd-p2-process-diagram/plan.md) — `completed` and read-only.
  G-26..G-28 hold evidence in `docs/reports/qbd-p2-process-diagram/`, including the rendered diagram. A
  third figure kind draws unit operations down the page with the components added at each one; Trial 2's
  process has a source now so its sequence decision closed, and Trial 1's branch carries a note and a
  decision rather than a second copy of the same diagram.

- [Self-consistency plan](docs/plans/qbd-p2-self-consistency/plan.md) — `completed` and read-only.
  G-23..G-25 hold evidence in `docs/reports/qbd-p2-self-consistency/`. Eleven internal references that
  pointed at container sections now resolve to the leaves that hold the content, enforced at Stage B, and
  the abbreviation table moved out of the renderer into the draft with five dead entries removed.

- [Trial 2 plan](docs/plans/qbd-p2-trial-2/plan.md) — `completed` and read-only. G-19..G-22 hold evidence
  in `docs/reports/qbd-p2-trial-2/`. The first real dataset to reach the dossier: it settled the
  manufacturing process as direct compression and made the lubricant level the second experimentally
  established critical attribute. Its finished-product results table is a partial copy of the first
  trial's — 25 of 45 numeric cells verbatim, in a block pattern — so that table is named rather than
  written, and FD owes either the real measurements or confirmation that these are the same batches.

- [Decision register plan](docs/plans/qbd-p2-decision-register/plan.md) — `completed` and read-only.
  G-13..G-18 hold evidence in `docs/reports/qbd-p2-decision-register/`. The draft now carries a second
  marker kind for a conflict or an unapproved assumption, and the rendered document has a second annex
  listing 16 decisions with their owners beside the 149 data requests. The ICH Q8(R2) conformance record
  is current again; its most consequential finding is open and unresolved — the dossier states the
  process is direct compression while the trial's own in-process data describes granules.
- [P.2 figures plan](docs/plans/qbd-p2-figures/plan.md) — `completed` and read-only. G-08..G-12 all
  hold evidence in `docs/reports/qbd-p2-figures/`. The drug-substance properties are sourced from
  PubChem with identifiers and retrieval URLs; W-5 stays open, because those are secondary aggregators
  and it asks for reconciliation against the monograph.
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
