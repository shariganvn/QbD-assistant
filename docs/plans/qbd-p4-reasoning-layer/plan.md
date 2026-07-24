---
title: QbD P.2 Layer B reasoning core
workstream: qbd-p4-reasoning-layer
status: in-progress
canonical: true
created: 2026-07-24
scope: evidence-bound formulation comparison, public/mock MVP
mode: tdd
---

# QbD P.2 Layer B — Evidence-Bound Reasoning Core

## Goal

Deliver a Cowork-runnable Layer B comparison core that uses admitted public/mock trial records to
select one best-supported formulation within a valid cohort, or emits an explicit inconclusive/FD
adjudication result. The core produces traceable JSON and readable derivatives; it does not draft
P.2.2/P.2.3 or render DOCX.

## Basis and scope

- Approved rationale: [`brainstorm report`](../../reports/qbd-p4-reasoning-layer/brainstorm-20260724-evidence-bound-formulation-comparison.md).
- Validation record: [`Validation Session 1`](#review-provenance).
- Red-team source: [`findings and patch directives`](../../reports/qbd-p4-reasoning-layer/from-red-team-to-plan-patcher-260724-findings-and-patch-directives.md).
- Layer A's portable input contract: `cowork-p2-kit/store/records.schema.json`.
- Layer C is complete and remains a downstream seam only: `cowork-p2-kit/render/contract.mjs`.

### In scope

- Strict contracts and validator/CLI boundary for selection-rubric, cohort, fact-card,
  linear-attestation, decision, and evidence-log artifacts.
- Selection-rubric schema and proposal plus a hash-pinned approval lifecycle (the real FD-approved
  file is deferred — see [Deferred work](#deferred-work)), cohort and linear-formulation policy with
  an explicit attestation contract, evidence admissibility, unit/normalization policy, and
  hard-gate/scoring/conflict/sensitivity behavior.
- Rewriting `cowork-p2-kit/SKILL.md` into an explicit bounded Cowork procedure, replacing its current
  drafting mandate.
- Node built-in tests, committed fixtures (including a snapshot of the store), a parameterized
  per-gate evidence runner, an ordered `verify:reasoning` suite, and retained gate evidence.

### Out of scope

- P.2.2/P.2.3 prose/draft generation or a Layer C adapter.
- A model API, autonomous external search, or external evidence admission.
- Internal/confidential records, provider routing, egress-control implementation, and any expansion
  of Layer C's `public` citation envelope.
- Changing Layer A JSONL records or the completed Layer A/C behavior.

### MVP cut line

The red-team findings harden the approved comparison core; they do not authorize a general reasoning
platform. Implementation must reuse the existing Node/P3 patterns locally and stop at the named
fixtures and artifacts. In particular, do not build a shared gate framework, cryptographic-signature
service, generic rules DSL, per-run evidence archive, crash-injection system, Layer C adapter, or new
ingest capability. New work not required by G-P4-01 through G-P4-05 needs a separate plan delta.

## Assumptions and stop conditions

1. MVP runs only with public/mock admitted records. An unlabeled, non-public, or uncitable record
   cannot support a selection.
2. The agent may propose a rubric but must stop at `inconclusive` until an FD-approved immutable
   rubric version is supplied. **The real approved rubric is deferred** (owner: FD; reopen condition:
   FD signature plus a human-committed SHA-256 pin in `gates.yaml`). Until then, gates run against
   `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.json`, which is
   test-only and can never be published. At runtime an approved rubric is accepted only when its
   SHA-256 matches the human-committed pin; a missing or unmatched pin yields `inconclusive`, never a
   winner. Every `formula-decision.json` embeds the SHA-256 of the rubric it applied.
3. Mixed strength/formulation candidates are separate cohorts unless an FD-provided linear attestation
   satisfies `cowork-p2-kit/reasoning/linear-attestation.schema.json`, whose required-field list is
   the only definition of "complete". Attestation authenticity uses the same human-committed SHA-256
   pin as the rubric. Even with a complete attestation, strength-specific test results are not merged.
4. A missing critical measure, evidence conflict, unit ambiguity, or sensitivity-instability is a
   decision state, not a numeric penalty invented by the agent.
5. If the intended contract would require a new renderer capability or internal-data route, stop
   and obtain a separate approved plan.
6. The Cowork agent produces `fact-cards.json` from record `content`; `cowork-p2-kit/reasoning/*.mjs`
   never calls a model and only validates those cards. Quote-substring containment alone is
   insufficient, because it checks the quote and never binds the record to a candidate. A card is
   invalid unless:
   - (a) it names a `candidate` that resolves through the committed `provenance.file → candidate` map
     carried in the cohort artifact, and a numeric measure card cites only records whose provenance
     file maps to that same candidate;
   - (b) the card's literal value and unit token appear inside the `quote` string;
   - (c) the quote carries `char_start`/`char_end` and `content.slice(char_start, char_end) === quote`;
   - (d) the quote meets the contract's declared minimum length.

   Store `table.headers` and `table.rows` are unreliable for 12 of 17 current records and are not a
   fact source.
7. Typed failures follow the existing Layer A/C convention: uniform nonzero exit plus a stable `E_`
   string code on the error object and stderr. No per-category numeric exit statuses.
8. Published artifacts are re-validated, not trusted. Publication emits a validation receipt with
   the input-store and artifact SHA-256 values plus run ID. The verification suite exercises this
   against the Step 0 committed store snapshot, so it is hermetic on a fresh clone; runtime validation
   applies the same rule to the explicitly supplied store. Missing or mismatched hashes fail closed.
9. Gate evidence must be machine-produced. Bare `node --test` writes none, so Step 1 owns a
   parameterized runner; hand-authored evidence is a rule violation, not a fallback.

## Planned touchpoints

| Path | Responsibility |
|---|---|
| `cowork-p2-kit/SKILL.md` | **Rewrite.** Bounded agent workflow, authority limits, checkpoints, fact-card production, and output instructions. Its current P.2.2/P.2.3 drafting mandate and Layer C output contract are removed and deferred to a later workstream. The untrusted-extracted-text rule is carried forward, not dropped |
| `cowork-p2-kit/reasoning/*.schema.json` | Portable fact-card, cohort (including the `provenance.file → candidate` map), linear-attestation, decision, and evidence-log contracts for future `qbd_core` reuse |
| `cowork-p2-kit/reasoning/*.mjs` | Small deterministic validation/calculation boundary; no LLM call. Includes the deterministic Markdown generator — agents never hand-author derivatives |
| `cowork-p2-kit/reasoning/cli.mjs` | Validate/publish decision artifacts; refuses to publish outside the declared publication root; emits the publication validation receipt; every typed failure exits nonzero with a stable `E_` string code |
| `cowork-p2-kit/reasoning/tests/run-gate.mjs` | **New.** Parameterized per-gate evidence writer adapted from `render/tests/run-gate.mjs`: gate-ID pattern `^G-P4-0[1-5]$`, evidence dir `docs/reports/qbd-p4-reasoning-layer/gates/`, multiple test paths per invocation, explicit `--test-reporter=tap`. Carries its own contract test |
| `cowork-p2-kit/reasoning/tests/fixtures/store/` | **New.** Step 0 committed snapshot of the F-01/F-02/F-03 records plus Step 2 synthetic inadmissible records, one per exclusion reason. Gate fixtures never read the gitignored live store |
| `cowork-p2-kit/reasoning/tests/**` | Node built-in focused, integration, and regression fixtures/tests, one file per gate |
| `cowork-p2-kit/rubric/selection-rubric*.json` | **New, co-located with the existing dossier rubric.** Selection-rubric schema and proposal only. The FD-approved file is deferred; gates use a clearly named test-only fixture |
| `cowork-p2-kit/rubric/scoring-90-100.md` | Existing dossier-readiness rubric. Unchanged behavior; add a cross-reference distinguishing it from the selection rubric |
| `package.json` | `verify:reasoning` script only after its runner is tested; `engines.node` pinned to the v22 line |
| `cowork-p2-kit/README.md`, `docs/system-architecture.md` | **Required.** `docs/system-architecture.md` currently states Layer B drafts P.2.2/P.2.3 into a Layer C payload, which this workstream contradicts; both files must be corrected before G-P4-05 |
| `docs/reports/qbd-p4-reasoning-layer/decision/` | **Publication root, git-retained.** `fact-cards.json`, the cohort artifact, `formula-decision.json`, `formula-decision.md`, the evidence log, and the publication receipt. `cli.mjs` refuses to publish anywhere else |
| `docs/reports/qbd-p4-reasoning-layer/gates/**` | Retained evidence defined by `gates.yaml`: `gates/` = latest run, `gates/step-close/` = snapshot taken when a step completes, `gates/red/` = recorded TDD red results |

### Publication protocol

`docs/reports/qbd-p4-reasoning-layer/decision/` is the only permitted publication root. Within a run,
derivatives (`formula-decision.md`, evidence log, fact-cards, cohort artifact) are staged and renamed
first; `formula-decision.json` is renamed **last** and is the commit point. Each file lands by
temp-file plus rename, following the `render/publication.mjs` precedent. A process killed between
renames leaves a divergent artifact set; that divergence is detected by the published-artifact
re-validation in G-P4-05, not by a crash-injection fixture.

## Step 0 readiness

The former three pre-execution actions are one explicit, reviewable setup step:
[Freeze the reasoning fixture baseline](./step-00-freeze-store-baseline.md). It quarantines the
redundant store backup, commits the exact 17-record fixture snapshot with provenance, and records its
SHA-256 pin. This makes setup resumable and keeps Step 1 focused on contracts and the TDD harness.

## TDD rule

For Steps 1-5, create the named failing fixture/test first, record its red result under
`docs/reports/qbd-p4-reasoning-layer/gates/red/`, then implement the smallest deterministic behavior
that makes it green. Never treat an LLM's prose as proof of contract conformance. The focused tests
and `npm run verify:reasoning` are the executable oracle; FD review remains mandatory for rubric
approval and scientific adjudication.

## Ordered execution

| Step | Execution file | Status | Blocking gate |
|---|---|---:|---|
| 0 | [Freeze the reasoning fixture baseline](./step-00-freeze-store-baseline.md) | completed | readiness checklist |
| 1 | [Freeze contracts and TDD harness](./step-01-contracts-and-harness.md) | completed | G-P4-01 |
| 2 | [Enforce cohort and evidence boundaries](./step-02-cohort-evidence-boundaries.md) | pending | G-P4-02 |
| 3 | [Implement approved selection-rubric decision engine](./step-03-rubric-decision-engine.md) | pending | G-P4-03 |
| 4 | [Rewrite Cowork skill and publish artifacts](./step-04-cowork-skill-artifacts.md) | pending | G-P4-04 |
| 5 | [Run integrated gates and close review](./step-05-integrated-gates-review.md) | pending | G-P4-05 |

Only this table may transition a step `pending -> in-progress -> completed`. Step 0 completes against
its readiness checklist. Steps 1-5 require their gate to pass with retained evidence snapshotted to
`gates/step-close/`. Do not begin a later step until its predecessor checkpoint passes.

## Validation and review

`gates.yaml` is the executable acceptance contract; step files explain sequencing without duplicating
every assertion. Step 1 adapts the P3 evidence wrapper locally. Step 5 re-runs G-P4-01 through
G-P4-05 under one suite UUID, validates the evidence set, and re-validates the published fixture
artifacts and receipt against the Step 0 store snapshot. `gates/` holds latest evidence,
`gates/step-close/` holds one closure snapshot per gate, and `gates/red/` holds TDD red evidence; no
other archival system is in scope.

Closure also runs `git diff --name-only <base>` against the touchpoint table and records MCP
`gitnexus_detect_changes()` output as review context. GitNexus impact analysis remains mandatory
before editing an existing symbol. The literal drafting denylist is only a best-effort regression
check; FD/human review remains the semantic authority.

## Deferred work

| Item | Owner | Reopen condition | Effect while deferred |
|---|---|---|---|
| Real `cowork-p2-kit/rubric/selection-rubric-approved.json` | FD | FD signature plus a human-committed SHA-256 pin in `gates.yaml` | Gates run against the test-only fixture. Steps 3-5 close normally; a production run without a matching pin yields `inconclusive`, never a winner. This does **not** block any gate |
| Real FD linear-formulation attestation | FD | Same signature-plus-pin mechanism | Cross-strength merging stays unavailable; cohorts stay separate |
| P.2.2/P.2.3 drafting and the Layer C adapter | later workstream | Separate approved plan | Out of scope here |

## Dependencies and risks

- Layer A and Layer C are completed; their frozen contracts are dependencies, not edit targets.
- `cowork-p2-kit/store/records.jsonl` and source DOCX files are gitignored and mutable. Step 0 freezes
  the 17-record test baseline; all gates, including published-artifact re-validation, use that
  committed snapshot. Runtime accepts an explicitly supplied admitted store and binds its hash into
  the validation receipt. No gate requires a fresh ingest.
- GitNexus currently indexes no useful execution flows for the planned Layer B code because the
  workstream does not exist yet; targeted impact analysis becomes mandatory once symbols exist.
- The first scientific rubric remains FD-owned. Engineering can validate its shape, lifecycle, and
  hash pin, not decide its pharmaceutical validity.
- A same-model counter-case improves traceability but cannot replace independent FD adjudication.

### Residual risks (accepted, closed by no gate)

| Risk | Why no gate closes it | Control |
|---|---|---|
| Values withheld *within* a cited record — the agent quotes one number and silently omits a less favorable one from the same record | The validator only sees the cards it is handed; omission inside an admitted record leaves no machine-detectable trace | Independent FD adjudication. G-P4-03's uncited-record assertion covers whole records that were never cited, not values inside a cited one. Do not claim G-P4-03 closes this |
| Semantic drafting drift in the rewritten `SKILL.md` prose | The denylist is literal; paraphrase evades it | FD/human review of `SKILL.md` |
| A forged FD approval or attestation committed by someone with repo write access | The hash pin proves the file matches what a human committed, not that FD authored it | Signature and out-of-band confirmation at FD sign-off |

## Review provenance

Validation Session 1 checked 21 claims and settled five decisions: agent-produced/module-validated
fact cards; full `SKILL.md` rewrite; P3-style per-gate commands; selection rubric beside the dossier
rubric; and uniform nonzero exit plus stable `E_` code. The red team then produced 15 accepted
findings (4 Critical, 6 High, 5 Medium). The full evidence, line references, rejected alternatives,
and patch map stay in the linked red-team report rather than being duplicated here.

The implementation-bearing outcomes retained in this plan are provenance-bound cards, deferred and
hash-pinned FD authority, hermetic store fixtures, explicit attestation and normalization contracts,
published-artifact receipts, deterministic Markdown, and machine-produced gate evidence. F8/F9
remain reduced controls: ordered rename plus verification, and latest/red/step-close evidence only.
No unresolved plan contradiction was found in the post-patch consistency sweep.

## What changed from the archived Phase-4 narrative

The old narrative treated reasoning primarily as a five-step SKILL producing a matrix and draft.
This plan freezes a narrower, testable decision core first; separates rubric approval from model
reasoning; introduces cohort/linear-formulation policy; makes inconclusive a valid result; and
defers drafting, external research, and internal-data handling.
