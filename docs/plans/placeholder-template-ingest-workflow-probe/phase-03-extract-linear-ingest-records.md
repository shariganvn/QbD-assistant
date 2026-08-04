---
phase: 3
title: "Extract linear ingest records"
status: pending
priority: P1
effort: "6-8h"
dependencies: [2]
---

# Phase 03: Extract linear ingest records

<!-- Updated: Validation Session 1 - cell provenance goes to an isolated sidecar receipt; committed record schema frozen; probe code under cowork-p2-kit/template-probe/ -->

## Overview

Read filled public/mock DOCX cells through the compiled field map and emit one
deterministic, current-contract-compatible record per field occurrence.

## Requirements

- Functional: bind each field ID to the exact raw cell value and preserve source
  hash, template version, table/row/cell, formula scope, type, and unit.
- Functional: preserve decimal comma, whitespace-sensitive symbols, blanks,
  `≤`/`≥`, and narrative text; never calculate, translate, or infer.
- Functional: fail on template drift, missing required value, unexpected
  structure, field-count mismatch, or field/value round-trip mismatch.
- Non-functional: isolate adapter output and preserve the committed record schema
  and publication boundary unchanged; carry cell provenance (table/row/cell) and
  cell-level round-trip results in an isolated sidecar receipt (Validation Session 1).

## Architecture

Template-aware extraction replaces generic page-layout association only at the
record-construction seam. Linear records avoid wide-table interleaving. Existing
schema validation, round-trip verification, sorting, and atomic publication stay
authoritative. Cell provenance (table/row/cell) and cell-level round-trip
verification live in an isolated sidecar receipt, not in the committed record
schema; the committed contract is frozen for this probe.

## Related code files

- Read (reuse `buildRecords`/`verifyRoundTrips`; committed contract frozen): `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/records.mjs`
- Read (reuse pipeline seam; no contract change): `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/pipeline.mjs`
- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/schema-validation.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-record-extractor.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-cell-receipt.mjs` (isolated sidecar: field_id -> table/row/cell + cell-level round-trip)
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-record-extractor.test.mjs`

## Implementation Steps

1. Freeze expected field/value fixtures from the authorized public/mock data.
2. Write tests for exact raw value, blank/null policy, type/unit metadata,
   deterministic ordering, drift, missing values, and field-count mismatch.
3. Extract values from logical owner cells using the validated map.
4. Emit one field occurrence per record through the narrowest existing ingest
   seam; avoid a second publication pipeline.
5. Run field-by-field round-trip reconciliation, not global marker search.

## Todo

- [ ] Record count equals filled field occurrence count.
- [ ] Every `field_id → raw_value` pair matches its owner cell exactly.
- [ ] Two extractions emit byte-identical records.
- [ ] Existing record-contract and repository-boundary tests still pass.

## Success Criteria

- Zero unexplained missing, duplicate, inferred, or normalized values.
- No wide-table layout text is used to associate a field with its value.
- Downstream ingest receives schema-valid linear records.

## Risk assessment and rollback

Risk: the current page-oriented record schema may not express cell provenance.
Mitigation: emit an isolated sidecar receipt carrying table/row/cell coordinates
and cell-level round-trip results; the committed record schema stays frozen (no
public schema change). Roll back the adapter without touching canonical store data.

## Next steps

Phase 04 consumes the exact filled package, map, records, and reconciliation receipt.
