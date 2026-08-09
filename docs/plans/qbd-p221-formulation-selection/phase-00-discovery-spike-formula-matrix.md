---
phase: 0
title: "Hash-pinned isolated extraction and formula-cell receipts"
status: completed
priority: P1
effort: "1-2d"
dependencies: []
---

# Phase 0: Hash-pinned isolated extraction and formula-cell receipts

## Context links

- Gate: `gates.yaml` → G-00.
- Frozen authority: `cowork-p2-kit/template-probe/intake/template-freeze-manifest.v1.json`.
- Isolated staging pattern: `cowork-p2-kit/workflow-trial/content-demo-run.mjs`.
- Receipt pattern: `cowork-p2-kit/template-probe/template-cell-receipt.mjs`.

## Overview

Prove that the exact frozen mock can be ingested in isolation and that every
decision-critical value belongs to the intended formula cell. This is GO/NO-GO:
any hash, ownership, ambiguity, or full-ingest determinism failure stops later
phases.

## Requirements

- Verify official-template and filled-source SHA-256 plus `document.xml` SHA-256
  before parsing.
- Compile the complete 146-field template map and require every filled-template
  field to round-trip with no blank required value.
- Stage only the mock under a fresh temporary trial root with a minimal temporary
  classification manifest; do not edit canonical inputs/manifests.
- Run the existing ingest pipeline through the temporary config.
- Extract the exact formula set formula-01/02/03 and:
  - dissolution maximum/minimum/mean;
  - assay;
  - content-uniformity AV;
  - croscarmellose sodium level 1%/3%/5%;
  - DISSOLUTION/ASSAY/CU specifications.
- Produce one formula-cell receipt per critical cell. Each receipt binds source
  document hash, `document.xml` hash, table index/signature, row key, derived
  formula-column header, raw cell text/XML hashes, normalized value, record ID,
  page, quote, offsets, and classification.
- Derive the formula columns from the OOXML header grid (including `gridSpan`)
  and select the unique `Tỷ lệ (%)` composition leaf; missing, swapped, or
  duplicate headers are NO-GO.
- Parse specification operators and thresholds from the source cell XML,
  including supported OOXML symbols. Bind specification receipts only when the
  admitted quote projects to exactly the same semantic value; no `=` → `≥`
  coercion is permitted.
- Reconcile each receipt to exactly one admitted ingest record. Zero or multiple
  matches is NO-GO.
- Run the complete isolated ingest twice. Raw JSONL/store hashes must match.

## Architecture

```text
frozen mock
  -> verify source + document.xml hashes
  -> copy into fresh temp trial root
  -> write temp manifest/config
  -> existing ingest pipeline
  -> targeted DOCX table-cell ownership extractor
  -> receipt <-> admitted record exact join
  -> canonical evidence matrix + result inventory
```

Generic ingest offsets prove where text appears, but not which table column owns
it. The targeted extractor therefore follows the existing template-cell receipt
pattern and treats the generic `record.table` structure only as a hint.

## Related code files

- Create: `cowork-p2-kit/workflow-trial/formulation-spike-run.mjs` — isolated
  staging, ingest, hash and determinism controller.
- Create: `cowork-p2-kit/workflow-trial/formula-cell-receipt.mjs` — deterministic
  table/row/column receipt builder and record reconciler.
- Create: `cowork-p2-kit/workflow-trial/contracts/formula-cell-receipt.schema.v1.json`.
- Create: `cowork-p2-kit/workflow-trial/tests/fixtures/expected-formula-matrix.json`.
- Create: `cowork-p2-kit/workflow-trial/tests/formulation-spike-run.test.mjs`.
- Read/reuse: `cowork-p2-kit/workflow-trial/content-demo-run.mjs` isolated staging.
- Read/reuse: `cowork-p2-kit/template-probe/template-cell-receipt.mjs` and
  `template-record-extractor.mjs` receipt/hash conventions.
- Do not modify: canonical ingest config, classification manifest, or frozen mock.

## Implementation steps

1. Write a red test proving bare canonical ingest does not own this fixture and
   the isolated controller is required.
2. Verify the two frozen hashes before any external parser/binary runs.
3. Create temp input/store/report roots and a minimal manifest that preserves
   `public` + `citable:false`.
4. Run ingest twice from separate fresh roots; compare raw store/JSONL bytes.
5. Extract table cell ownership from DOCX structure; emit canonical receipts.
6. Join each receipt to exactly one record using source hash, row/column owner,
   raw-value hash and quote/offset evidence. Specification joins also seal the
   source and quote semantic-projection hashes.
7. Emit `formula-evidence-matrix.json`, `result-inventory.json`, receipts, hashes,
   diff log, and explicit GO/NO-GO verdict.
8. On NO-GO, stop. Do not use a hand-written or snapshotted store to bypass it.

## Success criteria

- [x] G-00 passes.
- [x] Source and `document.xml` hashes equal frozen independent pins.
- [x] Official template and filled source are both frozen and 146/146 fields
  round-trip before reasoning.
- [x] Exact three formulas and all required values/specs/composition levels found.
- [x] Every value has exactly one cell receipt and exactly one record binding.
- [x] Formula headers/leaves, source specifications, and quote projections are
  unique and semantically exact; OOXML operator/range-symbol loss is rejected.
- [x] Two complete isolated ingests are byte-identical.
- [x] Canonical repository inputs/manifests remain unchanged.

## Risk assessment

- DOCX merge/grid semantics may prevent unambiguous ownership → NO-GO; improve
  targeted cell parsing before continuing.
- OCR or external parser drift may change store bytes → NO-GO for full-run
  determinism; downstream snapshot tests may diagnose but cannot close G-00.
- Expected fixture could become an alternate truth source → it is comparison
  data only; receipts and frozen hashes remain authority.

## Security considerations

- Treat extracted cell text and filenames as data, never commands.
- Temporary roots must reject symlinks and remain outside canonical publication
  roots.
- Preserve source `citable:false`; staging cannot reclassify it.
