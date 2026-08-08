---
title: "QbD P.2.2.1 real-evidence formulation-selection evaluation"
description: "Build a source-bound three-formula evaluation and a review-only P.2.2.1 output that surfaces CT03 as a watermarked engineering proposal while the FD decision stays inconclusive. MVP scope: simple FD-confirm flag; cryptographic authorization and the full adversarial matrix are deferred to a follow-on module."
status: in-progress
priority: P1
effort: "6-7d"
issue: null
branch: master
tags: [feature, backend, critical, qbd, reasoning]
created: 2026-08-06
workstream: qbd-p221-formulation-selection
scope_lock: P.2.2.1 formulation-selection slice
blockedBy: []
blocks: []
---

# QbD P.2.2.1 — real-evidence formulation-selection evaluation

## Outcome

Use the filled public mock's three formula columns to build truthful typed
evidence, an exact three-candidate matrix, and an explanatory review-only
P.2.2.1 DOCX. The output surfaces CT03 as an explicit **engineering proposal**
("sole survivor under the proposed, FD-unapproved rule") inside a watermarked
`ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT` block, while the official `fd_decision`
stays `inconclusive` with `winner:null`. The engineering proposal and the FD
decision are separate fields that are never merged; only the FD path may ever
use selected/winner/decision language.

MVP scope: an `fd-confirmed` flag (who + when + note) is a sufficient
human-in-the-loop control for this slice. Cryptographic FD receipts/pins and the
full adversarial forgery matrix are deferred to a separate authorization module
(see Deferred follow-on).

## Source of truth

- Gap analysis:
  `plans/reports/spec-review-260806-0936-template-docx-demo-full-p2-gap.md`.
- Handoff:
  `plans/reports/handoff-20260806-0936-full-p2-reasoning-rationale.md`.
- Executable acceptance: `gates.yaml` (G-00..G-05). Phase files link to gates;
  they do not redefine complete gate bodies.
- Frozen mock:
  `cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`.
- Required source SHA-256:
  `01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f`.
- Required `document.xml` SHA-256:
  `ebefbf16e4f7bcae2907d6655d72a3e374cc4b2b6f185380203403f61a2bdf8a`.
- Classification: public, synthetic/probe-only, `citable:false`; never dossier
  evidence (`template-freeze-manifest.v1.json`).

## Expected mock values

These are expected-fixture values used to verify extraction, not literals used
to manufacture a decision.

| Metric | Extracted specification | CT01 (1%) | CT02 (3%) | CT03 (5%) |
|---|---|---:|---:|---:|
| Dissolution mean % | `DISSOLUTION.SPEC` `>=80 (Q)` | 73.89 | 81.40 | 98.64 |
| Dissolution minimum % | `DISSOLUTION.SPEC` `>=80 (Q)` | 65.15 | 79.12 | 96.15 |
| Dissolution maximum % | `DISSOLUTION.SPEC` `>=80 (Q)` | 79.33 | 87.67 | 100.98 |
| Assay % | `ASSAY.SPEC` `90-110` | 100.31 | 100.02 | 99.99 |
| Content-uniformity AV | `CU.SPEC` `<15` | 3.71 | 2.79 | 3.04 |
| Croscarmellose sodium | composition evidence | 1% | 3% | 5% |

The proposed interpretation gates dissolution on the observed minimum and
scores the observed mean. Under that **test-only proposed rule**, CT01 and CT02
fail and CT03 is the sole survivor. FD must approve the scientific
interpretation before a production winner may exist.

## Two execution lanes (MVP)

| Lane | Authority | Allowed output | Forbidden output |
|---|---|---|---|
| Proposal review (default, demonstrated) | Engineering; no FD confirmation | Raw evidence/spec diagnostic, `fd_decision:inconclusive`, watermarked engineering-proposal block naming CT03 as sole survivor under the proposed rule (`fd_approved:false`), review-only rationale/DOCX | selected/winner/decision language for CT03; any claim of FD approval; mutating `fd_decision` |
| FD-confirmed | `fd-confirmed` flag set by a trusted FD user (who + when + note) | Same output with `fd_decision` reflecting the confirmed rule outcome | — (MVP-grade trust, not tamper-proof) |

