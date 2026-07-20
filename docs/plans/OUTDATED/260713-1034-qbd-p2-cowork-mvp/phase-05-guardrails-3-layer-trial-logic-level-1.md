---
phase: 5
title: "Guardrails 3-layer + trial-logic Level-1"
status: pending
priority: P1
effort: "1.5d"
dependencies: [4]
---

# Phase 5: Guardrails 3-layer + trial-logic Level-1

## Overview

Keep the three guardrail layers named distinctly, and implement the MVP-applicable ones:
the runtime LLM guardrails, the classification admission check, and a Level-1 mechanical
trial-logic checker. The code-enforced data-access boundary and the code egress router are
**documented here but implemented in Phase 2 `qbd_core`** (no internal store exists in the MVP).

## Requirements

- Functional: guardrail checks run on the Phase-4 draft; an unsourced/fabricated claim is
  caught; a seeded mechanical trial error is flagged; unlabeled/internal data is not admitted.
- Non-functional: checks are deterministic where possible (labels, numeric sanity, trial-logic);
  probabilistic checks (grounding, injection) are explicit and logged.

## Architecture — 3 distinct layers (see `docs/system-architecture.md` §3)

1. **Data-access boundary** — code-enforced isolation. **MVP: N/A** (no internal store wired);
   documented for Phase 2.
2. **Egress control** — router checks classification label before each LLM call, fail-closed
   default-internal when unlabeled. **MVP:** the admission block is **enforced at ingest**
   (Phase 2 aborts on any non-`public` input — a real gate, not a passive label); this layer
   re-confirms only `public`/mock records reached reasoning. The generalized router-as-code is
   Phase 2 `qbd_core`.
3. **LLM guardrails (runtime, implemented now)** — grounding (no evidence ID → no claim),
   source-tier ranking, numeric/unit sanity, prompt-injection defense.

## Related Code Files

- Create: `cowork-p2-kit/guardrails/check-grounding.mjs` — every claim has a store record ID or "chờ dữ liệu"
- Create: `cowork-p2-kit/guardrails/check-numeric-sanity.mjs` — unit/total consistency
- Create: `cowork-p2-kit/guardrails/trial-logic-level-1.mjs` — mechanical consistency flags
- Create: `cowork-p2-kit/guardrails/README.md` — what runs in MVP vs deferred to Phase 2
- Modify: `cowork-p2-kit/SKILL.md` — invoke guardrails in step 4

## Implementation Steps

1. **Grounding check:** scan the draft; any claim without a store record ID must be "chờ dữ liệu";
   fail the run if a bare unsourced factual claim exists. Also **fail any claim citing a
   `citable:false` record** (e.g. cross-drug reference like 135-00) — trust axis, not just presence.
2. **Source-tier ranking:** annotate each citation with its tier (pharmacopoeia / FDA-EMA label
   / PAR / Q1–Q3 journal > general web); flag low-tier-only support.
3. **Numeric/unit sanity + injection defense:** check units/totals; strip/deny instructions
   embedded in ingested content (do not follow injected instructions).
4. **Trial-logic Level-1 checker (mechanical only):** unit/total mismatch,
   missing-result-with-conclusion, wrong product/substance. Flags only — **do not expand scope.**
5. **Classification admission:** confirm only `public`/mock records reached the reasoning step;
   unlabeled ⇒ internal ⇒ blocked.
6. Document in `guardrails/README.md` which layers are MVP vs Phase-2.

## Success Criteria

- [ ] A seeded unsourced claim is caught (grounding); a claim citing a `citable:false` record is rejected.
- [ ] A seeded unit/total mismatch and a missing-result-with-conclusion are flagged (trial-logic L1).
- [ ] Citations carry source tiers; low-tier-only claims are flagged.
- [ ] Injected instructions in ingested content are not followed.
- [ ] README states data-access boundary + egress router are Phase-2 (not silently skipped).

## Risk Assessment

- **Scope creep on trial-logic:** Level-1 mechanical only; resist expanding into scientific
  judgment — that is out of pilot scope and would produce unreviewable false positives.
- **False sense of security:** the MVP admission check is not the code-enforced boundary;
  the README must say so, so the MVP posture is not mistaken for production.
