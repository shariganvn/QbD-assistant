<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/progress/*.yaml and docs/decisions/D*.md -->
<!-- Regenerate: baton render-workflow -->
<!-- Source fingerprint: sha256:d8334e13e84cfd1b82a8fff6bfb3bd208c52034ced8268dda1be03ee7faa3ad5 -->

# PROGRESS

> Generated compatibility view. Canonical state lives in `project-state.yaml` and `docs/progress/*.yaml`.

## Current workstream

- ID: `qbd-p4-reasoning-layer`
- Status: `in-progress`
- Plan: `docs/plans/qbd-p4-reasoning-layer/plan.md`
- Current pickup: Step 4 is closed with G-P4-04 at 7/7 and final boundary hardening. Begin Step 5 integrated revalidation; the test-only rubric fixture remains non-production authority.
- Pickup files: `docs/plans/qbd-p4-reasoning-layer/step-05-integrated-gates-review.md`, `docs/plans/qbd-p4-reasoning-layer/gates.yaml`, `docs/decisions/D20260727-qbd-p4-reasoning-policy.md`

## Latest progress

| Date | ID | Status | Summary |
|---|---|---|---|
| 2026-07-28 | `P20260728-qbd-p4-reasoning-step-04-publisher-surface` | done | Finalized Step 4 publication surface: raw store bytes are parsed internally for every shared validation, and the concrete package writer is private to the publication module while cli.mjs retains only CLI compatibility exports. |
| 2026-07-28 | `P20260728-qbd-p4-reasoning-step-04` | done | Closed Step 4 bounded publication and Cowork instructions: G-P4-04 passed 7/7, with complete-package binding, canonical JSON and deterministic Markdown, publication receipt validation, and a human-only execution-report seam. |

## Blockers

- No blocker recorded in the latest progress events.

## History

- Structured events: `docs/progress/*.yaml`
- Pre-cutover prose: `docs/archive/PROGRESS-ARCHIVE.md`
- Search older context with qmd.
