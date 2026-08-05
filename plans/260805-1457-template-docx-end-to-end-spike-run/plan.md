---
title: "Template DOCX end to end spike run"
description: "One throwaway end-to-end run wiring the five existing stages (template-probe → ingest → reasoning → rationale → render) so a template + filled DOCX produce one internal DOCX in a temp root, without touching canonical state."
status: completed
priority: P1
effort: "0.5-1d"
tags: [spike, experimental, backend]
created: 2026-08-05
---

# Template DOCX end to end spike run

## Overview

Prove the pipeline connects end to end in **one** run. Copy the frozen template
and the filled mock into a temp root, call each existing stage function in order,
and print the final internal DOCX path plus a per-stage log. Goal is visibility
("see it run once"), not a hardened acceptance suite.

This is a lightweight precursor to
`plans/260805-1335-template-to-docx-end-to-end-trial/` (the hardened trial). That
larger plan becomes active only if we choose to harden after seeing the spike run.

```text
official-placeholder-template-v3 ─┐
filled-public-mock-document ──────┴─► template-probe (field map + receipt)
                                      ingest (records + store)
                                        │  (inline SYNTHETIC candidate profile)
                                        ▼
                                      reasoning (expected: inconclusive)
                                      rationale (seal packet → author → publish)
                                        ▼
                                      render → one internal DOCX (printed)
```

## Scope

- **In:** one temp-root run, byte-copied sources, the five stage calls with a
  visibly synthetic reasoning profile, one printed DOCX, per-stage log, and a
  before/after check that canonical `inputs`/`store`/`outputs` are untouched.
- **Out (belongs to `260805-1335` trial):** two-run determinism, forge/negative
  tests, strict 3/2/0 mapping assertion, Bubblewrap-hardened no-network render,
  red-team, retained gate evidence, promotion to npm scripts/docs.
- **Assumption:** the spike observes and reports the mapping count; it does not
  assert or enforce it. Output stays internal-only and non-citable.

## Fixtures & entry points (verified)

- Template: `cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx`
- Filled: `cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`
- Stages: `compileTemplateFieldMap`/`extractTemplateCellReceipt` → `createConfig`/`runIngest`
  → `buildCohortEvidence`/`evaluateSelection`/`createReasoningCli` →
  `buildRationalePacket`/`sealRationalePacket`/`validateRationale`/`createRationaleCli`
  → `buildDocumentBuffer`/`validateDraft`/`publishBuffer`.

## Phases

| # | Phase | Status | Depends on |
|---|-------|--------|------------|
| 1 | [Wire upstream: sources → records](./phase-01-start.md) | Completed (real run: receipt + 21 records, canonical byte-unchanged) | — |
| 2 | [Wire downstream, render, run once](./phase-02-wire-downstream-render-and-run-once.md) | Completed — five-stage run exited 0; internal DOCX retained under temp root and canonical roots unchanged | 1 |

## Success Criteria

- [x] `node cowork-p2-kit/workflow-trial/spike-e2e-run.mjs` exits `0` and prints
      one internal DOCX path readable under a temp root.
- [x] Every stage runs from copied bytes; nothing writes into canonical
      `cowork-p2-kit/inputs`, `store`, or `outputs`.
- [x] Reasoning result is reported (expected `inconclusive`); DOCX is internal,
      with no fabricated citation.
- [x] Per-stage log shows mapping count, reasoning decision, and DOCX path.

## Dependencies

- Runtime: Node 22, LiteParse, LibreOffice/render deps already present.
- Reuses completed stage modules under `cowork-p2-kit/`; no stage code rewrite.

## Open Questions

None. If a stage genuinely blocks the chain, report the exact stage/error and
stop — do not fabricate inputs to force it through.

<!-- slug: template-docx-end-to-end-spike-run -->
