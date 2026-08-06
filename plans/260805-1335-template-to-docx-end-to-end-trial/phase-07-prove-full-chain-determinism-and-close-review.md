---
phase: 7
title: "Prove Full-Chain Determinism and Close Review"
status: pending
priority: P1
effort: "1d"
dependencies: [6]
---

# Phase 7: Prove Full-Chain Determinism and Close Review

## Context Links

- [Phase 6](./phase-06-adapt-internal-rationale-and-render-docx.md)
- `package.json`
- `research/evidence-isolation-research.md`

## Overview

Turn the stages into one direct repeatable test command. Run two fresh roots,
inject only cross-stage failures, compare stable artifacts, prove repository byte
preservation, then document the exact claim boundary. Do not duplicate mature
layer-local negative suites or promote the experiment prematurely.

## Requirements

- Functional: one focused command executes template → ingest → diagnostic join →
  inconclusive reasoning → sealed rationale → internal draft → DOCX twice.
- Functional: stage/member allowlists, receipt/hash chains, protected snapshots,
  process cleanup, and failure diagnostics are mandatory acceptance outputs.
- Non-functional: focused acceptance never writes retained gate evidence; gate
  regeneration is a separate explicitly approved clean-worktree activity.
- Non-functional: no skipped/todo/cancelled/timed-out test and no hidden warning path.
- Non-functional: automated acceptance does not claim a separate human author
  context or retain a review bundle unless the operator explicitly requests one.

## Architecture

Run 1 and Run 2 execute serially in sibling temp roots. Compare canonical selected
map, receipt, records, diagnostic join, reasoning package, rationale package,
draft, normalized OOXML manifest, and relative file manifest. Raw DOCX hashes and
volatile diagnostics are reported but excluded from the equality contract.

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/tests/workflow-trial.e2e.test.mjs` | final 400-600 lines | Two-run/cross-stage controller |
| Create | `/media/E/VIBECODING/MODULE3-agent/plans/260805-1335-template-to-docx-end-to-end-trial/reports/acceptance-closeout.md` | 100-180 lines | Exact evidence and unresolved items |

## Function and Interface Checklist

- [ ] `runIsolatedTrial` owns one exact root and all stage roots/processes.
- [ ] `compareStableArtifacts` requires normalized OOXML equality and treats raw
      DOCX hash as diagnostic only.
- [ ] `assertProtectedStateUnchanged` runs after every write-capable stage.
- [ ] Failure path retains exact root, emits redacted manifest diff, and exits nonzero.
- [ ] The direct workflow-trial test never calls a retained-evidence verifier.

## Implementation Steps

1. Add only seam/cross-stage negatives: different source/store, unexpected join
   status, any scoring/selected decision, fact rationale, package drift, citation,
   root mismatch, render network-isolation failure, and direct-stage timeout.
2. Execute Run 1 and Run 2 serially with identical fixed policy/IDs and fresh roots.
3. Compare stable artifacts/member lists and reuse existing layer-local suites for
   publication rollback/idempotence instead of copying their cases.
4. Assert protected snapshots for canonical inputs/store/outputs/artifacts/report
   roots plus the 18 pre-existing dirty files after each stage and final exit.
5. Keep the first entry point as the direct `node --test` command. Do not add an
   npm script, README workflow, or architecture promotion in this trial.
6. Run focused syntax/tests, then broad non-retained regression suites serially.
7. Run high-risk code review and `gitnexus_detect_changes`; address all concrete
   findings without touching explicit user decisions.
8. Optionally create a separately requested, immutable review bundle for manual
   two-context authoring/DOCX inspection; never treat it as automated evidence.
9. Write closeout with internal, non-citable, inconclusive, non-promotion boundary.
10. If retained gates are requested later, run four `npm run verify:*` suites in
    a clean disposable worktree, validate complete evidence, and copy back only
    after explicit approval. Never mix partial suite evidence with this closeout.

## Test Scenario Matrix

| Priority | Scenario | Gate |
|---|---|---|
| Critical | Two runs differ in stable artifact or normalized OOXML | Fail |
| Critical | Any protected repository byte changes | Fail at first stage |
| Critical | Selected/external/citable claim appears | Fail semantic boundary |
| High | Direct timeout or temp/lock/surplus member | Fail cleanup/allowlist |
| High | Existing module regression | Fix; never weaken tests |
| Medium | Diagnostic timestamps differ | Compare stable projection only |

## Validation Commands

```bash
node --check cowork-p2-kit/workflow-trial/*.mjs
node --test cowork-p2-kit/workflow-trial/tests/*.test.mjs
node --test cowork-p2-kit/template-probe/tests/*.test.mjs
node --test cowork-p2-kit/ingest/tests/record-contract.test.mjs cowork-p2-kit/ingest/tests/pipeline.test.mjs
node --test cowork-p2-kit/reasoning/tests/contract.test.mjs cowork-p2-kit/reasoning/tests/output-preservation.test.mjs cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs cowork-p2-kit/reasoning/tests/decision-engine.test.mjs
node --test cowork-p2-kit/rationale/tests/packet-contract.test.mjs cowork-p2-kit/rationale/tests/claim-binding.test.mjs cowork-p2-kit/rationale/tests/rationale-publication.test.mjs
node --test cowork-p2-kit/render/tests/contract.test.mjs cowork-p2-kit/render/tests/output-preservation.test.mjs cowork-p2-kit/render/tests/determinism.test.mjs
git diff --check
```

## Success Criteria

- [ ] All focused/broad non-retained tests pass with no hidden failure state.
- [ ] Two-run automated chain passes; optional manual review is reported separately.
- [ ] Dirty count changes only by approved implementation/plan files; original 18
      bytes and every protected canonical/report root remain unchanged.
- [ ] Review and GitNexus scope match one controller, at most one pure adapter,
      minimum sandbox compatibility, and plan-scoped closeout only.

## Risk Assessment and Rollback

Full-chain tests can be slow and system-dependent. Keep one serial direct command
and stage diagnostics; do not split into flaky parallel jobs. Rollback removes
the controller, optional adapter/sandbox seam, and closeout only.

## Security Considerations

For the fixed hash-pinned fixture, preserve content-as-data, strict path ownership,
direct-child timeouts, redacted diagnostics, and no credential/environment capture.
Enforce no-network Bubblewrap at render; do not claim whole-pipeline network or
descendant-process isolation for template/ingest.

## Next Steps

Close automated acceptance after the chain passes and closeout states structural
trial—not citable evidence, formula selection, dossier completion, or production
promotion. User DOCX review remains an optional explicitly retained run.
