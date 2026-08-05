---
phase: 3
title: "Extract linear ingest records"
status: pending
priority: P1
effort: "6-8h"
dependencies: [2]
---

<!-- Session 3 boundary: Phase 03 is intentionally not executed; existing
     extractor code/tests are pickup material, not closeout evidence. -->

# Phase 03: Extract linear ingest records

<!-- Updated: Validation Sessions 1–2 - isolated sidecar receipt joins by occurrence_id; committed record schema frozen; no fabricated page provenance -->

## Overview

Read filled public/mock DOCX cells through the compiled field map, emit a
deterministic receipt per field occurrence, and emit a current-contract-compatible
record projection only when its required provenance is truthful.

## Requirements

- Functional: bind each occurrence_id and canonical field ID to the exact raw
  cell value and preserve source hash, template version, tagged owner, scope,
  type, and unit in the isolated receipt.
- Functional: preserve decimal comma, whitespace-sensitive symbols, blanks,
  `≤`/`≥`, and narrative text; never calculate, translate, or infer.
- Functional: fail on template drift, missing required value, unexpected
  structure, field-count mismatch, or field/value round-trip mismatch.
- Non-functional: isolate adapter output and preserve the committed record schema
  and publication boundary unchanged. The receipt maps occurrence_id to tagged
  owner, raw-value hash, cell-level round-trip result, and the schema-valid
  record ID when one truthfully exists. Never manufacture page, offset, quote,
  or page-kind provenance to force a record through the existing schema.

## Architecture

Template-aware extraction replaces generic page-layout association only at the
record-construction seam. The occurrence_id is the sole deterministic join key:
the map binds it to a source owner, while the receipt binds it to raw value,
round-trip result, and any schema-valid record projection. Existing schema
validation, round-trip verification, sorting, and atomic publication stay
authoritative. If the existing schema cannot receive truthful page provenance,
the adapter fails before isolated publication; it does not widen or falsify the
committed contract.

## Related code files

- Read (reuse `buildRecords`/`verifyRoundTrips`; committed contract frozen): `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/records.mjs`
- Read (reuse pipeline seam; no contract change): `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/pipeline.mjs`
- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/schema-validation.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-record-extractor.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/contracts/template-cell-receipt.schema.v1.json`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-cell-receipt.mjs` (isolated sidecar: occurrence_id -> tagged owner, raw value hash, record ID when available, cell-level round-trip)
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-record-extractor.test.mjs`

## Implementation Steps

1. Freeze expected field/value fixtures from the authorized public/mock data.
2. Write tests for exact raw value, blank/null policy, occurrence_id joins,
   metadata, deterministic ordering, drift, missing values, field-count
   mismatch, and fail-closed missing page provenance.
3. Extract values from logical owner cells using the validated map.
4. Emit a schema-valid record projection only through the narrowest existing
   ingest seam and only with truthful required provenance; otherwise stop before
   publication. Avoid a second publication pipeline.
5. Run field-by-field round-trip reconciliation, not global marker search.

## Todo

- [ ] Record count equals filled field occurrence count.
- [ ] Every `occurrence_id → raw_value` pair matches its owner exactly.
- [ ] Every receipt occurrence_id joins to no more than one schema-valid record ID.
- [ ] Two extractions emit byte-identical records.
- [ ] Existing record-contract and repository-boundary tests still pass.

## Prework evidence — not Phase 03 execution (2026-08-04)

The entries below are retained as prework evidence for the next pickup. They
do not represent a Phase 03 execution or closeout in this session.

- Synthetic extractor prework passes 3/3: exact raw values, occurrence-ID
  joins, deterministic receipt bytes, required-blank rejection, and explicit
  `E_PAGE_PROVENANCE_UNAVAILABLE` projection status.
- V3 exact extraction prework is unblocked: the frozen map and mock now share paragraph
  owners 1 and 6, and the literal boundaries produce unique values.
- Prework receipt verification returns 146 occurrences with raw values
  `EXPERIMENT-DESCRIPTION = "Khảo sát tỷ lệ tá dược rã"` and
  `BATCH-SIZE = "1.000 viên"`; no semantic or label-based recovery is used.
- The schema-valid record projection remains unavailable by design in this
  prework because the
  existing record contract requires truthful page provenance for records.

## Success Criteria

- Zero unexplained missing, duplicate, inferred, or normalized values.
- No wide-table layout text is used to associate a field with its value.
- A schema-valid projection either preserves existing truthful provenance or
  fails before isolated publication; no synthetic page provenance is accepted.

## Risk assessment and rollback

Risk: the current page-oriented record schema may not express cell provenance.
Mitigation: emit an isolated sidecar receipt carrying table/row/cell coordinates
and cell-level round-trip results; the committed record schema stays frozen (no
public schema change). Roll back the adapter without touching canonical store data.

## Next steps

Phase 04 consumes the exact filled package, map, records, and reconciliation receipt.
