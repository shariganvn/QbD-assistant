# Plan Routing

There is currently no active implementation plan. The root
`IMPLEMENTATION_PLAN.md` is the single authoritative router and must link a
plan before implementation resumes.

- Latest completed plan: [P.2.2.1 formulation-selection](qbd-p221-formulation-selection/)
- Queued, not active: [hardened end-to-end trial](../../plans/260805-1335-template-to-docx-end-to-end-trial/)
- Historical material: `docs/plans/OUTDATED/`
- Review/research evidence: `docs/reports/` (evidence only, not routing
  authority)

Rules for agents:

- Never infer current status from reports, implementation notes, handoff prose, or archived plans.
- Never recursively read `OUTDATED/` during startup, planning, implementation, or review.
- A step is complete only when the canonical plan records it complete and every blocking gate in
  `gates.yaml` has retained PASS evidence.
- Workflow ledgers may reference the router but must not duplicate plan
  execution content.
