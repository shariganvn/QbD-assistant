---
title: QbD rationale/report layer
workstream: qbd-rationale-report-layer
status: in-progress
canonical: true
created: 2026-07-28
scope: LLM-authored, evidence-bound decision explanation over a sealed reasoning packet
mode: tdd
---

# QbD Rationale/Report Layer — Sealed-Packet Decision Explanation

## Goal

Turn a completed, already published reasoning decision package into one human-readable explanation
whose every claim is machine-bound to a permitted fact card, evaluation field, or recorded exclusion.
The layer explains a decision. It never re-evaluates the store, selects a formulation, changes a
decision state, adds evidence, or writes into the reasoning publication root.

## Basis and authority

- Boundary decision: [`D20260728`](../../decisions/D20260728-qbd-rationale-report-layer-boundary.md).
- Retained policy: [`D20260727`](../../decisions/D20260727-qbd-p4-reasoning-policy.md) — no external
  egress, no model call inside `.mjs`, no new scoring/ranking/rubric/admission policy.
- Option record: [`brainstorm — LLM role separation`](../../reports/qbd-p4-reasoning-layer/brainstorm-20260724-llm-role-separation-rationale.md),
  Option 2 (separate contexts + immutable JSON handoff) is the model implemented here.
- Upstream contract, read-only: [`P4 plan`](../qbd-p4-reasoning-layer/plan.md), status `completed`,
  G-P4-01 through G-P4-05 `pass`.

### Product Owner decisions applied (2026-07-28)

| # | Decision | Consequence in this plan |
|---|---|---|
| 1 | Rationale text is **English**, consistent with every existing P4 artifact | No Vietnamese claim field; verbatim quotes keep their source language |
| 2 | **No machine FD-approval gate.** Output is labelled internal only | `display_state` is the schema constant `internal_only`; no code path can set another value; external display and its FD-approval mechanism are deferred to a separate approved workstream |
| 3 | The rationale author is a **new Cowork session whose only input is the packet file** | `RATIONALE-SKILL.md` is a separate skill file; the session that produced fact cards must not author rationale |

D20260728 §5 requires deterministic validation **and** FD approval before any external-facing
rationale. This layer satisfies that by never producing an external-facing rationale: the state is a
schema constant, and G-RL-04 proves no input, flag, or code path can change it. Enabling external
display requires a new decision and plan delta.

## In scope

- A sealed, hash-bound `rationale-packet.json` derived from a published decision package.
- A claim-to-fact rationale artifact contract and its binding validator.
- A deterministic Markdown derivative proved by regeneration equality.
- `inconclusive` explanation, including recorded missing/conflicting evidence and the FD action.
- Its own publication root, receipt, gate runner, fixtures, gate evidence, and Cowork skill.

## Out of scope

- P.2.2/P.2.3 drafting, a Layer C adapter, or any dossier prose.
- Any model API call, retrieval, external search, or egress from `cowork-p2-kit/rationale/*.mjs`.
- Editing P4 schemas, validators, decision engine, CLI, publication transaction, gate runner,
  gate evidence, or the P4 decision root.
- Re-scoring, re-ranking, cohort changes, rubric approval, or document-control authorization.

## Non-negotiable boundary rules

1. **Separate module.** All new code lives in `cowork-p2-kit/rationale/`. `reasoning/contracts.mjs`
   and `reasoning/errors.mjs` are byte-locked by G-P4-03 and must stay byte-identical; this layer
   declares its own `E_` code set in `rationale/errors.mjs`.
2. **Separate publication root.** `docs/reports/qbd-rationale-report-layer/rationale/`. The P4 package
   allowlist rejects any extra file, so writing a rationale artifact into the decision root would fail
   `E_PUBLICATION_SURPLUS_FILE` in G-P4-04/05. This separation is a hard technical constraint.
3. **Sealer verifies, author consumes.** The deterministic sealer reads the store to call the retained
   `validatePublishedDecisionPackage()`, then discards it. The packet carries validated quotes and
   metadata only — never `record.content`, never the store file, never an execution report.
4. **Fail closed.** A missing binding, packet hash or run-ID mismatch, evidence outside the packet, an
   invented numeric value or unit, or any attempt to alter decision state rejects the whole rationale.
   There is no partial publication and no warning-only path.
5. **Regeneration equality only.** `rationale.md` is rendered from published canonical JSON and
   compared byte-for-byte. A hand-authored file that happens to agree is still rejected.
6. **Best-effort controls are labelled.** The recommendation-token denylist and the numeric-token scan
   are declared best-effort drift signals. FD/human review remains the semantic authority.

## Planned touchpoints