This slice ships with the flag UNSET, so the demonstrated output is the proposal
lane. The FD-confirmed lane is a simple documented seam, not a security control.
An unforgeable cryptographic authorization lane is deferred (see Deferred
follow-on).

## Junior guide — critical findings and exact patch

### Critical 1 — one eligible formula could never win

**Current bug:** rubric v2 requires at least two eligible candidates. The plan's
own filter removes CT01 and CT02, leaving one. The engine therefore returns
`E_INSUFFICIENT_ELIGIBLE_CANDIDATES`, not CT03.

Think of it as a tournament function that refuses to announce a result unless
two finalists remain, while our scientific rule intentionally leaves one
survivor.

**Patch:** preserve v2 behavior for existing callers. Add a formulation-specific
v3 contract with:

```json
{
  "required_candidate_ids": ["formula-01", "formula-02", "formula-03"],
  "minimum_eligible_candidates": 1,
  "selection_mode": "single-survivor-after-complete-cohort"
}
```

The evaluator first proves the input cohort is exactly those three candidates.
Only then may one eligible survivor be selected. Tests must prove that a
one-candidate or two-candidate input remains inconclusive.

### Critical 2 — the Phase 0 ingest command points at the wrong boundary

**Current bug:** bare `node cowork-p2-kit/ingest/cli.mjs` scans the configured
input roots. The frozen mock is not admitted by the canonical manifest, so the
command fails before extraction.

Think of it as asking a mailroom to process one letter but giving it the whole
inbox and a whitelist that does not contain that letter.

**Patch:** copy only the hash-verified mock into a fresh temporary trial root,
write a minimal temporary manifest/config, then call the existing ingest
pipeline with that config. Reuse the isolated staging pattern from
`content-demo-run.mjs`; never edit canonical inputs or the canonical manifest.

### Critical 3 — surface CT03 as a proposal without faking an FD decision

**Verified behavior:** `evaluateSelection()` checks `approval_state` before
matrix work (`decision-engine.mjs:127` returns `E_RUBRIC_APPROVAL_REQUIRED` for a
`proposal`). So the official FD decision is correctly empty — but the demo must
still show CT03.

**Patch (MVP):** keep the engine's fail-closed `fd_decision`. Add a *separate*
`engineering_proposal` object, computed from the same validated evidence, that
names CT03 as the sole survivor under the proposed rule. Fixed fields:

```json
{
  "artifact_kind": "engineering-proposal-not-fd-approved",
  "proposed_survivor": "formula-03",
  "conditional_on": "proposed rule (dissolution min-gate + mean-score, strict CU<15), NOT FD-approved",
  "fd_approved": false
}
```

`fd_decision` stays `inconclusive/winner:null`; the two objects are never merged.
Proposal rationale/render may state "CT03 is the only candidate meeting the
proposed rule" and show why CT01/CT02 fail, but must never use
selected/winner/decision. Also emit the raw `formula-evidence-diagnostic.json`
(`decision_status:not-evaluated`).

### Critical 4 — authorization: MVP flag now, crypto later

**Context:** a caller could change a JSON string to `test-approved`, recompute
its SHA-256, and pass both to the engine — a matching self-computed hash proves
byte identity, not authority. The full defense (unforgeable even by an insider)
is a cryptographic FD receipt + human-committed pin.

**Patch (MVP scope, per PO decision):** do NOT build the cryptographic seam in
this slice. Instead:

```text
proposal (default)      -> fd_decision inconclusive; engineering_proposal shows CT03
fd-confirmed (flag set) -> trusted FD user sets a flag (who + when + note); decision reflects the confirmed outcome
```

The runner still refuses caller-supplied `--rubric-state`; the only way past
proposal is the `fd-confirmed` flag, which is honest-but-not-tamper-proof. This
slice ships with the flag UNSET, so the demonstrated output is the watermarked
engineering proposal. **Cryptographic authorization is deferred to a separate
module** (see Deferred follow-on).

