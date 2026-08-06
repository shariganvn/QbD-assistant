---
title: "Template to DOCX End-to-End Trial"
description: "Prove one isolated public/synthetic DOCX can traverse template extraction, ingest, inconclusive reasoning, sealed rationale, and deterministic DOCX rendering without changing canonical state."
status: pending
priority: P1
effort: "4-6d"
issue: null
branch: master
tags: [feature, experimental, backend, critical]
blockedBy: []
blocks: []
created: 2026-08-05
---

# Template to DOCX End-to-End Trial

## Overview

Build a truthful internal-only connectivity trial around the frozen placeholder
template and filled public/mock DOCX. The receipt never becomes a synthetic
record. Template probe and ingest read byte-identical copies independently. A
test-local join proves document-level lineage and reports each occurrence as
`exact`, `unmapped`, or `ambiguous`; under the pinned toolchain the accepted
baseline is three exact and two unmapped entries. Downstream output is expected
to be `inconclusive`, `internal_only`, fact-free, and non-citable.

```text
filled DOCX ─┬─> template map + receipt ─┐
             └─> ingest records ────────┴─> same-source join
                                            (3 exact, 2 unmapped)
                                             │
approved test-only profile/context card ─────┴─> reasoning package
                                                     │
                                              sealed packet
                                                     │
                                      packet-only test author
                                      (manual separate context optional)
                                                     │
                                        rationale package
                                                     │
                                      internal draft -> DOCX
```

## Scope

- In: fixed five-field public/synthetic mock, isolated roots, document-level
  lineage, honest partial occurrence mapping, one-candidate inconclusive
  reasoning, automated packet-only rationale wiring, internal render, two-run
  determinism, and cross-stage fail-closed negatives.
- Out: arbitrary templates, schema migration, canonical admission/promotion,
  rubric approval, selected formula claim, external display, P.2.2/P.2.3 dossier,
  OCR expansion, fuzzy matching, model/network calls inside `.mjs`, retained
  gate refresh, machine-verifiable author-session attestation, and hostile
  same-host filesystem race hardening.
- Assumption: success means structural connectivity only. It does not make the
  mock citable or establish FD/scientific correctness.

## Approved Junior-Level Trade-off

- What changes: preserve all five receipt entries, but map only values that
  LiteParse actually returns byte-exactly. The other two remain `unmapped`.
- What we gain: the chain can run without invented page numbers, fake quotes,
  fuzzy matching, or a public schema migration.
- What we give up: this trial cannot claim field-level provenance for all five
  placeholders and cannot prove a production-ready template-to-evidence flow.
- Why acceptable: the requested outcome is a safe internal wiring test. A true
  five-of-five production bridge requires a separate provenance design decision.

## Phases

| # | Phase | Status | Depends on |
|---|---|---|---|
| 1 | [Freeze trial contract and prove feasibility](./phase-01-start.md) | Pending | — |
| 2 | [Build isolated same-source template and ingest run](./phase-02-build-isolated-same-source-template-and-ingest-run.md) | Pending | 1 |
| 3 | [Report truthful same-source occurrence matches](./phase-03-bind-receipt-occurrences-to-truthful-ingest-records.md) | Pending | 2 |
| 4 | [Publish inconclusive reasoning package and seal packet](./phase-04-publish-inconclusive-reasoning-package-and-seal-packet.md) | Pending | 3 |
| 5 | [Publish packet-only rationale and record optional manual separation](./phase-05-run-separate-rationale-authoring-and-publication.md) | Pending | 4 |
| 6 | [Adapt internal rationale and render DOCX](./phase-06-adapt-internal-rationale-and-render-docx.md) | Pending | 5 |
| 7 | [Prove full-chain determinism and close review](./phase-07-prove-full-chain-determinism-and-close-review.md) | Pending | 6 |

## Success Criteria

- [ ] One command runs two complete fresh-root trials and exits `0`.
- [ ] Receipt and records bind to the same DOCX hash; the pinned baseline is
      exactly three `exact`, two `unmapped`, and zero `ambiguous` entries.
