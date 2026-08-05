---
phase: 2
title: "Compile template field map"
status: completed
priority: P1
effort: "4-6h"
dependencies: [1]
---

# Phase 02: Compile template field map

<!-- Updated: Validation Sessions 1–2 - isolated probe root; explicit metadata, tagged owners, occurrence identity, and synthetic negative fixtures -->

## Overview

Build a deterministic compiler that turns semantic placeholders in the frozen
DOCX into a versioned field map bound to logical OOXML cells.

## Requirements

- Functional: reconstruct placeholder text across runs and emit exactly one map
  entry per declared occurrence.
- Functional: validate a versioned per-anchor metadata catalog that explicitly
  supplies type, unit, scope, and requiredness; never infer them from DOCX
  text, labels, or values.
- Functional: record raw source token, canonical field ID, stable
  `occurrence_id`, template hash/version, explicit metadata, and a tagged
  owner. Cell owners contain table, row, physical cell, logical-column,
  grid-span, and vertical-merge coordinates; the three approved paragraph
  owners contain paragraph coordinates.
- Functional: reject missing, surplus, duplicate, malformed, split-ambiguous,
  and merged-continuation placeholders.
- Non-functional: emit the isolated
  `artifacts/placeholder-template-ingest-workflow-probe/field-map/<template-sha256>/template-field-map.v1.json`
  with canonical key order, entries sorted by occurrence_id, a trailing newline,
  and a SHA-256. Do not rewrite with Word or LibreOffice.

## Architecture

Reuse the smallest proven OOXML/ZIP reading seam from the quarantined probe only
after re-review. Keep contract validation separate from DOCX traversal. The
metadata catalog and JSON Schema are tracked contracts; the map is generated
isolated evidence, never a hand-maintained coordinate registry.

## Related code files

- Review only (from Phase 00 quarantine recovery): `extract-cell-ledger.mjs`
- Create: `cowork-p2-kit/template-probe/intake/field-metadata.v1.json`
- Create: `cowork-p2-kit/template-probe/contracts/template-field-map.schema.v1.json`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-field-map.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/template-field-contract.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-field-map.test.mjs`
- Create: `cowork-p2-kit/template-probe/tests/fixtures/template-field-map/` (minimal synthetic OOXML/DOCX only)

## Implementation Steps

1. Write tests first for metadata coverage, aliases, exact multiplicity,
   malformed/duplicate IDs, split-run tokens, merged continuations, paragraph
   owners, template drift, and canonical bytes using minimal synthetic fixtures.
2. Add the hash-bound metadata catalog and tagged-owner validation; derive
   occurrence_id only from template hash, raw source token, and canonical owner
   coordinates.
3. Implement logical OOXML traversal and placeholder reconstruction without
   accepting a vertical-merge continuation as an owner.
4. Validate against the grammar and metadata contracts, then emit the map
   through its versioned JSON Schema and canonical serialization rules.
5. Re-open the map, reconcile every entry to its original owner, and run
   generation twice to compare bytes and SHA-256.

## Todo

- [x] Negative contract tests fail closed with typed errors.
- [x] Every metadata entry matches one declared anchor; no property is inferred.
- [x] Every expected placeholder maps exactly once.
- [x] Repeated compilation is byte-identical.
- [x] V3 template hash is bound consistently across manifest, grammar, metadata,
      and generated map.

## Evidence — 2026-08-04

- Official compilation produces 146 entries: 143 cell anchors and 3 approved
  paragraph anchors, with 142 unique cell owners.
- Focused field-map coverage passes 8/8, including split-run reconstruction,
  merged-continuation rejection, nested malformed-delimiter rejection,
  authoritative metadata-catalog binding, schema validation, and deterministic
  output.
- Two isolated generated map files are byte-identical and both hash to
  `1f74f21bc5ca89acdf958db247693ceb3bae0c8fe34fdd69ba819eb278667cf2`.
- Artifact writes now use same-directory atomic replacement; the v3 template
  hash is `c492532054d9ba04d2dbd5c3d03706c423534cce5329d2657b2588760e0087e0`.

## Success Criteria

- Field map count equals declared occurrence count and every entry has a unique
  occurrence_id.
- No unknown/missing/duplicate placeholder survives validation.
- Cell and paragraph fixtures prove tagged logical ownership; split-run and
  merged-continuation fixtures fail or resolve according to the owner contract.
- The generated artifact validates against its JSON Schema and two runs have
  matching bytes and SHA-256.

## Risk assessment and rollback

Risk: reusing stale code may carry the marker-only semantic flaw forward.
Mitigation: reuse only low-level traversal after tests, never old acceptance
logic. Roll back by removing the compiler and ignored generated map; the
metadata/schema contracts and immutable source remain reviewable.

## Next steps

Pass only the validated field map and frozen template receipt to Phase 03.
