---
title: "Figures in the P.2 document, drawn from the draft's own data"
description: "Give the renderer process-flow diagrams, charts and supplied images, with every figure read out of a table already in its section so a chart cannot disagree with the numbers beside it, and cannot be drawn where there are none. Also records why the drug-substance property cells stay empty: the reference databases are blocked by the environment's network policy."
status: completed
priority: P2
effort: "1d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, renderer, pharma-dev-draft]
created: 2026-09-25
workstream: qbd-p2-figures
scope_lock: tools/pharma-dev-draft only
blockedBy: []
blocks: []
---

# Figures in the P.2 document

## Outcome

The department's form calls for a process flow diagram, dissolution charts and a structural formula.
The renderer could place none of them, so four sections carried a sentence telling the reader to paste
the picture in by hand.

Figures are now drawn. Two of them are in the document: the process flow of the chosen manufacturing
method, and the dissolution result of the three trial formulations. The other three are not, and the
reason has changed from "the tool cannot" to "the data does not exist yet" — which the sections now
say, because those two are different statements to a reviewer.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — the `figure` and `image` block shapes.
- Executable acceptance: `gates.yaml` (G-08..G-12).
- Preceding work: `docs/plans/qbd-p2-bisoprolol-5-10mg/` (`completed`).

## Governing rule, unchanged

**Format lives in the outline, data lives in the draft, neither lives in the code.** A figure is the
easiest place to break that: a chart needs numbers, and the obvious way to give it them is to copy
them into the block. Then one measurement sits in two places and they disagree the first time one is
corrected.

So a figure block carries **no numbers**. It names a table and a row already in its section. Two
things follow, and both are tested:

- a chart cannot disagree with the table beside it, because there is only one copy of the value;
- a chart cannot be drawn where there is no data, because the gap markers are still there to refuse.

## What was found on the way

**The reference databases are blocked.** `pubchem.ncbi.nlm.nih.gov` and `eutils.ncbi.nlm.nih.gov`
both answer HTTP 403 at the egress proxy — a policy denial, confirmed through `curl`, through
WebFetch, and in the proxy's own rejection log. EMA, FDA accessdata, DrugBank and ChemicalBook are
blocked the same way. Only web search works, and it returns snippets rather than a citable record.

Two consequences recorded rather than worked around:

1. **PubMed was the wrong database anyway.** It indexes citations and abstracts; IUPAC name, melting
   point, LogP and pKa live in PubChem, DrugBank or a pharmacopoeial monograph.
2. **The property cells stay empty.** Filling them from a search snippet would repeat W-9 exactly,
   where a value everyone "knows" sat in the draft through four passes saying the substance dissolves
   in ethanol while the certificate said methanol. G-12 opens when the network policy does.

Five of the eight empty cells would not be closed by any database: the forced-degradation rows are
experimental results on this drug substance and belong to `3.2.S.7`.

**No structural formula is drawn.** There is no chemistry toolkit here to generate one from a SMILES
string, and hand-placing the bonds of a forty-carbon salt is a way to be quietly wrong about chemical
identity. The `image` block exists so the file drops in the moment FD supplies it or PubChem becomes
reachable.

## Ordered steps

- [x] `step-06-figure-infrastructure.md` — browser bridge, flow and chart drawing, the `figure` and
      `image` blocks, source resolution at Stage B.
- [x] `step-07-figures-in-the-draft.md` — the two figures that have data, and the corrected notes.
- [ ] `step-08-physicochemical-sources.md` — blocked on the environment's network policy.

## Exit acceptance

G-08..G-11 hold evidence under `docs/reports/qbd-p2-figures/`. G-12 is deferred with its condition
recorded. The rendered document carries exactly two figures, passes schema validation, and the
sections without data say why rather than asking for a paste-in.

## Rollback

Remove the two figure blocks from the draft and the document renders as before; the block types and
the drawing modules are additive and harm nothing left in place.
