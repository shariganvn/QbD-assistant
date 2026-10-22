---
title: "Step 06 - Acceptance"
workstream: qbd-core-p2-autodraft
status: pending
---

# Step 06 - Acceptance

## Context
Plan: plan.md. Gates: gates.yaml. Scope: docs/decisions/D20261021-qbd-core-p2-autodraft-scope.md.

## Requirements
Cases for each main N group plus a combination and an out-of-scope case; negative paths; determinism; A13 sign-off on one case; tag.

## Done when
G-10 passes.

## Risks and rollback
Each step lands as its own commits; reverting them restores the previous state. Nothing is published on any failed check.

## Progress
- `python -m qbd_core accept --cases qbd_core/tests/fixtures/acceptance/cases.json --out-dir docs/reports/qbd-core-p2-autodraft/g-10` runs 16 cases twice and compares exit code and bytes. Evidence: `g-10.txt`, `g-10/`.
- Out of scope is covered by a form outside the 38; NCE and biologics cannot be detected from the three inputs.
- Not done: A13 sign-off, real knowledge documents, G-03, G-08. G-10 stays unverified.
