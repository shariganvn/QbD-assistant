---
title: Rationale/report layer boundary and planning inputs
id: D20260728
status: active
date: "2026-07-28"
scope: qbd-rationale-report-layer
supersedes: null
affects:
  - docs/plans/qbd-p4-reasoning-layer/
  - cowork-p2-kit/reasoning/
  - docs/reports/qbd-p4-reasoning-layer/decision/
read_when: Planning or implementing an LLM-generated human rationale/report from reasoning artifacts.
---

# D20260728 — Rationale/Report Layer Boundary

## Decision

Create the future human-facing rationale/report capability as a separate layer after the completed
reasoning core. It consumes only a sealed packet derived from completed reasoning artifacts; it never
re-evaluates the mutable store, selects a formulation, changes a decision, adds evidence, or overwrites
the deterministic `formula-decision.md` and `evidence-log.md` derivatives.

The Product Owner approved these planning inputs:

1. The rationale author receives no raw record content beyond the validated quotes and metadata carried
   in the sealed packet.
2. The canonical output is structured claim-to-fact JSON. Any human-readable Markdown is a deterministic
   derivative or must pass an equivalent regeneration/equality validation.
3. An `inconclusive` decision receives a human-readable explanation of recorded missing/conflicting
   evidence and its FD action, but cannot become a recommendation.
4. The first scope is decision explanation only. It does not draft or bridge into P.2.2/P.2.3.
5. Any external-facing rationale requires both deterministic validation and FD approval before display.

## Required packet and controls

The future plan must define an immutable, hash-bound packet from `formula-decision.json`,
`selection-evaluation.json`, `fact-cards.json`, `cohort.json`, `evidence-log.json`, and the publication
receipt. Each generated claim must bind to permitted fact-card IDs and its allowed evidence quote(s).
Missing bindings, packet hash/run-ID mismatches, evidence outside the packet, invented numeric values or
units, and attempts to alter the decision state must fail validation.

The layer retains D20260727 boundaries: no external search/egress, no mutable-store access by default,
and no new scoring, ranking, rubric, or evidence-admission policy. The separate human-only execution
report remains an operational-control artifact, not rationale input or publication content.

## Consequences

- A new rationale/report plan or explicit P4 plan delta is required before implementation.
- That plan must include an artifact contract, packet builder/validator, claim-to-evidence validator,
  deterministic readable derivative, `inconclusive` cases, and FD-approval/display boundary tests.
- P.2.2/P.2.3 drafting remains a separately approved future workstream.

## Rationale

The separation preserves deterministic decision authority and makes every narrative claim auditable
without allowing the authoring model to silently choose a different corpus or conclusion.

## Related records

- `docs/decisions/D20260727-qbd-p4-reasoning-policy.md`
- `docs/reports/qbd-p4-reasoning-layer/brainstorm-20260724-llm-role-separation-rationale.md`
