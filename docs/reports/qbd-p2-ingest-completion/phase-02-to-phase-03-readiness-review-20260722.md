---
title: "Phase 2 to Phase 3 readiness spec-diff review"
date: 2026-07-22
status: completed
review_type: historical-roadmap-entry-gate
spec_phase_2: docs/plans/OUTDATED/260713-1034-qbd-p2-cowork-mvp/phase-02-ingest-and-store-layer-liteparse.md
spec_phase_3: docs/plans/OUTDATED/260713-1034-qbd-p2-cowork-mvp/phase-03-render-spike-and-layer-node-docx.md
canonical_phase_2_evidence: docs/plans/qbd-p2-ingest-completion/gates.yaml
---

# Phase 2 → Phase 3 readiness review

## Purpose and boundary

This is a read-only historical-roadmap entry-gate review. It determines whether the completed
ingest/store implementation supplies a safe, usable input contract for the archived Phase 3
render spike. It does not reopen or change the canonical `qbd-p2-ingest-completion` plan, its
gate statuses, or Phase 3 implementation scope.

The canonical plan and gates remain the source of truth for completed ingest work. The two
phase-level documents above are historical specifications used only to derive this readiness
check.

## Review protocol

1. **Freeze inputs.** Record `HEAD`, worktree state, the archived Phase 2/3 specifications, and
   the canonical gate/evidence set. Exclude unrelated working-tree changes from conclusions.
2. **Establish fresh verification.** Run `npm run verify:ingest`; accept no prior green result as
   proof. Require exit 0 and inspect the suite result for failed, skipped, todo, cancelled, or
   timed-out tests.
3. **Spec compliance matrix.** Map every Phase 2 success criterion relevant to a renderer input
   to current code, focused tests, and retained G-01 through G-12 evidence. Mark each item `met`,
   `modernized-equivalent`, `deferred`, or `missing`.
4. **Consumer-contract review.** Trace the renderer's input parsing and citation validation
   against the current record schema and representative JSONL. Confirm relative provenance,
   mandatory page/offset/quote anchors, `label`/`citable`, public-URL-only links, and rejection of
   local/absolute/file links and uncitable references.
5. **Boundary and debt review.** Separate accepted Phase 2 deferrals and technical debt from
   Phase 3 blockers. In particular, validate that deferred OCR does not fabricate evidence and
   that the retained LiteParse TOCTOU debt is explicitly dispositioned.
6. **Issue a constrained verdict.** Return `GO`, `CONDITIONAL GO`, or `NO-GO`, with exact evidence
   for every condition. A positive result authorizes only the Phase 3 fidelity spike; it does not
   waive Phase 3 offline, OOXML, or viewer verification.

## Acceptance rule

`GO` requires the fresh ingest suite plus a renderer-consumable, safe record/citation contract.
`CONDITIONAL GO` permits only the isolated Phase 3 fidelity spike using committed public fixtures,
with any missing contract assertion named as a prerequisite for production rendering. `NO-GO`
requires a Phase 2 contract remediation before Phase 3 work begins.

## Fresh verification

`npm run verify:ingest` ran on 2026-07-22 against `53da09d09fba0917984ba4d6d53b8408a2800d76`.
The ordered G-01 through G-10 suite completed in 119,266 ms with exit code 0, no failed gate, no
timeout, and no skipped, todo, or cancelled test. Its fresh suite ID is
`d840fb50-529c-4d6c-99b8-9289a5a68b31`; the suite refreshed G-01 through G-10 evidence and
`suite.json`.

## Phase 2 spec-compliance matrix

| Historical Phase 2 requirement | Status | Current evidence |
|---|---|---|
| Deterministic JSONL with schema, relative provenance, page offsets, quotes, and `{label, citable}` | met | G-02 freezes the record contract; G-09 executes two isolated real-LiteParse child CLIs and compares byte-identical, schema-valid JSONL with successful round trips. |
| Fail-closed admission; public/citable manifest metadata; no unsupported input reaches the parser or store | met | `admission.mjs`; G-06 path/binary boundary checks; fresh G-07 real-child-CLI rejection cases preserve the seeded store. |
| Complexity detection without OCR execution; valid nonzero `is-complex` results remain usable | modernized-equivalent | `liteparse-adapter.mjs` and fresh G-08 distinguish available, unsupported, and invalid outcomes and assert no OCR subcommand. |
| Table reconstruction is deterministic, or a text-and-quote fallback is documented | met | `table-reconstruction.mjs` is best effort; `store/README.md` explicitly records partial reconstruction and defers canonical matrix structuring to Phase 4. |
| Atomic, non-empty, schema-valid publication and stable round-trip anchors | met | `publication.mjs`; G-04/G-05 and G-09 cover failure preservation, single-writer cleanup, schema validation, determinism, and round trips. |
| Persist the resolved LiteParse path/version and OCR-eligibility markers in a non-contract run log | missing | Current code returns/prints `capabilities.ocrEligible`; no run-log writer or persisted path/version record exists. The modern gate evidence is a useful audit substitute but not the historical runtime-artifact requirement. |

## Phase 3 consumer-contract review

The ingest contract is safe for a fixture-only render spike: all fixture records have mandatory,
relative provenance and a boolean `classification.citable`; the demo path selects only citable,
successfully extracted records and produces local provenance as plain text.

The following Phase 3 implementation gaps prevent a production-render GO:

1. `render-docx.mjs` validates citation index and URL syntax, but does not carry or reject a
   cited record's `citable:false` status. The archived Phase 3 remediation explicitly requires
   this rejection.
2. The renderer accepts any `http`/`https` URL; it does not establish that the target is an
   approved public URL as required by the Phase 3 contract.
3. `render-spike.mjs` writes its generated report to the obsolete repository-root `plans/...`
   path, rather than the current `docs/...` layout. Running it would recreate documentation
   drift.

## Debt disposition

The accepted LiteParse same-host TOCTOU race in D20260722 remains open. It is not closed by this
review and is not a blocker for an isolated Phase 3 fidelity spike; it must not be described as
resolved by Phase 2 verification.

The renderer-contract and historical run-log findings are tracked in the
[related Phase 3 readiness debt](../../decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md#related-phase-3-readiness-debt).

## Verdict

**CONDITIONAL GO — Phase 3 fidelity spike only.** Phase 2 has fresh, executable evidence for the
record contract and its safety boundaries. Phase 3 may begin using committed public fixtures, but
must close the three consumer-contract issues above before it renders a production draft or claims
the archived Phase 3 acceptance criteria. The missing historical run-log artifact should be
explicitly accepted as a modernization deviation or restored before the project claims full
historical Phase 2 compliance.
