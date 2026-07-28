<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/progress/*.yaml and docs/decisions/D*.md -->
<!-- Regenerate: baton render-workflow -->
<!-- Source fingerprint: sha256:674b99fa19ee9ee667fd6e5da72f401628d9c35806cbb11863603b9dc1579c01 -->

# PROGRESS

> Generated compatibility view. Canonical state lives in `project-state.yaml` and `docs/progress/*.yaml`.

## Current workstream

- ID: `qbd-p2-ingest-completion`
- Status: `in-progress`
- Plan: `docs/plans/qbd-p2-ingest-completion/post-closure-toctou-validation-plan-patch.md`
- Current pickup: P2 cooperative-writer and file-boundary validation is closed with an accepting verdict. In a new reconciled session, review the committed scope against D20260722 before updating the separate publication-lock spec-diff report.
- Pickup files: `docs/plans/qbd-p2-ingest-completion/post-closure-toctou-validation-plan-patch.md`, `docs/decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md`, `docs/reports/qbd-p2-ingest-completion/spec-diff-step-03-publication-lock-debt-20260724.md`

## Latest progress

| Date | ID | Status | Summary |
|---|---|---|---|
| 2026-07-28 | `P20260728-qbd-p2-ingest-post-closure-validation` | done | Verified the bounded P2 cooperative-writer and file-boundary changes with fresh canonical G-01 through G-10 evidence, an accepting attested verdict, and an independent review; D20260722 remains open. |
| 2026-07-28 | `P20260728-qbd-p2-ingest-closeout-attestation` | done | Recorded the final accepting closeout verdict and synchronized the canonical P2 validation plan after the final independent review; D20260722 remains open. |

## Blockers

- No blocker recorded in the latest progress events.

## History

- Structured events: `docs/progress/*.yaml`
- Pre-cutover prose: `docs/archive/PROGRESS-ARCHIVE.md`
- Search older context with qmd.
