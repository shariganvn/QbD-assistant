---
title: "QbD P.2 Cowork MVP kit (bisoprolol) — Phase 1 build"
description: "Claude Cowork kit that ingests trials, picks the best formulation, and drafts CTD P.2.2/P.2.3 in Vietnamese — grounded, cited, draft-only, on mock/public data."
status: pending
priority: P1
branch: ""
tags: [qbd, ctd-p2, cowork-kit, pharma, bisoprolol]
blockedBy: []
blocks: []
created: "2026-07-13T03:40:32.193Z"
createdBy: "ck:plan"
source: skill
---

# QbD P.2 Cowork MVP kit (bisoprolol) — Phase 1 build

## Overview

Build a Claude Cowork-runnable `cowork-p2-kit/` that reads 2–3 formulations + trial results,
reasons to pick the best-supported formulation (logical, defensible), and drafts **P.2.2
(formulation development)** + **P.2.3 (process development)** of the CTD "Phát triển dược học"
section in Vietnamese — grounded, cited, **draft-only** for the Trưởng phòng FD to review.
**Public / FD-modified MOCK data only.** Two deterministic layers (ingest via liteparse,
render via OfficeCLI) wrap Cowork's non-deterministic reasoning; both deterministic layers are
built to be reused by Phase-2 `qbd_core`. See `docs/system-architecture.md`, `docs/project-roadmap.md`.

**Authorization:** MVP authorized to proceed now on the PO/FD body answers dated 12/07/2026;
the full `qbd_core` P0 gate is deferred to Phase 2. Residual sub-items (P0.2/P0.4/P0.5/P0.1
answer key) are carried as tracked risks, not blockers — see per-phase Risk sections and
`docs/project-roadmap.md`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Foundation — docs + scaffold + data-classification](./phase-01-foundation-docs-scaffold-data-classification.md) | Pending |
| 2 | [Ingest and store layer (liteparse)](./phase-02-ingest-and-store-layer-liteparse.md) | Pending |
| 3 | [Render spike and layer (OfficeCLI)](./phase-03-render-spike-and-layer-officecli.md) | Pending |
| 4 | [Reasoning SKILL — matrix + P.2.2/P.2.3 + citations](./phase-04-reasoning-skill-matrix-p-2-2-p-2-3-citations.md) | Pending |
| 5 | [Guardrails 3-layer + trial-logic Level-1](./phase-05-guardrails-3-layer-trial-logic-level-1.md) | Pending |
| 6 | [Acceptance — rubric + market-status + mock demo](./phase-06-acceptance-rubric-market-status-mock-demo.md) | Pending |
| 7 | [Phase-2 prep — local-LLM benchmark + tightening](./phase-07-phase-2-prep-local-llm-benchmark-tightening.md) | Pending |

## Dependencies

```
1 ─┬─► 2 ─┐
   └─► 3 ─┴─► 4 ─► 5 ─► 6      7 (planned; externally gated, parallelizable)
```

- Phase 2 and Phase 3 both depend on Phase 1 → can run in parallel **with file-ownership
  boundaries**: Phase 2 owns `cowork-p2-kit/store/**`, Phase 3 owns `cowork-p2-kit/render/**`.
  `package.json` script wiring is a shared file — Phase 1 adds both `ingest`/`render` script
  stubs so parallel phases never co-edit it (avoids a lost-update).
- Phase 3 has a real toolchain dependency Phase-1 scaffold does not satisfy (no .NET runtime
  installed): its Step 0 provisions/pins the OfficeCLI binary before the spike.
- Phase 3 runs the **P1.2 OfficeCLI fidelity spike first** (timeboxed, with a named fallback) —
  it gates the output-format lock.
- Phase 7 is `planned`/deferred: the 24 GB local-LLM benchmark and production-tightening
  backlog are externally gated (procurement, ZDR contract, real corpus) and out of the MVP
  build path; the benchmark may begin any time a 24 GB box + golden set exist.

## Acceptance (Phase 1 exit)

- 2–3 synthetic bisoprolol trial files exist and ingest produces a **non-empty** store (a silent
  admission-gate total-drop fails this check).
- End-to-end mock run emits `outputs/{p2-draft.docx, evidence-log.md, formula-decision.md}`.
- Every claim is sourced (numbered + footnote + clickable link, anchored by char offset) or
  marked **"chờ dữ liệu"**; no fabricated lab numbers; only `citable:true` sources are cited.
