---
title: "Workflow state consolidation — migration decision brief"
date: 2026-08-04
status: advisory
audience: "Implementation agent and human maintainer"
scope: "AgentKit plan/session state and Agent Baton workflow state"
---

# Workflow state consolidation — migration decision brief

## Purpose and boundary

This report records the observed overlap between AgentKit and Agent Baton so a
later agent can migrate deliberately. It does not authorize a migration,
change an active plan, or supersede the current handoff. The human maintainer
will update `CLAUDE.md` and `AGENTS.md` for the selected Frontier-model
workflow after the migration decision.

## Verified evidence

- Agent Baton is wired into SessionStart through `.claude/settings.json` and
  owns repository workflow validation, progress ledgers, test verdicts,
  handoff provenance, and reconciliation. Its executable owners are the
  installed `baton` CLI and `agent_baton` workflow-state modules.
- The current Baton cursor in `project-state.yaml` and the current
  `session-handoff.yaml` both route the next pickup to the placeholder-template
  probe's Phase 02. `baton state validate` passes and `baton reconcile` reports
  `benign_external_commit` with an accepting test verdict.
- AgentKit's `ak plan` command uses plan Markdown plus a local SQLite plan
  store; its short-lived agent session state is stored outside the repository
  as temporary JSON and a global Markdown summary. It is not a repository YAML
  handoff equivalent.
- `ak plan resolve --json --no-interactive` currently returns three `active`
  local candidates, including an obsolete preprocess probe, and warns that one
  stored plan directory no longer contains `plan.md`.
- `IMPLEMENTATION_PLAN.md` identifies the rationale-layer plan as the sole
  canonical execution plan, while Baton routes the placeholder-template probe.
  The probe plan itself flags this as an unapproved active-plan repoint.
- `ak journal` writes to `plans/journals/`, while the repository's documentation
  rules and recent Phase 01 journal use `docs/journals/`. This is a second,
  smaller ownership conflict to resolve during migration.

## Diagnosis

The systems are not duplicate implementations of the same file format. Their
intended responsibilities differ, but they currently each influence “what work
is active.” That creates three competing signals:

1. Canonical plan selection: `IMPLEMENTATION_PLAN.md`.
2. Durable session pickup and evidence: Agent Baton state and handoff.
3. Local plan selection/cache: AgentKit's SQLite store, worktree pin, and
   per-session cache.

The result is split-brain routing, stale AgentKit candidates, and unnecessary
prompt/context load. A later agent must not infer precedence from recency.

## Recommended target ownership

| Concern | Authoritative owner | Non-authoritative / derived owner |
|---|---|---|
| Plan requirements, phase status, and acceptance | One plan package under `docs/plans/`, selected by `IMPLEMENTATION_PLAN.md` | AgentKit plan-store index and worktree pin |
| Current session pickup | Agent Baton `project-state.yaml`, constrained to point into the selected plan | AgentKit session cache and statusline |
| Test evidence, closeout, and git provenance | Agent Baton verdict, handoff, and reconcile | None |
| Human-readable workflow views | Baton render commands | Never hand-edited |
| Historical work journal | One chosen repository location | AgentKit journal command only if configured to use that location |

Keep Baton as the durable operational control plane. It provides the two-commit
handoff, attested verdict, optimistic state write, and reconciliation already
used by this repository. Treat AgentKit plan/session persistence as local UX
and retrieval cache, never as evidence that a phase is complete or a handoff
instruction.

`project-state.yaml` should remain a compact cursor: broad lifecycle state and
the next file paths only. It must not duplicate plan checklists, detailed gate
results, or a second phase-status register.

## Migration sequence for the implementation agent

### 1. Stop and choose the single active plan

Require the human maintainer to choose one target before any state mutation:

- retain `docs/plans/qbd-rationale-report-layer/plan.md` as active and defer
  the placeholder probe; or
- promote `docs/plans/placeholder-template-ingest-workflow-probe/plan.md` and
  explicitly retire or defer the rationale-layer plan.

