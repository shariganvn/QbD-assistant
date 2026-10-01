---
title: "Take the format reference's structure, refuse its data"
description: "A finished P.2 for the same product, written by another company, shows what a complete P.2 looks like. The draft took its structure and none of its numbers: 17 new sections, paired risk matrices, a single operation list, per-strength sections, a profile figure, and an annex regrouped as a work order."
status: completed
priority: P1
effort: "5d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, contract, renderer, data-integrity, pharma-dev-draft]
created: 2026-09-30
workstream: qbd-p2-format-reference
scope_lock: tools/pharma-dev-draft + docs/reports/qbd-p2-format-reference + docs/reports/qbd-p2-ich-q8r2-audit
blockedBy: []
blocks: []
---

# Take the format reference's structure, refuse its data

## Outcome

The draft grew from 26 to 43 sections with content and from 19 to 34 tables. It still holds no new
measurement: 396 gap markers and 26 decision markers wait on data and on people with authority. The
growth is the 17 places that a complete P.2 has and this one did not, each built as a marked skeleton.

The reference is another company's dossier — a different formula in every excipient but the lubricant. It
is the authority on structure and completeness and never a source of values. That boundary was built
first, enforced by hashes, so the file that blocks the reference is not a copy of it.

## Source of truth

- Comparison: `docs/reports/qbd-p2-format-reference/format-reference-comparison.md`.
- Executable acceptance: `gates.yaml` (G-35..G-47). Evidence: `docs/reports/qbd-p2-format-reference/gates-g35-g47.txt`.
- Contract: `tools/pharma-dev-draft/schemas/p2-draft-contract.md`, the sections on the format reference,
  risk assessments, the operation list, strength sections, the similarity table and the work order.
- Conformance record: `docs/reports/qbd-p2-ich-q8r2-audit/ich-q8r2-format-audit.md`, round 13.

## Where the plan changed shape while it was carried out

Each is stated in the comparison report and in the commit that made it.

- The justification table for the process matrix already existed, filed under process development. It was
  moved beside its matrix, not built.
- The trial process description stays under the trial. Moving it to the commercial process would have
  presented a laboratory process as the commercial one.
- Invariant G-41 was restated: seven operations, three development sections, one section for three mixing
  steps, so "exactly one each way" does not hold.
- The repository holds no pharmacopoeia, so method statements that need one say so, and the number of
  tablets and batches for the breakability test is a decision for FD rather than a figure copied across.
- The figure that was to be upgraded to a profile did not exist at the place the plan named; the profile
  kind is proved on a filled copy and the committed document has no dissolution result to draw.

## Ordered steps

- [x] `step-17-format-reference.md` — the six phases, in the order they were done.

## Exit acceptance

G-35..G-47 are `pass`. Two limits stay open and are named where they live: the rules about lowered risk,
profile figures and an unbatched strength have not been exercised by real data, and the number of
per-strength sections is fixed by the outline, so a third strength needs the outline to grow.
