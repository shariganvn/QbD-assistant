---
title: "Step 03 - Evidence and egress"
workstream: qbd-core-p2-autodraft
status: pending
---

# Step 03 - Evidence and egress

## Context
Plan: plan.md. Gates: gates.yaml. Scope: docs/decisions/D20261021-qbd-core-p2-autodraft-scope.md.

## Requirements
Kho manifest with A/B/C class, KnowledgePort internal-first, SearchPort with citation, egress_gate code-enforced, provenance records.

## Done when
G-03 passes with trap payloads.

## Risks and rollback
Each step lands as its own commits; reverting them restores the previous state. Nothing is published on any failed check.
