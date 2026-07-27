---
title: FD-owned MVP admission and cross-strength linear ranking
id: D20260726-P4-FD-MVP-ADMISSION
status: active
date: "2026-07-26"
scope: qbd-p4-reasoning-layer
supersedes:
  - "The public/mock-only admission restriction in qbd-p4 plan and G-P4-02"
  - "The no-merged-strength-ranking rule after a complete linear attestation"
affects:
  - docs/plans/qbd-p4-reasoning-layer/plan.md
  - docs/plans/qbd-p4-reasoning-layer/gates.yaml
  - docs/plans/qbd-p4-reasoning-layer/step-02-cohort-evidence-boundaries.md
  - cowork-p2-kit/reasoning/cohort-evidence.mjs
  - cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs
read_when: Admitting an MVP evidence package, defining a linear-formulation cohort, or revising G-P4-02.
---

# D20260726-P4-FD-MVP-ADMISSION — FD-owned MVP Admission and Linear Ranking

## Decision

For the MVP and post-production pilot, **Mr. Tiển** is the single FD authority for FD review,
evidence authorization, and the initial approval matrix. Delegation is not assumed until he records
it explicitly.

Mr. Tiển may supply a selected internal Bisoprolol evidence package to P4. The MVP admits and uses
the package he supplies without enforcing per-document version, approval, rights, DMS, email, or
meeting-minutes controls. A document-control field is retained only as a future control seam; it
does not gate MVP admission. This decision does not authorize external egress or alter the existing
rule that output remains a technical prototype, not a formulation approval.

Existing record-to-candidate identity, formulation/strength binding, evidence quotes, and conflict
handling remain required. Deferring document control must not be read as permission to misattribute
evidence, invent a value, or use a package not supplied by Mr. Tiển.

Once a complete FD linear-formulation attestation is present, candidates across the attested strengths
may enter one combined cohort, have their scores merged, and receive a common ranking. The reasoning
artifact must name the attestation and plainly state that the combined ranking depends on it. Without
that attestation, strengths remain separate and no cross-strength score or ranking is produced.

Engineering owns the initial selection-rubric proposal and its stated rationale. The proposal remains
non-authoritative: the runtime result is `inconclusive` until Mr. Tiển reviews and approves a detailed
rubric under the existing approval lifecycle.

Superseded source versions are `deprecated`: retained for reference/audit, not used for a new MVP
run, and not a source of MVP feature work.

## Consequences

- G-P4-02's retained public/mock evidence is historical fixture validation only. It does not validate
  the newly authorized internal-package admission or cross-strength merged ranking.
- Before a result claims the new behavior, Engineering must revise the cohort/evidence implementation,
  contracts as needed, fixtures, G-P4-02 assertions, and gate evidence. Until then, the current code
  continues to enforce the former behavior.
- MVP does not implement a document-control workflow. A later workstream may activate the retained
  control seam with version, approval, rights, and source-governance rules.
- DMS, email, and meeting minutes are equal evidence of a future approval; none has precedence in
  MVP.

## Rationale

FD chose a deliberately low-friction pilot: selected input packages establish MVP admission, while
document governance is postponed. The comparison boundary still needs deterministic candidate and
quote bindings so an authorized package cannot silently be attributed to the wrong formulation.
FD also explicitly permits a cross-strength ranking only after a linear-formulation attestation, so
the former platform-observation-only policy no longer reflects the pilot's intended decision.

## Non-goals

- This does not approve a formulation, release P4 to production, or replace Mr. Tiển's professional
  decision.
- This does not make an unreviewed engineering rubric FD-approved.
- This does not define the later document-control schema or authorize external AI/data egress.
