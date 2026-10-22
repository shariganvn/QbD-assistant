---
title: "qbd_core: three inputs to a P.2 orientation draft"
description: "Build the qbd_core pipeline that turns active substance, dosage form and market into a gap-flagged P.2 orientation draft, with code-enforced egress, provenance and quality gates."
status: active
priority: P1
effort: "26-38d"
branch: claude/codebase-architecture-summary-po0utr
workstream: qbd-core-p2-autodraft
created: 2026-10-21
blockedBy: []
blocks: []
---

# qbd_core P.2 autodraft

Scope and boundaries: `docs/decisions/D20261021-qbd-core-p2-autodraft-scope.md`.
Gate bodies: `gates.yaml` (this file does not restate them). Design source: Notion "Soạn thảo phát triển dược học" and the Whimsical board.
Architecture: `docs/architecture/ADR-qbd-core-module-boundaries.md`.

## Source-of-truth rules

- Status lives in the checkboxes below and in `gates.yaml`; a step is done only when its gates hold retained evidence in `docs/reports/qbd-core-p2-autodraft/`.
- No evidence means `unverified`.
- Notion mirrors this plan; it never overrides it. Mapping: `notion-sync.md`.

## Steps

| Step | File | Status |
|---|---|---|
| 00 Governance | step-00-governance.md | [x] |
| 01 Skeleton and contracts | step-01-skeleton-contracts.md | [x] local; CI run pending |
| 02 Intake and config | step-02-intake-config.md | [ ] G-01, G-02 pass; CTD/ACTD cross-check open |
| 03 Evidence and egress | step-03-evidence-egress.md | [ ] |
| 04 Dossier drafting | step-04-dossier-drafting.md | [ ] |
| 05 Quality and render | step-05-quality-render.md | [ ] |
| 06 Acceptance | step-06-acceptance.md | [ ] (accept command done; sign-off pending) |
| 07 Experimental data intake | step-07-experimental-data-intake.md | slices 1-5 done (G-13 to G-15, G-17 to G-25); consumers open |

Dependencies: 01 after 00; 02 and 03 after 01; 04 after 02 and 03; 05 after 04; 06 after 05.
Parallel, non-blocking: confirmation of the A5 refinement by the head of R&D (blocks only freezing the
dependency graph in 04); classification of unclassified and group C Kho files (blocks the manifest in 03).

## Exit acceptance

G-10 passes on the full acceptance case set, with human sign-off recorded for one case.
