---
phase: 4
title: "Run two isolated receipt-only probes"
status: completed
priority: P1
effort: "2-3h"
dependencies: [3]
---

<!-- Session 3 boundary: Phase 04 is intentionally not executed; existing
     workflow test code is pickup material, not two-run probe evidence. -->

# Phase 04: Run two isolated receipt-only probes

<!-- Updated: Validation Sessions 1–2 - named ignored artifact root; probe evidence is distinct from unrelated downstream regression suites -->
<!-- Updated: Validation Session 4 - two clean receipt-only runs; compare selected-map/receipt hashes and canonical manifests -->

## Overview

Run the fixed five-field slice twice from clean isolated roots, compare the
derived-map and receipt bytes/hashes, and prove canonical inputs/store are
unchanged. The receipt is the terminal artifact.

## Requirements

- Functional: run the approved five-field selection and receipt extraction
  twice from two newly created, equivalent isolated roots.
- Functional: capture selected-map bytes/hash, receipt bytes/hash, exact five
  field values, cell-level round-trip results, and explicit unavailable record
  projection for both runs.
- Functional: compare complete canonical manifests for the frozen template,
  public/mock DOCX, `cowork-p2-kit/inputs/`, and `cowork-p2-kit/store/` before
  and after execution.
- Non-functional: do not invoke PDF parsing, ingest CLI, schema migration,
  reasoning, render, or other downstream processing.

## Architecture

Run 1 and Run 2 each receive a distinct temporary root and the same read-only
template/mock paths. Each run compiles or loads the same full field map, derives
the fixed five-entry view, and writes only its selected map and receipt beneath
that run root. Determinism compares canonical artifact bytes plus embedded
hashes; immutability compares path-and-SHA-256 manifests of canonical trees.

## Related code files

- Modify: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-workflow-probe.test.mjs`
- Reuse unchanged: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-field-contract.mjs` for canonical bytes, SHA-256, and atomic writes
- Create during tests only: two temporary run roots outside canonical inputs/store
- Preserve unchanged: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/inputs/`
- Preserve unchanged: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/store/`

## Implementation Steps

1. Snapshot canonical input/store manifests, including relative paths and
   SHA-256 for every file.
2. Create two distinct temporary run roots; neither may be nested under
   canonical inputs or store.
3. In each root, derive the same fixed five-entry map from the frozen full map
   and write the receipt through the existing atomic writer.
4. Assert five exact values, five unique occurrence IDs, five passing
   cell-round-trip hashes, five null record IDs, and unavailable projection.
5. Compare selected-map canonical bytes/hash and receipt canonical bytes/hash
   across Run 1 and Run 2.
6. Recompute canonical manifests, fail on any difference, clean only the two
   validated temporary roots, and retain concise command/hash evidence.

## Todo

- [x] Focused extractor and workflow tests pass.
- [x] Both clean runs contain exactly five receipt entries and identical
      selected-map/receipt bytes and hashes.
- [x] Field-level reconciliation reports zero failure and zero record IDs.
- [x] Both projections are explicitly `not_available` with zero records.
- [x] No PDF, ingest, reasoning, or render command runs as part of the MVP.
- [x] Canonical template/mock/inputs/store manifests remain byte-identical.

## Prework evidence — not Phase 04 execution (2026-08-04)

The entries below are retained as prework evidence for the next pickup. They
do not represent the required two-run Phase 04 execution or closeout in this
session.

- Focused v3 workflow prework passes 1/1 and proves exact receipt extraction
  without mutating canonical inputs or `cowork-p2-kit/store`.
- Earlier ingest/reasoning/render regression results are outside this narrowed
  MVP and remain non-evidence for probe processing.
- The required two clean receipt-only runs and selected-map/receipt hash
  comparison remain pending. Record projection remains intentionally unavailable.

## Execution evidence — 2026-08-05

- `node --test cowork-p2-kit/template-probe/tests/*.test.mjs`: 13/13 passed;
  the workflow test executes two distinct temporary roots.
- Both runs publish only the selected five-entry map and receipt, with identical
  canonical bytes and embedded SHA-256 values, exact raw values, five passing
  round-trip hashes, five null record IDs, and unavailable projection.
- Frozen template/mock plus complete `cowork-p2-kit/inputs/` and
  `cowork-p2-kit/store/` path/SHA-256 manifests are byte-identical before/after.
- Syntax checks, `git diff --check`, field-map 8/8, record-contract 2/2, and
  intake contract verification (146 anchors) passed. The write-capable full
  ingest gate runner was intentionally not run.

## Success Criteria

- Both run roots provide the same five-field selected-map and receipt bytes/hash.
- All passed claims point to a focused command, exact value, count, manifest, or hash.
- No record or downstream artifact is produced or published.

## Risk assessment and rollback

Risk: a probe can accidentally write through canonical defaults or compare two
runs that reused state. Mitigate with two distinct system temporary roots,
preflight boundary assertions, and before/after manifests. Roll back by deleting
only the validated temporary roots; canonical state must require no restoration.

## Next steps

Close the proof of concept with promotion still held. Any first-class
page/cell provenance work requires a separate approved post-MVP plan.
