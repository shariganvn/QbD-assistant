<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/progress/*.yaml and docs/decisions/D*.md -->
<!-- Regenerate: baton render-workflow -->
<!-- Source fingerprint: sha256:441a1c776df45817db2bd090924dd15fe7dd878bb1f983d1b5c22b0936bf3497 -->

# PROGRESS

> Generated compatibility view. Canonical state lives in `project-state.yaml` and `docs/progress/*.yaml`.

## Current workstream

- ID: `qbd-rationale-report-layer`
- Status: `in-progress`
- Plan: `docs/plans/qbd-rationale-report-layer/plan.md`
- Current pickup: Rationale Steps 1–4 are closed. Begin Step 5 integrated verification and end-to-end acceptance from the sealed publication path only.
- Pickup files: `docs/plans/qbd-rationale-report-layer/step-05-integrated-gates-review.md`, `docs/plans/qbd-rationale-report-layer/gates.yaml`, `cowork-p2-kit/rationale/rationale-publication.mjs`

## Latest progress

| Date | ID | Status | Summary |
|---|---|---|---|
| 2026-07-29 | `P20260729-qbd-rationale-step-04` | done | Completed rationale Step 4: publish-rationale atomically publishes the sealed packet, validated rationale JSON, deterministic Markdown, and a hash-bound receipt into the isolated rationale root; the dedicated Cowork skill confines authoring to the sealed packet and internal-only output. |
| 2026-07-29 | `P20260729-qbd-rationale-step-03` | done | Completed rationale Step 3: deterministic Markdown is now a literal-safe, byte-exact derivative of validated rationale JSON and its sealed packet. |

## Blockers

- No blocker recorded in the latest progress events.

## History

- Structured events: `docs/progress/*.yaml`
- Pre-cutover prose: `docs/archive/PROGRESS-ARCHIVE.md`
- Search older context with qmd.
