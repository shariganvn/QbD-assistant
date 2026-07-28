---
title: Same-host TOCTOU hardening technical debt
id: D20260722
status: active
date: "2026-07-22"
scope: qbd-p2-ingest-completion
affects:
  - cowork-p2-kit/ingest/liteparse-adapter.mjs
  - cowork-p2-kit/ingest/publication.mjs
  - cowork-p2-kit/ingest/config.mjs
  - docs/plans/qbd-p2-ingest-completion/plan.md
  - cowork-p2-kit/render/render-docx.mjs
  - cowork-p2-kit/render/render-spike.mjs
  - cowork-p2-kit/ingest/cli.mjs
  - cowork-p2-kit/ingest/records.mjs
read_when: Before accepting untrusted input, changing publication locks, production rendering, citation-contract changes, or a claim of full historical Phase 2 compliance.
---

# D20260722 — Same-host TOCTOU Hardening

## Debt

Two same-host races remain outside the historical Phase 2 gate scope:

1. Between validating the configured LiteParse path/input and invoking LiteParse, another actor could
   replace a checked filesystem object.
2. During publication-lock cleanup, the process can identify a lock as its own and later remove a path
   that a non-cooperating same-host actor has replaced. The current implementation protects cooperating
   ingest writers and has focused G-04/G-05/G-06 regression coverage, but it cannot make a portable
   identity-bound unlink guarantee with the Node filesystem primitives used here.

The completed Phase 2 gates validate the cooperative-writer behaviour. They do not eliminate either
hostile same-host check-to-use race.

## Decision

Accept both races as open technical debt, outside the completed Phase 2 ingest scope. Do not describe the
Step 4 or Step 5 gates as closing them, and do not claim G-05 protects against a non-cooperating
same-host filesystem actor.

## Required follow-up

Before a future security-hardening release claims either boundary closed, define and review a design that
binds the object used for execution or removal to the object that was trusted. The design must include:

- a threat model distinguishing cooperative ingest writers from a hostile same-host actor with filesystem
  access;
- an explicit supported OS/filesystem model and ownership/permission assumptions;
- a platform-appropriate identity-bound publication-lock release design, rather than check-then-unlink;
- executable regression tests that replace both the public and private lock paths in the cleanup window;
- an equivalent trusted-object binding for LiteParse execution.

## Non-goals

This record neither weakens path admission nor changes the accepted LiteParse capability contract, JSONL
contract, or the cooperative-writer publication contract.

## Related Phase 3 readiness debt

The Phase 2 → Phase 3 readiness review records the following independent follow-ups. They are
accepted only for an isolated fidelity spike with committed public fixtures; none authorizes a
production draft render.

| ID | Finding | Required resolution before |
|---|---|---|
| R-01 | Structured-render input does not carry or enforce a cited record's `classification.citable`; the renderer cannot reject `citable:false` evidence. | Any production draft render. Define the citation input contract, reject uncitable evidence before output creation, and add an executable negative test. |
| R-02 | `evidenceLink` accepts arbitrary `http`/`https` targets; the required approved-public-URL policy is not encoded or tested. | Any production draft render. Define the approval source/policy, reject non-approved URLs, and add allow/deny tests. |
| R-03 | `render-spike.mjs` writes its report to obsolete repository-root `plans/...`, which violates the current `docs/plans` and `docs/reports` layout. | Running or attesting the fidelity spike. Route output to a tracked `docs/reports/...` path and verify no root `plans/` directory is created. |
| R-04 | Historical Phase 2 required a non-contract run log containing LiteParse path/version and OCR-eligibility markers. Current code exposes capability data only through the process result/stdout; no runtime artifact is retained. | Any claim of full compliance with the archived Phase 2 specification. Either restore a versioned/safe runtime artifact with tests or formally accept this as a modernization deviation. |

This section does not reopen G-01 through G-12, select a renderer, or declare Phase 3 fidelity,
offline, OOXML, or viewer gates passed. The review evidence is
`docs/reports/qbd-p2-ingest-completion/phase-02-to-phase-03-readiness-review-20260722.md`.
