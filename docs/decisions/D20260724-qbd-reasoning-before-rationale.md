---
title: Reasoning core before LLM rationale generation
id: D20260724
status: active
date: "2026-07-24"
scope: qbd-p4-reasoning-layer
affects:
  - docs/plans/qbd-p4-reasoning-layer/plan.md
  - cowork-p2-kit/reasoning/
  - docs/reports/qbd-p4-reasoning-layer/decision/
read_when: Adding an LLM-generated explanation, changing formula-decision artifacts, or planning a rationale layer.
---

# D20260724 — Reasoning Core Before Rationale

## Decision

Complete the evidence-bound reasoning core before introducing LLM-generated rationale. The current
workstream remains responsible for provenance-bound fact cards, deterministic validation, cohort and
rubric policy, a traceable `selected` or `inconclusive` decision, and canonical decision/evidence
artifacts.

Rationale generation is a later, separate layer. It consumes a sealed handoff derived from the
completed reasoning artifacts; it does not re-evaluate the mutable store, change a decision, or add
new evidence.

## Rationale

Separating the fact-extraction and rationale contexts prevents a narrative generator from silently
selecting different evidence or overriding the deterministic decision. It keeps the current MVP
small, testable, and compatible with the active plan's rule that canonical JSON and its current
Markdown derivatives are deterministic.

## Consequences

- Step 1 and the rest of the active P4 reasoning plan proceed unchanged.
- `formula-decision.json`, fact-card, cohort, and evidence-log artifacts remain the canonical
  handoff; no empty rationale field is reserved now.
- A future rationale step must add separate versioned artifacts and validate each generated claim
  against allowed fact-card IDs and quoted evidence.
- A future rationale generator must not overwrite `formula-decision.md`, which remains a
  deterministic derivative under the active plan.
- The separate-session alternatives and open product questions are retained in
  `docs/reports/qbd-p4-reasoning-layer/brainstorm-20260724-llm-role-separation-rationale.md`.

## Non-goals

This decision does not approve a rationale schema, model/provider, prompt, output location, or
P.2.2/P.2.3 drafting behavior. Those require a separate design and plan delta.
