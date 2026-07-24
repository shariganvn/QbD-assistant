---
title: "Brainstorm — Layer B evidence-bound formulation comparison"
workstream: qbd-p4-reasoning-layer
status: approved
date: 2026-07-24
scope: Cowork MVP public/mock comparison core
---

# Layer B — Evidence-Bound Formulation Comparison

## Decision

Build Layer B as an **evidence-bound formulation comparison analyst**, not an open-ended
"pharmaceutical formulation researcher". The agent may normalize admitted evidence, apply an
FD-approved rubric, compare candidates, and emit a traceable result. It may not invent evidence,
silently set weights, merge incompatible candidates, search externally without a request, or claim a
final dossier decision.

The canonical decision artifact is structured JSON; human-readable Markdown is a derivative. P.2.2
and P.2.3 drafting is a later workstream that consumes a completed decision artifact.

## Confirmed requirements

| Topic | Agreed requirement |
|---|---|
| Output | `SKILL.md`, strict decision/rubric/evidence contracts, `formula-decision` and `evidence-log` JSON + Markdown artifacts |
| Result | Select one best-supported formulation, or return `inconclusive / cần FD adjudicate` with actionable reasons |
| Rubric | Agent proposes; FD supplements and approves a version; only that immutable approved version may be applied |
| Evidence | Compare admitted trial evidence only. External material is requested explicitly, returned raw, reviewed by FD, and admitted to the store before any later use |
| Scope | Comparison core only; P.2.2/P.2.3 drafting follows after core acceptance |
| Runtime | Cowork MVP consumes public/mock evidence only. Internal processing, egress/access controls, and an internal-capable renderer are Phase 2 |

## Cohort policy

Candidates are rankable only when they share API, strength, dosage form, product target, and trial
context. A candidate that cannot be assigned to the cohort is not scored against it.

The sole planned exception is an FD-declared **linear formulation**: equivalent proportional
composition with tablet mass scaled for strength. The attestation must also identify comparable
manufacturing/process context. Results remain strength-specific: evidence at 10 mg may support a
platform observation but cannot replace 5 mg evidence or be merged into a 5 mg score.

The current fixtures demonstrate the need for this gate: F-01/F-02 are 5 mg, while F-03 is 10 mg.

## Approaches evaluated

| Approach | Benefit | Failure mode | Decision |
|---|---|---|---|
| Domain-expert persona + freeform matrix | Fast prompt authoring | Narrative-first confidence, implicit weights, fabricated rationale | Reject |
| Weighted matrix only | Visible totals | Cannot distinguish missing evidence, conflicts, eligibility, or unapproved weights | Reject |
| Evidence-first state machine with FD-controlled rubric | Traceable, testable, portable to `qbd_core` | More contract/test work | Adopt |

## Design

```text
admitted public/mock store
  -> cohort gate
  -> normalized fact/evidence cards
  -> approved-rubric gate
  -> eligibility + hard gates
  -> explicit matrix calculation
  -> conflict and sensitivity review
  -> selected | inconclusive
  -> formula-decision + evidence-log
```

### Authority boundaries

- `citable:false`, non-public, unlabeled, low-confidence/`needs-ocr`, malformed, or unresolved
  evidence cannot silently support a winner. The artifact records why it was excluded or why FD
  adjudication is needed.
- A missing critical value is **not score zero**. It is a stop condition defined by the approved
  rubric.
- A proposed rubric is never auto-promoted. An approval record carries version, approver, date, and
  the exact criteria/weights/missing-data/tie policy used for the run.
- External evidence remains outside the decision run until FD review and normal Layer A admission.
- No Layer B output writes a final `.docx`; Layer C remains the deterministic renderer.

### Decision protocol

1. Validate candidate identity, cohort membership, and any linear-formulation attestation.
2. Create fact cards from store records: raw value, unit, specification, direction, candidate,
   provenance, quote, and extraction confidence.
3. If no approved rubric exists, emit only a proposal and `inconclusive`.
4. Apply hard gates before soft scoring. Hard gates, units, score mappings, weights, and tie/margin
   thresholds are data in the approved rubric, not hidden prompt choices.
5. Compute every matrix cell explicitly and attach its supporting record IDs.
6. Produce a counter-case for the tentative winner, list conflicts/non-comparability, and test the
   permitted weight/uncertainty range. A brittle result becomes `inconclusive`.
7. Emit selected candidate only when it is eligible, sufficiently evidenced, and robust under the
   approved policy; otherwise name the precise FD action needed.

### Artifact boundary

- `rubric-proposal.json` and `rubric-approved.json`: rubric lifecycle.
- `formula-decision.json`: canonical cohort, fact cards, hard-gate outcomes, matrix, calculations,
  conflicts, review, decision, and FD actions.
- `formula-decision.md`: readable derivative, never a source of truth.
- `evidence-log.json`/`.md`: claim or matrix cell to evidence ID, provenance, quote,
  classification, and admission status.

Layer C's current public citation envelope is intentionally not expanded in this workstream. The
future drafting adapter may translate a successful decision into the existing render draft contract.

## Validation criteria

- No approved rubric: no selection.
- Different cohorts: no joint ranking.
- Incomplete linear exception: no cross-strength inference.
- Missing critical value or unresolved conflict: `inconclusive`, never invented data or score zero.
- Every score, hard gate, and conclusion resolves to admitted store evidence.
- External raw evidence cannot affect the current run.
- JSON artifacts are mechanically valid; Markdown agrees with the canonical JSON.
- An end-to-end 5 mg fixture compares F-01/F-02 and retains F-03 as a separate cohort.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Same model audits its own reasoning | Treat the adversarial pass as consistency checking only; FD remains scientific adjudicator |
| Prompt framing sounds authoritative | Encode permissions, stop conditions, and schema; avoid theatrical expert-role instructions |
| Current renderer accepts public citations only | Keep MVP public/mock; defer internal contract/egress change to Phase 2 |
| Rubric politics become hidden prompt behavior | Versioned FD approval is a hard precondition to selection |
| Score precision hides weak evidence | Evidence completeness, conflict status, and sensitivity result are first-class decision fields |

## Handoff

The approved implementation plan is `docs/plans/qbd-p4-reasoning-layer/plan.md`. It uses TDD
because the main value is enforceable contracts and regression fixtures, not unconstrained model
prose.
