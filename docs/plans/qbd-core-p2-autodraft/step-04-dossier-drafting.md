---
title: "Step 04 - Dossier drafting"
workstream: qbd-core-p2-autodraft
status: pending
---

# Step 04 - Dossier drafting

## Context
Plan: plan.md. Gates: gates.yaml. Scope: docs/decisions/D20261021-qbd-core-p2-autodraft-scope.md.

## Requirements
Thin slice Atorvastatin calcium / film-coated tablet / both first; then agents A1-A12 by wave with CQA gate 3.5, max_review_loops 1, Data Gap Register.

## Done when
G-05 G-07 pass; draft.json valid.

## Risks and rollback
Each step lands as its own commits; reverting them restores the previous state. Nothing is published on any failed check.

## Provisional decision: A5 ordering (task 4.6)

Decision 2026-10-21 (project owner): agents 5.1 and 5.2 run after 4.1 as the A5 refinement proposes, without waiting for a separate written confirmation from the head of R&D. The choice is listed in every run report as an `A13:` line (from `provisional` in `config/agents.json`) so the head of R&D sees and settles it at the final approval. If rejected: edit `depends_on` of 5.1 and 5.2 in `agents.json` and re-run; no code change. Reopen condition: A13 rejects or amends the ordering.
