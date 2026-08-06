---
title: Template DOCX content demo
date: 2026-08-06
summary: "Completed a watermarked synthetic P.2 content demo with store-bound scoring, exact citations, and Bubblewrap-isolated DOCX rendering."
---

# Template DOCX content demo

## What happened
Completed the accepted plan at `plans/260805-1815-template-docx-content-demo/`. The workflow now runs template probing, real filled-mock ingest, isolated synthetic comparator scoring, selected rationale publication, a pure rich-draft adapter, and Bubblewrap no-network rendering. The retained artifact is `artifacts/template-docx-content-demo/run/p2-draft.docx`.

## Verification
The focused workflow tests pass 7/7 and the decision-shape probe passes 2/2. The reasoning suite passes 122/122. Sequential render verification has one pre-existing failure because `isolated-network.test.mjs` assumes no repository-root `plans/` directory. The demo itself passes its watermark, content, determinism, isolation, and no-mutation checks.

## Decision and follow-up
The demo remains review-only: comparator records, rubric, scores, and decision are synthetic; three exact citation envelopes quote real ingest excerpts only to demonstrate provenance formatting. A review found and fixed two contract gaps: exact joins now bind the augmented store SHA-256 and substring-specific offsets while rejecting ambiguous matches, and the adapter deep-clones citation envelopes to remain pure. No canonical inputs, store, outputs, or pre-existing dirty tracked files were mutated. No evergreen documentation or commit was created.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
