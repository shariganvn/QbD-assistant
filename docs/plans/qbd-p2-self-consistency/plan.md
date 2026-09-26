---
title: "The document checks its own references and its own glossary"
description: "Eleven internal references pointed at container sections that hold no content, and the abbreviation table lived in the renderer while five of its ten entries named terms the text had stopped using. Both are now derived from the document and enforced at Stage B."
status: completed
priority: P2
effort: "0.5d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, contract, pharma-dev-draft]
created: 2026-09-26
workstream: qbd-p2-self-consistency
scope_lock: tools/pharma-dev-draft only
blockedBy: []
blocks: []
---

# The document checks itself

## Outcome

Two defects the document had inflicted on itself, both machine-checkable, neither touching data.

**Eleven internal references pointed nowhere.** The dossier is full of "xem mục P.2.x" and nothing
checked them. Six distinct references, eleven occurrences, all aimed at **container** sections — a
container carries a heading and no content, so a reviewer following one arrives at an empty heading.
`P.2.2.1.3` where the tables are in `P.2.2.1.3.3`; `P.2.2.1.2` where the specification is in
`P.2.2.1.2.1`. In a submission that reads as a dead link.

**The glossary lived in the renderer.** A hard-coded array in `render/builder.mjs`, and five of its ten
entries named terms the text had stopped using — leftovers from when the draft still wrote "RMP" instead
of "thuốc đối chiếu". A glossary kept beside the layout code drifts against the content it explains.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — `meta.quotedNumbering`, `meta.abbreviations`.
- Executable acceptance: `gates.yaml` (G-23..G-25).
- Evidence: `docs/reports/qbd-p2-self-consistency/g23-g25-self-consistency.txt`.

## Governing rule, unchanged

**Format lives in the outline, data lives in the draft, neither lives in the code.** The glossary
describes this document's text, so it is data; the order it prints in is format, so the renderer sorts
it. And the one legitimate exception to the reference rule — a number quoted from the department's own
worked example, which numbers two different subsections the same — is declared in the draft rather than
listed in the checker.

A second rule earned its own gate this round: **a check that cries wolf is a check people learn to
ignore.** The reference rule runs in one direction only, and so does the glossary rule.

## Ordered steps

- [x] `step-13-references-and-glossary.md` — both rules, the eleven redirects, and the tokenising trap
      that caught this work twice from opposite sides.

## Exit acceptance

G-23..G-25 hold evidence. Every internal reference resolves to a leaf, every declared abbreviation
appears in the text, and 107 tests pass.

## Rollback

Remove the two validator rules and the draft's `abbreviations`/`quotedNumbering`; the renderer would need
its hard-coded array back, which is the thing this round removed.