## Non-negotiable contracts

- **Spec is not result:** specs, observations, and composition context are
  distinct typed evidence. Scoring cards must bind only to observed-result IDs.
- **Exact cohort:** expected set is exactly formula-01/02/03 before eligibility.
- **Source inventory:** every decision-relevant store record appears in a
  source-derived inventory; `recordRoles` is derived, not caller-authored.
- **Spec-driven rules:** operators and thresholds compile from spec evidence.
  Strict `<15` stays strict; no `<` to `<=` weakening.
- **Atomic binding:** source DOCX hash, store hash, cell-receipt hash, spec
  evidence hash, rubric hash, decision, engineering proposal, and
  rationale/render artifacts are sealed in same-run receipts. (Cryptographic FD
  approval receipts are part of the deferred authorization module.)
- **Cell ownership:** page offsets alone are insufficient. Each critical value
  needs table/row/column ownership plus source and raw-cell hashes.
- **Non-citable means non-citable:** render uses internal provenance references,
  not the render contract's public/citable citation objects.
- **Fail closed:** missing/conflicting evidence, incomplete cohort, role
  downgrade, spec drift, or cross-run artifact substitution yields `inconclusive`
  (FD decision) or hard failure. The engineering proposal is emitted only when
  the evidence/cohort/spec bindings all pass.
- **Determinism:** full-ingest determinism and downstream-from-snapshot
  determinism are reported separately. A snapshot cannot hide ingest drift.

## Non-goals

- Complete P.2 or all 146 template fields.
- Creating or impersonating FD approval, or labeling CT03 "selected/winner".
- Cryptographic, insider-proof authorization (deferred to a separate module).
- Changing the mock classification to citable.
- Promoting or touching the synthetic demo artifact `p2-draft.docx`.
- Rewriting frozen v2 semantics for existing callers.

## Ordered phases

| Phase | File | Gate | Status |
|---:|---|---|---|
| 0 | [Hash-pinned isolated extraction and cell receipts](phase-00-discovery-spike-formula-matrix.md) | G-00 | Complete |
| 1 | [Typed evidence, inventory and safe fact-card bindings](phase-01-real-data-layer.md) | G-01 | Complete |
| 2 | [Formulation v3 rubric and MVP FD-confirm flag](phase-02-spec-compiled-rubric-and-approval.md) | G-02 | Pending |
| 3 | [Proposal diagnostic and watermarked CT03 engineering proposal](phase-03-reasoning-decision-matrix.md) | G-03 | Pending |
| 4 | [Bound rationale and watermarked non-citable review render](phase-04-rationale-and-render.md) | G-04 | Pending |
| 5 | [Legitimacy-negative and determinism regression suite](phase-05-negative-path-tests.md) | G-05 | Pending |

## Dependencies

- Phase 0 is GO/NO-GO and blocks every later phase.
- Phase 1 depends on Phase 0.
- Phase 2 depends on Phase 1's spec/evidence contracts.
- Phase 3 depends on Phases 1 and 2.
- Phase 4 depends on Phase 3 publication receipts.
- Phase 5 depends on Phases 0-4.
- External: promoting the engineering proposal to a real FD decision needs a
  trusted FD user to set the `fd-confirmed` flag (MVP) and, for dossier use, the
  deferred cryptographic authorization module.

## Exit acceptance

- G-00..G-05 pass with evidence under
  `docs/reports/qbd-p221-formulation-selection/`.
- Proposal lane produces a complete raw evidence diagnostic, an `fd_decision` of
  `inconclusive` with `winner:null`, a separate `engineering_proposal` naming
  CT03 as sole survivor under the proposed rule (`fd_approved:false`), and a
  review-only P.2.2.1 DOCX that shows the watermarked
  `ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT` block with internal provenance
  references and no public citation objects.
- CT03 is derived only after exact three-candidate and source/spec bindings pass;
  no output uses selected/winner/decision language for CT03.
- The runner rejects caller-supplied approval state; with the `fd-confirmed` flag
  unset, `fd_decision` stays `inconclusive`.
