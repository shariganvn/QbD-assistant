---
phase: 3
title: "Extract representative receipt slice"
status: completed
priority: P1
effort: "2-3h"
dependencies: [2, 5]
---

<!-- Session 3 boundary: Phase 03 is intentionally not executed; existing
     extractor code/tests are pickup material, not closeout evidence. -->

# Phase 03: Extract representative receipt slice

<!-- Updated: Validation Sessions 1–2 - isolated sidecar receipt joins by occurrence_id; committed record schema frozen; no fabricated page provenance -->
<!-- Updated: Validation Session 4 - fixed five-field receipt-only MVP; projection and downstream work excluded -->

## Overview

Read exactly five representative fields from the filled public/mock DOCX through
a derived field-map view and emit a deterministic receipt. Record projection is
intentionally unavailable in this MVP.

## Requirements

- Functional: select exactly `PDS-180-CT02`, `UOM-SPEC`, `API-NAME`,
  `ASSAY-SPEC`, and `BATCH-SIZE` from the validated full map. Reject a missing,
  duplicate, or surplus selected occurrence.
- Functional: derive a canonical five-entry field-map view without mutating the
  completed full map; preserve the existing field-map schema and recompute the
  derived view's `occurrence_count` and `field_map_sha256`.
- Functional: bind each selected occurrence_id and canonical field ID to the
  exact raw owner value and preserve source hash, template version, tagged
  owner, scope, type, and unit in the isolated receipt.
- Functional: preserve decimal comma, whitespace-sensitive symbols, blanks,
  `≤`/`≥`, and narrative text; never calculate, translate, or infer.
- Functional: fail on template drift, missing required value, unexpected
  structure, selected-field count mismatch, or field/value round-trip mismatch.
- Functional: emit exactly five receipt entries with
  `record_projection.status = "not_available"`,
  `reason_code = "E_PAGE_PROVENANCE_UNAVAILABLE"`, and `record_count = 0`.
- Non-functional: preserve the committed record, field-map, and receipt schemas
  unchanged. Never manufacture page, offset, quote, or page-kind provenance.

## Architecture

The completed 146-entry map remains immutable authority. A narrow selector
validates the fixed allowlist, creates a canonical five-entry map value, and
passes it to the existing extractor. For owners shared with an unselected
placeholder, the full map is read-only owner context; only selected entries are
published. The occurrence_id remains the deterministic join key from selected
map owner to receipt raw value and round-trip hash. The receipt is the terminal
MVP artifact; no record constructor, ingest pipeline, PDF parser, reasoning
layer, or renderer participates.

## Related code files

- Read only: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/tests/fixtures/happy-path/records.schema.json` (prove no record-schema edit)
- Modify: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-record-extractor.mjs`
- Preserve unchanged: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/contracts/template-cell-receipt.schema.v1.json`
- Preserve unchanged: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-cell-receipt.mjs`
- Modify: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-record-extractor.test.mjs`

## Implementation Steps

1. Freeze the five-field allowlist and the verified public/mock values:
   `29,08`, `± 5% `, `bisoprolol fumarate 90`, `110%`, and `1.000 viên`.
2. Write focused tests for exactly-five selection, missing/duplicate selection,
   exact raw values, occurrence_id joins, deterministic ordering, and explicit
   unavailable projection.
3. Add the smallest selector seam that derives and validates a canonical
   five-entry map from the already validated full map; do not add a new schema.
4. Extract the five values from their logical owners and publish only the
   receipt to the caller-provided isolated output path.
5. Assert zero record IDs, `record_count = 0`, and field-by-field round-trip
   hashes; do not call any existing ingest/downstream seam.

## Todo

- [x] Selected map and receipt each contain exactly five unique occurrences.
- [x] Every selected `occurrence_id → raw_value` pair matches its owner exactly.
- [x] Every receipt entry has `record_id = null`; projection is unavailable with
      zero records for the approved provenance reason.
- [x] Repeated in-memory extraction emits byte-identical receipt bytes/hash.
- [x] Record schema and receipt schema files have no diff.

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
- The schema-valid record projection remains unavailable by design because the
  existing record contract requires truthful page provenance for records. The
  approved MVP now selects five of those occurrences and stops at the receipt.

## Execution evidence — 2026-08-05

- `node --test cowork-p2-kit/template-probe/tests/*.test.mjs`: 13/13 passed.
- Selector and extractor checks prove the fixed five IDs, exact official values,
  occurrence joins, round-trip hashes, deep-copy isolation, and unavailable
  projection (`E_PAGE_PROVENANCE_UNAVAILABLE`, zero records).
- Shared-owner extraction uses the immutable full map only as owner-boundary
  context; the derived map and receipt each contain five entries.
- Record schema and receipt schema are unchanged. Promotion remains held;
  first-class template-version/cell-page provenance hardening is post-MVP.

## Success Criteria

- Exactly five selected values with zero unexplained missing, duplicate,
  inferred, or normalized values.
- No wide-table layout text is used to associate a field with its value.
- Projection is explicitly unavailable; no synthetic page provenance and no
  record publication are accepted.

## Risk assessment and rollback

Risk: a selector could silently choose the wrong repeated occurrence. Mitigate
with a fixed canonical-field allowlist whose members each resolve exactly once,
stable occurrence_id checks, and exact expected values. The truthful owner data
retained in each receipt entry is the seam for a separate post-MVP provenance
design. Roll back the selector without touching canonical store data.

## Next steps

Phase 04 consumes the exact filled package, derived five-entry map, and receipt.
