# Spec review: template DOCX content demo → full P.2 gap

Date: 2026-08-06 09:36 ICT
Review target: [template DOCX content demo plan](../260805-1815-template-docx-content-demo/plan.md)
Artifact: [p2-draft.docx](../../artifacts/template-docx-content-demo/run-msgvldj7/p2-draft.docx)

## Verdict

The demo proves that the existing five-stage pipe can produce a watermarked,
isolated DOCX. It does not prove semantic reasoning or a complete rationale
from the filled mock. The demo scope is therefore complete only as a
presentation/provenance spike; full P.2 reasoning remains open.

## Findings

### F-001 — Critical: specification values are used as measured results

`buildRealCandidateCards()` hard-codes `release_30m = 90` and `assay = 110`
after selecting a record because it contains the text `90 - 110%`
(`cowork-p2-kit/workflow-trial/demo-data-pack.mjs:9-12,54-67`). In the filled
mock, `90–110%` is the assay acceptance range, not an observed result.

The observed assay values are `100,31`, `100,02`, and `99,99` for the three
formulas. The observed dissolution means are `73,89`, `81,40`, and `98,64`.
Consequently, the selected result in the demo is not a scientifically
interpretable result from the mock.

Disposition: block any claim that the demo selected a real formulation. The
next implementation must model specification and result as separate typed
evidence and reject spec-as-result binding.

### F-002 — Major: three formulas collapse into one real candidate

The ingest run retains 21 mock-derived records, but the reasoning pack creates
only two real cards, both bound to the same result record. The second candidate
is a deterministic synthetic comparator. The actual formula 01/02/03 cohort is
not represented in the decision matrix.

Disposition: the full P.2 work must create one real candidate per formula and
use the comparator only for isolated contract tests, never as the basis for a
real winner.

### F-003 — Major: rationale is generic and not decision-explanatory

`demo-rationale.mjs` emits four generic claims: retained real evidence,
synthetic gates, sensitivity stability, and decision state. The body adapter
also renders generic prose plus a synthetic score table
(`demo-rationale.mjs:28-53`; `rationale-to-content-draft.mjs:57-82`). It does
not explain the observed formula trade-off or why the selected formula wins.

Disposition: full rationale must bind claims to formula-specific fact cards,
gate outcomes, sensitivity results, and the decision state. It must explain
the observed dissolution/assay trade-off and cite the source evidence.

### F-004 — Major: citation lane is not a full reasoning evidence lane

The DOCX renders three exact receipt citations: batch size `1.000 viên`, the
assay specification substring `110%`, and particle-size value `29,08`. Two
receipt fields remain unmapped. These citations demonstrate join/footnote
format only; they do not cover the full formula result set and are not causal
support for the synthetic score or decision.

Disposition: full P.2 needs formula/metric-level provenance joins derived from
ingest records. The five-field receipt selector must not be treated as a full
mock-result projection.

### F-005 — Scope boundary is explicit, not a missing demo test

The accepted demo plan explicitly chooses one representative P.2.2.1-style
slice and excludes the real FD rubric, full P.2 mirror, scientific correctness,
and five-of-five/full field provenance (`plan.md:34-42,90-96`). The plan's
completion status is therefore not evidence that full P.2 is implemented.

Disposition: open a separate full-P.2 plan in the next session. Do not expand
the completed demo plan in place or promote its artifact.

## What the demo did prove

- Template probe and ingest can run against the real template and filled mock.
- The isolated run can retain real ingest records and bind a bounded citation
  join to record/page/offset evidence.
- The reasoning engine can reach `selected` with a pinned synthetic rubric and
  two eligible candidates.
- Same-run rationale sealing, draft validation, leading watermark, Bubblewrap
  no-network rendering, and normalized DOCX determinism were exercised.

These are pipeline/contract results, not a real formulation recommendation.

## Required acceptance for the next full-P.2 implementation

1. Extract and normalize all relevant mock values by formula 01/02/03, keeping
   specification, observed result, unit, and candidate identity separate.
2. Create real candidate-bound fact cards with exact record provenance for the
   selected measures and all supporting result/context measures.
3. Use an FD-approved, hash-pinned rubric. If approval is absent or a required
   value is missing/conflicting, return `inconclusive`; do not substitute a
   synthetic comparator or hand-written score.
4. Publish a decision matrix containing all critical gates, score inputs,
   sensitivity vectors, and formula identities used by the decision.
5. Author a same-packet rationale that explains the selection, failed/limited
   alternatives, trade-offs, uncertainty, and every claim's evidence binding.
6. Render a full-P.2 or explicitly accepted full P.2.2.1 output, with
   formula-level citations and visible missing-data states where evidence is
   unavailable.
7. Add regression tests for spec-as-result confusion, missing formula identity,
   ambiguous joins, incomplete candidate coverage, and rationale claims that
   omit decision-critical evidence.

## Unresolved questions

- Whether the next deliverable is the complete P.2 form or first the complete
  P.2.2.1 formulation-selection section must be confirmed in the next plan.
- FD must approve the real rubric, thresholds, weights, and interpretation of
  the supplied mock before any real winner can be declared.
