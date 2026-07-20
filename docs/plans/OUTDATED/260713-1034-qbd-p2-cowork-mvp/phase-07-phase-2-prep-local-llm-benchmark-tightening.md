---
phase: 7
title: "Phase-2 prep — local-LLM benchmark + tightening"
status: pending
priority: P3
effort: "TBD (externally gated)"
dependencies: []
---

# Phase 7: Phase-2 prep — local-LLM benchmark + tightening

## Overview

Deferred / `planned`. Two Phase-2 enablers that are safe to prepare now: the 24 GB local-LLM
benchmark harness (P1.5 golden set) and the explicit production-tightening backlog. Neither is
on the MVP build path; both are externally gated (procurement, ZDR contract, real corpus).

## Requirements

- Functional: a runnable benchmark harness + golden-set gate defined; a written
  production-tightening backlog with owners; a `qbd_core` ports outline that reuses Layer A/C.
- Non-functional: nothing here assumes hardware is approved or a corpus exists.

## Architecture

Local model = internal-track worker (extraction/retrieval/bounded drafting on approved corpus)
+ fail-closed fallback — never a user-facing model picker. Runtime = `llama.cpp` + CUDA, GGUF,
`llama-server` (OpenAI-compatible) as a Windows Service. See `docs/system-architecture.md` §4–5.

## Related Code Files

- Create: `plans/260713-1034-qbd-p2-cowork-mvp/reports/local-llm-benchmark-harness.md`
- Create: `plans/260713-1034-qbd-p2-cowork-mvp/reports/production-tightening-backlog.md`
- Reference: `plans/reports/research-260711-local-llm-model-hardware-windows-server-report.md`

## Implementation Steps

1. **Benchmark harness (24 GB tier only):** define the P1.5 golden-set gate — weights
   faithfulness 30 / extraction 20 / citation 15 / drafting 15 / structured-output 10 /
   latency 5 / stability 5; hard disqualifiers = fabrication, filling missing evidence, schema
   noncompliance, following injected instructions, sending internal content to a non-cleared
   provider. Candidates: `Qwen3-14B` vs `Gemma 3 12B IT` vs `Gemma 4 12B`.
2. Note that 48/96 GB tiers and any procurement require benchmark evidence first — **hardware
   is not approved.** The 24 GB pilot is the only currently-actionable hardware step.
3. **Production-tightening backlog** — enumerate with owners: per-file manifest + authority
   labels (P0.3); IT/Deputy-CEO approval for confidential data (P0.6); signed Anthropic ZDR +
   evidence packet (P1.4); OpenAI enterprise ZDR confirmation; egress router as code +
   data-access boundary enforcement; local-worker fail-closed deployment; consent approver
   (P0.4) and retention window (P0.5) confirmation.
4. **`qbd_core` ports outline** — `LLMPort` / `SearchPort` / `KnowledgeDBPort` /
   `EvidenceStorePort` / `DocRenderPort`. Reuse is cross-language (qbd_core is Python; MVP Layer A
   ingest is Node `.mjs`), so **Layer A is reused as its documented JSON record schema, not its
   code**; Layer C's render (Node `docx` script; .NET OfficeCLI as fallback) is reused by
   **shell/CLI invocation** (a `node` subprocess), not Python import. Do not assume the `.mjs`
   modules are importable by the Python port.

## Success Criteria

- [ ] Golden-set gate (weights + hard disqualifiers) defined and runnable once a 24 GB box + golden set exist.
- [ ] Production-tightening backlog written with an owner per item.
- [ ] `qbd_core` ports outline documented, reusing Layer A/C.

## Risk Assessment

- **External gating:** procurement, ZDR contract, and real corpus are outside this plan; this
  phase prepares but does not unblock them. Do not begin 48/96 GB sizing without benchmark data.
- **Posture drift:** the MVP's relaxed consent/retention must not silently become production;
  the backlog is the mechanism that forces the tightening decisions.

<!-- Updated: Validation Session 1 - Layer C reuse restated: render is now a Node `docx` script (OfficeCLI fallback), reused by node-subprocess shell/CLI invocation, not Python import. -->
