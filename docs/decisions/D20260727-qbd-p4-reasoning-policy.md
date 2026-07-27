---
title: P4 reasoning policy bundle — deterministic core, FD-selected MVP, and evidence-log v2
id: D20260727
status: active
date: "2026-07-27"
scope: qbd-p4-reasoning-layer
supersedes: null
affects:
  - docs/plans/qbd-p4-reasoning-layer/
  - cowork-p2-kit/reasoning/
  - docs/reports/qbd-p4-reasoning-layer/decision/
read_when: Changing P4 evidence admission, cohort policy, artifact contracts, publication, rationale, or FD pilot scope.
---

# D20260727 — P4 Reasoning Policy Bundle

## Decision

This record consolidates the four archived P4 decisions listed under
`docs/decisions/OUTDATED/`; they remain historical rationale, not canonical ledger entries.

P4 remains a deterministic, evidence-bound technical prototype. It produces provenance-bound fact
cards, cohorts, decisions, and canonical JSON/Markdown derivatives; it does not approve a formulation,
replace FD judgement, draft P.2.2/P.2.3, or perform external egress.

LLM-generated rationale is a later, separate layer. It may consume a sealed handoff from completed
reasoning artifacts, but must not re-evaluate the mutable store, change a decision, add evidence, or
overwrite the deterministic `formula-decision.md` derivative.

For the MVP, Mr. Tiển is the FD authority. The exact record package he supplies is the package boundary:
Layer B neither discovers additional records nor implements document-control authorization. Within that
bounded package, classification, `citable`, and deferred version/approval/rights metadata do not gate
admission. Provenance-to-candidate mapping, formulation identity, quote bindings, extraction quality,
and conflict handling remain mandatory.

Candidates with different API, dosage form, product target, or trial context never share a cohort.
Different strengths may share one cohort only when a complete FD linear-formulation attestation names
the exact candidate/strength set, matches every candidate profile, and has a matching external
human-committed SHA-256 pin. Step 2 forms the eligible cohort; only Step 3 may score or rank it.
Without a valid attestation/pin, strengths remain separate.

Evidence log v2 is the canonical admitted-record and exclusion ledger. It has exact top-level keys
`schema_version`, `cohort_id`, `entries`, and `exclusions`. Entry rows retain `record_id`, `candidate`,
sorted unique `fact_card_ids`, `quote`, and page-global provenance `{file,page,char_start,char_end}`.
Layer B compares that stored tuple and quote directly with `record.provenance`; it never slices
segment-local `record.content` with page-global offsets. The cohort artifact retains candidates, the
complete candidate map, store pin, attestation binding, and cohort basis only; it never duplicates
exclusions. Fact-card offsets remain their separate segment-local contract.

## Consequences

- Historical public/mock G-P4-02 and evidence-log-v1 results are retained for audit only; they do not
  establish FD readiness or production publication.
- G-P4-01 owns evidence-log v2 schema/runtime/CLI binding and failed-publication preservation; G-P4-02
  owns admission/exclusion policy and must validate/publish the actual builder result.
- A real FD-approved rubric remains deferred. Until its human-committed pin is present, a decision is
  `inconclusive`; an attestation never substitutes for rubric approval.
- The MVP keeps a future document-control seam but does not activate it. DMS, email, and meeting
  minutes do not supply a competing MVP authorization mechanism.
- Any future rationale layer, document-control workflow, external route, rubric approval, scoring,
  ranking, or drafting behavior requires a separate approved decision and plan delta.

## Amendment — Step 3 test-only decision core authorization

**Approved by the maintainer on 2026-07-27.** The separate decision and plan delta required for the
narrow test-only scoring/ranking mechanism are satisfied by this amendment and the rebuilt Step 3
plan.

1. G-P4-03 may use only the committed synthetic v2 selection-rubric fixture and its immutable
   canonical SHA-256 test pin to prove deterministic selection behavior.
2. That fixture is not FD approval, cannot be published, and cannot select a real formulation or
   release a product.
3. G-P4-01 and G-P4-02 remain completed, read-only upstream contracts and evidence. Step 3 uses its
   isolated v2 rubric/evaluation namespace rather than reopening their v1/v2 envelopes.
4. `pins.selection_rubric_approved_sha256` remains null. A production-shaped invocation without an
   FD-approved rubric and matching human-committed production pin returns `inconclusive`, never a
   winner.
5. Step 3 completes only when the rebuilt G-P4-03 suite passes with machine-produced evidence. Real
   FD rubric approval remains deferred work and does not block that technical closure.

This amendment does not modify FD authority, MVP package admission, linear-attestation policy,
publication behavior, Markdown generation, document control, or external egress. The implementer
starts with the required red G-P4-03 result and runs GitNexus impact analysis before changing any
existing symbol. Step 4 may consume the frozen `{ decision, evaluation }` output only after G-P4-03
passes; it owns publication and deterministic Markdown.

## Rationale

Separating deterministic evidence/decision logic from narrative generation prevents a narrative system
from silently choosing different evidence or overriding a decision. FD selected a low-friction pilot
for supplied internal packages, while retaining deterministic candidate and quote controls. Evidence-log
v2 resolves the former conflict between G-P4-01's artifact envelope and G-P4-02's required provenance
and named exclusions.

## Non-goals

This bundle does not approve a formulation, authorize production release, define a rationale schema or
provider, add an evidence-log migration/dual writer, implement document governance, or authorize
external AI/data egress.
