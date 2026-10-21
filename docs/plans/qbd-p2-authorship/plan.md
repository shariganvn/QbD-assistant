---
title: "Provenance is not a signature, and the conformance record catches up"
description: "The sign-off table named the tool that assembled the draft as its drafter, with a date beside it, in a document whose purpose is to be auditable. Provenance moves to the scope notice, the three signature rows are left blank, and the ICH Q8(R2) record closes the process finding that Trial 2 settled."
status: completed
priority: P2
effort: "0.5d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [fix, contract, renderer, data-integrity, pharma-dev-draft]
created: 2026-09-26
workstream: qbd-p2-authorship
scope_lock: tools/pharma-dev-draft + docs/reports/qbd-p2-ich-q8r2-audit
blockedBy: []
blocks: []
---

# Provenance is not a signature

## Outcome

No data was reachable this round either: 149 gap markers wait on a measurement, a number from FD, or
another CTD module, and 19 decisions wait on someone with authority. What was left were two places where
the document made a false statement **about itself**.

**The sign-off table named a tool as the drafter.** It rendered as
`Soạn thảo (Claude (phiên làm việc 2026-08-20, tổng hợp từ Thử nghiệm 1))   —   2026-08-20`: a row with
a "Chữ ký" column, pre-filled, on a document that exists to be audited. The date was also five weeks
stale, and the parentheses were doubled by string concatenation.

The cause was the field's **name**. `meta.preparer` reads as "the person who prepared this", so it drifted
onto a signature line. The field is now `meta.assembledBy`, it prints once in the scope notice as
provenance, and the sign-off table's three rows are blank for people to sign.

**The conformance record was one round stale, in the worst direction.** It still carried N-1 as an open
CRITICAL — the dossier claiming direct compression while Trial 1's in-process table described granules —
and still named it the most important open item. Trial 2 settled that weeks ago. Round 12 closes it,
extends C-1 with the lubricant as the second established critical attribute, and corrects the
conclusion: the urgent item is the copied Trial 2 results table.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — `assembledBy` and `draftDate`.
- Executable acceptance: `gates.yaml` (G-32..G-34).
- Evidence: `docs/reports/qbd-p2-authorship/g32-g34-authorship.txt`.
- Conformance record: `docs/reports/qbd-p2-ich-q8r2-audit/ich-q8r2-format-audit.md`, round 12.

## The rule is positional, and that is the point

A check that looked for AI-sounding strings would pass a draft whose field held an invented person's
name — the same false statement with better camouflage. So `signoffRows()` takes no arguments at all: a
table with a signature column reads no field of the file, and therefore cannot claim anyone accepted
responsibility. `verify.mjs` then requires `assembledBy` to be printed exactly once and before the
sign-off heading.

## Ordered steps

- [x] `step-16-provenance-not-signature.md` — the rename, the blank rows, the provenance sentence, the
      positional rule, and round 12 of the conformance record.

## Exit acceptance

G-32..G-34 hold evidence. 129 tests pass (122 previous, 7 new), `value-inventory` reports
`added: 0 (marker 0, prose 0, data 0)`, the rendered document passes XSD and the text checks, and the
four figures are byte-identical to the previous render. Marker counts unchanged: 149 gaps, 19 decisions.

## Rollback

Rename the field back and print it into the drafter's row; the false statement returns with it, and the
verifier will refuse the result.

## What no tool can do next

P.2 now waits on three things, none of which is code:

1. Buy the comparator product and measure it — 38 cells in `P.2.2.1.1`. Three rounds of source hunting
   ended in "there is none": nationally authorised, so no EPAR, and accessdata.FDA blocks every path at
   their end.
2. FD supplies risk levels and process parameters — 35 matrix cells and 10 parameter cells.
3. Someone with authority settles the 19 decisions. The urgent one is Trial 2's finished-product results
   table: 25 of its 45 numeric cells are verbatim Trial 1 values in a block pattern. That is experimental
   data, not formatting, so the tool could do exactly one thing about it, and has: refuse to put it in.