- `formula-decision.md` defends the chosen formulation via a decision matrix + prose + TL;DR.
- Guardrails catch an unsourced claim; Level-1 trial-logic checker flags a seeded mechanical error.
- Draft self-scored against the P0.1 rubric (true 90/100 scoring blocked on FD answer key — tracked).

## Red Team Review

### Session — 2026-07-13 (Phases 1–3)
**Scope:** Phases 1–3 only. **Reviewers:** 3 hostile lenses (Security Adversary, Assumption
Destroyer, Failure Mode Analyst), Standard verification tier (Fact Checker + Contract Verifier).
**Findings:** 19 raw → 14 after dedup, all evidence-backed (many verified empirically against the
real `lit`/`dotnet` environment) — **14 accepted, 0 rejected**.
**Severity breakdown:** 5 Critical, 7 High, 2 Medium.
**Reviewer reports:** `reports/from-code-reviewer-to-planner-red-team-{security-adversary,assumption-destroyer,failure-mode-analyst}-plan-review-report.md`.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Classification+admission underspecified — no label-assignment mechanism nor enforcement ⇒ silent starvation or egress leak | Critical | Accept | Phase 1, 2 |
| 2 | Contaminated cross-drug `135-00` can become citable; label set lacked a do-not-cite axis | Critical | Accept | Phase 1, 2 |
| 3 | No phase authored the mock trial data the kit reasons over | Critical | Accept | Phase 1 |
| 4 | liteparse extracts no table STRUCTURE (verified) — Layer A deliverable rested on missing capability | Critical | Accept | Phase 2 |
| 5 | OfficeCLI spike gates format-lock but .NET absent (verified) + no fallback/timebox/threshold | Critical | Accept | Phase 3, plan |
| 6 | OfficeCLI unpinned 3rd-party binary; spike never checked network egress/integrity | High | Accept | Phase 3 |
| 7 | No prompt-injection handling at the Layer-A ingest boundary | High | Accept | Phase 2 |
| 8 | Provenance `page` unpopulatable via documented `--format text` (page nums only in `--format json`) | High | Accept | Phase 2 |
| 9 | DOCX `page` is a liteparse layout artifact ≠ FD's Word page | High | Accept | Phase 2 |
| 10 | Quote-only anchoring → round-trip attaches wrong page for repeated phrases | High | Accept | Phase 2 |
| 11 | 41/107 QbD-ref pages need OCR (verified) but `--no-ocr` + no `is-complex` wiring ⇒ silent loss | High | Accept | Phase 2 |
| 12 | "Reuse by qbd_core" designed for a non-existent Python consumer while ingest is Node `.mjs` | High | Accept | Phase 2 |
| 13 | Store persists verbatim quotes + absolute paths with no erasure/`.gitignore` | Medium | Accept | Phase 1, 2 |
| 14 | Phase 2/3 parallel with no file-ownership globs; shared `package.json` lost-update | Medium | Accept | plan, Phase 3 |

### Whole-Plan Consistency Sweep
Re-read `plan.md` + all 7 phase files after applying findings. Decision deltas propagated to the
downstream (unreviewed) phases so no stale claim survives:

- **Phase 4** — dropped the assumption that Phase-2 hands over already-`normalized comparison
  tables` (now spike-gated; Phase 4 may rebuild the grid from raw table text). Citations
  restricted to `citable:true`; the "135-00 reference-only" risk re-expressed as the enforced
  `citable:false` rule.
- **Phase 5** — egress/admission reworded: the block is now **enforced at ingest** (Phase 2),
  not a passive label check; grounding guardrail also rejects claims citing `citable:false`
  records.
- **Phase 7** — `qbd_core` reuse clarified: Layer A reused as its **JSON schema** (Python port
  can't import Node `.mjs`); Layer C reused via **shell invocation** of the render binary.
- **Phase 6** — no change needed; its end-to-end mock demo is now satisfied by the synthetic
  trial data authored in Phase 1.

**Result:** no unresolved contradictions across the plan. Provenance shape
(`{file,page,char_start,char_end,quote,page_kind}` + `confidence`), the two-axis classification
(`{label,citable}`), the liteparse table-spike gate, and the JSON-only qbd_core reuse are now
consistent in every phase that references them.
