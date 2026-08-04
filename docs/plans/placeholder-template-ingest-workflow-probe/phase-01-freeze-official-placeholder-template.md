---
phase: 1
title: "Freeze official placeholder template"
status: blocked
priority: P1
effort: "2-3h"
dependencies: [0]
---

# Phase 01: Freeze official placeholder template

## Context links

- Plan: `./plan.md`
- User input gate: concrete FD/PO DOCX with placeholders such as
  `<HAUSNER-RATIO-CT01>`.

## Overview

Receive the user-supplied official DOCX, freeze its identity and trust boundary,
and define the smallest placeholder grammar needed for the mock/public probe.
This phase cannot execute before the DOCX is supplied.

## Requirements

- Functional: resolve the final intake path only after receipt; record SHA-256,
  sensitivity, public/mock authorization, page/table counts, and template version.
- Functional: preserve the original byte-for-byte and work on derived copies.
- Functional: define ASCII semantic field IDs, allowed multiplicity, required vs
  optional fields, formula scope, type, unit, and raw-display rules.
- Non-functional: reject unknown template versions and ambiguous placeholder
  ownership; do not infer missing values.

## Architecture

The immutable DOCX is the template authority. Placeholder tokens are authoring
anchors; a later compiler resolves logical cell ownership across OOXML runs and
merged cells. Template hash plus a structural fingerprint bind every derived
artifact to this exact version.

## Related code files

- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/inputs/` (existing boundary patterns)
- Input: `TBD after user supplies the official placeholder DOCX`
- Create: `TBD isolated probe intake directory and immutable source manifest`

## Implementation Steps

1. Receive the DOCX and confirm it is the official FD/PO report format and is
   authorized for the public/mock probe.
2. Hash and survey the file without OCR or mutation; capture table, merge, and
   placeholder inventory.
3. Freeze placeholder grammar and field naming with examples for value, unit,
   statistic, specification, narrative, and repeated occurrence.
4. Record template version, structural fingerprint inputs, allowed blank/null
   states, and fail-closed intake rules.
5. Create a minimal fixture subset covering merged cells, split XML runs,
   decimal commas, units, `≤`/`≥`, and `TB/Max/Min/RSD`.

## Todo

- [ ] User-supplied DOCX path and authorization resolved.
- [ ] Original hash and structure frozen.
- [ ] Placeholder inventory has no unknown or duplicate owner.
- [ ] Field grammar and fixture coverage accepted.

## Success Criteria

- The source remains byte-identical.
- Every placeholder has one logical owner cell and declared multiplicity.
- Phase 02 receives a versioned, unambiguous template contract.

## Risk assessment and rollback

Word may split a visible token across `w:r`/`w:t`, and merged-cell continuation
cells may look like owners. Compile logical cell text, not raw XML substrings;
fail on ambiguous ownership. Roll back by discarding derived intake artifacts.

## Next steps

Start Phase 02 only after the input gate and template contract are complete.
