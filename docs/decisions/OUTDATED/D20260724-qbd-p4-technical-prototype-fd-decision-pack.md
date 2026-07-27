---
title: Technical prototype first; FD Decision Pack before contract review
id: D20260724-P4-PILOT
status: active
date: "2026-07-24"
scope: qbd-p4-reasoning-layer
affects:
  - docs/plans/qbd-p4-reasoning-layer/plan.md
  - docs/plans/qbd-p4-reasoning-layer/gates.yaml
  - docs/reports/qbd-p4-reasoning-layer/fd-decision-pack-bisoprolol-pilot.md
read_when: Reviewing G-P4-01, deciding whether to change reasoning contracts, or preparing the Bisoprolol FD pilot.
---

# D20260724-P4-PILOT — Technical Prototype Before FD Contract Changes

## Decision

Treat the current reasoning-layer work as a **technical prototype**, not a production or FD-approved
decision service. The pilot is for Bisoprolol; its current documented product framing is 5 mg/10 mg
film-coated tablets, subject to the FD Decision Pack confirming a narrower operational scope.

FD supplies a first Decision Pack before Monday, 2026-07-27. It contains day-to-day decision examples,
permitted source documents, sample evidence, comparison/exclusion rules, handling of missing or
conflicting evidence, and the normal FD confirmation path. FD is not asked to design technical JSON,
versioning, SHA pins, or a sidecar artifact.

After the pack is reviewed against G-P4-01, PO, FD, and Engineering decide whether the existing
contract is fit, needs a controlled revision, or needs further real examples. No contract change is
authorized merely because the current fixtures are incomplete.

## Rationale

There is no reliable real FD output sample yet. Changing a frozen technical contract without one
would make test fixtures agree with implementation, but would not prove the result supports FD work.
The Decision Pack turns normal FD practice into a small, reviewable pilot sample before technical
shape decisions are made.

## Consequences

- G-P4-01 remains frozen pending the review; this decision does not reopen it.
- Any current G-P4 technical gate result may only be described as prototype/fixture validation, not
  as evidence that the output is FD-ready or publishable for production use.
- The detailed pack and PO checklist are in
  `docs/reports/qbd-p4-reasoning-layer/fd-decision-pack-bisoprolol-pilot.md`.
- The post-pack review must explicitly record **keep**, **revise**, or **need more examples**, with
  the supporting FD examples. Engineering then owns any proposed contract/versioning/artifact design.

## Non-goals

This decision neither approves a formulation, makes G-P4-02 a production release, nor decides whether
future audit information is embedded in one artifact or stored in a companion artifact.
