---
title: "Placeholder Template Ingest Workflow Probe"
description: "Use a PO-supplied FD-like placeholder DOCX as a controlled schema to evaluate the ingest-to-report workflow with public/synthetic data."
status: in-progress
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
PO-supplied FD-like MVP DOCX contains semantic placeholders such as
`<HAUSNER-RATIO-CT01>`. The probe compiles those anchors into a versioned field
map, extracts exact OOXML cell values, linearizes one field per record, then runs
the existing isolated ingest and downstream workflow.

## Outcome and constraints

- Outcome: quickly assess the complete ingest-to-downstream workflow with a
  mock/public package while preserving exact field-to-value provenance.
- Constraint: Phase 01 is bound to the PO-supplied FD-like MVP template at
  `cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx`.
- Constraint: original template and public package remain immutable; derived
  probe artifacts stay isolated and non-citable by default.
- Constraint: preserve raw text, decimal comma, units, `≤`/`≥`, blanks, and
  source-cell identity without inference or normalization.
- Constraint: field type, unit, scope, and requiredness come only from a
  versioned per-anchor metadata catalog bound to the frozen template hash; they
  are never inferred from labels, values, or DOCX layout.

## Non-goals

- Generic arbitrary-DOCX ingestion or production support for edited templates.
- Content controls, FD authoring UX, OCR expansion, or native wide-table parsing.
- Promoting probe records as regulatory evidence or changing public contracts
  before the evidence review in Phase 05.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 00 | [Clean up stale probe worktree](./phase-00-cleanup-stale-probe-worktree.md) | Completed |
| 01 | [Freeze PO-supplied FD-like placeholder template](./phase-01-freeze-official-placeholder-template.md) | Completed |
| 02 | [Compile template field map](./phase-02-compile-template-field-map.md) | Completed |
| 03 | [Extract linear ingest records](./phase-03-extract-linear-ingest-records.md) | Pending — v3 exact receipt verified; projection gate remains |
| 04 | [Run isolated end-to-end probe](./phase-04-run-isolated-end-to-end-probe.md) | Pending — depends on Phase 03 |
| 05 | [Review evidence and promotion boundary](./phase-05-review-evidence-and-promotion-boundary.md) | Completed |

## Dependencies

- Phase order is sequential: `00 → 01 → 02 → 03 → 04 → 05`.
- The unfinished `260803-1903` probe is superseded WIP to quarantine in Phase
  00, not a cross-plan dependency.
- Reuse the committed record schema, isolated config, round-trip verification,
  and atomic publication boundaries unchanged. A stable `occurrence_id` binds
  the map, sidecar receipt, and any schema-valid record projection. Cell
  provenance and cell-level round-trip results live in that sidecar; the
  committed record schema is not modified.

## Success Criteria

- [x] Stale untracked implementation is recoverably quarantined and no longer
      contaminates the active worktree.
- [ ] Every declared placeholder compiles exactly once to a stable
      `occurrence_id`, canonical field ID, tagged source owner, explicit
      metadata, and template version.
- [ ] Every filled field produces one deterministic record whose raw value
      exactly matches its owning DOCX cell.
- [ ] Two isolated runs produce identical records/store hashes and do not
      mutate canonical inputs or store.
- [ ] The final report separates workflow evidence from production-readiness
      claims and records the explicit promote/rework/stop decision.

## Input gate

The PO supplied the closest FD-like template for the MVP and confirmed the
probe inputs are public/synthetic. Phase 01 freezes its repo-relative source
path, hash, and isolated non-citable classification without admitting either
DOCX to the canonical ingest manifest. `EXPERIMENT-DESCRIPTION` and
`BATCH-SIZE` are supplied data; `CONCLUSION` remains reference-only context for
the separate rationale layer to author, never a value produced by this probe.

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

### Session 2 — 2026-08-04
**Trigger:** Full read-only `/ak:plan validate` assessment before Phase 02.
**Questions asked:** 5

