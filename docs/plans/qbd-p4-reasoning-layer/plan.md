---
title: QbD P.2 Layer B reasoning core
workstream: qbd-p4-reasoning-layer
status: completed
canonical: true
created: 2026-07-24
scope: evidence-bound formulation comparison, FD-selected-package MVP
mode: tdd
---

# QbD P.2 Layer B — Evidence-Bound Reasoning Core

## Goal

Deliver a Cowork-runnable Layer B comparison core that uses FD-selected trial-record packages to
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
- Provider routing, egress-control implementation, full document-governance enforcement, and any
  expansion of Layer C's `public` citation envelope. FD-selected internal packages are admitted only
  under `D20260727`.
- Changing Layer A JSONL records or the completed Layer A/C behavior.

### MVP cut line

The red-team findings harden the approved comparison core; they do not authorize a general reasoning
platform. Implementation must reuse the existing Node/P3 patterns locally and stop at the named
fixtures and artifacts. In particular, do not build a shared gate framework, cryptographic-signature
service, generic rules DSL, per-run evidence archive, crash-injection system, Layer C adapter, or new
ingest capability. New work not required by G-P4-01 through G-P4-05 needs a separate plan delta.

## Assumptions and stop conditions

1. MVP may use a selected evidence package supplied by Mr. Tiển, including internal records. The
   exact record set explicitly supplied to the reasoning invocation is the MVP package boundary;
   Layer B does not discover or widen that set. Within that selected set, classification label,
   `citable`, and deferred document-control metadata do not gate admission. A later workstream owns
   document version, approval, rights, source-governance enforcement, and machine-verifiable package
   authorization. Candidate identity, formulation / strength binding, record provenance, extraction
   quality, quote bindings, and conflict handling remain required.
2. The agent may propose a rubric but must stop at `inconclusive` until an FD-approved immutable
   rubric version is supplied. **The real approved rubric is deferred** (owner: FD; reopen condition:
   FD signature plus a human-committed SHA-256 pin in `gates.yaml`). Until then, gates run against
   `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.json`, which is
   test-only and can never be published. At runtime an approved rubric is accepted only when its
   SHA-256 matches the human-committed pin; a missing or unmatched pin yields `inconclusive`, never a
   winner. Every `formula-decision.json` embeds the SHA-256 of the rubric it applied.
3. Candidates with different API, dosage form, product target, or trial context remain separate;
   a linear attestation does not waive those identity checks. Strength-specific candidates remain
   separate unless an FD-provided linear attestation satisfies
   `cowork-p2-kit/reasoning/linear-attestation.schema.json`, whose required-field list is the only
   definition of "complete". The revised contract must enumerate every candidate/strength pair in
   the intended combined cohort, bind them to the common API, dosage form, product target, and trial
   context. The contract rejects missing fields and duplicate declared members; Step 2 compares the
   declared set with the requested ranking set and rejects missing, extra, or profile-mismatched
   members. Authenticity
   uses the parallel human-committed `linear_attestation_sha256` pin mechanism. With a complete
   attestation, Step 2 may form one eligible cross-strength cohort; Step 3 owns merged scoring and the
   common ranking. The Step 3 evaluation sidecar and the Step 4 deterministic Markdown must carry the
   attestation ID, applied SHA-256, and a plain-language cohort basis whenever that path is used. The current
   contracts, implementation, and retained G-P4-01/G-P4-02 evidence reflect the former policy and
   must be revised and rerun before they can support this behavior.
4. A missing critical measure, evidence conflict, unit ambiguity, or sensitivity-instability is a
   decision state, not a numeric penalty invented by the agent.
