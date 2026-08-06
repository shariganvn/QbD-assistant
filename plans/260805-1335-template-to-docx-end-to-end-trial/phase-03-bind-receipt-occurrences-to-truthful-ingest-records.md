---
phase: 3
title: "Report Truthful Same-Source Occurrence Matches"
status: pending
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 3: Report Truthful Same-Source Occurrence Matches

## Context Links

- [Phase 2](./phase-02-build-isolated-same-source-template-and-ingest-run.md)
- `cowork-p2-kit/template-probe/contracts/template-cell-receipt.schema.v1.json`
- `cowork-p2-kit/store/records.schema.json`

## Overview

Compute a test-local diagnostic join between receipt occurrences and real ingest
records. Preserve the frozen receipt (`record_id=null`, projection unavailable).
The join is acceptance evidence inside the controller, not a new downstream
contract or production sidecar.

## Requirements

- Functional: evaluate exactly five unique occurrence IDs and field IDs.
- Functional: every entry records `exact`, `unmapped`, or `ambiguous`; only an
  exact entry may carry record/page/offset/quote evidence.
- Functional: require document and store hashes for the join as a whole.
- Non-functional: exact matching only; the pinned baseline is 3/2/0.

## Architecture

Test-local `buildOccurrenceJoin(...)` returns a canonical diagnostic object. It
validates inputs first and performs no writes. Downstream reasoning consumes the
validated store and explicit test policy—not this diagnostic object.

## File Inventory

| Action | Path | Rough size | Test impact |
|---|---|---:|---|
| Modify | `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/workflow-trial/tests/workflow-trial.e2e.test.mjs` | +50-90 lines | Test-local join and cross-stage assertions |

## Function and Interface Checklist

- [ ] `buildOccurrenceJoin` is test-local, pure, exact-keyed, and deterministic.
- [ ] `assertExpectedJoinBaseline` requires 3 exact, 2 unmapped, 0 ambiguous.
- [ ] Existing receipt/map/record validators are reused, not copied.

## Implementation Steps

1. Run GitNexus impact for every existing symbol before any implementation edit;
   expected core edits are zero.
2. Write cross-stage tests for source/store mismatch, duplicate/ambiguous match,
   forged page/offset/quote, and expected unmapped handling.
3. Implement exact candidate search over validated record `content`/`quote`.
4. Emit sorted diagnostic entries; omit record/page fields for non-exact status.
5. Compare canonical diagnostic bytes across two runs without publishing them.
6. Prove receipt bytes still report unavailable projection and null record IDs.

## Test Scenario Matrix

| Risk | Scenario | Expected |
|---|---|---|
| Critical | Same value occurs in two candidate records | `ambiguous`; fail baseline |
| Critical | Forged page/offset/quote | Join assertion failure |
| Critical | Receipt/store come from different source | Source/store binding failure |
| High | Expected unmapped value receives inferred match | Reject |
| Medium | Input/object key order changes | Canonical bytes/hash unchanged |

## Success Criteria

- [ ] Exactly five statuses are reported: 3 exact, 2 unmapped, 0 ambiguous.
- [ ] Exact-entry bytes repeat identically and all referenced record bytes exist.
- [ ] Existing receipt, ingest schema, and canonical store remain unchanged.

## Risk Assessment and Rollback

Do not broaden matching when a value is absent or ambiguous. A production
five-of-five requirement needs a separate native-OOXML or derived-source design.
Rollback removes only test-controller changes.

## Security Considerations

Treat field and record text as untrusted. Error diagnostics list IDs/hashes and
cardinality, not full document contents.

## Next Steps

Phase 4 uses the binding as traceability evidence; reasoning still consumes the
validated store and explicitly approved author inputs, never the receipt itself.
