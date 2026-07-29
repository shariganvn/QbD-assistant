# Implementation Plan

The single canonical execution plan is:

`docs/plans/qbd-rationale-report-layer/plan.md`

The previous active plan, `docs/plans/qbd-p4-reasoning-layer/plan.md`, is `completed` with
G-P4-01 through G-P4-05 passing. It is now a read-only upstream contract for the rationale layer.

This file is a pointer only. It must not duplicate phase status, task status, gates, or
acceptance results.

Agent routing rules:

1. Read the canonical `plan.md` first.
2. Read only the current step file linked from that plan.
3. Use `gates.yaml` as the acceptance contract.
4. Do not scan or read `docs/plans/OUTDATED/` or `docs/reports/OUTDATED/` unless the user
   explicitly requests historical investigation.
