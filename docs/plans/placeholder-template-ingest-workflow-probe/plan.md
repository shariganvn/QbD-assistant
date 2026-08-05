---
title: "Placeholder Template Ingest Workflow Probe"
description: "Use five representative fields from a PO-supplied FD-like placeholder DOCX to prove deterministic, immutable receipt-only extraction with public/synthetic data."
status: completed
priority: P1
effort: "4-6h"
issue: null
branch: master
tags: [feature, experimental, ingest, docx]
blockedBy: []
blocks: []
created: 2026-08-04
---

# Placeholder Template Ingest Workflow Probe

## Overview

Replace the failed generic wide-table probe with a controlled receipt-only proof
of concept. A PO-supplied FD-like MVP DOCX contains semantic placeholders such
as `<HAUSNER-RATIO-CT01>`. The completed compiler remains the authority for all
146 anchors, while the remaining MVP derives a five-entry view, extracts exact
OOXML owner values, and proves deterministic receipts in two isolated runs.

## Outcome and constraints

- Outcome: quickly prove exact field-to-value extraction for five representative
  fields with deterministic receipt hashes and immutable canonical state.
- Constraint: Phase 01 is bound to the PO-supplied FD-like MVP template at
  `cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx`.
- Constraint: original template and public package remain immutable; derived
  probe artifacts stay isolated and non-citable by default.
- Constraint: preserve raw text, decimal comma, units, `≤`/`≥`, blanks, and
  source-cell identity without inference or normalization.
- Constraint: field type, unit, scope, and requiredness come only from a
  versioned per-anchor metadata catalog bound to the frozen template hash; they
  are never inferred from labels, values, or DOCX layout.
- Constraint: the fixed MVP allowlist is `PDS-180-CT02`, `UOM-SPEC`,
  `API-NAME`, `ASSAY-SPEC`, and `BATCH-SIZE`. It covers a decimal comma, a
  merged cell, two placeholders sharing one cell, and a paragraph owner using
  values already present in the frozen public/mock DOCX.
- Constraint: keep the committed record schema, field-map schema, and receipt
  schema unchanged. The MVP receipt must state
  `record_projection.status = "not_available"`,
  `reason_code = "E_PAGE_PROVENANCE_UNAVAILABLE"`, and `record_count = 0`.

## Non-goals

- Generic arbitrary-DOCX ingestion or production support for edited templates.
- Content controls, FD authoring UX, OCR/PDF expansion, or native wide-table parsing.
- Record projection, schema migration, ingest CLI execution, reasoning, render,
  or any other downstream probe-processing branch.
- Implementing page/offset/quote provenance. The receipt retains truthful OOXML
  owner coordinates so first-class provenance can be designed after the MVP.
- Promoting probe output as regulatory evidence or changing public contracts.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 00 | [Clean up stale probe worktree](./phase-00-cleanup-stale-probe-worktree.md) | Completed |
| 01 | [Freeze PO-supplied FD-like placeholder template](./phase-01-freeze-official-placeholder-template.md) | Completed |
| 02 | [Compile template field map](./phase-02-compile-template-field-map.md) | Completed |
| 03 | [Extract representative receipt slice](./phase-03-extract-linear-ingest-records.md) | Completed — five-field receipt-only MVP |
| 04 | [Run two isolated receipt-only probes](./phase-04-run-isolated-end-to-end-probe.md) | Completed — deterministic isolated runs |
| 05 | [Review prior evidence and set promotion boundary](./phase-05-review-evidence-and-promotion-boundary.md) | Completed — promotion remains held |

## Dependencies

- Actual execution order is `00 → 01 → 02 → 05 → 03 → 04`: Phase 05 recorded
  the prior rework/hold boundary, and this validation authorizes only the
  narrowed receipt-only execution tail.
- The unfinished `260803-1903` probe is superseded WIP to quarantine in Phase
  00, not a cross-plan dependency.
- Reuse the completed full field map as immutable input. Each isolated run
  derives the same canonical five-entry field-map view, recomputes its valid
  field-map hash, and passes that view to the existing receipt extractor.
- A stable `occurrence_id` binds each selected map entry to its receipt entry.
  Cell provenance and cell-level round-trip results stay in the receipt; the
  committed record schema and all canonical inputs/store files remain unchanged.

## Success Criteria

- [x] Stale untracked implementation is recoverably quarantined and no longer
      contaminates the active worktree.
- [x] Every declared placeholder compiles exactly once to a stable
      `occurrence_id`, canonical field ID, tagged source owner, explicit
      metadata, and template version.
- [x] Each of the five selected fields produces exactly one receipt entry whose
      raw value matches its owning DOCX cell or paragraph byte-for-byte.
- [x] Two clean isolated runs produce identical selected-map bytes/hash and
      receipt bytes/hash.
- [x] Both runs report `record_projection=not_available`, produce zero records,
      and never invoke ingest, reasoning, or render downstream paths.
- [x] Canonical template, mock, `cowork-p2-kit/inputs/`, and
      `cowork-p2-kit/store/` manifests remain byte-identical.
- [x] MVP closeout states proof-of-concept only; promotion remains held and
      first-class provenance is a separate post-MVP decision.

## Input gate

The PO supplied the closest FD-like template for the MVP and confirmed the
probe inputs are public/synthetic. Phase 01 freezes its repo-relative source
path, hash, and isolated non-citable classification without admitting either
DOCX to the canonical ingest manifest. `EXPERIMENT-DESCRIPTION` and
`BATCH-SIZE` are supplied data; `CONCLUSION` remains reference-only context for
the separate rationale layer to author, never a value produced by this probe.

