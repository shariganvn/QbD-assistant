# Project Documentation Management

Use this file when creating plans or changing project documentation.

## When To Update Docs

Update docs only when the change affects user-visible behavior, setup, commands, architecture, security posture, public contracts, or future maintainer decisions. Do not add changelog noise for purely internal edits unless the repo already requires it.

Common docs:

- `docs/code-standards.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md` or `docs/development-roadmap.md`
- `docs/project-changelog.md` when present

## Plan Location

`IMPLEMENTATION_PLAN.md` is a pointer to the single active plan. Save the canonical plan package
under `docs/plans/<descriptive-workstream>/`.

Use:

```text
IMPLEMENTATION_PLAN.md             # pointer only
docs/plans/<workstream>/
  plan.md
  gates.yaml
  step-01-<name>.md
docs/reports/<workstream>/
  <review-or-evidence>.md
```

Keep `plan.md` short: source-of-truth rules, scope, ordered step status, dependencies, exit
acceptance, and links to step/gate files. `gates.yaml` owns executable acceptance definitions.

Step files should include only the detail needed to execute safely:

- context links
- requirements
- files to modify/create/delete
- implementation steps
- tests or validation
- risks and rollback notes

Historical material belongs under `docs/plans/OUTDATED/` or `docs/reports/OUTDATED/`. Agents must
not recursively read those directories unless the user explicitly requests historical analysis.
Archived material never declares current status or satisfies an acceptance gate.

Before updating docs, read the existing document. After updating, verify dates, links, and claims match the actual change.
