---
phase: 1
title: "Discovery: reach a selected decision and inventory renderable content"
status: completed
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Discovery — reach a selected decision and inventory renderable content

## Context links

- `cowork-p2-kit/reasoning/decision-engine.mjs` (Step 2 rubric gate at :126-135;
  matrix build follows)
- `cowork-p2-kit/reasoning/cohort-evidence.mjs` (requires a complete profile, :19)
- `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json`
- `cowork-p2-kit/reasoning/tests/decision-engine.test.mjs` (shows how a valid
  approved+pinned input is built and what a scored decision looks like)
- `cowork-p2-kit/workflow-trial/spike-e2e-run.mjs:257-270` (the deliberate
  `rubricPin: null` early exit we are replacing)

## Overview

Before building the demo pack or adapter, prove empirically that the existing
engine reaches `selected` from an **approved + correctly-pinned** rubric, one
real-data candidate, and one store-bound synthetic comparator. Inventory the
returned decision/evaluation shape and the existing selected-rationale contract.
This is a bounded feasibility probe, not production implementation.

## Requirements

- Feed `evaluateSelection` the test-approved rubric with
  `rubricPin = sha256(canonicalBytes(rubric))`, two complete candidate profiles,
  and admitted cards for both critical measures. One candidate models the real
  document; the second is explicitly `demo-comparator`.
- Confirm `decision.status === "selected"`, the comparator records/cards are
  required by `minimum_eligible_candidates: 2`, and capture `decision` plus
  `evaluation` fields used by the adapter.
- Inventory the selected-rationale claim shapes already proven by
  `rationale/tests/e2e-rationale.test.mjs`; do not pretend `evaluateSelection`
  returns prose or rationale.
- Record the two later presentation lanes separately: synthetic decision prose
  and exact-join citations. Citation excerpts must not be treated as causal
  support for the synthetic result.
- If no reasonable valid input reaches `selected`, STOP and report
  the exact blocking stage/error — do not invent a workaround.

## Files to create / modify

| Action | Path | Note |
|---|---|---|
| Create | `cowork-p2-kit/workflow-trial/tests/decision-shape-probe.test.mjs` | Probe selected two-candidate output and selected-rationale inputs |

## Implementation steps

1. Reuse the approved rubric fixture and its canonical hash procedure.
2. Build a minimal two-candidate, store-bound fixture: one real-lane shape and
   one visibly synthetic comparator. Phase 2 owns the final run data.
3. Call `evaluateSelection`; assert `selected`; inventory `decision`, matrix,
   candidate review, and sensitivity fields without dumping mock content.
4. Reuse the selected branch pattern from `e2e-rationale.test.mjs` to list the
   required fact/gate/sensitivity/decision-state claims.
5. Record which fields may become generic prose or synthetic score-table cells.
   Record citation inputs as a separate Phase 2 exact-join dependency.

## Gate G-01 — A selected decision is reachable with a store-bound comparator

- Requirement: the engine produces `selected` from an approved+pinned rubric,
  one real-lane candidate, and one admitted store-bound synthetic comparator.
- Boundary / owner: `reasoning/decision-engine.mjs` via the probe test; Phase 1.
- Fixture: approved rubric fixture + inline two-candidate admitted records/cards.
- Command: `node --test cowork-p2-kit/workflow-trial/tests/decision-shape-probe.test.mjs`
- Expected exit/output: exit `0`; `decision.status === "selected"`; inventory of
  decision/evaluation and selected-rationale input fields.
- Negative cases: rubric still `proposal` → `E_RUBRIC_APPROVAL_REQUIRED`;
  `rubricPin: null` → `E_RUBRIC_PIN_REQUIRED`; wrong pin → `E_RUBRIC_PIN_MISMATCH`
  (each asserted to still fail-closed).
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/decision-shape-probe.md`
- Blocks: Phases 2, 3, 4.
- Status: passed (2026-08-06)

## Success criteria

- [x] G-01 passes with a captured field inventory.
- [x] Negative rubric states still return their inconclusive codes.

## Risks

If the engine cannot reach `selected` with a valid store-bound comparator, the
content-demo premise fails. STOP and report the exact contract code; do not
bypass admission, publication binding, or minimum-candidate rules.

<!-- Updated: Validation Session 1 - require store-bound comparator and separate decision/rationale/citation lanes -->
