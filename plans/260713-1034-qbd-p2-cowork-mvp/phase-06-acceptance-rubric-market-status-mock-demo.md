---
phase: 6
title: "Acceptance — rubric + market-status + mock demo"
status: pending
priority: P1
effort: "1.5d"
dependencies: [4, 5]
---

# Phase 6: Acceptance — rubric + market-status + mock demo

## Overview

Close Phase 1: fill the P0.1 dossier-readiness rubric and wire self-scoring, add the
reference-product market-status task, and run the full pipeline end-to-end on mock bisoprolol
trials to produce the three deliverables under a single-FD review structure.

## Requirements

- Functional: rubric self-score computed; market-status section present with sources + FD-confirm
  placeholder; end-to-end mock run emits all three outputs with claim-level review affordances.
- Non-functional: run is reproducible from the kit; outputs are draft-only.

## Architecture

Rubric = the P0.1 weighted scheme (FD acceptance gate), NOT the P1.5 golden-set gate — keep
separate (see `docs/system-architecture.md` §6). Review gate = claim-level Accept/Edit/Reject
represented in the output structure (evidence adjacent); **no UI** (deferred "vòng sau").

## Related Code Files

- Fill: `cowork-p2-kit/rubric/scoring-90-100.md` — weighted rubric + critical-error list
- Create: `cowork-p2-kit/rubric/self-score.mjs` — compute score from the draft + evidence-log
- Create: `cowork-p2-kit/market-status/reference-product-check.md` — DAV/EMA/USP procedure + log
- Modify: `cowork-p2-kit/SKILL.md` — add self-score step + market-status input
- Output: `cowork-p2-kit/outputs/{p2-draft.docx, evidence-log.md, formula-decision.md}`

## Implementation Steps

1. Fill `scoring-90-100.md`: weights **coverage 20 / product-fact 25 / evidence-support 20 /
   provenance 10 / no-fabrication 10 / logic-consistency 10 / usability 5**; **min 90/100, zero
   critical errors**; approver = Trưởng phòng FD. Enumerate the critical-error taxonomy.
2. Implement `self-score.mjs` to compute the weighted score from the draft + evidence-log and
   emit a scorecard; mark it **self-assessment** until an FD answer key exists.
3. Build the market-status task: check **DAV (VN) + EMA (EU) + USP (US)**, monthly recheck
   cadence, log sources + dates, leave an FD comparator-suitability confirmation field.
4. Add claim-level **Accept / Edit / Reject** affordances into the output (evidence adjacent);
   document that this is the MVP review gate (no UI).
5. Run the **end-to-end mock demo** on bisoprolol mock trials → `p2-draft.docx` +
   `evidence-log.md` + `formula-decision.md` + scorecard.

## Success Criteria

- [ ] `scoring-90-100.md` encodes the exact weights, threshold, and critical-error list.
- [ ] `self-score.mjs` computes a scorecard (labeled self-assessment).
- [ ] Market-status section lists DAV/EMA/USP sources + dates + FD-confirm field.
- [ ] End-to-end mock run emits all three outputs; every claim sourced or "chờ dữ liệu".
- [ ] Each claim carries an Accept/Edit/Reject affordance with adjacent evidence.

## Risk Assessment

- **P0.1 answer key missing (tracked):** no leakage-free adjudicated claim set exists yet.
  The rubric runs as self-assessment; a trustworthy 90/100 gate is blocked on the FD-provided
  key. Do not present the self-score as an FD-accepted pass.
- **Conflate risk:** keep P0.1 (FD acceptance) and P1.5 (local-model promotion) rubrics separate.