#### Verification Results
- **Tier:** Full (6 phases; Fact Checker + Contract Verifier + Flow Tracer + Scope Auditor)
- **Claims checked:** 90 | **Verified:** 80 | **Failed:** 4 | **Unverified:** 6
- The frozen template, grammar, immutable-input boundary, isolated config, and
  existing ingest schema were verified. The four failed claims were missing
  planning contracts, not source failures; the accepted decisions below define
  them without changing canonical ingest or store contracts.

#### Questions & Answers
1. **[Contract]** What is the authority for type, unit, scope, and requiredness?
   - Options: A Versioned per-anchor metadata catalog | B Derive from labels | C Raw-only map
   - **Answer:** A — Versioned per-anchor metadata catalog.
2. **[Architecture]** How are cell and paragraph owners represented?
   - Options: A Tagged cell/paragraph owner union | B Physical OOXML owner only | C Exclude paragraph anchors
   - **Answer:** A — Tagged cell/paragraph owner union.
3. **[Contract]** How is the generated field map made durable and deterministic?
   - Options: A Versioned JSON artifact plus JSON Schema and canonical bytes | B Unschematized JSON | C Module-only API
   - **Answer:** A — Versioned JSON artifact plus JSON Schema and canonical bytes.
4. **[Traceability]** How are map, receipt, and record projection joined?
   - Options: A Stable occurrence_id | B Canonical field ID only | C Existing record ID
   - **Answer:** A — Stable occurrence_id, with canonical field ID retained separately.
5. **[Testing]** How are malformed DOCX cases tested?
   - Options: A Minimal synthetic OOXML/DOCX fixtures | B Derived official-template copies | C XML strings only
   - **Answer:** A — Minimal synthetic OOXML/DOCX fixtures.

#### Confirmed Decisions
- Per-anchor metadata is a versioned input contract, never inferred.
- Owners use an explicit tagged union for logical cells and approved paragraphs.
- The map uses a versioned schema, canonical serialization, and hash comparison.
- The receipt is the join authority from occurrence_id to any schema-valid record.
- Negative fixtures are synthetic and never modify or copy the frozen sources.

#### Impact on Phases
- Phase 01: baseline grammar intentionally excludes per-anchor metadata; its
  completed freeze remains immutable.
- Phase 02: add the metadata catalog, tagged owner contract, map schema,
  isolated artifact path, deterministic bytes, and synthetic negative fixtures.
- Phase 03: join map, receipt, and optional record projection by occurrence_id;
  fail closed rather than fabricate page provenance.
- Phase 04: use a named ignored artifact root and distinguish probe evidence
  from unrelated downstream regression suites.
- Phase 05: remove unsupported historic gap counts and assess only reproduced,
  evidence-backed gaps.

### Whole-Plan Consistency Sweep — Session 2
- Files reread: plan.md, phase-00, phase-01, phase-02, phase-03, phase-04, phase-05
- Decision deltas checked: 5 (metadata authority, owner union, map schema,
  occurrence identity, synthetic fixtures)
- Reconciled stale references: 11 (Phase 01 metadata boundary; Phase 02 map
  contract and fixtures; Phase 03 receipt join and provenance; Phase 04 run
  root and downstream evidence; Phase 05 unsupported historic counts).
- Unresolved contradictions: 0

### Session 3 — 2026-08-05 closeout boundary

- Phase 02 is closed for this session after regenerating the v3 field-map
  artifacts and rerunning the intake, compiler, and existing ingest regression
  checks.
- Phase 05 review is closed for this session with the existing
  `REWORK / HOLD PROMOTION` decision; no production contract or canonical
  manifest/store admission is implied.
- Phase 03 and Phase 04 remain **Pending and not executed**. Their existing
  adapter/test files are pickup material only, not phase-completion evidence.
- The next execution must resolve or explicitly carry the provenance blocker:
  cell owners provide OOXML table/row/cell coordinates, while the frozen record
  schema requires truthful page/offset/quote provenance. Do not fabricate page
  fields; keep the sidecar receipt as the evidence boundary unless an approved
  schema decision changes that contract.

<!-- slug: placeholder-template-ingest-workflow-probe -->
