---
phase: 2
title: "Build the synthetic, labeled demo data pack"
status: completed
priority: P1
effort: "5h"
dependencies: [1]
---

# Phase 2: Build the synthetic, labeled demo data pack

## Context links

- Phase 1 field inventory: `plans/260805-1815-template-docx-content-demo/reports/decision-shape-probe.md`
- `cowork-p2-kit/reasoning/cohort-evidence.mjs`, `.../contracts.mjs`,
  `.../fact-cards.schema.json`, `.../cohort.schema.json`
- `cowork-p2-kit/render/contract.mjs` (citation envelope: `label:"public"`,
  `citable:true`, normalized relative POSIX `source`, optional approved-host link)
- `cowork-p2-kit/render/approved-hosts.json`

## Overview

Produce the store-bound scaffold that drives a selected decision, and derive a
separate citation set from exact receipt-to-record joins. Split of trust:

- **Real:** copied filled mock, its ingest records, real-candidate cards bound to
  those records, and citation excerpts/locations for exactly three joined fields.
- **Synthetic:** approved+pinned rubric, profiles, and deterministic comparator
  records/cards stored only in the isolated run store. The engine computes the
  synthetic comparison scores; callers do not inject a score directly.

The two lanes meet only in presentation. Exact citations demonstrate provenance
format; they are not claimed to prove the synthetic comparator or decision.

## Requirements

- Approved rubric handle + correct `rubricPin` (sha256 of canonical bytes);
  `approval_state` is not `"proposal"`.
- The real-data candidate's cards are built by a new deterministic builder from
  real ingest records. Reuse the spike's binding pattern, not its file-local
  single-card `createTruthfulFactCard` helper. Every card binds one admitted
  record, exact quote, candidate, and provenance file.
- Add deterministic comparator records to the isolated `records.jsonl`, then
  recompute canonical store bytes/hash before `buildCohortEvidence`. Comparator
  cards bind those records and carry the `demo-comparator` marker. No synthetic
  record/card enters `cowork-p2-kit/store`.
- The test-approved rubric already requires two eligible candidates. Both
  candidates must have admitted cards for its two critical measures; the
  optional hardness measure may be omitted rather than composing a fake range
  across separate records.
- Build an exact, ambiguity-rejecting join for all five receipt entries. Require
  exactly three `exact`, two `unmapped`, zero `ambiguous`. Only exact entries may
  produce citation envelopes. Unmapped entries have null record/location data.
- Citation sources for Phase 3 are derived from the ingest records: `source` is
  the mock's normalized relative POSIX path
  (`inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`),
  `location` and `excerpt` come from the real record, `evidenceLink: null`. The
  entry is marked `label:"public"`, `citable:true` **for demo rendering only**;
  the leading watermark is what keeps this honest.
- Citation excerpts equal the exact joined receipt value and occur in the bound
  ingest quote. The three citations remain presentation-only relative to the
  synthetic selection.

## Files to create / modify

| Action | Path | Note |
|---|---|---|
| Create | `cowork-p2-kit/workflow-trial/demo-data-pack.mjs` | Pure builders for real cards, comparator records/cards, exact join, and citations; no writes/network |
| Create | `cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs` | Validate store binding, strict join, pack schemas, and citations |

## Implementation steps

1. Reuse the spike's isolated Stage 2 ingest to obtain real records. Select and
   parse only record-local values needed for the two critical rubric measures;
   keep each source quote byte-exact.
2. Create deterministic comparator records/cards under an obviously synthetic
   provenance path. Append them only to the run-owned store, canonicalize the
   combined JSONL, and recompute its SHA-256.
3. Run `buildCohortEvidence` over the combined store so real and comparator cards
   are admitted through the normal contract. Mark only cited measure records as
   `results`; all other admitted records are `context`.
4. Compute and check the approved rubric pin; call `evaluateSelection`; require
   `selected` without hand-rolling cohort/evidence artifacts.
5. Join all five receipt values to real ingest content by exact substring plus
   source/store hash binding. Reject zero/multiple matches; require 3/2/0.
6. Convert only the three exact joins into render citation envelopes. Preserve
   real source, page/offset location, and exact excerpt; use no URL.

## Gate G-02 — The pack is store-bound and its exact citations trace to real ingest

- Requirement: augmented isolated store validates; both candidates' cards are
  admitted; comparator artifacts are visibly synthetic; rubric pin matches;
  join is exactly 3/2/0; each of the three citation excerpts equals its bound
  real ingest substring and passes `contract.mjs` with `citable:true`.
- Boundary / owner: `demo-data-pack.mjs` + existing schemas/`contract.mjs`;
  Phase 2.
- Fixture: `demo-data-pack.mjs` output + the filled mock's ingest records.
- Command: `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs`
- Expected exit/output: exit `0`; store/schema/admission/pin/3-2-0/citation
  assertions pass and decision is `selected`.
- Negative cases: comparator card absent from its store record; same comparator
  inserted into canonical store; join ambiguity; baseline drift; fabricated
  excerpt; `citable:false`; wrong pin; missing critical measure.
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/data-pack-validation.md`
- Blocks: Phases 3, 4.
- Status: passed (2026-08-06)

## Success criteria

- [x] G-02 passes.
- [x] Exactly three citation excerpts are real joined ingest strings; the two
      unmapped entries have null projections.
- [x] Rubric, comparator artifacts, scores, and decision carry visible synthetic
      markers at their owning boundaries.

## Risks

Mixing real excerpts with synthetic scores can imply false causal support. Keep
the lanes separate in data structures and prose: exact citations demonstrate
format/provenance only; the selected outcome remains synthetic and review-only.

<!-- Updated: Validation Session 1 - add isolated comparator store and strict 3/2/0 citation join -->
