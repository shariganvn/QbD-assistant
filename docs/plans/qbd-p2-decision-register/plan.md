---
title: "The document reports what must be decided, not only what is missing"
description: "A second marker kind for a conflict or an unapproved assumption, enforced at Stage B and rendered as its own annex, so the dossier stops under-reporting what stands between it and submission. Also brings the ICH Q8(R2) conformance record back in line with the document it describes."
status: completed
priority: P2
effort: "1d"
issue: null
branch: claude/codebase-architecture-summary-po0utr
tags: [feature, contract, renderer, pharma-dev-draft]
created: 2026-09-26
workstream: qbd-p2-decision-register
scope_lock: tools/pharma-dev-draft + docs/reports/qbd-p2-ich-q8r2-audit
blockedBy: []
blocks: []
---

# The document reports what must be decided

## Outcome

The rendered document listed 143 things nobody had measured and **nothing** anybody had to choose. It
was carrying both: a finished-product impurity limit naming no impurity while the substance
certificate names three, two pharmacopoeia versions cited in one dossier, an excipient sitting at the
top of its recommended range, a "not applicable" inferred from the dosage form. Each was written down,
in prose, and therefore in no list — so the document read as though data were the only thing between
it and submission.

There are now two registers, both derived from the draft. 149 data requests and **16 decisions**, each
naming what must be settled and who settles it.

Re-running the conformance check against the current document also found the thing this round is most
worth: the dossier states its process is direct compression while the trial's own in-process table is
titled "granule physical properties", measures moisture at 105 °C, and the formula carries a wet
granulation binder. That is one sentence for FD to confirm, and several rendered sections change if
the answer is the other one.

## Source of truth

- `tools/pharma-dev-draft/schemas/p2-draft-contract.md` — the two markers and `meta.decisionOwners`.
- Executable acceptance: `gates.yaml` (G-13..G-18).
- Preceding work: `docs/plans/qbd-p2-figures/` and `docs/plans/qbd-p2-bisoprolol-5-10mg/` (both `completed`).

## Governing rule, unchanged

**Format lives in the outline, data lives in the draft, neither lives in the code.** A second marker
kind is an easy place to break that, in two ways, and both are tested:

- It must not become a way around the first. A cell in a `measuredOnly` table belonging to a derived
  strength still has to carry the **gap** marker: nobody can decide a cell whose strength has no batch.
- Who may settle a decision is **data**. It is read from `meta.decisionOwners`, not built into the
  checker, so a department naming its roles differently is not wrong.

One spot is one kind. A text carrying both labels is rejected rather than listed twice.

## Ordered steps

- [x] `step-09-two-marker-kinds.md` — the second label in the single producer, the Stage B rules, the
      second annex, and the registers' shared label-stripping.
- [x] `step-10-record-the-decisions.md` — the conformance re-check, and the findings moved into the
      new construct or marked where they were invisible.

## Exit acceptance

G-13..G-18 hold evidence under `docs/reports/qbd-p2-decision-register/`. The rendered document carries
both annexes, passes schema validation, keeps its three figures, and the conformance record states each
finding's real status.

## Rollback

Remove `meta.decisionOwners` and the decision markers and the document renders with one annex as
before; the second label, the register module and the annex are additive.