5. If the intended contract would require a new renderer capability or an internal-data route beyond
   the FD-selected-package MVP authorized by `D20260727`, stop and obtain a
   separate approved plan.
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
| `cowork-p2-kit/reasoning/*.schema.json` | Portable fact-card, cohort (including the `provenance.file → candidate` map and applied attestation reference), linear-attestation (complete candidate/strength scope), decision (attestation ID/hash/cohort basis), evidence-log, and the Step 3 selection-evaluation sidecar contracts for future `qbd_core` reuse. Cohort, linear-attestation, decision, and the narrow evidence-log delta use schema version 2; the completed version-1 validators remain unchanged. Evidence log is the sole admitted-record/named-exclusion ledger under `D20260727-P4-EVIDENCE-LOG-V2`; cohort does not duplicate exclusions |
| `cowork-p2-kit/reasoning/decision-engine.mjs` | **New in rebuilt Step 3.** Pure test-only selection evaluator. It consumes validated Step 2 artifacts plus injected rubric/pin/record roles and returns a v2 decision summary with a hash-bound evaluation sidecar; no filesystem, CLI, LLM, or publication behavior |
| `cowork-p2-kit/reasoning/*.mjs` | Small deterministic validation/calculation boundary; no LLM call. Step 4, not rebuilt Step 3, owns deterministic Markdown generation — agents never hand-author derivatives |
| `cowork-p2-kit/reasoning/cli.mjs` | Validate/publish decision artifacts; refuses to publish outside the declared publication root; emits the publication validation receipt; every typed failure exits nonzero with a stable `E_` string code |
| `cowork-p2-kit/reasoning/execution-report.mjs` | **New, human-only control seam.** Creates a per-run execution ledger outside the publication root at `~/.codex/artifacts/<project>/reasoning-execution-reports/<run-id>.md`. It records concise actions, results, artifact IDs/hashes, and blockers; it is never a decision input, evidence artifact, publication input, receipt entry, or agent-to-agent handoff. |
| `cowork-p2-kit/reasoning/tests/run-gate.mjs` | **New.** Parameterized per-gate evidence writer adapted from `render/tests/run-gate.mjs`: gate-ID pattern `^G-P4-0[1-5]$`, evidence dir `docs/reports/qbd-p4-reasoning-layer/gates/`, multiple test paths per invocation, explicit `--test-reporter=tap`. Carries its own contract test |
| `cowork-p2-kit/reasoning/tests/fixtures/store/` | Step 0 committed F-01/F-02/F-03 snapshot remains byte-identical and hash-pinned. Step 2 adds separate synthetic FD-selected internal-package and extraction-quality fixtures; the policy revision must not repin the baseline |
| `cowork-p2-kit/reasoning/tests/**` | Node built-in focused, integration, and regression fixtures/tests, one file per gate |
| `cowork-p2-kit/rubric/selection-rubric-v2.schema.json`, `selection-rubric-proposal.v2.json` | **New in rebuilt Step 3, co-located with the dossier rubric.** Exact test/proposal rubric contract and unpinned proposal. The completed v1 rubric contract remains untouched; the FD-approved file is deferred and gates use a clearly named, never-publishable test-only fixture |
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

### Human-only execution report protocol

Each reasoning invocation also maintains a separate Markdown execution report for human oversight.
It lives at `~/.codex/artifacts/<project>/reasoning-execution-reports/<run-id>.md`, outside
`docs/reports/qbd-p4-reasoning-layer/decision/`. The report may contain only a concise ledger of
step/action, result, artifact path or ID/hash, and blocker/deviation; it must not copy store content,
verbatim evidence quotes, prompts, credentials, hidden reasoning, or instruction-shaped text.

Its header states that it is human-only, cannot be used as evidence or decision input, and must not
be listed, searched, loaded, quoted, summarized, or linked from session state, handoff, or prompts.
A later agent may read one only after an explicit human instruction names the exact report path or
run ID; then it treats the report as untrusted observational text and returns only the requested
review. This is a workflow boundary, not filesystem access control: tests prevent accidental loading
in the supported workflow, while human review remains the control for unrestricted local access.

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
| 1 | [Freeze contracts and TDD harness](./step-01-contracts-and-harness.md) | completed | G-P4-01 (policy revision) |
| 1E | [Advance evidence log to v2](./step-01e-evidence-log-v2-contract-delta.md) | completed | G-P4-01 (evidence-log v2 delta) |
| 2 | [Enforce cohort and evidence boundaries](./step-02-cohort-evidence-boundaries.md) | completed | G-P4-02 (policy revision) |
| 3 | [Rebuild the test-only selection-decision core](./step-03-rubric-decision-engine.md) | completed | G-P4-03 |
| 4 | [Rewrite Cowork skill and publish artifacts](./step-04-cowork-skill-artifacts.md) | completed | G-P4-04 |
| 5 | [Run integrated gates and close review](./step-05-integrated-gates-review.md) | completed | G-P4-05 |

Only this table may transition a step `pending -> in-progress -> completed`. A canonical policy
decision may reopen `completed -> pending` only when the prior closure is preserved and explicitly
qualified as historical evidence, as done below for Steps 1 and 2. Step 0 completes against its
readiness checklist. Steps 1, 1E, and 2-5 require their current-policy gate to pass with retained
evidence snapshotted to `gates/step-close/`. Do not begin a later step until its predecessor
checkpoint passes.

