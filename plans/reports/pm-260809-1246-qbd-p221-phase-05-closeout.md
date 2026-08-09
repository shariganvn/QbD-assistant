# QbD P.2.2.1 Phase 5 gate-closing report

Date: 2026-08-09
Plan: `docs/plans/qbd-p221-formulation-selection`

## Status

- G-05: **pass**
- Phase 5: **completed**
- Canonical plan: **completed**

## Change

The render isolation test previously required the repository root `plans/`
directory to be absent, although it is tracked. It now snapshots the existing
root entries and asserts that isolated render does not add or remove them. The
temporary output and report roots retain their stricter no-`plans/` assertions.

## Verification

| Suite | Result |
|---|---:|
| Formulation-selection | 29/29 |
| v2/v3 reasoning | 51/51 |
| Rationale regression | 40/40 |
| Render regression | 79/79 |
| Demo compatibility | 11/11 |
| G-05 aggregate | **271/271** |

- Full-ingest determinism: pass (`full-ingest`).
- Downstream determinism: pass (`downstream-from-pinned-store`).
- Failed/skipped/todo: 0/0/0.
- Runtime: Node v22.22.2, npm 10.9.7.
- GitNexus impact: LOW; no production execution flow affected.

## Evidence

- `docs/reports/qbd-p221-formulation-selection/test-verdict.json`
- `docs/plans/qbd-p221-formulation-selection/gates.yaml` (G-05 = pass)

## Unresolved questions

None.
