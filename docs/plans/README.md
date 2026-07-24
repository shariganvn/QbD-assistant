# Plan Routing

There is exactly one active implementation plan in this repository. The root
`IMPLEMENTATION_PLAN.md` points to it.

- Active execution material: `docs/plans/qbd-p4-reasoning-layer/`
- Historical material: `docs/plans/OUTDATED/`
- Review/research evidence: `docs/reports/`

Rules for agents:

- Never infer current status from reports, implementation notes, handoff prose, or archived plans.
- Never recursively read `OUTDATED/` during startup, planning, implementation, or review.
- A step is complete only when the canonical plan records it complete and every blocking gate in
  `gates.yaml` has retained PASS evidence.
- Workflow ledgers may route to the active plan but must not duplicate its execution content.
