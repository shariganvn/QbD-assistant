# Step 12 — What the second trial establishes, and what it costs to check

Status: pass · Gates: G-19, G-22

## How the numbers got in

Through Stage A, `extract/extract.mjs` on the xml-walk path: 33 paragraphs, 3 tables, deterministic, no
interpretation. A subagent read the document first to say what was in it — the project's own rule for
office files — but not one number in the draft came from that reading. The two roles are different: a
scout says where to look, an extractor says what is there.

Two mapping hazards were handled explicitly rather than by a rule that would look tidy and be wrong. Two
rows of the blend table carry no sub-label, so their values sit one column to the left of every other
row; they are mapped by hand, because a general rule would have shifted a number into the neighbouring
formulation's column. And both compositions were added up rather than read off the document's own
"Tổng cộng" row: 100,00 mg each, which is the check, not the claim.

## What it settled

**The process is direct compression.** The step set is sieving, two blends, a final blend with sieved
lubricant, and compression — no granulation, no wetting, no drying. This is the first experimental source
in the dossier to describe the process at all, and it closes the finding that blocked the most: the
in-process table of the first trial is titled "tính chất vật lý cốm", and read alone that title is a
reason to suspect granulation. It is not. "Cốm" in this department's forms means the blend ready for
compression. Povidone is in the formula as a dry binder, not a granulating solution. The disintegrant
benchmark used for direct compression is therefore the right one.

**The lubricant level is the second critical formulation attribute** established the way the guideline's
baseline page describes — by varying one factor while holding the rest. At 1% the tablets stuck to the
punch; at 5% hardness fell and friability rose. The control follows: hold 3%, and watch hardness and
friability because those are the attributes it moves.

Both conclusions are stated with their limits. 3% was never tested in the second trial — it was the fixed
level throughout the first — so what is proven is that 3% beats both 1% and 5%, not that it is optimal
between them.

## What it cost to check, and what stayed out

**Twenty-five of the forty-five numeric cells in the finished-product results table are verbatim values
from the first trial.** Not scattered: the hardness, thickness, friability, disintegration, assay,
dissolution and impurity blocks of the two columns map onto CT02 and CT03, while the weight-uniformity
block maps onto CT01 and CT02. An independent dataset does not fall into that pattern.

Four of those cells are only visible after normalising quote marks — the second trial writes minutes and
seconds with typographic marks where the first uses plain ones. A comparison that skips that step reports
a cleaner document than it has.

That table is not in the dossier. The section names it, gives the comparison, and asks FD for the real
measurements or for confirmation that these are the same batches reported again. This is not a data gap:
the numbers exist. It is a spot where nobody can say which batch they describe.

The blend table went in, with its own open decision. Three of its twenty-four cells match the first
trial's. Against that, three internal checks hold: each Hausner ratio equals its own tapped/bulk
quotient, and both particle-size distributions sum to 100,00% — arithmetic a partially copied table
usually breaks. The evidence points both ways, so the document says so instead of choosing.

The step **sequence** stayed out. The source draws it as a flow diagram, and the extractor reads text
boxes in XML order, not visual order. The pharmaceutically obvious order is exactly why not to write it:
an order that is obvious is still an order with no source.

## Two identifier defects in the source

The dissolution specification row names **pravastatin sodium** — a different active ingredient
altogether — and cites "cEP 2.9.40". Both are recorded verbatim and neither is corrected here: editing
figures in someone else's released document is not this document's business. But a development report
naming another product's active cannot serve as evidence until it is reissued.

## The honest arithmetic of the round

The gap-marker count did not move: 149 before, 149 after. The cells the second trial could have filled
are the finished-product results, and that is the table that was refused.

Decisions went from 16 to 20 — two closed, six opened. A source with a demonstrated copy-paste defect
asks more questions than it answers, and the register is the right place for that to show.

Both formulations are at the 10 mg strength. `meta.derivedStrengths` still lists 5 mg, and its cells still
carry markers. Two trials at one strength do not make a batch at another.
