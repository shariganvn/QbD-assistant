---
phase: 4
title: "Publish Inconclusive Reasoning Package and Seal Packet"
status: pending
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4: Publish Inconclusive Reasoning Package and Seal Packet

## Context Links

- [Phase 3](./phase-03-bind-receipt-occurrences-to-truthful-ingest-records.md)
- `cowork-p2-kit/SKILL.md`
- `cowork-p2-kit/reasoning/cohort-evidence.mjs`
- `cowork-p2-kit/reasoning/decision-engine.mjs`
- `cowork-p2-kit/reasoning/publication.mjs`

## Overview

Use the isolated records plus one explicit inline synthetic policy/context card
to exercise reasoning construction, publication, and fresh-root packet sealing.
The only acceptable result is a deterministic pre-matrix inconclusive decision;
the trial must not reinterpret specification data as formulation performance.

## Requirements

- Functional: candidate `trial-candidate-01` and all required profile values are
  visibly synthetic test values; no filename or scientific inference.
- Functional: at least one non-result context fact card binds exact record ID,
  quote, offsets, value/unit, candidate, and source. It must not masquerade as a
  release/assay result or satisfy a scoring cell.
- Functional: rubric remains `proposal`, pin remains unavailable, and the
  expected decision is `inconclusive` before matrix/scoring construction.
- Non-functional: reasoning package and sealed packet publish only to injected
  temp roots and bind the isolated store SHA-256.

## Architecture

The E2E test composes existing production primitives:

```text
records + reviewed trial policy/fact card
  -> buildCohortEvidence
  -> evaluateSelection (expected inconclusive)
  -> createReasoningCli({ publicationRoot }).publish-package
  -> validatePublishedDecisionPackage
  -> createRationaleCli({ publicationRoot: freshEmptyRoot }).seal-packet
```

No general records-to-fact-card production policy is introduced.

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/tests/workflow-trial.e2e.test.mjs` | +90-140 lines | Inline policy, package, packet, cross-stage negatives |

## Function and Interface Checklist

- [ ] `buildCohortEvidence` consumes only the isolated records and explicit map.
- [ ] `evaluateSelection` exits on proposal approval state before matrix scoring,
      returns the frozen inconclusive code, and has no winner/scored cells.
- [ ] `createReasoningCli` uses a run-local declared root.
- [ ] `validatePublishedDecisionPackage` reopens package against store bytes.
- [ ] `createRationaleCli(...).seal-packet` uses a different fresh empty temp root;
      no same-root rollback guarantee is claimed.

## Implementation Steps

1. Write cross-stage tests proving missing/forged synthetic policy, unbound card,
   store hash drift, scoring entry, and unexpected selected result fail.
2. Freeze one inline synthetic profile and one context-only fact card from an
   exact record. Use a trial-only measure name outside the proposal rubric.
3. Build cohort/evidence log, attach the card ID, define all record roles as
   `context`, and call `evaluateSelection` with a proposal rubric and no pin.
4. Assert `winner=null`, exact inconclusive status/action/card ID, empty matrix
   and scoring projections, then publish with fixed trial IDs.
5. Validate the reasoning package member allowlist/receipt/hashes against the
   actual isolated store, then seal and validate `rationale-packet.json`.
6. Re-run reasoning publication for idempotence; seal each packet only into a
   fresh empty root and test tamper rejection without promising packet rollback.

## Test Scenario Matrix

| Risk | Scenario | Expected |
|---|---|---|
| Critical | Context card reaches matrix/scoring | Reject trial policy/run |
| Critical | Decision becomes `selected` | Fail acceptance immediately |
| Critical | Store/package SHA mismatch | Existing fail-closed error; no packet |
| High | Candidate/profile incomplete | `E_COHORT_PROFILE_MISMATCH` |
| High | Publication member/receipt tampered | Revalidation failure; prior bytes safe |

## Success Criteria

- [ ] Package is built from the same-source store and is deterministically inconclusive.
- [ ] The context card resolves to one exact record but is never scored.
- [ ] Sealed packet validates without giving the rationale author store access.

## Risk Assessment and Rollback

Reasoning primitives do not enforce context-vs-results scoring. The proposal
rubric early exit plus empty-matrix assertion is the trial guard, not a new
production promise. Rollback removes only controller-test changes.

## Security Considerations

Document contents remain untrusted. No model, external search, mutable store
widening, or production publication root is permitted.

## Next Steps

Phase 5 hands only the sealed packet to the deterministic test author; a truly
distinct human context remains an optional procedural review.
