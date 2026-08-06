---
phase: 3
title: "Content adapter → rich watermarked draft"
status: completed
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 3: Content adapter → rich watermarked draft

## Context links

- `cowork-p2-kit/render/contract.mjs` (`validateDraft`; block types
  `heading1/2/3`, `paragraph` with plain text or citation `segments`, `table`,
  `chờ_dữ_liệu`)
- `cowork-p2-kit/render/document-builder.mjs` (how blocks/citations/footnotes/
  Sources render)
- `cowork-p2-kit/rationale/packet.mjs`, `.../rationale-*.mjs` (rationale claims
  that become body prose)
- Phase 1 field inventory + Phase 2 data pack

## Overview

Author and validate a selected rationale from the same sealed packet, then write
one **pure** adapter that maps the decision/evaluation, validated rationale, and
Phase 2 exact citations into the existing rich-draft contract. The exact
watermark is `draft.title`, so the current renderer places it before the table of
contents without a render-contract change.

## Requirements

- Build selected rationale claims only from the sealed packet, following the
  existing `fact`, `gate`, `sensitivity`, and `decision_state` bindings. Run
  `validateRationale` before the adapter accepts the rationale.
- `validateDraft` accepts the output with
  `title === "SYNTHETIC / DEMO — không dùng để nộp hoặc trích dẫn"`.
- Blocks, in order: `heading2`, ≥2 `paragraph` blocks of generic validated
  rationale/decision prose (≥1 with citation segments), and ≥1 table of
  synthetic rubric scores. Do not place raw mock values in the body/table.
- `citations`: exactly three Phase 2 exact-join entries, each quoting a real
  ingested excerpt and marked `citable:true` for this demo only.
- Any string taken from the mock appears **only inside a citation** (footnote),
  never as an uncited body assertion.
- **Zero** `chờ_dữ_liệu` blocks. No invented evidence link; no upgrade of the
  mock's underlying `citable:false` classification beyond the demo citation entry.
- Adapter performs no writes and no network.

## Files to create / modify

| Action | Path | Note |
|---|---|---|
| Create | `cowork-p2-kit/workflow-trial/demo-rationale.mjs` | Pure same-packet selected-rationale author + contract validation |
| Create | `cowork-p2-kit/workflow-trial/rationale-to-content-draft.mjs` | Pure map: decision/evaluation+rationale+exact sources → validated draft |
| Modify | `cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs` | Adapter/draft assertions |

## Implementation steps

1. Seal the same-run reasoning package, build selected claims from only the
   packet's permitted sources, validate them, and publish the rationale through
   the existing rationale CLI boundary.
2. Require decision/evaluation/rationale IDs and hashes to agree before mapping.
3. Map validated generic claims into ≥2 paragraphs. Add citation markers in a
   provenance-format paragraph without saying those excerpts prove the
   synthetic selection.
4. Build a table from synthetic rubric points/totals, not raw mock values. Mark
   the comparator and all scores synthetic.
5. Set the exact watermark as `draft.title`; do not duplicate it as a body block.
6. Run `validateDraft`; assert exact citation count, no raw mock string in body,
   and zero `chờ_dữ_liệu` blocks.

## Gate G-03 — The adapter yields a valid, content-rich, watermarked draft

- Requirement: selected rationale validates against the same packet;
  `validateDraft` passes; title is the exact watermark; draft has ≥2 body
  paragraphs, ≥1 citation segment, ≥1 synthetic-score table, exactly three
  citable exact-join citations, and zero `chờ_dữ_liệu`.
- Boundary / owner: `rationale-to-content-draft.mjs` + `render/contract.mjs`;
  Phase 3.
- Fixture: Phase 2 data pack + Phase 1 decision.
- Command: `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs`
- Expected exit/output: exit `0`; rationale binding and draft-shape assertions pass.
- Negative cases: a body paragraph quoting a mock string without a citation
  segment → rejected; a forged citation index → `E_CITATION_UNRESOLVED`; a
  citation flipped to `citable:false` → `E_CITATION_UNCITABLE`; a draft missing
  the exact watermark title → adapter error (feeds Gate G-EX).
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/draft-assertions.md`
- Blocks: Phase 4.
- Status: passed (2026-08-06)

## Gate G-EX — Watermark is the first rendered text (cross-cutting)

- Requirement: any draft this demo produces has the exact synthetic watermark
  as `draft.title`; Phase 4 proves it precedes `Mục lục` in DOCX text order.
- Boundary / owner: `rationale-to-content-draft.mjs`; enforced again in Phase 4
  on the rendered DOCX text.
- Fixture: adapter output with missing, changed, or body-only watermark.
- Command: `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs`
- Expected exit/output: exit `0`; any non-exact title makes the adapter guard throw.
- Negative cases: empty title; watermark only in `blocks[0]`; translated/shortened title.
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/draft-assertions.md`
- Blocks: Phase 4.
- Status: passed (2026-08-06)

## Success criteria

- [x] G-03 and G-EX pass.
- [x] Draft is pure (no writes/network) and needs no render-contract change.

## Risks

The citation envelope forces `label:"public"` + `citable:true`. Keep that
watermark-gated override confined to exactly three derived citation entries.
The adapter must not phrase them as scientific support for the synthetic score
or selection. The underlying mock stays `citable:false` everywhere else.

<!-- Updated: Validation Session 1 - add selected rationale boundary and title-first watermark -->
