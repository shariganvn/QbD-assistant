---
title: "Phase 1: Wire upstream — sources to records"
status: completed
---

# Phase 1: Wire upstream — sources to records

## Overview

Create the throwaway runner `cowork-p2-kit/workflow-trial/spike-e2e-run.mjs`, set
up an isolated temp root, copy the two source DOCX in, and run the template-probe
and ingest stages so we hold a field map, a receipt, and an ingest record store —
all inside temp.

## Requirements

- [x] One `fs.mkdtemp` root owns every write; source DOCX are read-only.
- [x] `compileTemplateFieldMap` + `extractTemplateCellReceipt` produce field map + receipt.
- [x] `createConfig` receives temp input/store/artifact roots; `runIngest` returns records + store hash.
- [x] No write lands in `cowork-p2-kit/inputs`, `store`, or `outputs`.

## Implementation Steps

1. Create `spike-e2e-run.mjs`; `mkdtemp` a run root with `source/`, `kit/{inputs,store}`,
   `template-probe/`, `ingest-artifacts/` subdirs.
2. Byte-copy template `official-placeholder-template-v3-040826.docx` and filled
   `filled-public-mock-document-030826.docx` into `source/`.
3. Call `compileTemplateFieldMap` + `extractTemplateCellReceipt`; write field map + receipt to temp.
4. Build an isolated `createConfig` result on temp roots; run `runIngest` over the copied filled DOCX.
5. Log receipt occurrence count, mapped-vs-unmapped count (observe, do not assert), and store hash.

## Todo

- [x] Runner + temp root scaffolding
- [x] Template-probe stage wired and logged
- [x] Ingest stage wired and logged
- [x] Canonical roots confirmed untouched after upstream

## Success Criteria

Field map, receipt, and record store exist under the temp root from the same
copied sources; canonical inputs/store/outputs are byte-unchanged.

## Result (verified)

One real run of `spike-e2e-run.mjs` produced the field map + receipt (5 fields)
and an ingest store of 21 records from the copied filled DOCX. The before/after
hash guard confirmed canonical `inputs`/`store`/`outputs` stayed byte-identical.
Runner exits 0 at the upstream checkpoint. Upstream half of the pipeline is
proven to connect end to end.
