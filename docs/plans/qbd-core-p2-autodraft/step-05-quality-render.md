---
title: "Step 05 - Quality and render"
workstream: qbd-core-p2-autodraft
status: pending
---

# Step 05 - Quality and render

## Context
Plan: plan.md. Gates: gates.yaml. Scope: docs/decisions/D20261021-qbd-core-p2-autodraft-scope.md.

## Requirements
quality_gate as code (appendix C 17 items, consistency, provenance, market numbering); validate-draft; docx via CLI; Q8(R2) review.

## Done when
G-04 G-06 G-08 G-09 pass.

## Risks and rollback
Each step lands as its own commits; reverting them restores the previous state. Nothing is published on any failed check.
