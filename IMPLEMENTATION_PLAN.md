# Implementation Plan

The single canonical execution plan is:

`docs/plans/qbd-p2-ingest-completion/plan.md`

This file is a pointer only. It must not duplicate phase status, task status, gates, or
acceptance results.

Agent routing rules:

1. Read the canonical `plan.md` first.
2. Read only the current step file linked from that plan.
3. Use `gates.yaml` as the acceptance contract.
4. Do not scan or read `docs/plans/OUTDATED/` or `docs/reports/OUTDATED/` unless the user
   explicitly requests historical investigation.
