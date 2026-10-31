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

## Closing G-03 against real Kho text
Approval status: on 2026-10-31 the project owner reported that the head of R&D approved hash files (no text) leaving the machine for this purpose. The written record is still to be attached here.

Primary route: run `kho-fingerprint` on the machine that holds the Kho text, with approval of the head of R&D that hashes (no text) may leave it; run the leak trap against the real fingerprints at that machine and report counts only to `g-03.txt`.

Fallback route, to use only if the primary one cannot be done (no approval, or no machine that can run the command): a time-boxed exception, written and signed by the head of R&D, to load class B/C files into a cloud session and run `kho-load` plus the trap there. Needs scope (files needed for G-03 only), an end date, deletion of files and container afterwards, output outside any git tree, and a report with counts and SHA-256 only. Claude does not apply it on its own. The gate is then recorded as closed by an approved exception, not as designed.

## Risks and rollback
Each step lands as its own commits; reverting them restores the previous state. Nothing is published on any failed check.
