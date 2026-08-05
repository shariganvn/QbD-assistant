---
title: Template DOCX end-to-end spike run
date: 2026-08-05
summary: "Connected template probe, ingest, reasoning, rationale, and render in one isolated, attested internal DOCX run."
---

# Template DOCX end-to-end spike run

## What happened

Implemented `cowork-p2-kit/workflow-trial/spike-e2e-run.mjs` as a disposable five-stage runner. It byte-copies the template, filled DOCX, and approved rubric into one temporary root; executes template probe, ingest, reasoning, rationale, and render; then checks canonical `cowork-p2-kit/inputs`, `store`, and `outputs` remain byte-identical.

The attested command `baton verdict --session-id 260805-1803 -- node cowork-p2-kit/workflow-trial/spike-e2e-run.mjs` exited 0 with an accepting verdict at `artifacts/260805-1803/test-verdict.json`. The run retained the internal-only document at `/tmp/spike-e2e-9IV3al/render-output/p2-draft.docx`.

## Decision

The runner uses a visibly synthetic `spike-candidate` profile. It deliberately omits the rubric pin, which exercises the existing `inconclusive/E_RUBRIC_PIN_REQUIRED` early exit before any scoring or promotion. The context fact card remains truthfully bound to an ingested record because later reasoning/rationale publication validates record provenance, quote, offsets, value, and unit.

The rendered output is generic and uncited. It proves sequential orchestration once; it does not prove field-level template transformation, production evidence, multi-run determinism, sandboxed/no-network rendering, or hardened negative-path handling. Those remain owned by `plans/260805-1335-template-to-docx-end-to-end-trial/`.

## Closeout

Synced the spike plan to completed and wrote Agent Baton progress/test-plan closeout artifacts. Verified `baton verdict --validate`, `baton render-workflow --check`, `baton render-test-plan --check`, and `baton state validate` all pass. AgentWiki publish skipped; the local journal is the source of truth.

## Next steps

Commit only the spike runner, plan/report, and Agent Baton closeout artifacts when authorized. A later committed closeout must use the required two-commit sequence: C1 work product, then `baton handoff` plus reconcile, then C2 only session handoff state.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
