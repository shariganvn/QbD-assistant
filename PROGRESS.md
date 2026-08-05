<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/progress/*.yaml and docs/decisions/D*.md -->
<!-- Regenerate: baton render-workflow -->
<!-- Source fingerprint: sha256:e830e09be783d87df8c163e6cd432f30fa52ca684d81e4a6e4f59e42dbfe089c -->

# PROGRESS

> Generated compatibility view. Canonical state lives in `project-state.yaml` and `docs/progress/*.yaml`.

## Current workstream

- ID: `placeholder-template-ingest-workflow-probe`
- Status: `in-progress`
- Plan: `docs/plans/placeholder-template-ingest-workflow-probe/plan.md`
- Current pickup: Placeholder-template MVP is complete through the receipt-only boundary: all six phases are closed, the five-field two-run proof passed, and promotion remains held pending independent provenance and contract-binding decisions.
- Pickup files: `cowork-p2-kit/template-probe/template-record-extractor.mjs`, `cowork-p2-kit/template-probe/template-cell-receipt.mjs`, `cowork-p2-kit/template-probe/contracts/template-cell-receipt.schema.v1.json`

## Latest progress

| Date | ID | Status | Summary |
|---|---|---|---|
| 2026-08-04 | `P20260804-placeholder-template-ingest-phase-01-closeout` | done | Closed Phase 01 only: the PO-supplied FD-like MVP template and public/synthetic mock are frozen for an isolated, non-citable workflow probe. This is not a production or FD-authority decision. |
| 2026-08-05 | `P20260805-placeholder-template-ingest-phase-02-05-closeout` | done | Closed Phase 02 field-map compilation and Phase 05 evidence review only. Phase 03 and Phase 04 were intentionally not executed and remain the next pickup because the frozen record schema requires truthful page provenance that DOCX cell owners do not currently provide. |
| 2026-08-05 | `P20260805-placeholder-template-ingest-phase-03-04-closeout` | done | Completed Phase 03 fixed five-field receipt extraction and Phase 04 two-run isolated determinism proof. Promotion remains held and no production or downstream contract is changed. |

## Blockers

- No blocker recorded in the latest progress events.

## History

- Structured events: `docs/progress/*.yaml`
- Pre-cutover prose: `docs/archive/PROGRESS-ARCHIVE.md`
- Search older context with qmd.
