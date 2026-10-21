---
title: "A figure names its table instead of counting to it"
description: "The reference from a figure to its table was a positional index, and a table moved or inserted ahead of a figure silently redirected it three times in two rounds. Tables that a figure points at now declare an id, and the failure becomes impossible rather than watched for."
status: completed
priority: P2
effort: "0.5d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [fix, contract, renderer, pharma-dev-draft]
created: 2026-09-26
workstream: qbd-p2-table-reference
scope_lock: tools/pharma-dev-draft only
blockedBy: []
blocks: []
---

# A figure names its table

## Outcome

No data was reachable this round — 149 gaps wait on measurement, 19 decisions wait on FD and QA, and
three rounds of source hunting ended in "there is none". What was worth doing is a known weakness in
the tool itself.

`fromTable` was an index into the section's tables. Moving or inserting a table ahead of a figure
redirected that figure, and it happened three times in two rounds. Every time it was caught by a check
aimed at something else: the process diagram's column count, the chart's row name, and once by five
failing tests. The `flow` kind has no such check — it reads column headings straight into unit
operation names — so a misdirected flow figure would have drawn a **different manufacturing process**
into a registration dossier with nothing to complain about.

Tables that a figure points at now declare an `id`, and the figure names it. A name does not move when
the table does.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — `fromTable` and the table `id`.
- Executable acceptance: `gates.yaml` (G-29..G-31).
- Evidence: `docs/reports/qbd-p2-table-reference/g29-g31-table-reference.txt`.

## The distinction this preserves

`form.tables[]` in the outline **is** positional, and should stay so: it says "the Nth table of this
section must have this shape". That is format, and a table inserted in the middle ought to break it.

A figure points at **content**, so it points by name. Writing both rules down in the contract is the
point — otherwise a later round "harmonises" them and reintroduces this.

## Ordered steps

- [x] `step-15-tables-by-name.md` — the id, the resolver, the three names, and the shuffle that proves
      the old form fails where the new one holds.

## Exit acceptance

G-29..G-31 hold evidence. 122 tests pass, and the four rendered figures are byte-identical to the ones
produced before the change — the refactor moved no content.

## Rollback

Return `fromTable` to an integer and drop the ids; the failure it removes comes back with it.