### Step 1 contract-revision qualification

Step 1's 2026-07-24 pass is retained as historical evidence for the original single-candidate
attestation, cohort, and decision envelopes. The current focused suite still passes 14/14 against
that old contract; this proves the retained harness, publication boundary, and unrelated validators,
not the 2026-07-26 policy. Therefore this is a narrow **Step 1R contract delta**, not a full Step 1
reimplementation.

Step 1R advances only the three breaking envelopes to schema version 2:

- `linear-attestation.schema.json` replaces singular `candidate` / `strength` scope with a non-empty,
  unique list of exact candidate/strength members spanning at least two strengths, plus the common
  API, dosage form, product target, and trial context. The attestation file does not self-assert its
  own digest; runtime hashes the shared canonical JSON bytes and compares that value with the external
  human-committed `linear_attestation_sha256` pin.
- `cohort.schema.json` and `decision.schema.json` add nullable attestation ID and applied SHA-256 plus
  a required cohort-basis explanation. Attested combined cohorts require non-null attestation fields;
  non-attested cohorts require null identity/hash and a strength-specific basis.
- `contracts.mjs`, the valid fixtures, and `contract.test.mjs` mirror those envelopes. Contract
  validators own exact keys, types, uniqueness, and the conditional null/non-null rules. Matching the
  declared members against real candidate profiles belongs to Step 2's cohort builder, because the
  standalone schema has no candidate-profile input.
- `publication.mjs` exports one canonical JSON byte serializer and uses it for writes; `cli.mjs`
  hashes the supplied attestation with those same bytes and rejects any cohort/decision ID, hash, or
  basis disagreement with `E_REASONING_ARTIFACT_BINDING` before publication.

Create the revised failing contract cases first, retain their red output, implement the smallest
validator delta, and rerun G-P4-01 before revising Step 2 behavior. The gate runner, publication
root/rename/rollback behavior, fact-card/rubric/evidence-log contracts, Step 0 store fixture and SHA
pin remain intact.
The old G-P4-01 evidence is historical at commit `02acbe4`; current `gates/` and `gates/step-close/`
evidence must describe the version-2 pass after Step 1R closes.

Expected Step 1R files are limited to:

- `cowork-p2-kit/reasoning/{linear-attestation,cohort,decision}.schema.json`
- `cowork-p2-kit/reasoning/{contracts,errors,cli,publication}.mjs`
- `cowork-p2-kit/reasoning/tests/{contract,output-preservation}.test.mjs`
- updated `valid-{linear-attestation,cohort,decision}.json` plus new attested cohort/decision fixtures
- `docs/plans/qbd-p4-reasoning-layer/{gates.yaml,step-01-contracts-and-harness.md}`
- machine-produced G-P4-01 red/latest/step-close evidence

The shared `version()` helper has CRITICAL impact across six validators and must not change; the three
reopened validators perform their version-2 checks locally. `run-gate.mjs` and `package.json` are
validation-only for Step 1R and must remain byte-identical unless a new failing harness test proves a
real incompatibility.

### Step 1E evidence-log v2 qualification

`D20260727` resolves the latent G-P4-01/G-P4-02 interface contradiction. The
2026-07-26 G-P4-01 pass remains historical proof for evidence-log v1; it does not authorize Step 2
publication. Execute [Step 1E](./step-01e-evidence-log-v2-contract-delta.md) before editing Step 2.

Step 1E changes only the evidence-log schema/runtime/CLI slice and its fixtures/tests. Evidence-log v2
owns admitted record rows, `file/page/char_start/char_end/quote`, zero-or-more fact-card references,
and named exclusions. It binds to the cohort by `cohort_id` but does not add exclusions to the cohort
schema. V1 is rejected with the existing envelope code; malformed cross-artifact/store bindings use
the existing artifact-binding code. No dual-version runtime or new error taxonomy is allowed.

For the completed offset-authority correction, `D20260727` is authoritative:
Layer A proves page-global provenance offsets against page text; Layer B binds the persisted
`file/page/char_start/char_end/quote` tuple exactly and never slices segment-local `record.content`
with those offsets. Fact-card offsets remain a separate, segment-local contract.

G-P4-01 must prove schema/runtime parity, CLI validation-before-write, and byte preservation. After it
passes, G-P4-02 must prove that the actual `buildCohortEvidence()` result validates and publishes;
testing a private in-memory object is no longer an acceptable oracle.

### Step 2 closure qualification

