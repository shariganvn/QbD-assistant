---
phase: 4
title: "Run isolated end-to-end probe"
status: pending
priority: P1
effort: "4-6h"
dependencies: [3]
---

<!-- Session 3 boundary: Phase 04 is intentionally not executed; existing
     workflow test code is pickup material, not two-run probe evidence. -->

# Phase 04: Run isolated end-to-end probe

<!-- Updated: Validation Sessions 1–2 - named ignored artifact root; probe evidence is distinct from unrelated downstream regression suites -->

## Overview

Run the template-aware public/mock package twice through isolated ingest and
state each downstream branch's availability without treating a regression suite
as proof that it processed the probe.

## Requirements

- Functional: run the approved isolated ingest path twice from clean roots and
  capture whether a truthful schema-valid projection was available. Run
  `npm run verify:ingest` as an existing boundary regression suite.
- Functional: run `npm run verify:reasoning` and `npm run verify:render`
  only as existing regression suites; they are not evidence that those layers
  processed the probe unless a separately authorized compatible input contract
  exists.
- Functional: capture exact counts, hashes, round-trip results, downstream
  branch coverage, and field-level traceability.
- Non-functional: use isolated input/store/artifact roots; canonical inputs and
  store must be byte-identical before and after.

## Architecture

The probe uses an explicit temporary config and immutable source snapshot. Run
1 and Run 2 start from equivalent isolated state. Evidence binds source,
template, field map, records, the isolated sidecar cell-level receipt, store,
and an output hash only for a separately authorized downstream branch that
actually processed the probe.

## Related code files

- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/cli.mjs`
- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/config.mjs`
- Read: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/ingest/tests/verify-ingest.mjs`
- Create: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/template-probe/tests/template-workflow-probe.test.mjs`
- Create: ignored run roots under `artifacts/placeholder-template-ingest-workflow-probe/<run-id>/`

## Implementation Steps

1. Snapshot canonical input/store manifests and hashes.
2. Create isolated run roots and stage only the authorized template-derived
   package, field map, and classification metadata.
3. Run focused map/extractor/workflow tests and `npm run verify:ingest`, then
   invoke the ingest CLI with an absolute isolated config twice from clean run roots.
4. Run the reasoning and render regression suites separately; record each
   unavailable probe-processing branch as not tested, never as pass.
5. Compare map, receipt, record, and store hashes, plus an output hash only for
   an authorized downstream branch that actually processed the probe.
6. Recompute canonical snapshots and fail on any mutation.

## Todo

- [ ] Focused and existing ingest contract tests pass.
- [ ] Both runs have identical record counts and hashes.
- [ ] Field-level reconciliation reports zero failure.
- [ ] Downstream branch results are explicit and evidence-backed.
- [ ] Regression-suite results are not represented as probe-processing results.
- [ ] Canonical inputs/store remain byte-identical.

## Prework evidence — not Phase 04 execution (2026-08-04)

The entries below are retained as prework evidence for the next pickup. They
do not represent the required two-run Phase 04 execution or closeout in this
session.

- Focused v3 workflow prework passes 1/1 and proves exact receipt extraction
  without mutating canonical inputs or `cowork-p2-kit/store`.
- Existing ingest and reasoning verification suites were previously run as regression
  checks. Render regression has 48/48 remaining tests passing plus one unrelated
  baseline failure caused by the pre-existing untracked `plans/` directory;
  none of these suites processed the blocked probe package.
- The two-run isolated ingest, record/store hash comparison, and downstream
  probe coverage remain pending; Phase 03 prework can produce a truthful receipt, but
  the existing record projection still lacks page provenance.

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
