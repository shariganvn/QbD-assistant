---
phase: 1
title: "Freeze PO-supplied FD-like placeholder template"
status: completed
priority: P1
effort: "2-3h"
dependencies: [0]
---

# Phase 01: Freeze PO-supplied FD-like placeholder template

## Context links

- Plan: `./plan.md`
- Frozen template: `cowork-p2-kit/inputs/reference/official-placeholder-template-v1-040826.docx`
  (PO-supplied closest FD-like MVP template; SHA-256
  `a8002623e0808cc54c870ab2f47adab44498a6c2ce5b7c4b3bd21cd99973a01d`).
- Frozen mock: `cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`
  (public/synthetic, non-citable; SHA-256
  `01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f`).

## Overview

Freeze the PO-supplied FD-like MVP DOCX identity and trust boundary,
and define the smallest placeholder grammar needed for the mock/public probe.

## Requirements

- Functional: record the supplied paths, SHA-256, public/synthetic
  authorization, table structure, and template version without adding either
  DOCX to the canonical ingest manifest.
- Functional: preserve the original byte-for-byte. Phase 01 opens it read-only;
  any later writeable operation must use a derived copy.
- Functional: define ASCII semantic field IDs using
  `^[A-Z][A-Z0-9%-]*$`, allowed multiplicity, required vs optional fields,
  formula scope, type, unit, and raw-display rules. The immutable source token
  `EXPERIMENT-DISCRIPTION` aliases to the corrected canonical semantic ID
  `EXPERIMENT-DESCRIPTION`.
- Functional: accept `EXPERIMENT-DISCRIPTION`, `BATCH-SIZE`, and `CONCLUSION`
  as the only paragraph-owned anchors. The first two are supplied data;
  `CONCLUSION` is optional reference-only context and must not be written or
  derived by this probe.
- Non-functional: reject unknown template versions and ambiguous placeholder
  ownership; do not infer missing values.

## Architecture

The immutable DOCX is the template authority for this MVP probe. Placeholder
tokens are authoring anchors; a later compiler resolves logical cell ownership
across OOXML runs and merged cells, plus the three approved paragraph owners.
Template hash plus a structural fingerprint bind every derived artifact to this
exact version.

## Related code files

- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/inputs/` (existing boundary patterns)
- Input: `cowork-p2-kit/inputs/reference/official-placeholder-template-v1-040826.docx`
- Input: `cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`
- Create: `cowork-p2-kit/template-probe/intake/` isolated freeze contracts and
  read-only verifier

## Implementation Steps

1. Record PO's MVP authority and the public/synthetic, non-citable probe
   boundary without promoting the source as a final FD report format.
2. Hash and survey the file without OCR or mutation; capture table, merge, and
   placeholder inventory.
3. Freeze placeholder grammar and field naming for value, unit, statistic,
   specification, narrative, repeated occurrence, and the three approved
   paragraph owners.
4. Record template version, structural fingerprint inputs, allowed blank/null
   states, and fail-closed intake rules.
5. Create a metadata-only fixture subset covering merged cells, split XML runs,
   decimal commas, units, `≤`/`≥`, and `TB/Max/Min/RSD`; it must not extract
   records or change either source DOCX.

## Todo

- [x] PO-supplied paths and public/synthetic authorization resolved.
- [x] Original hash and structure frozen.
- [x] Placeholder inventory has no unknown or duplicate owner.
- [x] Field grammar and fixture coverage accepted.

## Success Criteria

- The source remains byte-identical.
- Every placeholder has one logical owner: a cell, or one of the three approved
  paragraph owners.
- Phase 02 receives a versioned, unambiguous template contract.

## Risk assessment and rollback

Word may split a visible token across `w:r`/`w:t`, and merged-cell continuation
cells may look like owners. Compile logical cell text, not raw XML substrings;
fail on ambiguous ownership. Roll back by discarding derived intake artifacts.

## Next steps

Start Phase 02 only after the input gate and template contract are complete.