- [ ] Each `exact` entry has real record/page/offset/quote evidence; each
      `unmapped` entry has no fabricated record ID or page projection.
- [ ] Decision is deterministically `inconclusive`; rationale stays
      `internal_only`, contains zero `fact` claims, and renders with no citations.
- [ ] Stable JSON and normalized OOXML manifests match across runs; raw DOCX
      hashes are recorded diagnostically, not required to match.
- [ ] No controller-started direct child or temp/lock/backup member remains; the
      fixed-fixture trial does not claim hostile descendant-process attestation.
- [ ] Canonical inputs/store/outputs/report roots and the pre-existing 18 dirty
      files are byte-identical before/after focused acceptance.

## Dependencies

- Completed authorities: placeholder probe, P2 ingest, P4 reasoning, rationale,
  and P3 render plans under `docs/plans/`.
- Runtime: Node 22, LiteParse, LibreOffice, Ghostscript, Tesseract data, and
  usable Bubblewrap. Missing dependency is a hard failure; no network install.
- Research: [`research/`](./research/) records boundary and isolation evidence.

## Open Questions

None blocking after the user's 2026-08-05 approval of document-level lineage
with a three-exact/two-unmapped baseline. Citable promotion, native OOXML
provenance, approved rubric, real formulation selection, external display, and
dossier drafting remain future user/PO/FD decisions.

## Red Team Review

### Session — 2026-08-05

**Findings:** 15 (14 accepted, 1 rejected)
**Severity breakdown:** 2 Critical, 11 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Five-of-five exact mapping is empirically impossible | Critical | Accept | Plan, Phases 1-3, 7 |
| 2 | `citable:false` is lost before rationale authorization | Critical | Accept with zero-fact trial guard | Phases 4-6 |
| 3 | Candidate/profile values are business-owned | High | Accept as visibly synthetic test-only policy | Phases 1, 4 |
| 4 | `context` roles can still enter scoring | High | Accept with proposal rubric and pre-matrix inconclusive assertion | Phase 4 |
| 5 | Current render sandbox rejects the planned temp layout | High | Accept | Phase 6 |
| 6 | Current timeout does not prove descendant cleanup | High | Accept fixed-fixture limitation; require direct timeout/root preservation without claiming descendant attestation | Phases 2, 7 |
| 7 | Packet sealing has no same-root rollback | High | Accept by requiring a fresh empty packet root | Phase 4 |
| 8 | Automated tests cannot prove a separate human context | High | Accept; manual evidence is procedural only | Phase 5 |
| 9 | Raw DOCX hash equality is not the renderer contract | High | Accept | Phases 6, 7 |
| 10 | Successful cleanup conflicts with manual inspection | High | Accept by separating optional review retention | Phases 5, 7 |
| 11 | A standalone binding sidecar is not consumed downstream | High | Accept; keep join inside controller diagnostics | Phase 3 |
| 12 | E2E duplicates mature layer-local negative suites | High | Accept; retain cross-stage negatives only | Phase 7 |
| 13 | Trial was prematurely promoted to scripts/docs | High | Accept; direct test command first | Phase 7 |
| 14 | Hostile same-host root swapping needs stronger primitives | Medium | Reject as outside cooperative-writer trial threat model | Scope |
| 15 | Three versioned policy fixtures are pseudo-contracts | Medium | Accept; use one validated inline test policy | Phases 2, 4, 5 |

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all seven `phase-*.md` files.
- Decision deltas checked: partial mapping, zero-fact rationale, synthetic policy,
  proposal-rubric early exit, normalized OOXML, procedural manual review, and
  reduced file surface.
- Reconciled stale references: 11 (five-of-five mapping, standalone sidecar,
  fact-capable rationale, mandatory manual context, raw DOCX equality, public
  npm/docs promotion, policy fixtures, packet rollback, phase names, controller
  command, and optional artifact retention).
- Unresolved contradictions: 0.

## Validation Log

### Verification Results — 2026-08-05

- Tier: Full (7 phases); broader verification reused the four evidence-backed
  red-team roles, then rechecked six decision-critical claims.
