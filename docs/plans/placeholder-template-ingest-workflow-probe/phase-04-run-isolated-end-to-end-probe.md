---
phase: 4
title: "Run isolated end-to-end probe"
status: pending
priority: P1
effort: "4-6h"
dependencies: [3]
---

# Phase 04: Run isolated end-to-end probe

<!-- Updated: Validation Session 1 - probe test under cowork-p2-kit/template-probe/; evidence binds the isolated sidecar cell-level receipt -->

## Overview

Run the template-aware public/mock package twice through isolated ingest and the
available downstream verification path, proving reproducibility and boundaries.

## Requirements

- Functional: run approved ingest, retrieval/reasoning/render checks needed to
  exercise the complete workflow without promoting outputs.
- Functional: capture exact counts, hashes, round-trip results, downstream
  branch coverage, and field-level traceability.
- Non-functional: use isolated input/store/artifact roots; canonical inputs and
  store must be byte-identical before and after.

## Architecture

The probe uses an explicit temporary config and immutable source snapshot. Run
1 and Run 2 start from equivalent isolated state. Evidence binds source,
template, field map, records, the isolated sidecar cell-level receipt, store,
and downstream output hashes.

## Related code files

- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/cli.mjs`
- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/config.mjs`
- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/tests/verify-ingest.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-workflow-probe.test.mjs`
- Create: `TBD ignored artifact root after template identity is frozen`

## Implementation Steps

1. Snapshot canonical input/store manifests and hashes.
2. Create isolated run roots and stage only the authorized template-derived
   package, field map, and classification metadata.
3. Run focused contract tests, then isolated ingest twice from clean run roots.
4. Exercise downstream verification sufficient to evaluate the full vertical
   workflow; record unavailable branches as not tested, never as pass.
5. Compare record/store/output hashes and exact field-level receipts.
6. Recompute canonical snapshots and fail on any mutation.

## Todo

- [ ] Focused and existing ingest contract tests pass.
- [ ] Both runs have identical record counts and hashes.
- [ ] Field-level reconciliation reports zero failure.
- [ ] Downstream branch results are explicit and evidence-backed.
- [ ] Canonical inputs/store remain byte-identical.

## Success Criteria

- No unconditional `round_trip_failures: 0` or marker-only success claim.
- All passed claims point to a command, artifact, count, or hash.
- A failed downstream branch does not publish partial canonical output.

## Risk assessment and rollback

Risk: a probe can accidentally write through canonical defaults. Mitigate with
explicit absolute isolated roots, preflight boundary assertions, and before/after
hashes. Roll back by deleting only validated session-specific temporary roots;
canonical state must require no restoration.

## Next steps

Carry the immutable evidence packet and any failures to Phase 05.