| Path | Responsibility |
|---|---|
| `cowork-p2-kit/rationale/rationale-packet.schema.json`, `packet.mjs` | Sealed packet envelope, author-safe projection builder, validator, citation-local permitted-source index |
| `cowork-p2-kit/rationale/rationale.schema.json`, `rationale-contracts.mjs` | Claim-to-fact artifact envelope and exact-key validation |
| `cowork-p2-kit/rationale/claim-binding.mjs` | Claim → permitted source resolution, numeric/unit scan, decision-state guard |
| `cowork-p2-kit/rationale/rationale-markdown.mjs` | Pure deterministic renderer plus regeneration-equality assertion |
| `cowork-p2-kit/rationale/rationale-publication.mjs`, `rationale-receipt.{schema.json,mjs}` | Staged/renamed package write, full package re-validator, allowlist, receipt |
| `cowork-p2-kit/rationale/errors.mjs`, `cli.mjs` | Own `E_` taxonomy; `seal-packet` and `publish-rationale` commands |
| `cowork-p2-kit/RATIONALE-SKILL.md` | Bounded instructions for the separate rationale session |
| `cowork-p2-kit/rationale/tests/run-gate.mjs` | Gate-evidence wrapper copied from the P4 runner; gate pattern `^G-RL-0[1-5]$`, own evidence dir |
| `cowork-p2-kit/rationale/tests/fixtures/{decision-package,rationale-packet}/` | Committed selected / inconclusive / attested source packages with SHA pins, plus the named selected packet used by the skill-template test |
| `cowork-p2-kit/rationale/tests/**` | One test file per gate |
| `docs/reports/qbd-rationale-report-layer/rationale/` | Publication root, git-retained, `.gitkeep` only until Step 5 |
| `docs/reports/qbd-rationale-report-layer/gates/**` | `gates/` latest, `gates/step-close/` closure snapshot, `gates/red/` TDD red |
| `package.json` | Add `verify:rationale` in Step 5 only, after its runner has a passing contract test |
| `docs/system-architecture.md`, `cowork-p2-kit/README.md` | Add the rationale layer as a separate stage after the reasoning core |

## TDD rule

For every step, create the named failing test first, keep its machine-produced result under
`docs/reports/qbd-rationale-report-layer/gates/red/`, then implement the smallest deterministic
behaviour that turns it green. LLM prose is never proof of contract conformance.

## Ordered execution

| Step | Execution file | Status | Blocking gate |
|---|---|---:|---|
| 0 | [Freeze source decision-package fixtures](./step-00-freeze-source-package-fixtures.md) | completed | readiness checklist |
| 1 | [Seal the packet contract](./step-01-packet-contract-and-sealer.md) | completed | G-RL-01 |
| 2 | [Bind claims to permitted sources](./step-02-rationale-contract-claim-binding.md) | completed | G-RL-02 |
| 3 | [Derive the readable rationale](./step-03-deterministic-readable-derivative.md) | completed | G-RL-03 |
| 4 | [Publish, receipt, and bound the Cowork session](./step-04-publication-receipt-and-skill.md) | pending | G-RL-04 |
| 5 | [Run integrated gates and close review](./step-05-integrated-gates-review.md) | pending | G-RL-05 |

### Step 1 contract delta — 2026-07-29

Step 1 remains complete after reopening G-RL-01 to add a sealed causal-reference index for
inconclusive outcomes. Packet schema version 2 adds only `causal_evidence`; no P4 artifact, store
access pattern, publication root, or author-safe projection changes. Step 2 must cite the exact typed
refs from this index for its inconclusive explanation and must not treat unrelated exclusions or gates
as causes.

Only this table may transition a step `pending -> in-progress -> completed`. A step closes only when
its gate passes with machine-produced evidence snapshotted to `gates/step-close/`. Do not begin a step
before its predecessor closes.

## Dependencies and risks

- P4 is a completed upstream contract. Any required change to a P4 schema, validator, or the frozen
  decision/evaluation pair is a **blocker requiring a new plan delta**, not an in-step decision.
- The P4 decision root holds no committed package (`git ls-files` shows `.gitkeep` only), and the P4
  e2e test publishes to a temporary root. Step 0 therefore has to generate and commit its own source
  fixtures through the injectable `createReasoningCli({ publicationRoot })` factory. The rationale
  layer follows the same split: production `main()` fixes its declared root, while
  `createRationaleCli({ publicationRoot, fileSystem })` is a test-only injection seam.
- The P4 suite rewrites its own gate evidence. Upstream non-regression runs therefore occur in an
  isolated clean worktree; the active worktree's P4 boundary is compared against a pre-run hash set
  and is never used as the evidence destination.
- `pins.selection_rubric_approved_sha256` is still null, so a production-shaped decision is
  `inconclusive`. The inconclusive branch is the realistic primary path, not an edge case.
- Run GitNexus impact analysis before editing any existing symbol.

### Residual risks (accepted, closed by no gate)

| Risk | Why no gate closes it | Control |
|---|---|---|
| A claim is technically bound to real facts yet reads as misleading emphasis | Binding is structural; rhetorical slant leaves no machine-detectable trace | FD/human review of `rationale.md` |
| The rationale session is run by the same operator context that read raw records | Session separation is a workflow rule, not filesystem access control | `RATIONALE-SKILL.md` states it; operator/FD review |
| An internal-only rationale is copied out of the repo by a human | The layer controls its own artifacts, not human redistribution | `display_state` label plus FD process |
| Recommendation-token denylist evaded by paraphrase | Denylist is literal | FD review; declared best-effort |

## Deferred work

| Item | Owner | Reopen condition | Effect while deferred |
|---|---|---|---|
| External-facing display and its FD-approval mechanism | PO + FD | Separate approved decision defining approval artifact, hash binding, and revocation | `display_state` stays the constant `internal_only`; no approval command exists |
| Vietnamese or bilingual rationale | PO | Separate approved plan delta | English only; quotes keep source language |
| Rationale over a real FD-approved rubric decision | FD | FD signature plus human-committed rubric pin in the P4 `gates.yaml` | Fixtures cover the test-only selected branch and the production-shaped inconclusive branch |
| P.2.2/P.2.3 drafting bridge | later workstream | Separate approved plan | Out of scope; drafting denylist enforced |