- Two full ingests are deterministic, or G-00 records NO-GO. Snapshot-based
  downstream determinism is never reported as full-run determinism.

## Red Team Review

### Session — 2026-08-06

**Findings:** 15 (15 accepted, 0 rejected)
**Severity:** 4 Critical, 9 High, 2 Medium

| # | Accepted finding | Applied to |
|---:|---|---|
| 1 | Single survivor impossible under v2 minimum | Plan, Phases 2-3, G-02/G-03 |
| 2 | Bare ingest cannot admit the mock | Phase 0, G-00 |
| 3 | Proposal evaluation has no matrix | Plan, Phases 3-4, G-03/G-04 |
| 4 | Test pin is forgeable as FD approval | Plan, Phases 2-3, G-02/G-03 |
| 5 | Non-citable mock conflicts with citation contract | Phase 4, G-04 |
| 6 | Spec/rubric/decision binding not atomic | Phases 2-4, G-02..G-04 |
| 7 | Min/mean and paired-gate mapping underspecified | Phase 2, G-02 |
| 8 | Strict CU operator weakened | Phase 2, G-02/G-05 |
| 9 | Cohort/store coverage and roles incomplete | Phases 1-3, G-01/G-03 |
| 10 | Spec-as-result guard not structural | Phases 1-2, G-01/G-02 |
| 11 | Disintegrant evidence missing | Phases 0-1 and 4, G-00/G-01/G-04 |
| 12 | Same-run sealing not executable | Phases 3-4, G-03/G-04 |
| 13 | Offsets do not prove cell ownership | Phase 0, G-00 |
| 14 | Snapshot fallback hides ingest nondeterminism | Phase 5, G-05 |
| 15 | Non-canonical `step-*` plan filenames | All phase files; CLI validation |

> **Superseded by Validation Log (2026-08-06):** findings #4 and #12's
> cryptographic-authorization remedy is deferred to the authorization module;
> this slice uses the MVP `fd-confirmed` flag instead. All other findings stand.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, `gates.yaml`, and all six `phase-*.md` files.
- Decision deltas checked: 15 accepted finding clusters.
- Reconciled stale references: 15 clusters, including old `step-*` links,
  unchanged-v2 claims, proposal-matrix claims, test/FD approval conflation,
  public-citation claims, inclusive CU operator, and snapshot fallback.
- Unresolved contradictions: 0.

## Validation Log

### Session 1 — 2026-08-06 (PO validate, ELI-junior)

**Verification pass (Full tier, 6 phases):** 29 claims checked, 0 failed.

- 20 reused/modified files exist; 4 created files absent (correct).
- Frozen mock SHA-256 matches the pinned authority exactly.
- Confirmed `selection-contracts.mjs:102` enforces `minimum_eligible_candidates >= 2`
  (v2 cannot yield a single survivor) and `decision-engine.mjs:127` returns
  `E_RUBRIC_APPROVAL_REQUIRED` for a proposal before any matrix work.

**PO decisions (4 questions):**

