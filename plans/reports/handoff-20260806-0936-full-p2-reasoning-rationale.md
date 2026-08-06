# HANDOFF: Full P.2 reasoning and rationale from filled mock

Generated: 2026-08-06 09:36 ICT · Session focus: close the synthetic DOCX demo and route the next session to full P.2 reasoning.

## Goal

Continue from the completed template DOCX content demo into a separate,
evidence-first implementation that reasons over all relevant results in the
filled mock and produces a source-bound rationale.

## Why This Matters

The retained DOCX is a valid internal demo of the pipeline, but its selected
path is synthetic. It must not be read as a formulation recommendation: the
demo currently uses the assay specification range `90–110%` as if `90` and
`110` were observed values.

## Current State

- The demo plan is complete for its bounded scope: one representative
  P.2.2.1-style slice, synthetic rubric/comparator, three presentation-only
  citations, watermark, isolated render, and deterministic normalized OOXML.
- The mock ingest retains 21 records. The demo reasoning pack creates two real
  cards from one result record and two synthetic comparator cards.
- The mock's three formula identities and their observed result matrix are not
  yet represented as three real candidates.
- Rationale is sealed and validated as `internal_only`, but contains generic
  demo claims rather than a full explanation of formula selection.

## Key Decisions and Why

- Keep the demo artifact review-only and non-citable as a whole.
- Treat specification and observed result as different evidence types. The
  `90–110%` assay range cannot become a candidate value.
- Start full P.2 work under a new plan. Do not silently expand or relabel the
  completed demo plan.
- Use only real formula candidates for a real decision. A synthetic comparator
  remains useful for contract tests but cannot justify a real winner.
- Require FD approval for rubric thresholds, weights, and winner semantics.

## Rejected Approaches and Traps

- Do not promote `p2-draft.docx` as scientific evidence.
- Do not treat the three DOCX footnotes (`1.000 viên`, `110%`, `29,08`) as full
  mock coverage; they are a bounded citation-join demonstration.
- Do not use the existing `demo-real-candidate`/`demo-comparator` pair as the
  full P.2 cohort.
- Do not infer a winner from the mock's conclusion until its evidence is
  extracted, normalized, rubric-bound, and reviewed.

## Verification Status

- Focused demo tests and the end-to-end demo run passed according to the
  plan-scoped reports, but those tests validate the synthetic demo contract.
- Direct DOCX inspection confirms the retained artifact has three citations
  and generic synthetic scoring.
- Full P.2 semantic extraction, real candidate comparison, and explanatory
  rationale are not done.

## Relevant Files and Pointers

- [Spec review](spec-review-260806-0936-template-docx-demo-full-p2-gap.md)
- [Demo plan](../260805-1815-template-docx-content-demo/plan.md)
- [Demo runner](../../cowork-p2-kit/workflow-trial/content-demo-run.mjs)
- [Demo data pack](../../cowork-p2-kit/workflow-trial/demo-data-pack.mjs)
- [Demo rationale](../../cowork-p2-kit/workflow-trial/demo-rationale.mjs)
- [Mock input](../../cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx)
- [Retained artifact](../../artifacts/template-docx-content-demo/run-msgvldj7/p2-draft.docx)

## Open Work and Dependencies

The next session needs a new plan that decides full P.2 versus a complete
P.2.2.1-first increment, defines the FD-approved rubric, and maps every
decision-critical mock value to a truthful ingest record. It then needs the
real-candidate fact-card matrix, reasoning publication, same-packet rationale,
render acceptance, and negative-path tests described in the spec review.

Fresh-agent prompt: read this handoff, the linked spec review, the demo plan,
the filled mock, `template-record-extractor.mjs`, `ingest/pipeline.mjs`,
`reasoning/decision-engine.mjs`, `rationale/claim-binding.mjs`, and the existing
P2/P4/rationale contracts. Verify the current checkout and C1/C2 history before
creating the new full-P.2 plan. Do not modify the demo artifact or claim its
synthetic selection is real.