The five-field MVP selection is a derived view over the frozen full field map;
it does not edit the template, mock, metadata catalog, grammar, or canonical map
artifact.

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

### Session 4 — 2026-08-05 MVP slice approval

**Trigger:** `/ak:plan --validate` with an explicit user-approved MVP slice.
**Questions asked:** 0 — the invocation supplied all material scope decisions.

#### Verification Results — before propagation

- **Tier:** Full (6 phases; prior completed-phase evidence rechecked plus fresh
  Fact Checker, Contract Verifier, Flow Tracer, and Scope Auditor checks for
  Phases 03–04).
- **Claims checked:** 90 | **Verified:** 85 | **Failed:** 5 | **Unverified:** 0
- **Failed stale claims:** complete ingest/downstream outcome; all-occurrence
  record output; optional schema-valid projection; ingest/reasoning/render run
  requirements; and the sequential `03 → 04 → 05` dependency claim after Phase
  05 had already closed with `REWORK / HOLD PROMOTION`.
- Current source evidence confirms receipt-only extraction already reports
  `record_projection=not_available`, `E_PAGE_PROVENANCE_UNAVAILABLE`, and zero
  records. Focused prework tests pass 4/4, but the official workflow test still
  covers 146 occurrences in one run; the required five-field two-run proof
  remains pending implementation.

#### User-supplied decisions

1. **[Scope]** Run only 3–5 representative fields.
   - **Answer:** fixed five-field slice for the fastest useful coverage.
2. **[Contract]** Keep the record schema unchanged.
   - **Answer:** no record, field-map, or receipt schema migration.
3. **[Architecture]** Stop at the truthful receipt boundary.
   - **Answer:** `record_projection.status = "not_available"`, reason
     `E_PAGE_PROVENANCE_UNAVAILABLE`, and `record_count = 0`.
4. **[Scope]** Exclude PDF, schema migration, reasoning, render, and downstream
   probe processing.
   - **Answer:** focused DOCX owner-to-receipt proof only.
5. **[Evidence]** Execute two isolated runs.
   - **Answer:** compare deterministic selected-map/receipt bytes and hashes,
     plus before/after canonical manifests.
6. **[Future boundary]** Prepare for provenance after MVP without implementing it.
   - **Answer:** retain stable occurrence IDs, tagged OOXML owners, raw values,
     and round-trip hashes in the unchanged receipt contract.

#### Derived implementation choice

- The fixed allowlist is `PDS-180-CT02`, `UOM-SPEC`, `API-NAME`,
  `ASSAY-SPEC`, and `BATCH-SIZE`. These five already have real frozen-mock
  values and focused fixtures, covering decimal comma, merged-cell ownership,
  two values in one cell, and paragraph ownership without adding new inputs.

#### Confirmed decisions

- MVP output: one five-entry derived map plus one five-entry receipt per run.
- Determinism: Run 1 and Run 2 selected-map/receipt canonical bytes and embedded
  SHA-256 values must match.
- Immutability: frozen template/mock and canonical inputs/store manifests must
  match before and after.
- Promotion: remains held regardless of MVP success.
- Post-MVP provenance: separate approval and plan; never synthesize page data.

#### Impact on phases

- Phases 00–02: completed contracts and evidence remain unchanged.
- Phase 03: narrowed to fixed five-field map selection and receipt extraction;
  no record construction or downstream call.
- Phase 04: narrowed to two clean receipt-only runs and deterministic/canonical
  immutability evidence.
- Phase 05: clarified as the already-completed prior boundary review, dependent
  on Phase 02; Phase 03 now depends on that hold decision.

#### Verification Results — after propagation

- **Claims rechecked:** 90 | **Verified:** 90 | **Failed:** 0 | **Unverified:** 0
- `ak plan validate` passes; all cited source/test/schema paths exist; the five
  selected fields resolve exactly once in the current full map and have verified
  values in the frozen public/mock DOCX.

### Whole-Plan Consistency Sweep — Session 4

- Files reread: `plan.md`, Phase 00, Phase 01, Phase 02, Phase 03, Phase 04,
  Phase 05.
- Decision deltas checked: 6 (field count, schema freeze, receipt boundary,
  excluded downstream scope, two-run evidence, deferred provenance).
- Reconciled stale references: 12 grouped scope/dependency/output claims across
  `plan.md`, Phase 03, Phase 04, and Phase 05.
- Unresolved contradictions: 0.
- Open questions: None for the MVP slice.

### Session 5 — 2026-08-05 Phase 03/04 execution closeout

- Focused template-probe suite passed 13/13; syntax checks passed 3/3; `git diff
  --check` passed.
- Delegated tester passed the focused probe (5/5), field-map (8/8),
  record-contract (2/2), and intake contract checks (146 anchors: 143 cell,
  3 paragraph). Delegated final code review scored 9/10 and approved with no
  blocking findings.
- The two isolated runs produced identical selected-map and receipt canonical
  bytes/hashes, exact values for all five fields, zero record IDs, and
  `E_PAGE_PROVENANCE_UNAVAILABLE`; canonical template/mock/inputs/store
  manifests remained unchanged.
- Direct tester/debugger dispatch failed before execution because the delegated
  runtime lacked `CODEX_LB_API_KEY`; alternate tester/debugger/reviewer runs
  completed. The write-capable full ingest verifier was not run because it
  writes gate evidence; direct ingest contract tests passed 2/2.
- Docs impact: no evergreen/public docs update. The experimental probe remains
  non-citable and unpromoted; its plan/progress/report are the stateful record.
- Remaining post-MVP concern: bind template-version metadata more strictly
  across all independently forged artifacts before any promotion or provenance
  contract work.

<!-- slug: placeholder-template-ingest-workflow-probe -->
