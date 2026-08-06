---
phase: 2
title: "Build Isolated Same-Source Template and Ingest Run"
status: pending
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Build Isolated Same-Source Template and Ingest Run

## Context Links

- [Phase 1](./phase-01-start.md)
- `cowork-p2-kit/template-probe/template-record-extractor.mjs`
- `cowork-p2-kit/ingest/config.mjs`
- `cowork-p2-kit/ingest/pipeline.mjs`
- `research/evidence-isolation-research.md`

## Overview

Create the test-owned run-root builder and execute template probe plus ingest
against byte-identical copies of one filled DOCX. Keep helpers local to the E2E
test until another caller proves a reusable production abstraction is needed.

## Requirements

- Functional: create selected map, receipt, `records.jsonl`, ingest artifacts,
  and stage manifests only below the run root.
- Functional: copy input bytes; reject symlink/hard-link shortcuts and undeclared files.
- Non-functional: fixed clock/run IDs for stable contract bytes; serial stages;
  no server, watcher, daemon, or unowned background process.
- Non-functional: protected repository snapshots must match after every stage.

## Architecture

```text
run-N/
├── source/{template.docx,filled.docx}
├── template-probe/{field-map,receipt}
├── kit/{inputs,store}
├── ingest-artifacts/
├── reasoning/
├── rationale/
├── render/
└── diagnostics/
```

The test calls exported functions with injected roots. It must not call
no-argument `npm run ingest` or any retained-evidence verifier.

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Create | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/tests/workflow-trial.e2e.test.mjs` | 400-600 lines total across phases | Owns temp roots and full-chain assertions |
| Inline | `workflow-trial.e2e.test.mjs` test policy constant | 30-50 lines | One test-only policy, not a public contract |
| Read only | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/store/records.schema.json` | — | Copied into each temp store |

## Function and Interface Checklist

- [ ] `createTrialRoots()` rejects overlap, escape, symlink, and canonical roots
      within the cooperative-writer threat model.
- [ ] `snapshotProtectedState()` hashes path/type/size/bytes deterministically.
- [ ] `runTemplateStage()` writes only selected map and receipt.
- [ ] `runIngestStage()` injects all writable roots and returns records/store hash.
- [ ] `assertStageAllowlist()` rejects temp/backup/lock/surplus members.

## Implementation Steps

1. Write red tests for root escape, symlink, canonical-root alias, undeclared input,
   and protected-state mutation.
2. Add one validated inline policy bound to template/mock SHA-256 and pinned tool
   versions; do not introduce a versioned fixture contract.
3. Implement test-local root/snapshot/copy helpers; use fresh bytes, not links.
4. Compose the existing template map/receipt functions with `runIngest` using an
   isolated `createConfig` result.
5. Validate field map, receipt, JSONL schema, record round trips, stage allowlist,
   and exact source/store hashes before returning.
6. For the fixed hash-pinned fixture, run template/ingest with isolated writable
   roots, allowlisted environment, and the existing direct-child timeouts; do not
   add a whole-pipeline Bubblewrap or claim descendant-process attestation. On a
   timeout, fail immediately and prove protected roots/store bytes are unchanged.
7. Add `finally` cleanup guarded by exact temp parent and owner sentinel; on
   failure retain root and print its exact path.

## Test Scenario Matrix

| Risk | Scenario | Expected |
|---|---|---|
| Critical | Output root resolves inside canonical store/report root | Reject before write |
| Critical | Copied source hash differs | Reject before extraction |
| High | Ingest dependency/round trip fails | No store replacement; local diagnostic |
| High | Direct stage timeout or temp/lock/backup remains | Fail and prove protected bytes unchanged |
| Medium | Re-run same stage in same root | Byte-identical and no surplus |

## Success Criteria

- [ ] One isolated run yields valid receipt and store from the same source hash.
- [ ] Canonical roots and the existing dirty bytes are unchanged stage-by-stage.
- [ ] Failure cleanup affects only the controller-owned temp root/processes.

## Risk Assessment and Rollback

External binaries can be slow or unavailable. Fail with the dependency name and
keep diagnostics; never install or use an unisolated fallback. Rollback deletes
the controller test only.

## Security Considerations

Use literal argv arrays, a hash-pinned fixed DOCX, isolated roots, allowlisted
environment variables, and stage timeouts. This scoped choice is valid only for
the reviewed fixture; arbitrary future templates require whole-pipeline sandboxing.
Never dump the full environment or source content.

## Next Steps

Phase 3 consumes only the validated receipt and store returned here.
