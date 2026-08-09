---
phase: 5
title: "Legitimacy-negative and split determinism regression suite"
status: completed
priority: P1
effort: "1-2d"
dependencies: [0, 1, 2, 3, 4]
---

# Phase 5: Legitimacy-negative and split determinism regression suite

## Context links

- Gate: `gates.yaml` → G-05.
- Covers every trust boundary introduced in Phases 0-4.

## Overview

Lock the MVP legitimacy negatives with specific error-code assertions, and keep
full-ingest determinism separate from downstream snapshot determinism so a stable
snapshot cannot conceal an unstable extraction boundary. The full cryptographic
forgery/publication adversarial matrix is deferred to the authorization module.

## Requirements

### Required negative matrix

| Boundary | Negative | Expected result |
|---|---|---|
| Source | DOCX or `document.xml` hash mismatch | reject before parse |
| Template binding | template hash/owner drift, incomplete 146-field receipt or unresolved placeholder | reject |
| Isolated ingest | canonical/broad root used or fixture absent from temp manifest | reject |
| Cell ownership | wrong/duplicate formula column, row, cell hash or record join | NO-GO |
| Typed evidence | specification bound as observed result | `E_SPEC_AS_RESULT` |
| Inventory | omitted adverse record or result relabeled context | reject |
| Cohort | missing, extra, duplicated or unexpected formula ID | inconclusive/reject |
| Spec compile | threshold/operator/spec hash/store hash drift | `E_RUBRIC_SPEC_DRIFT` |
| Strict gate | CU AV exactly 15 | ineligible under `<15` |
| Approval | caller-supplied approval state; fd-confirm flag unset | inconclusive fd_decision |
| Proposal integrity | winner/selected/decision token in `engineering_proposal` | reject |
| Proposal cohort | partial cohort asked for a proposed survivor | no proposed survivor |
| Publication | decision/data/spec/rubric/diagnostic/proposal from different runs | reject |
| Rationale | unbound value, invented 1%/3%/5%, recommendation in proposal block | reject |
| Classification | non-citable source represented as public citation | reject |
| Render | missing review marker, missing watermark/`NOT FD APPROVED`, or missing internal provenance | reject |

> Deferred to the authorization module: cryptographic FD-receipt forgery,
> insider-pin tampering and the full publication-forgery adversarial matrix.

### Determinism matrix

- **Full-ingest:** two fresh isolated runs from the frozen DOCX must have equal
  raw store/JSONL, receipts, inventory and evidence package hashes. Failure means
  G-00/G-05 fail; no snapshot fallback can turn it into a pass.
- **Downstream diagnostic:** starting from the same accepted store snapshot may
  separately compare diagnostic, decision, rationale and normalized OOXML.
  Report label must be `downstream-from-pinned-store`, never `full-run`.
- Test verdict records both results independently.

## Architecture

Keep focused tests with their owning module, then aggregate the exact commands
and machine verdict. Do not duplicate production logic in test helpers. The old
synthetic demo pack may be used only for frozen v2 regression, never as expected
evidence or winner for this plan.

## Related code files

- Create: `cowork-p2-kit/workflow-trial/tests/formulation-selection-negatives.test.mjs`.
- Create: `cowork-p2-kit/workflow-trial/tests/formulation-selection-determinism.test.mjs`.
- Create: `cowork-p2-kit/workflow-trial/tests/formulation-selection-publication.test.mjs`.
- Create: `cowork-p2-kit/workflow-trial/tests/formulation-selection-render.test.mjs`.
- Modify: `package.json` only if an existing test-script naming pattern requires
  a scoped aggregate command.
- Read/run: all existing ingest, reasoning v2, rationale, render and workflow-trial
  regressions affected by shared contract changes.

## Implementation steps

1. Add focused red tests before each Phase 0-4 implementation change.
2. Build the aggregate negative matrix with exact error-code assertions.
3. Run two complete isolated ingests; compare every upstream byte/hash artifact.
4. Run two downstream passes from the accepted store; compare diagnostic,
   fd_decision, engineering_proposal, packet and normalized OOXML separately.
5. Run v2 compatibility suites to prove additive v3 changes did not alter prior
   behavior.
6. Emit `test-verdict.json` with commands, versions, hashes, lane labels and
   pass/fail per negative. A missing assertion is a failed verdict.

## Success criteria

- [x] G-05 passes.
- [x] Every negative above asserts the expected error/state, not only “throws”.
- [x] Full-ingest and downstream determinism have separate verdict fields.
- [x] Any ingest nondeterminism fails the plan instead of activating a snapshot bypass.
- [x] Existing v2 reasoning, demo rationale and render regression suites pass;
  fresh aggregate is 291/291 with no remaining baseline failures.
- [x] Complete template+filled binding and final resolved P.2.2.1 render are
  covered by focused drift/completeness tests.
- [x] The engineering_proposal naming CT03 cannot be published or read as an FD decision.

## Risk assessment

- Aggregate suite may duplicate focused tests → aggregate commands/reports focused
  results; only cross-stage substitution/determinism logic belongs centrally.
- External tool versions may make full ingest unstable → capture versions and
  fail G-00; do not weaken the invariant.
- Caller approval state may leak into the runner → assert the runner has no
  approval CLI option and only the fd-confirm flag moves fd_decision.

## Security considerations

- Test temporary roots must be fresh, symlink-free and cleaned by the test harness.
- Reports contain hashes/relative paths only; no machine-local absolute paths or
  secrets.
