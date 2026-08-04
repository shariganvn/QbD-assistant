---
phase: 2
title: "Compile template field map"
status: pending
priority: P1
effort: "4-6h"
dependencies: [1]
---

# Phase 02: Compile template field map

<!-- Updated: Validation Session 1 - new probe code lives in cowork-p2-kit/template-probe/; old file reviewed from Phase 00 quarantine recovery -->

## Overview

Build a deterministic compiler that turns semantic placeholders in the frozen
DOCX into a versioned field map bound to logical OOXML cells.

## Requirements

- Functional: reconstruct placeholder text across runs and emit exactly one map
  entry per declared occurrence.
- Functional: record field ID, template hash/version, table/row/logical cell,
  OOXML ownership, type, unit, scope, requiredness, and provenance coordinates.
- Functional: reject missing, surplus, duplicate, malformed, split-ambiguous,
  and merged-continuation placeholders.
- Non-functional: byte-deterministic map output; no Word/LibreOffice rewrite.

## Architecture

Reuse the smallest proven OOXML/ZIP reading seam from the quarantined probe only
after re-review. Keep grammar/contract validation separate from DOCX traversal.
The map is generated evidence, not a hand-maintained coordinate registry.

## Related code files

- Review only (from Phase 00 quarantine recovery): `extract-cell-ledger.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-field-map.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-field-contract.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-field-map.test.mjs`

## Implementation Steps

1. Write contract tests for exact multiplicity, malformed IDs, duplicate IDs,
   split-run tokens, merged-cell owners, and template drift.
2. Implement logical OOXML table/cell traversal and placeholder reconstruction.
3. Validate against the frozen contract and emit sorted deterministic map JSON.
4. Re-open the map and reconcile every entry to the original OOXML owner cell.
5. Run generation twice and compare hashes.

## Todo

- [ ] Negative contract tests fail closed with typed errors.
- [ ] Every expected placeholder maps exactly once.
- [ ] Repeated compilation is byte-identical.
- [ ] Original template hash remains unchanged.

## Success Criteria

- Field map count equals declared occurrence count.
- No unknown/missing/duplicate placeholder survives validation.
- Split-run and merged-cell fixtures prove logical ownership.

## Risk assessment and rollback

Risk: reusing stale code may carry the marker-only semantic flaw forward.
Mitigation: reuse only low-level traversal after tests, never old acceptance
logic. Roll back by removing the compiler and generated map; source is immutable.

## Next steps

Pass only the validated field map and frozen template receipt to Phase 03.
