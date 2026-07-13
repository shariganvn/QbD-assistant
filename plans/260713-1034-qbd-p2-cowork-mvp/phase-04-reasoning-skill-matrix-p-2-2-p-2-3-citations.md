---
phase: 4
title: "Reasoning SKILL — matrix + P.2.2/P.2.3 + citations"
status: pending
priority: P1
effort: "2.5d"
dependencies: [2, 3]
---

# Phase 4: Reasoning SKILL — matrix + P.2.2/P.2.3 + citations

## Overview

Layer B: author `cowork-p2-kit/SKILL.md` — the non-deterministic reasoning that reads the
store, builds a decision matrix to pick the best-supported formulation, and drafts P.2.2
(formulation development) + P.2.3 (process development) in Vietnamese, grounded and cited.
Emits the structured draft (to Phase 3 render) + `evidence-log.md` + `formula-decision.md`.

## Requirements

- Functional: the 5-step workflow below runs end-to-end on mock trials and produces a defensible
  formulation choice + a VN P.2.2/P.2.3 draft where every claim is sourced or "chờ dữ liệu".
- Non-functional: Vietnamese pharma terminology per `docs/glossary.md`; **the SKILL emits
  structured content + citations, never the final `.docx`.**

## Architecture — SKILL 5-step workflow

1. **Ingest/normalize** — read Phase-2 store records. If the Phase-2 table-reconstruction spike
   deferred structuring (liteparse returns no table objects), this step also rebuilds the
   formulation×attribute grid from the raw table text/records before the matrix. Only
   `citable:true` records may be cited downstream.
2. **Decide** — build a **decision matrix (criteria × formulation)** + prose reasoning + **TL;DR**;
   pick the best-supported formulation (logical, defensible from the trials).
3. **Draft** — write P.2.2 + P.2.3 in Vietnamese, grounded in trial + reference records.
4. **Guard (content rules; full checks in Phase 5)** — no source → **"chờ dữ liệu"**; never
   fabricate lab numbers; draft-only.
5. **Emit** — structured draft (for render) + citations (numbered + footnote + clickable link,
   claim-level, evidence adjacent) + `evidence-log.md` + `formula-decision.md`.

## Related Code Files

- Create: `cowork-p2-kit/SKILL.md` — the workflow + prompts + output contract
- Create: `cowork-p2-kit/outputs/formula-decision.md` (template) — matrix + prose + TL;DR
- Create: `cowork-p2-kit/outputs/evidence-log.md` (template) — per-run citation ledger
- Read for context: `docs/system-architecture.md`, `docs/glossary.md`, Phase-2 store schema

## Implementation Steps

1. Write `SKILL.md` encoding the 5 steps, the render input contract (Phase 3), and the
   citation format.
2. Define the decision-matrix structure (criteria, per-formulation scores, weights) — leave
   criteria/weights as a filled-in mock **plus** a "FD/PO to confirm" marker (owner = P0.8, tracked).
3. Draft P.2.2/P.2.3 section templates mapped to the `p2-template.md` headings; each claim
   links to a store record ID.
4. Generate `evidence-log.md` (every claim → source, tier, link) and `formula-decision.md`
   (matrix + prose + TL;DR justifying the pick).
5. Ensure lab-derived fields stay blank/"chờ dữ liệu"; only literature/public-searchable
   content is drafted.

## Success Criteria

- [ ] `SKILL.md` runs the 5-step workflow on mock trials.
- [ ] Decision matrix + prose + TL;DR select a defensible formulation in `formula-decision.md`.
- [ ] VN P.2.2/P.2.3 draft produced; every claim sourced or "chờ dữ liệu"; no fabricated lab numbers.
- [ ] `evidence-log.md` lists every claim with source, tier, and clickable link.
- [ ] Draft is structured for Phase-3 render (SKILL does not write the docx).

## Risk Assessment

- **Decision-matrix ownership (tracked):** who approves criteria + weights is open (tie to
  P0.8). MVP uses documented mock weights with a confirm marker; do not present them as final.
- **"Thấy tất cả thông tin" reading:** full heading coverage **with explicit missing-data
  states**, NOT every field populated — designing to the latter would force fabrication.
- **135-00 leakage:** never cite the 135-00 example as trusted product evidence or golden
  target; "reference-only" is now enforced by the `citable:false` flag (Phase 1/2) — Layer B
  must not cite any `citable:false` record.
