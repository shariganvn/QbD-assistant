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
