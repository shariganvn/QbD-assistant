---
phase: 5
title: "Publish Packet-Only Rationale and Record Optional Manual Separation"
status: pending
priority: P1
effort: "4h"
dependencies: [4]
---

# Phase 5: Publish Packet-Only Rationale and Record Optional Manual Separation

## Context Links

- [Phase 4](./phase-04-publish-inconclusive-reasoning-package-and-seal-packet.md)
- `docs/decisions/D20260728-qbd-rationale-report-layer-boundary.md`
- `cowork-p2-kit/RATIONALE-SKILL.md`
- `cowork-p2-kit/rationale/claim-binding.mjs`
- `cowork-p2-kit/rationale/rationale-publication.mjs`

## Overview

Exercise packet-to-rationale publication with a deterministic test-only author
that reads only the sealed packet. Automated acceptance proves structural
wiring, not the human two-context operating procedure. A fresh Cowork context
remains an optional manual review with procedural—not machine-verifiable—evidence.

## Requirements

- Functional: rationale is English, `internal_only`, `winner=null`, has exactly
  one or more non-fact `decision_state`/causal claims, and no recommendation.
- Functional: rationale contains zero `fact` claims, fact-card citations, raw
  values, units, or mock quotes; it preserves only packet decision state/action.
- Functional: automated helper has no default/fallback and is visibly test-only.
- Non-functional: publication uses injected temp root and produces exact four-member
  package with deterministic Markdown and receipt.

## Architecture

Automated test authoring proves contract wiring, not prose quality or author
session identity. Optional manual review follows this procedural workflow:

```text
fact-card/reasoning context -> sealed packet -> NEW rationale context
                                            -> validate -> publish package
```

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/tests/workflow-trial.e2e.test.mjs` | +60-100 lines | Packet-only author and package assertions |
| Create | `/media/E/VIBECODING/MODULE3-agent/plans/260805-1335-template-to-docx-end-to-end-trial/reports/manual-authoring-checklist.md` | 50-90 lines | Optional procedural review; not automated evidence |

## Function and Interface Checklist

- [ ] Test-only `authorTrialRationale(packet)` reads packet only and produces no
      `fact` claim or fact-card citation.
- [ ] `validateRationale` runs before any input file write/publication.
- [ ] `createRationaleCli` receives only the temp rationale root.
- [ ] `validatePublishedRationalePackage` and packet/source revalidation pass.
- [ ] Manual checklist records the intended distinct context/input allowlist but
      does not claim cryptographic or machine-verifiable attestation.

## Implementation Steps

1. Write cross-stage negatives for decision drift, external display, fact claim,
   fact-card cite, recommendation, invented value/unit, and missing causal refs.
2. Keep generic decision-state wording in the test helper; fill identity/hash and
   exact action/causal references from the packet at runtime.
3. Build and validate rationale from packet-only input; publish via injected CLI.
4. Reopen the package, compare regenerated Markdown byte-for-byte, and verify
   rationale receipt hashes/member allowlist.
5. Write an optional manual checklist for a fresh rationale session using an
   explicitly retained review bundle. Mark it procedural and outside the one-command gate.

## Test Scenario Matrix

| Risk | Scenario | Expected |
|---|---|---|
| Critical | Author changes winner/status/action | Existing rationale error; no package |
| Critical | Inconclusive text recommends a formula | Reject recommendation drift |
| High | Manual author reads wider corpus | Procedural review invalid; automated gate unaffected |
| High | Packet identity/hash stale | Reject before publication |
| Medium | Object key order differs | Canonical package bytes unchanged |

## Success Criteria

- [ ] Automated path preserves packet-only input and zero-fact output.
- [ ] Package stays internal, inconclusive, recommendation-free, and deterministic.
- [ ] No reasoning or production rationale root bytes change.

## Risk Assessment and Rollback

Mechanical test text is not an approved production authoring policy. Label it
test-only and never expose it through a product CLI. Optional manual separation
is human process evidence only. Rollback removes controller/checklist changes.

## Security Considerations

Packet text remains untrusted. No retrieval, glob, network, environment dump, or
model call is allowed in automated `.mjs` code.

## Next Steps

Phase 6 converts only the validated internal rationale package to a render draft.
