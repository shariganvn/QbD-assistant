---
title: "P4 Step 1 progress report"
workstream: qbd-p4-reasoning-layer
date: 2026-07-24
status: complete
---

# Step 1 — Contracts and TDD Harness

| Metric | Result |
|---|---|
| Gate | G-P4-01 pass |
| Focused tests | 14/14 pass |
| Shared Layer A/C smoke | 12/12 pass |
| Review | pass after three contract/publication fixes |
| New direct callers of existing Layer A/C symbols | 0 |

## Delivered

- Exact-key portable schemas and deterministic validators for decision, rubric, cohort, fact-card,
  linear-attestation, and evidence-log artifacts.
- Uniform `ReasoningContractError`/CLI nonzero `E_` failures; fact-card validation always binds to a
  required JSONL store whose SHA-256 matches the cohort pin before publication.
- Canonical JSON output, immutable declared-root enforcement, temp-file staging, and synchronous failure
  rollback for the five-artifact publish set.
- P4-specific multi-path TAP gate runner, retained initial red evidence, and G-P4-01 evidence with
  the frozen Step 0 store SHA-256.

## Scope and decisions

Layer A/C and their contracts were not changed. `D20260724` records the approved sequence:
finish the reasoning core first, then plan a separate LLM rationale layer that consumes sealed
decision artifacts.

## Next step

Proceed to Step 2 only: enforce cohort/evidence boundaries on the committed store fixture.
