---
phase: 1
title: "Freeze Trial Contract and Prove Same-Source Feasibility"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Freeze Trial Contract and Prove Same-Source Feasibility

## Context Links

- `docs/plans/placeholder-template-ingest-workflow-probe/plan.md`
- `docs/decisions/D20260728-qbd-rationale-report-layer-boundary.md`
- `cowork-p2-kit/template-probe/tests/template-workflow-probe.test.mjs`
- `cowork-p2-kit/store/records.schema.json`

## Overview

Freeze the exact internal trial semantics before source changes. Reconfirm the
known empirical baseline: the same mock can be ingested, three selected raw
values map exactly to LiteParse records, and two remain truthfully unmapped.
This is a contract gate, not an attempt to force five matches.

## Requirements

- Functional: use only the frozen official template and filled public/mock DOCX.
- Functional: isolated manifest keeps `label=public`, `citable=false`; do not
  change the completed probe intake or canonical classification manifest.
- Functional: expected downstream result is one visibly synthetic candidate,
  `inconclusive`, `internal_only`, zero fact claims/citations, and an internal
  trial DOCX.
- Non-functional: no repository write except plan-scoped spike findings; every
  runtime output lives in one controller-owned system-temp root.

## Architecture

Run template extraction and existing ingest independently over byte-identical
copies of the same filled DOCX. Record exact record count, store hash, and match
cardinality for all five receipt values. Accept only unique exact matches. The
pinned baseline is three exact, two unmapped, zero ambiguous. Normalization,
fuzzy matching, shared-owner guessing, or fabricated page data is forbidden.

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Read only | `/media/E/VIBECODING/MODULE3-agent/plans/260805-1335-template-to-docx-end-to-end-trial/research/template-ingest-contract-research.md` | — | Owns the empirical 3/2 baseline |
| Read only | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/**` | — | Existing 14-test baseline |
| Read only | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/**` | — | Existing focused ingest baseline |

## Function and Interface Checklist

- [ ] `compileTemplateFieldMap` and `extractTemplateCellReceipt` run unchanged.
- [ ] `createConfig` receives absolute temp `kitDir`, input/store/artifact roots.
- [ ] `runIngest` produces schema-valid records from the copied mock.
- [ ] Five receipt values have documented `exact|unmapped|ambiguous` status.

## Implementation Steps

1. Snapshot current template/mock/canonical roots and all 18 tracked dirty files.
2. Create one `mkdtemp` root; byte-copy mock, record schema, and minimal manifest.
3. Run focused template and ingest behavior with explicit temp roots.
4. Compare receipt values against record `content` and provenance `quote` using
   exact bytes only; require the reviewed three-exact/two-unmapped baseline.
5. Freeze one inline test policy: candidate ID `trial-candidate-01`; all profile
   values visibly prefixed/labeled synthetic; one context-only card from an exact
   record; proposal rubric with no approval pin; zero-fact rationale; no citation.
6. Delete only the exact owned temp root after success; retain it on failure.

## Test Scenario Matrix

| Risk | Scenario | Expected |
|---|---|---|
| Critical | An expected exact value loses its unique match | Fail as contract drift |
| High | An expected unmapped value is force-matched | Reject; no fallback |
| Critical | Match requires fuzzy/normalized text | Reject implementation |
| High | Manifest marks mock citable | Reject preflight |
| Medium | Value appears in multiple records | Mark `ambiguous`; fail baseline |

## Success Criteria

- [ ] Five-entry receipt and isolated record store are produced from the same
      mock hash with no canonical mutation.
- [ ] Join result is exactly three `exact`, two `unmapped`, zero `ambiguous`.
- [ ] Trial policy explicitly preserves non-citable/internal/inconclusive status.

## Risk Assessment and Rollback

Highest risk is tool-version drift changing the known 3/2 baseline. Pin and
report the tool versions; stop on drift instead of updating expected results
silently. This phase creates no durable product artifact to roll back.

## Security Considerations

Treat document text as untrusted data. Use argument arrays and fixed temp roots;
never execute content or expose it to network/model calls.

## Next Steps

Proceed to Phase 2 only after the pinned 3/2/0 contract assertions pass.
