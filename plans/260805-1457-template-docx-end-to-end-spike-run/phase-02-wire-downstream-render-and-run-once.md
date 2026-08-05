---
title: "Phase 2: Wire downstream render and run once"
status: completed
---

# Phase 2: Wire downstream render and run once

## Result (verified)

The complete five-stage runner exited `0` once. It uses one visibly synthetic
`spike-candidate` profile and one truthful, record-bound context fact card,
copies template, filled DOCX, and rubric bytes into its temp root, then retains
the internal result at `/tmp/spike-e2e-9IV3al/render-output/p2-draft.docx`
(8,947 bytes). The reasoning stage deliberately omits the rubric pin and reports
`inconclusive/E_RUBRIC_PIN_REQUIRED` before scoring; it still publishes the
reasoning package and a sealed, packet-bound internal rationale. The rendered
draft contains zero citations. Hash guards after every stage confirmed canonical
`inputs`/`store`/`outputs` were byte-unchanged.

The completed path proves a one-run connection only. Trial hardening remains
explicitly out of scope: two-run determinism, forge/negative tests, strict
mapping assertions, Bubblewrap/no-network render, red-team evidence, and
promotion to npm scripts or evergreen docs.

The renderer intentionally emits a generic internal draft from the sealed
rationale decision-state claim. It does not transfer template fields into the
output DOCX, so this spike is not proof of a semantic template-transformation
flow.

## Overview

Feed the Phase 1 record store plus one inline, visibly synthetic candidate
profile through reasoning → rationale → render, produce one internal DOCX, run
the whole runner once, and confirm canonical state stayed untouched.

## Requirements

- [x] Inline candidate profile is visibly synthetic (`spike-candidate`, values prefixed `SYNTHETIC-`).
- [x] `buildCohortEvidence` + `evaluateSelection` run; decision reported (expected `inconclusive`).
- [x] Reasoning publish → `sealRationalePacket` → packet-only rationale author → `createRationaleCli` publish.
- [x] `buildDocumentBuffer` + `publishBuffer` write one DOCX under the temp render root; `validateDraft` passes with no citation.
- [x] Whole runner exits `0`, prints the DOCX path, and canonical `inputs`/`store`/`outputs` are byte-unchanged.

## Implementation Steps

1. Define the inline synthetic profile + one context-only fact card from a mapped record.
2. `buildCohortEvidence` → `evaluateSelection` (approved fixture, no pin); log decision.
3. Publish reasoning package via `createReasoningCli` on a temp root; `sealRationalePacket` into a fresh temp root.
4. Author a minimal packet-only rationale (no fact claims), `validateRationale`, publish via `createRationaleCli`.
5. Map rationale to a draft, `validateDraft` (citations empty), `buildDocumentBuffer` → `publishBuffer` to temp render root. Call render buffers directly (no Bubblewrap — hardened no-network render is the `260805-1335` trial's job).
6. Snapshot canonical `inputs`/`store`/`outputs` hashes before and after; assert unchanged. Print per-stage log + final DOCX path.

## Todo

- [x] Synthetic profile + fact card
- [x] Reasoning wired, decision logged
- [x] Rationale sealed + authored + published
- [x] Render produces DOCX; draft has no citation
- [x] Canonical unchanged check + final log

## Success Criteria

- [x] One `node cowork-p2-kit/workflow-trial/spike-e2e-run.mjs` run yielded a
      readable internal DOCX under temp, printed the full stage log, and left
      canonical inputs/store/outputs byte-identical.