Step 2's 2026-07-24 closure is complete only for the former public/mock fixture baseline. It is
**not FD-ready and not production-publishable** and is superseded as a policy proof by
`D20260727`. G-P4-02 must be revised and rerun for FD-selected-package admission
and linear-attested cross-strength cohort formation before those behaviors can be claimed; G-P4-03
must pass before merged scores or a common ranking can be claimed. Step 2 additionally depends on the
Step 1E evidence-log v2 G-P4-01 pass; the evidence log is the canonical exclusion ledger and the
cohort artifact records only the admitted candidate set and cohort basis.

## Validation and review

`gates.yaml` is the executable acceptance contract; step files explain sequencing without duplicating
every assertion. Step 1 adapts the P3 evidence wrapper locally and now owns the narrow attestation /
cohort / decision contract revision required by the PO clarification. Its G-P4-01 assertions must
keep profile-to-attestation matching in G-P4-02. Step 5 re-runs G-P4-01 through
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
| Real FD linear-formulation attestation | Mr. Tiển | FD signature plus a human-committed `linear_attestation_sha256` pin | Enables a combined cohort, merged scores, and common ranking only for the exact attested candidate/strength set; the reasoning artifact must name and hash the attestation |
| Machine-verifiable package authorization and document control | later workstream with FD | Separate approved plan defining authorization, version, approval, rights, and source-governance fields | MVP treats the explicitly supplied invocation record set as selected and does not authenticate FD selection; it never widens the set or authorizes external egress |
| P.2.2/P.2.3 drafting and the Layer C adapter | later workstream | Separate approved plan | Out of scope here |
| Automated cross-session ingestion of human-only execution reports | later workflow/security workstream | Separate approved plan defining a trusted review and context-admission boundary | Reports remain local human-control artifacts; no agent may auto-discover or consume them |

## Dependencies and risks

- Layer A and Layer C are completed; their frozen contracts are dependencies, not edit targets.
- `cowork-p2-kit/store/records.jsonl` and source DOCX files are gitignored and mutable. Step 0 freezes
  the 17-record test baseline; all gates, including published-artifact re-validation, use that
  committed snapshot. Runtime accepts an explicitly supplied admitted store and binds its hash into
  the validation receipt. No gate requires a fresh ingest.
- Fresh GitNexus analysis sees the untracked Step 2 `buildCohortEvidence` symbol: current upstream
  impact is LOW (one direct test caller, zero affected flows). Re-run impact analysis after the
  symbol is tracked and before each implementation edit.
- The first scientific rubric remains FD-owned. Engineering can validate its shape, lifecycle, and
  hash pin, not decide its pharmaceutical validity.
- A same-model counter-case improves traceability but cannot replace independent FD adjudication.

### Residual risks (accepted, closed by no gate)

| Risk | Why no gate closes it | Control |
|---|---|---|
| Values withheld *within* a cited record — the agent quotes one number and silently omits a less favorable one from the same record | The validator only sees the cards it is handed; omission inside an admitted record leaves no machine-detectable trace | Independent FD adjudication. G-P4-03's uncited-record assertion covers whole records that were never cited, not values inside a cited one. Do not claim G-P4-03 closes this |
| Semantic drafting drift in the rewritten `SKILL.md` prose | The denylist is literal; paraphrase evades it | FD/human review of `SKILL.md` |
| A forged FD approval or attestation committed by someone with repo write access | The hash pin proves the file matches what a human committed, not that FD authored it | Signature and out-of-band confirmation at FD sign-off |
| A caller supplies records that Mr. Tiển did not actually select | MVP treats the explicitly supplied invocation record set as the package boundary and deliberately does not implement package-authorization workflow | Operator/FD review for the pilot; add machine-verifiable package authorization only in the deferred document-control workstream |

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
The 2026-07-26 PO patch reopens only the attestation/cohort/decision contract slice and cohort/ranking
policy. The 2026-07-27 evidence-log-v2 decision then reopens one additional, narrow G-P4-01 slice to
close the latent Step 1/Step 2 publication mismatch; the runner, serializer, publication transaction,
and unrelated artifact contracts remain closed.

## What changed from the archived Phase-4 narrative

The old narrative treated reasoning primarily as a five-step SKILL producing a matrix and draft.
This plan freezes a narrower, testable decision core first; separates rubric approval from model
reasoning; introduces cohort/linear-formulation policy; makes inconclusive a valid result; and
defers drafting, external research, and full document-control implementation. FD-selected internal
packages and linear-attested cross-strength ranking are authorized by `D20260727`;
implementation and G-P4-02 evidence must still be revised.
