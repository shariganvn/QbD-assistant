---
title: "P.2 two-strength coverage and full house-form outline"
description: "Give tools/pharma-dev-draft a strength dimension, the department's full P.2 outline with real heading nesting, and a machine-enforced rule that a strength with no experimental source can never carry a measured result. Worked example: Bisoprolol fumarate film-coated tablets 5 mg and 10 mg, where only 10 mg has trial data and 5 mg is a proportional calculation."
status: completed
priority: P1
effort: "4-5d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, schema, renderer, pharma-dev-draft]
created: 2026-09-24
workstream: qbd-p2-bisoprolol-5-10mg
scope_lock: tools/pharma-dev-draft only
blockedBy: []
blocks: []
---

# P.2 two-strength coverage and full house-form outline

## Outcome

`tools/pharma-dev-draft` produces one P.2 document that covers **every strength a product
declares** and carries **the department's full outline** with correct heading nesting. The worked
example is Bisoprolol fumarate film-coated tablets 5 mg and 10 mg: 10 mg has one screening trial,
5 mg has a proportional composition calculation and no measurement at all.

The document must make that asymmetry visible and impossible to fake. A strength declared as having
no experimental source may carry calculated masses in the final-formulation table and nothing else —
every measured-result cell for it stays a marked gap, enforced by the Stage B validator, not by a
note asking the author to be careful.

## Source of truth

- CTD taxonomy and document shape: `docs/raw/135-00-Pharmaceutical Development-example.docx`
  (table of contents and body headings) and `docs/raw/P 2_form_Edit 29-09-2025-example.docx`.
  Both are working structures, **not** FD/regulatory-affairs confirmed authority — the same caveat
  `schemas/p2-outline.json` already carries.
- Open findings this plan closes or moves: `docs/reports/qbd-p2-ich-q8r2-audit/ich-q8r2-format-audit.md`
  (W-1, W-2, W-3 closed by step 03; W-13 becomes gate G-06).
- Tool boundary: `docs/decisions/D20260825-pharma-dev-draft-tool-boundary.md`. Nothing in this plan
  imports from or exports to `cowork-p2-kit/`.
- Executable acceptance: `gates.yaml` (G-00..G-07). Step files describe implementation; they do not
  restate gate bodies.

## Governing rule: dynamic over hard-code

**Format lives in the outline, data lives in the draft, neither lives in the code.**

Every step is checked against three questions, and G-00 checks them by machine:

1. Does adding a third strength require a code change? Must be **no**.
2. Does changing the product or the manufacturing method require a code change? Must be **no**.
3. Does any single value exist in more than one place? Must be **no**.

This generalises what the tenth audit pass found: the format was loose while one product's data was
pinned. Adding a strength dimension is the likeliest place for that mistake to recur, so the check
runs on every test run rather than once by review.

## Scope

In scope: `tools/pharma-dev-draft/schemas/`, `draft/`, `render/`, `verify/`, and the worked example
`draft/example-draft.json`.

Out of scope: `cowork-p2-kit/` (any part), new extraction capability, images (the renderer still
cannot place a figure, so the structural formula, dissolution graphs and process flow diagram stay
manual additions), and filling any gap that needs a source the repository does not hold.

## Ordered steps

- [x] `step-00-shared-marker-constant.md` — one producer for the gap marker before any new logic
      reads it. Must precede step 02.
- [x] `step-01-multi-strength-contract.md` — `meta.strengths`, `meta.derivedStrengths`,
      `form.perStrength`, with the per-strength column-group size derived, not declared.
- [x] `step-02-derived-strength-invariant.md` — `form.measuredOnly` plus
      `E_DERIVED_STRENGTH_HAS_RESULT`. Depends on step 00 and step 01.
- [x] `step-03-full-outline-and-heading-depth.md` — container sections, heading level derived from
      CTD depth, the full 12-container/26-leaf outline. Closes W-1, W-2, W-3.
- [x] `step-04-migrate-existing-content.md` — move every existing value into the new sections,
      adding no data. Depends on step 03.
- [x] `step-05-five-mg-skeleton-and-data-request.md` — build out the 5 mg columns as located
      markers and derive the data-request annex from them. Depends on steps 01, 02, 04.

## Dependencies

```
step-00 ──┐
step-01 ──┴─> step-02 ──┐
step-03 ────> step-04 ──┴─> step-05
```

Step 03 may run in parallel with steps 00–02; step 04 must not start before step 03 lands, and
step 05 needs all of them.

## Exit acceptance

The workstream is done when all of G-00..G-07 hold evidence under
`docs/reports/qbd-p2-bisoprolol-5-10mg/`, and:

- The rendered document covers both declared strengths, with every 5 mg measured-result cell marked.
- The heading tree nests without skipping a level, and Word's navigation pane shows the CTD
  hierarchy.
- No value present in today's `example-draft.json` is lost or duplicated.
- A draft for a different product, a different manufacturing method, or three strengths validates on
  the same form with no code change.

## Deferred, with the condition to reopen

These need a source or a decision the repository does not hold. They are deferred, **not** passing.
Recording them here keeps `gates.yaml` from claiming coverage it does not have.

| Deferred item | Owner | Reopens when |
|---|---|---|
| Linear-formulation confirmation for 5 mg from 10 mg | FD | FD supplies it in writing; until then the 5 mg composition stays a calculation |
| Comparative dissolution 5 mg / 10 mg / reference product | FD lab | Biowaiver dissolution data exists |
| 5 mg tablet design (score line or debossing) | FD | FD states it; the 10 mg tablet is debossed "10" and the house example scores only the high strength, so the two strengths are not design-identical and nothing about 5 mg follows from proportion |
| Film-coating system and processing aids in the excipient list (C-2) | FD | Real batch formula supplied |
| API–excipient compatibility study (C-3) | FD lab | Study report supplied |
| Dissolution method conditions (W-7) | FD | Extracted from `3.2.P.5.2` |
| Process parameters and risk levels (C-4) | FD | Batch records supplied |
| Packaging compatibility (C-5) | FD | Stability data in `3.2.P.8` exists |
| API properties still blank: pKa, LogP, polymorphism, flow, forced degradation (W-5) | FD | Monograph or study data supplied |
| Reference product characterization, 19 cells per strength | FD | Survey performed |
| Effective EP version (W-13) | FD/QA | Gate G-06 — see below |
| Finished-product impurity specification (W-8) | FD | FD confirms the applicable monograph and its impurity list |
| Two numbering errors in the house example | FD | FD signs the renumbering deviation recorded in step 03 |

## Pharmacopoeia version is a discovery gate, not an assumption

The repository cites two versions: the house microbiological form cites EP 11.0, while the API
certificate of analysis for batch 488 states Ph.Eur. 12. The certificate is a supplier statement
about **the drug substance** — kept verbatim — and is not authority for the **finished product**
specification. Until the effective EP version and supplement are named by a verifiable source, every
finished-product EP citation renders as "EP hiện hành — phiên bản chờ FD xác nhận" and appears as one
row in the data-request annex. G-06 blocks writing a version number before that.

## Rollback

Each step is revertible on its own. Steps 00–02 add schema keys and validator rules and can be
removed without touching content. Step 03 changes the outline and the renderer's heading logic; if
the heading tree cannot be derived from CTD depth, revert to the flat `h1()` form and reopen W-1/W-2
rather than hand-maintaining an id-to-level map, which would reintroduce exactly the hard-coding this
plan removes.
