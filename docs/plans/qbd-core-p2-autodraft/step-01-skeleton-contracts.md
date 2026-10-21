---
title: "Step 01 - Skeleton and contracts"
workstream: qbd-core-p2-autodraft
status: pending
---

# Step 01 - Skeleton and contracts

## Context
Plan: plan.md. Gates: gates.yaml. Scope: docs/decisions/D20261021-qbd-core-p2-autodraft-scope.md.

## Requirements
qbd_core tree with six modules, pyproject, ruff and pytest, CI workflow, IntakeRequest/EvidenceRecord/GapEntry/DraftSection contracts.

## Done when
CI green on empty suites; contracts round-trip.

## Risks and rollback
Each step lands as its own commits; reverting them restores the previous state. Nothing is published on any failed check.
