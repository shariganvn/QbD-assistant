---
title: "Each trial's manufacturing process, drawn from the table that states it"
description: "A third figure kind: unit operations running down the page with the components added at each one branching in from the left. Trial 2's process has a source now, so the sequence decision closes; Trial 1's is a note pointing at it rather than a second copy."
status: completed
priority: P2
effort: "0.5d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, renderer, pharma-dev-draft]
created: 2026-09-26
workstream: qbd-p2-process-diagram
scope_lock: tools/pharma-dev-draft only
blockedBy: []
blocks: []
---

# Each trial's process

## Outcome

The document had one way to draw a process: a left-to-right chain of unit operations, read off the
risk matrix's columns. It says which operations exist and nothing about **what enters where** — which,
for a direct-compression process with three blending steps, is the entire content. A reviewer reads a
process diagram to learn that the disintegrant goes in at the second blend and the lubricant at the
last, and the chain cannot show it.

There is now a second shape: operations down the page, components branching in from the left, drawn
from a four-row table in the trial's own section.

The sequence itself arrived from FD this round. The previous round had left it as an open decision
rather than inferring it, because the source document draws its process as text boxes and the extractor
reads those in file order, not visual order — the operation set was certain, the order was not. That
decision closes.

Trial 1's document describes no process. Its branch gets a note and a decision for FD, not a copy of
Trial 2's diagram: drawing one process twice is one process in two places, and they diverge the first
time somebody corrects one.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — the `process` figure kind.
- Executable acceptance: `gates.yaml` (G-26..G-28).
- Evidence: `docs/reports/qbd-p2-process-diagram/`, including the rendered diagram.

## Governing rule, unchanged

**A figure carries no content of its own; it names a table in its section and the renderer reads it at
draw time.** So the process is a table first and a picture second, and correcting the table corrects
the diagram with no second edit.

Two decisions follow from that and are tested:

- The table's shape is **required outright** — three columns, step number, components, operation —
  rather than derived by `labelColumnCount`. That helper models "ordinals plus one label column", which
  puts the components on the label side and the operation on the value side; both matter here. A fourth
  column appended later would otherwise be drawn as the operation.
- A step that adds nothing writes `—`, not a blank. A blank cell in this document means "not
  applicable", which is the reading the markers exist to prevent.

## Ordered steps

- [x] `step-14-process-diagram.md` — the figure kind, Trial 2's table and diagram, Trial 1's note, and
      the three concrete differences against the risk matrix.

## Exit acceptance

G-26..G-28 hold evidence. The rendered document carries four figures, passes schema validation, and the
process diagram was looked at rather than only tested — the previous figures round had three drawing
faults that no test caught.

## Rollback

Remove the `process` kind from the valid set and the figure block from the draft; the table stays and
still states the process in words.