- Claims checked in targeted recheck: 6.
- Verified: 6 | Failed: 0 | Unverified: 0.
- Evidence:
  - LiteParse 2.0.0 yields three exact and two absent raw values:
    `research/template-ingest-contract-research.md:59`.
  - Proposal rubric exits before matrix construction:
    `cowork-p2-kit/reasoning/decision-engine.mjs:126`.
  - Rationale packet omits classification but permits fact-card sources:
    `cowork-p2-kit/rationale/packet.mjs:11` and `:110`.
  - Candidate reasoning requires a complete profile:
    `cowork-p2-kit/reasoning/cohort-evidence.mjs:19`.
  - Existing isolated render rejects external draft/nested temp layouts:
    `cowork-p2-kit/render/run-isolated-spike.mjs:103` and `:125`.
  - Renderer determinism contract compares normalized manifests while raw hashes
    are diagnostic: `cowork-p2-kit/render/tests/determinism.test.mjs:93`.

### Session 1 — 2026-08-05

**Trigger:** User requested a four-question pre-implementation validation interview.
**Questions asked:** 4

#### Questions & Answers

1. **[Risk]** If a newer LiteParse changes the result away from three exact and
   two unmapped occurrences, what should the test do?
   - Options: A. Fail and require review (Recommended) | B. Accept any count with
     no ambiguity | C. Require at least three exact
   - **Answer:** A — fail and require review.
   - **Rationale:** Prevents a tool upgrade from silently changing provenance.
2. **[Assumption]** Where should the reasoning candidate profile come from?
   - Options: A. `trial-candidate-01` with visibly synthetic/test-only values
     (Recommended) | B. Wait for a real PO/FD profile | C. Reuse existing `F-01`
   - **Answer:** A — use a visibly synthetic/test-only profile.
   - **Rationale:** Enables structural wiring without fabricating a scientific identity.
3. **[Security/Scope]** How much sandboxing should template and ingest receive?
   - Options: A. Bubblewrap the whole pipeline | B. Hash-pin DOCX, isolated roots,
     and timeouts for template/ingest; require Bubblewrap for render (Recommended)
     | C. No sandbox
   - **Answer:** B — scoped isolation for the fixed fixture; Bubblewrap at render.
   - **Rationale:** KISS for the hash-pinned trial while preserving the existing
     fail-closed render network boundary. Arbitrary future templates require A.
4. **[Acceptance]** What should happen to the generated DOCX after automated success?
   - Options: A. Cleanup by default; create a review bundle only on explicit
     request (Recommended) | B. Always cleanup | C. Require manual Cowork review
   - **Answer:** A — cleanup by default with opt-in review retention.
   - **Rationale:** Keeps CI clean while allowing deliberate human DOCX inspection.

#### Confirmed Decisions

- Mapping drift: strict 3/2/0 baseline; any drift blocks and requires review.
- Candidate identity: `trial-candidate-01` with explicit synthetic/test-only values.
- Isolation: hash pin + roots + timeouts for template/ingest; Bubblewrap for render.
- Artifacts: ephemeral by default; immutable review bundle only when requested.

#### Action Items

- [x] Propagate scoped template/ingest isolation to Phase 2.
- [x] Preserve mandatory render Bubblewrap in Phase 6.
- [x] Preserve optional review bundle behavior in Phases 5 and 7.
- [x] Run whole-plan consistency sweep.

#### Impact on Phases

- Phase 1: strict tool/version drift gate and synthetic profile confirmed.
- Phase 2: no whole-pipeline Bubblewrap; fixed-fixture hash/root/timeout boundary.
- Phase 6: render remains fail-closed under Bubblewrap.
- Phase 7: default cleanup plus explicit opt-in review bundle confirmed.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all seven `phase-*.md` files.
- Decision deltas checked: 4 (strict 3/2/0 drift gate, synthetic candidate,
  scoped template/ingest isolation, and opt-in review retention).
- Reconciled stale references: 4 (whole-pipeline sandbox, process-group cleanup,
  render-only network isolation, and review artifact lifetime).
- Unresolved contradictions: 0.

<!-- slug: template-to-docx-end-to-end-trial -->
