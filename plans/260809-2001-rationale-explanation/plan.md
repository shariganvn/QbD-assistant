---
title: "Add auditable formulation rationale to review DOCX"
status: completed
priority: P1
---

# Outcome

Make the filled-template conclusion and appended review rationale explain, in
short source-bound form, why CT01 and CT02 fail the proposed dissolution
minimum gate and why CT03 is surfaced as a conditional engineering proposal.

## Constraints

- Keep the existing review-only, non-citable, `fd_decision: inconclusive`
  boundary when FD confirmation is unset.
- Do not expose hidden chain-of-thought or invent a free-form LLM narrative;
  emit an auditable reasoning summary from validated evidence and rules.
- Keep user-facing provenance concise: source document and logical section only;
  retain record IDs, offsets, and hashes in machine-readable artifacts, not in
  the FD reading flow.
- Preserve deterministic output, template binding, provenance, and existing
  public contracts unless the new rationale block is intentionally added.
- Do not overwrite the user's pre-existing worktree changes.

## Non-goals

- No change to scientific thresholds, rubric approval, or decision-engine
  semantics.
- No FD approval, winner, recommendation, or dossier claim.
- No new model/provider call.

## Acceptance criteria

- The original template conclusion states the proposed rule, CT01/CT02 failed
  values, CT03 supporting values, and the FD-approval boundary.
- The review addendum contains a compact reasoning summary/table with the same
  source-bound values and an explicit diagnostic-only boundary for dissolution
  maximum.
- The visible provenance block names the source document and logical section
  without SHA, record, offset, or internal receipt columns; machine artifacts
  remain fully bound and verifiable.
- Draft and render contracts reject removal or incompleteness of the new
  reasoning block.
- Focused tests, full formulation tests, post-render verification, and a fresh
  DOCX parse pass.
- Canonical inputs/store/outputs and pre-existing dirty files remain unchanged.

## Files

- `cowork-p2-kit/render/formulation-proposal-reasoning.mjs` — shared deterministic summary helper.
- `cowork-p2-kit/workflow-trial/formulation-selection-review-draft.mjs` — emit the rationale summary/table.
- `cowork-p2-kit/render/template-bound-review-docx.mjs` — bind the expanded conclusion into the filled template.
- `cowork-p2-kit/render/formulation-review-contract.mjs` — validate required rationale content.
- `cowork-p2-kit/workflow-trial/tests/formulation-selection-template-binding.test.mjs` — regression assertions.

## Validation

1. `node --check` touched modules.
2. Focused template-binding/render test.
3. `npm run test:formulation`.
4. Fresh full workflow with `--emit rationale,render`.
5. Post-render verifier, `unzip -t`, `lit parse`, and canonical-state/worktree checks.

## Result

- Focused render/rationale/template-binding tests: 17/17 pass.
- Full formulation workflow suite: 93/93 pass.
- Final DOCX verifier and ZIP integrity checks: pass.
- Visible DOCX contains concise Vietnamese reasoning and source/section
  provenance only; machine-readable rationale retains the detailed bindings.

## Rollback

Revert only the files listed above and remove the new plan pointer if the
reasoning contract cannot remain deterministic and source-bound.
