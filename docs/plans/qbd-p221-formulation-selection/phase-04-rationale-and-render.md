---
phase: 4
title: "Source-bound rationale and watermarked non-citable review render with engineering proposal"
status: completed
priority: P1
effort: "1-2d"
dependencies: [3]
---

# Phase 4: Source-bound rationale and watermarked non-citable review render with engineering proposal

## Context links

- Gate: `gates.yaml` → G-04.
- Input: Phase 3 proposal publication receipt and non-decisional diagnostic.
- Existing binding: `cowork-p2-kit/rationale/claim-binding.mjs`.
- Existing render contract: `cowork-p2-kit/render/contract.mjs`.

## Overview

Explain the real mock evidence, show CT03 as a watermarked engineering proposal,
but never convert it into an FD decision. Render a review-only P.2.2.1 document
with internal provenance references, not public citation objects. Seal rationale
and render artifacts to the same Phase 3 receipt.

## Requirements

- Rationale decision-state claim exactly explains the inconclusive `fd_decision`
  (`E_RUBRIC_APPROVAL_REQUIRED`, `winner:null`).
- Evidence claims may state observed values/specs and croscarmellose 1%/3%/5%
  only when bound to Phase 1 fact cards/evidence and Phase 0 cell receipts.
- The engineering-proposal block may name CT03 as the proposed survivor under the
  proposed rule, but every sentence in it is wrapped by the watermark and the
  `fd_approved:false` framing; it must not say winner, best choice, eligible/
  ineligible, decision, recommendation or selection.
- Render starts from the frozen filled DOCX only after the official template and
  all 146 resolved fields are revalidated, preserving the complete P.2.2.1
  structure. It then shows:
  - exact three-formula raw evidence table;
  - extracted specs next to observations;
  - explicit missing/conflicting-data states;
  - why no FD decision exists;
  - a distinct watermarked engineering-proposal block naming CT03 with
    `NOT FD APPROVED`;
  - visible `REVIEW ONLY — NON-CITABLE — NOT FD APPROVED` marker and the
    Vietnamese `ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT` block header.
- The review-only marker is attached through a real DOCX header relationship so
  it is page-level, not only a paragraph on the first page.
- Because the source is `citable:false`, the render draft contains zero public
  `citations`. Formula-level provenance appears in a separate internal-reference
  block as record/page/offset/quote/cell-receipt identifiers.
- Rationale packet must bind Phase 3 reasoning receipt (decision + proposal) plus
  all source artifact hashes. Render receipt must bind the validated rationale
  packet hash and DOCX.
- Run twice from fresh roots; normalized OOXML must match.

## Architecture

```text
Phase 3 receipt (diagnostic + inconclusive fd_decision + engineering_proposal)
  -> seal rationale packet with diagnostic/proposal + evidence bindings
  -> validate inconclusive fd_decision claim and watermarked proposal claim
  -> validate internal provenance reference artifact
  -> map to review draft
       citations: []
       blocks: [...evidence tables, why-no-FD-decision,
                watermarked ĐỀ XUẤT KỸ THUẬT (CT03, NOT FD APPROVED)...]
  -> isolated render
  -> render receipt binding same rationale/run
```

Do not weaken `validateCitation` or falsely set `citable:true`. The internal
reference artifact is validated before adaptation, then serialized into ordinary
paragraph/table blocks. The final render draft keeps the existing exact top-level
keys `title`, `citations`, and `blocks`; no render-contract escape hatch is added.

## Related code files

- Create: `cowork-p2-kit/workflow-trial/formulation-selection-rationale.mjs`.
- Create: `cowork-p2-kit/workflow-trial/formulation-selection-review-draft.mjs`.
- Create: `cowork-p2-kit/workflow-trial/contracts/internal-provenance-reference.schema.v1.json`.
- Modify: `cowork-p2-kit/rationale/packet.mjs` and packet schema additively to
  seal diagnostic/proposal/data/compile receipts.
- Modify: `cowork-p2-kit/workflow-trial/formulation-selection-run.mjs` to emit
  rationale and render from the Phase 3 receipt (decision + proposal).
- Create: `cowork-p2-kit/render/template-bound-review-docx.mjs` and
  `run-isolated-template-review.mjs` to retain the complete filled-template
  structure and append validated paragraph/table blocks under no-network isolation.
- Create: `cowork-p2-kit/render/formulation-review-contract.mjs` to require every
  P.2.2.1 section, missing-data state, watermark and provenance table.
- Create: `cowork-p2-kit/workflow-trial/formulation-review-verifier.mjs` to
  regenerate rationale/draft bindings and verify the materialized DOCX/receipts.
- Read/reuse unchanged: `cowork-p2-kit/render/contract.mjs` and
  `determinize-ooxml.mjs`.
- Do not modify: `cowork-p2-kit/render/contract.mjs` citation eligibility rules.
- Read/reuse: `cowork-p2-kit/render/normalize-ooxml.mjs` and isolated Bubblewrap path.
- Create tests: `cowork-p2-kit/workflow-trial/tests/formulation-selection-rationale.test.mjs` and render integration cases.

## Blast radius to protect

- Changing `validateCitation` would be CRITICAL (12 impacted symbols, 5 flows),
  so this plan explicitly avoids it.
- Rationale packet/publication changes remain additive and require all existing
  packet, claim-binding, output-preservation and render tests.

## Implementation steps

1. Write red tests: non-citable source used as a citation fails; proposal block
   text containing recommendation/winner/decision tokens fails; unbound 1%/3%/5%
   fails; a proposal block missing the watermark or `NOT FD APPROVED` fails.
2. Extend packet sealing additively for the Phase 3 diagnostic/proposal/data/
   compile hashes.
3. Generate bound evidence/context claims, the exact inconclusive fd_decision
   claim, and the watermarked engineering-proposal claim naming CT03; validate
   against permitted sources.
4. Validate internal provenance refs, then serialize them into ordinary review
   draft paragraph/table blocks with `citations:[]`.
5. Render under existing isolated/no-network path with the review-only marker and
   the `ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT` block.
6. Publish rationale and render through receipts bound to one run; test swapped
   decision, diagnostic, proposal, data package, rationale or DOCX failures.
7. Render twice from fresh roots and compare normalized OOXML manifests/hashes.

## Success criteria

- [x] G-04 passes.
- [x] Rationale explains evidence and the withheld FD decision without recommendation.
- [x] The render contains a watermarked engineering-proposal block that names CT03
  with `NOT FD APPROVED`, and no winner/decision language elsewhere.
- [x] Every numeric/composition claim is source-bound.
- [x] Render has zero public citation objects and complete internal provenance refs.
- [x] Source classification remains `public`, `citable:false` end to end.
- [x] Same-run/cross-artifact substitution tests fail closed.
- [x] Two normalized renders are identical.
- [x] Final DOCX is bound to both frozen DOCX files, retains all required filled
  values, and contains no unresolved semantic placeholder.
- [x] Page-level header marker and post-render rationale/DOCX substitution checks pass.

## Risk assessment

- Reviewer may read the CT03 proposal block as an FD decision → mandatory
  watermark, `NOT FD APPROVED` label, banned decision language and the separate
  inconclusive fd_decision claim right beside it.
- Internal references may accidentally enter citation validation → separate key,
  separate schema, `citations:[]` assertion.
- Additive packet fields may break frozen consumers → versioned optional/additive
  path plus complete rationale/render regressions.

## Security considerations

- Never launder classification to satisfy render validation.
- Reject absolute paths, symlinked publication roots and cross-run hashes.
- Render process remains no-network and repository read-only where supported.
