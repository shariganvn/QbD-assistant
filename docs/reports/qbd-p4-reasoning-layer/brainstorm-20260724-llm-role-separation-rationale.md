---
title: "Brainstorm — Separate LLM roles for fact extraction and rationale"
workstream: qbd-p4-reasoning-layer
status: open
date: 2026-07-24
scope: future rationale-generation step after the evidence-bound comparison core
---

# Separate fact extraction from rationale generation

## Status and boundary

This is a **separate-session option record**, not an approved rationale implementation design and
not a plan delta. The sequencing decision is recorded in
[`D20260724 — Reasoning Core Before Rationale`](../../decisions/D20260724-qbd-reasoning-before-rationale.md).
It must not change the scope or status of the active Step 1 contract-and-harness work.

The active P4 plan keeps its current boundary: an LLM may create fact cards from admitted record
`content`; deterministic code validates them and produces a traceable decision. P.2.2/P.2.3
drafting remains deferred. See [the active plan](../../plans/qbd-p4-reasoning-layer/plan.md) and
[the approved comparison rationale](./brainstorm-20260724-evidence-bound-formulation-comparison.md).

## Product question

After a winner or `inconclusive` result is evidence-bound, Product Owner may want an LLM to write
a clear, human-readable rationale from the winning and countervailing facts. This should be
considered as a later capability, independently from fact extraction and independent from the
current Step 1 implementation.

## Candidate operating model

```text
admitted records
  -> Fact extractor LLM
  -> deterministic fact-card validation
  -> deterministic cohort/rubric/decision core
  -> sealed decision packet
  -> Rationale-author LLM
  -> deterministic rationale validation
  -> readable rationale derivative
```

The candidate model separates two LLM contexts and permissions:

| Role | Permitted input | Permitted output | Must not do |
|---|---|---|---|
| Fact extractor | Admitted record content and extraction contract | Provenance-bound fact cards | Pick a winner, invent units/values, use external sources |
| Rationale author | A sealed packet containing the result, approved fact cards, quoted evidence, rubric outcomes, exclusions, and FD actions | Traceable explanation that references packet fact IDs | Re-read the corpus by default, change the decision, add facts, perform external research |

The deterministic decision core is the authority between the two roles. A separate context is
more important than a separate product-agent abstraction: two constrained invocations with an
immutable JSON handoff may be sufficient.

## Options retained for a later decision

| Option | Benefit | Cost / risk | Current position |
|---|---|---|---|
| One LLM invocation extracts facts and writes rationale from the raw corpus | Lowest orchestration cost | Self-confirmation, unclear evidence boundary, harder audits and tests | Not recommended |
| Separate fact-extractor and rationale-author contexts, with deterministic decision core and sealed JSON handoff | Clear authority boundary, traceability, isolated prompts/models, testable contract | Adds an artifact, a validator, and a later workflow step | Recommended candidate; not yet approved |
| Deterministic templated explanation only | Strongest reproducibility and no new LLM claim risk | Less readable and less useful for nuanced comparison | Viable fallback, especially for `inconclusive` |

## Design constraints if Option 2 is selected

- The rationale author receives only facts that passed validation and were used or explicitly
  excluded by the decision run; it does not receive mutable live-store access by default.
- The handoff includes a run ID and hashes for the canonical decision/evidence artifacts so the
  rationale cannot be silently disconnected from its source decision.
- Prefer structured output first: each explanatory claim maps to one or more fact-card IDs and
  preserves verbatim evidence quotes. Markdown is a deterministic derivative or is checked by
  regeneration/equality rules.
- A rationale cannot turn `inconclusive` into a recommendation. It may explain the recorded
  missing/conflicting evidence and the FD action, if that behavior is expressly approved.
- The future step must retain the existing no-external-evidence, public/mock admission, and
  FD-rubric authority boundaries.

## Questions reserved for the separate session

1. May the rationale author see any raw record content beyond quotes in the sealed packet?
2. Should its canonical output be structured claim-to-fact JSON, Markdown with citations, or both?
3. Does `inconclusive` require a human-readable rationale and an FD-adjudication explanation?
4. Is this capability a decision explanation only, or a later bridge into P.2.2/P.2.3 drafting?
5. What review level is required before the rationale is shown externally: automatic validation,
   FD approval, or both?

## Re-entry condition

Open a new design/plan session only after Product Owner answers the reserved questions. That
session should create a separate plan delta or new workstream step; it must not be folded into
the Step 1 contract-and-harness gate without explicit approval.
