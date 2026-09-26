---
title: "The second trial: what a real dataset closes, and what it costs to check it"
description: "Trial 2 enters the dossier through Stage A. It settles the manufacturing process and makes the lubricant level the second experimentally established critical attribute — and its finished-product results table turns out to be a partial copy of Trial 1's, so that table is kept out and named instead."
status: completed
priority: P1
effort: "1d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, data, contract, pharma-dev-draft]
created: 2026-09-26
workstream: qbd-p2-trial-2
scope_lock: tools/pharma-dev-draft only
blockedBy: []
blocks: []
---

# The second trial

## Outcome

Three rounds had produced no measured data: the chemical databases give substance properties, the
European agency publishes no assessment report for the comparator, and every measured cell waited on
the laboratory. Trial 2 is the first real dataset to arrive.

It settled the one decision that blocked the most: the process is **direct compression**. Its process
summary lists sieving, two blends, a final blend and compression — no granulation, no wetting, no
drying. That also explains the word that caused the doubt: "cốm" in this department's forms means the
blend ready for compression, not wet granules. Several rendered sections rested on that premise and
now have an experimental source instead of an unsourced assertion.

It also made the lubricant level the **second** critical formulation attribute established the way
ICH Q8(R2) Part I page 6 describes, by varying it while holding everything else: at 1% the tablets
stuck to the punch, at 5% hardness fell and friability rose.

And it cost something to check. **25 of the 45 numeric cells in its finished-product results table are
verbatim Trial 1 values**, in a pattern no independent dataset produces: the hardness, thickness,
friability, disintegration, assay, dissolution and impurity blocks of its two columns map onto Trial 1's
CT02 and CT03, while the weight-uniformity block maps onto CT01 and CT02. That table is not in the
dossier. It is named, with the comparison, and handed to FD.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — `meta.sourceFiles`.
- Executable acceptance: `gates.yaml` (G-19..G-22).
- Evidence: `docs/reports/qbd-p2-trial-2/g19-g22-trial-2.txt`.
- Preceding work: the three `completed` plans listed in `IMPLEMENTATION_PLAN.md`.

## Governing rule, unchanged

**Format lives in the outline, data lives in the draft, neither lives in the code.** Two consequences
this round, both tested:

- The number of experimental sources is data. `meta.sourceFile` became `meta.sourceFiles`, a list, for
  the same reason `strengths` is a list: a document that states its provenance as `"a.docx; b.docx"`
  buries the count in a string where nothing can check it.
- A trial is a branch, not a sibling. Trial 1's sub-parts were `heading2`, level with the heading that
  named the trial, so a second trial's tables would have been indistinguishable from the first's.

## Ordered steps

- [x] `step-11-second-source-and-nesting.md` — the source list, the per-trial heading tree, and the
      four section-wide requirements moved off the tablet-design heading where they did not belong.
- [x] `step-12-what-trial-2-establishes.md` — the process, the composition, the blend data, the verbatim
      conclusion, the two decisions closed and the six opened.

## Exit acceptance

G-19..G-22 hold evidence. The rendered document carries both trials as separate branches, passes schema
validation, keeps its three figures, and states for every Trial 2 number either where it came from or
why it is not there.

## Rollback

Remove the Trial 2 block group and restore `meta.sourceFiles` to a single entry; the heading nesting and
the source list are the only changes outside that section.
