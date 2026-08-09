---
title: QbD P.2.2.1 formulation-selection closeout
date: 2026-08-08
summary: Hardened source-bound rationale publication and provenance; 79 focused tests pass; G-05 aggregate remains open on unrelated baseline failures.
---

# QbD P.2.2.1 formulation-selection closeout

## What happened
Completed the P.2.2.1 formulation-selection implementation and final remediation pass. The rationale boundary now validates required publication entries, source-regenerates the compiled rubric, diagnostic, and engineering proposal, binds selection evaluation to the FD decision and publication run, recomputes the FD decision hash, pins the trusted receipt set, and validates source-file and quote-hash provenance in the review draft.

## Decision
The proposal lane remains the demonstrated output: `fd_decision` is inconclusive with `winner:null`, while CT03 is shown only as a separate watermarked engineering proposal. MVP `fd-confirmed` trust remains distinct from deferred cryptographic authorization.

## Verification
The focused formulation/v2/v3 suite passes 79/79. Negative tests cover cross-run/coordinated substitutions, refreshed receipt hashes, missing receipt entries, mutated diagnostic/proposal artifacts, receipt-set replacement, forged decision hashes, proposal rubric tampering, and malformed provenance. The materialized review-run package revalidates and its DOCX contains 21 source-bound provenance rows, zero public citations, and the required watermarks. GitNexus reports the expected CRITICAL shared-contract blast radius; affected tests pass.

## Next steps
The plan remains in progress because the repository-wide aggregate still has two unrelated baseline failures: a render assertion conflicts with the tracked root `plans/` directory, and a skill-artifacts assertion expects `session-handoff.yaml` in the existing `RATIONALE-SKILL.md`. Reconcile those baseline contracts before marking G-05 complete. No commit was created.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
