---
title: "Placeholder Template Ingest Workflow Probe"
description: "Use an official placeholder-marked DOCX as a controlled schema to evaluate the ingest-to-report workflow with mock/public data."
status: pending
priority: P1
effort: "2-3d after template receipt"
issue: null
branch: master
tags: [feature, experimental, ingest, docx]
blockedBy: []
blocks: []
created: 2026-08-04
---

# Placeholder Template Ingest Workflow Probe

## Overview

Replace the failed generic wide-table probe with a controlled vertical slice. A
user-supplied official FD/PO DOCX contains semantic placeholders such as
`<HAUSNER-RATIO-CT01>`. The probe compiles those anchors into a versioned field
map, extracts exact OOXML cell values, linearizes one field per record, then runs
the existing isolated ingest and downstream workflow.

## Outcome and constraints

- Outcome: quickly assess the complete ingest-to-downstream workflow with a
  mock/public package while preserving exact field-to-value provenance.
- Constraint: Phase 01 cannot start until the user supplies the concrete DOCX.
- Constraint: original template and public package remain immutable; derived
  probe artifacts stay isolated and non-citable by default.
- Constraint: preserve raw text, decimal comma, units, `≤`/`≥`, blanks, and
  source-cell identity without inference or normalization.

## Non-goals

- Generic arbitrary-DOCX ingestion or production support for edited templates.
- Content controls, FD authoring UX, OCR expansion, or native wide-table parsing.
- Promoting probe records as regulatory evidence or changing public contracts
  before the evidence review in Phase 05.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 00 | [Clean up stale probe worktree](./phase-00-cleanup-stale-probe-worktree.md) | Completed |
| 01 | [Freeze official placeholder template](./phase-01-freeze-official-placeholder-template.md) | Blocked on user input |
| 02 | [Compile template field map](./phase-02-compile-template-field-map.md) | Pending |
| 03 | [Extract linear ingest records](./phase-03-extract-linear-ingest-records.md) | Pending |
| 04 | [Run isolated end-to-end probe](./phase-04-run-isolated-end-to-end-probe.md) | Pending |
| 05 | [Review evidence and promotion boundary](./phase-05-review-evidence-and-promotion-boundary.md) | Pending |

## Dependencies

- Phase order is sequential: `00 → 01 → 02 → 03 → 04 → 05`.
- The unfinished `260803-1903` probe is superseded WIP to quarantine in Phase
  00, not a cross-plan dependency.
- Reuse the committed record schema, isolated config, round-trip verification,
  and atomic publication boundaries unchanged. Cell provenance (table/row/cell)
  and cell-level round-trip results live in an isolated sidecar receipt; the
  committed record schema is not modified (Validation Session 1).

## Success Criteria

- [x] Stale untracked implementation is recoverably quarantined and no longer
      contaminates the active worktree.
- [ ] Every declared placeholder compiles exactly once to a stable field ID,
      source cell, type, scope, and template version.
- [ ] Every filled field produces one deterministic record whose raw value
      exactly matches its owning DOCX cell.
- [ ] Two isolated runs produce identical records/store hashes and do not
      mutate canonical inputs or store.
- [ ] The final report separates workflow evidence from production-readiness
      claims and records the explicit promote/rework/stop decision.

## Input gate

Await the concrete official placeholder DOCX from the user. Resolve its final
repo-relative intake path, hash, sensitivity, and allowed public/mock values in
Phase 01; do not guess a filename or begin template implementation before then.

## Validation Log

### Session 1 — 2026-08-04
**Trigger:** `/ak-plan --validate` critical-questions interview plus Full-tier verification pass (6 phases).
**Questions asked:** 4

#### Verification Results
- **Tier:** Full (6 phases; Fact Checker + Contract Verifier + Flow Tracer + Scope Auditor)
- **Claims checked:** 14 | **Verified:** 14 | **Failed:** 0 | **Unverified:** 0
- Every cited `ingest/`, `preprocess/`, and `inputs/` path exists. Round-trip
  (`verifyRoundTrips`, records.mjs:112 called from pipeline.mjs:75), atomic
  publication (publication.mjs), and schema validation confirmed present.
- **Structural finding (not a path failure):** the committed `records.schema.json`
  requires page-offset provenance (`page,char_start,char_end,quote,page_kind`)
  and `verifyRoundTrips` skips records without `quote`. Cell-sourced values have
  no native page offset — resolved by Q1.

#### Questions & Answers
1. **[Architecture/Contract]** Keep cell-level provenance and real verification
   without breaking the qbd_core-shared record schema?
   - Options: A Sidecar receipt (keep schema) | B Extend schema + SPEC diff | C Force through page-layout
   - **Answer:** A — Sidecar receipt; committed schema frozen
   - **Rationale:** Probe assesses the workflow on mock/public data without
     touching the production/qbd_core public contract. Cell coordinates and
     cell-level round-trip live in an isolated sidecar; main records stay
     schema-valid. Blast radius = 0.
2. **[Docs/Scope]** Plan lives in `plans/` but the project rule mandates
   `docs/plans/<workstream>/`.
   - Options: A Move to docs/plans | B Keep in plans/
   - **Answer:** A — Move to `docs/plans/placeholder-template-ingest-workflow-probe/`
   - **Rationale:** Matches project documentation layout and Phase 05's `docs/reports/` target.
3. **[Architecture]** Phase 00 quarantines all of `cowork-p2-kit/preprocess/`,
   but Phase 02/03 created files inside it.
   - Options: A New separate dir | B Reuse preprocess/
   - **Answer:** A — New root `cowork-p2-kit/template-probe/`
   - **Rationale:** Clean boundary; new probe code never mixes with quarantined
     WIP; old files reviewed only from Phase 00 quarantine recovery.
4. **[Scope]** How far should this session run given Phase 01 blocks on the user DOCX?
   - Options: A Only Phase 00 | B Cook 00-05 | C Only review plan
   - **Answer:** C — Review only; no implementation this session.
   - **Rationale:** DOCX not yet supplied; finalize and review the plan first.

#### Confirmed Decisions
- Cell provenance: isolated sidecar receipt; committed record schema unchanged.
- Plan location: `docs/plans/placeholder-template-ingest-workflow-probe/`.
- New probe code root: `cowork-p2-kit/template-probe/`.
- Session scope: review only — do not cook.

#### Impact on Phases
- Phase 00: relative context links fixed after relocation; probe code no longer recreated in `preprocess/`.
- Phase 02: create paths under `cowork-p2-kit/template-probe/`; `extract-cell-ledger.mjs` reviewed from Phase 00 quarantine recovery.
- Phase 03: adopt sidecar-receipt provenance; committed schema frozen; create paths under `template-probe/`.
- Phase 04: probe test path under `template-probe/`; evidence binds sidecar cell-level round-trip.
- Phase 05: plan-review path updated to relocated dir.

#### Flagged (needs explicit user decision, not blocking review)
- `IMPLEMENTATION_PLAN.md` points to `docs/plans/qbd-rationale-report-layer/plan.md`
  as the single active plan. This probe was **not** promoted to the active
  pointer — doing so would retire the current active plan, which the
  one-active-plan rule forbids without explicit retirement. Repoint only on request.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-00, phase-01, phase-02, phase-03, phase-04, phase-05
- Decision deltas checked: 4 (sidecar schema, plan location, probe dir, review-only scope)
- Reconciled stale references: 6 (dependencies bullet, phase-00 links, phase-02 paths, phase-03 sidecar + paths, phase-04 path, phase-05 path)
- Unresolved contradictions: 0

<!-- slug: placeholder-template-ingest-workflow-probe -->