Do not silently decide based on the most recent handoff or AgentKit's `best`
candidate. Record the choice in the canonical plan pointer and state cursor in
the same migration change.

### 2. Establish Baton-to-plan routing

After the active plan decision, write Agent Baton state only through
`baton state write-state` with its startup baseline. Make all of these agree:

- `IMPLEMENTATION_PLAN.md` target;
- `project-state.yaml.active_workstream.plan`;
- every `project-state.yaml.current_pickup.files` path; and
- the next `session-handoff.yaml` pickup after a normal C1 → reconcile → C2
  closeout.

If the selected plan has no next executable step, mark it waiting for human
input rather than pointing Baton to another plan. Do not manually edit Baton
generated state or use reset/amend to fix a handoff.

### 3. Rebuild AgentKit as a cache

Snapshot `ak plan resolve --json` and `ak plan list --json` for audit before
changing the local store. Validate the selected repository plan, reindex the
AgentKit plan store, then pin only that exact plan for this worktree. Archive or
close obsolete local records only after confirming their repository path and
history; do not delete source plans to satisfy the store.

The migration agent must consult the installed `ak plan` help for the exact
archive/close semantics at execution time. Local-store behavior is tool-version
dependent and this report does not prescribe a destructive command.

### 4. Resolve journal ownership

Choose one of the following before enabling journal automation again:

- configure/patch AgentKit journal output to the repository's chosen journal
  location; or
- keep `plans/journals/` as the documented repository journal location and
  update the repository rule accordingly; or
- stop invoking `ak journal` and use the repository's selected documentation
  workflow.

Do not maintain journal copies in both locations.

### 5. Update Frontier-model instructions after state is clean

The human-maintained `CLAUDE.md` and `AGENTS.md` should state only these durable
rules:

- one canonical active plan; disagreement with Baton state is a stop-and-repair
  condition, not a guessing prompt;
- AgentKit plan/session state is local cache and cannot close phases or override
  the canonical plan;
- Baton owns session startup validation, verdicts, state writes, generated
  workflow views, and C1/C2 handoff; and
- the chosen journal location is the sole repository destination.

Avoid embedding mutable plan names, session IDs, or command transcripts in the
agent guides. Link to their executable owners instead.

## Migration acceptance checks

The migration is acceptable only when all are true:

- `IMPLEMENTATION_PLAN.md` and Baton active-workstream route name the same plan.
- `ak plan resolve --json` has one active candidate for this worktree and emits
  no unreadable-plan warning.
- The selected plan passes `ak plan validate`.
- `baton state validate` and `baton reconcile` pass without a stale or
  in-progress pickup conflict.
- A deliberate session closeout still produces a valid C1 → handoff → reconcile
  → C2 sequence.
- Exactly one journal path is endorsed by repository instructions and used by
  the journal command/workflow.

Run these checks manually first. Do not add a permanent synchronization bot or
CI gate unless drift recurs and the human maintainer explicitly accepts that
new operating surface.

## Rejected approach

Do not remove Baton as the first migration step. That would discard existing
attestation, integrity, and reconciliation controls before AgentKit supplies
equivalent, tested replacements. Decommissioning Baton is a separate design
decision after those controls are either retained or intentionally retired.

## Risks and rollback

- The AgentKit plan store is local; a bad reindex/pin should be repaired by
  restoring its local index or reindexing, not by changing valid repository
  plans.
- Baton state must be updated through its optimistic-concurrency writer. A
  stale-read conflict stops migration for manual reconciliation.
- Preserve existing verdicts and handoffs as historical evidence. Never rewrite
  history with `git reset` or `git commit --amend` to make pointers look clean.
- If the active-plan choice is not available, stop after documenting the
  conflict; do not partially migrate either tool.

## Unresolved decisions

1. Which plan becomes the single canonical active plan after migration?
2. Is the C1/C2 Baton closeout protocol retained as a non-negotiable control?
3. Which repository path owns journals, and may AgentKit be configured to write
   there?
4. Should a future automated drift check be added after a manual migration has
   proven stable?