1. Output → **show CT03 as a watermarked engineering proposal** ("đề xuất KT,
   chưa FD duyệt"); FD decision stays inconclusive. Reverses the earlier
   "hide CT03 entirely" design; adds the separate `engineering_proposal` object
   and render watermark.
2. Effort → re-shaped to a "sharp + legit" MVP (~6-7d) over the full fortress
   (8-12d), trimming cryptographic authorization and the full adversarial matrix.
3. Determinism → **keep fail-closed / hard-stop** on ingest nondeterminism
   (unchanged).
4. Authorization → **MVP `fd-confirmed` flag** (who + when + note) is sufficient;
   cryptographic authorization becomes a separate follow-on module.

**Propagated to:** plan Outcome / lanes / Critical 3-4 / contracts / non-goals /
exit; gates G-02/G-03/G-04/G-05; phase files 02-05.

### Whole-Plan Consistency Sweep (post-validate)

- Files reread: `plan.md`, `gates.yaml`, all six `phase-*.md`.
- Reconciled: removed test-pin/crypto-receipt language where deferred; aligned
  "engineering proposal shows CT03" across plan, G-03/G-04 and phases 3-4;
  aligned the FD-confirm flag across G-02 and phase 2; kept determinism,
  spec-not-result and exact-cohort intact.
- Unresolved contradictions: 0.

### Session 2 — 2026-08-07 (Phase 1 readiness verification)

**Scope:** focused readiness check of Phase 1 only (no re-interview; Session 1
guard applies). Verification pass against the actual repo.

- Phase 0 verdict `GO`; all 7 G-00 evidence artifacts present.
- Phase 1 inputs complete: matrix carries exact cohort formula-01/02/03 with all
  six per-candidate metrics (dissolution min/mean/max, assay,
  `content_uniformity_av`, `croscarmellose_sodium`); specs are distinct
  (`dissolution >=80`, `assay range 90-110`, strict `content_uniformity_av < 15`).
- Inventory reconciliation exact: the 4 source-quote records reference all 21
  cell-receipt IDs (union covers dissolution-min and dissolution-max, not only
  mean); 0 missing, 0 extra. Cell-receipt set carries `receipt_set_sha256`.
- `recordRoles` absent in Phase 0 output — correct; Phase 1 derives them.
- Two-run ingest `byte_identical:true` (determinism holds).
- All five Phase 1 create-targets absent (correct); all reuse files present
  (`fact-cards.schema.json`, `contracts.mjs`, `cohort-evidence.mjs` under
  `reasoning/`, `demo-data-pack.mjs`).
- Failures: 0. No open decision points specific to Phase 1. **Verdict: ready to
  implement.**

### Session 3 — 2026-08-08 (Phase 1 implemented, G-01 pass)

**Scope:** full Phase 1 implementation via the validated plan (code mode).
Evidence under `docs/reports/qbd-p221-formulation-selection/`.

- Five create-targets landed: `real-data-pack.mjs`, three v1 JSON contracts
  (`formulation-evidence`, `fact-card-evidence-bindings`,
  `formulation-data-package`), and `tests/real-data-pack.test.mjs`.
- G-01 test suite 18/18 pass: exact cohort, spec-as-result, inventory omission,
  role downgrade, wrong-kind binding, dropped-binding coverage
  (`E_BINDING_INCOMPLETE`), ambiguous receipt join. Determinism asserted across
  two in-process builds; CLI re-emission byte-identical
  (`package_sha256 0d6620d2…`).
- G-00 regression 10/10 pass; reasoning 73/73 pass (pre-existing `G-P4-04`
  stale baton-era test excluded, unrelated).
- Code review (`code-reviewer`) DONE_WITH_CONCERNS; no critical issues.
  Resolved: H2 binding-coverage completeness + negative test; M2 pinned
  `receiptSetSha256` required (fail-closed). Documented: H1 — emitted fact
  cards are binding-validator-only by design (comma-decimal raw cells cannot
  carry the dot-decimal token the canonical `validateFactCards` requires);
  structural safety lives in the evidence envelope + bindings. Noted for G-02:
  M1 — Phase 1 roles are `record_id → [evidence kinds]`, the v2 engine expects
  `results|context`, a translation is needed at the G-02 boundary. Final
  remediation also pins every evidence item, including specifications, to the
  exact G-00 receipt authority before bindings are accepted.

## Deferred follow-on — Authorization module

Deferred per PO decision (2026-08-06). Not built in this slice.

- **What:** cryptographic FD approval receipt + human-committed, insider-proof
  production pin; full adversarial forgery/publication negative matrix.
- **Owner:** a separate `qbd-authorization` plan/module (shared cross-cutting
  concern per the qbd_core module-boundary ADR).
- **Reopen when:** the P.2.2.1 output moves from MVP review/demo toward real
  dossier use, or FD requires tamper-proof approval.
- Until then the `fd-confirmed` flag is explicitly MVP-grade trust, not security.

## Unresolved questions

None for implementation planning. FD approval itself remains an external human
action and is intentionally not inferred by this plan.
