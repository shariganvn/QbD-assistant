---
title: pharma-dev-draft tool boundary
id: D20260825
status: active
date: "2026-08-25"
scope: pharma-dev-draft
supersedes: null
affects:
  - tools/pharma-dev-draft/
read_when: Working on tools/pharma-dev-draft/, or deciding whether P.2.2/P.2.3 drafting capability
  belongs in cowork-p2-kit/.
---

# D20260825 — pharma-dev-draft tool boundary

## Decision

`tools/pharma-dev-draft/` is a standalone utility that drafts an internal, gap-flagged CTD
3.2.P.2 "Pharmaceutical Development" Word document from one user-supplied formulation/trial docx.
It is **not** part of "the system" described in D20260727 and D20260728, and it does not reopen,
narrow, or contradict either record. Specifically:

1. It never imports from `cowork-p2-kit/`, and nothing in `cowork-p2-kit/` imports from it. No
   shared code, no shared output directory, no shared CLI/store conventions.
2. It never claims FD approval, dossier-submission readiness, or "system"-level authority. Every
   rendered document carries a fixed, non-overridable scope-notice stating it is an internal
   draft, not FD-approved, not a dossier submission.
3. It never invents data. Any CTD 3.2.P.2 subsection not covered by the supplied source file is
   explicitly marked as a gap with a reason; general/pharmacopeial knowledge used to fill a gap
   (e.g. an API's known physicochemical constants) must be labeled as such in the text, distinct
   from what the source file actually states.
4. It draws its CTD taxonomy from `docs/raw/135-00-Pharmaceutical Development-example.docx`,
   inheriting the same "not yet FD/regulatory-affairs confirmed" caveat that
   `cowork-p2-kit/template/p2-template.md` already carries. It does not assert this taxonomy is
   authoritative.

## Why this doesn't conflict with D20260727/D20260728

Those records scope out P.2.2/P.2.3 drafting from the reasoning core (P4) and the rationale/report
layer — i.e. from the pipeline that ingests a bounded document package, compares formulations
under an FD-approved rubric, and produces decision rationale with citation/approval guarantees.
This tool does none of that: it does not ingest a package, does not compare or select formulations,
does not carry any approval or citation semantics, and produces no output inside `cowork-p2-kit/`.
It operates on exactly one supplied file at a time and always marks its own output as an
unapproved internal draft. "P.2.2/P.2.3 drafting remains a separately approved future workstream"
(D20260728) refers to that capability being added to the pipeline itself — this tool is
deliberately outside the pipeline, so it does not constitute that workstream.

## Consequences

- A contributor extending `cowork-p2-kit/render/` or `cowork-p2-kit/ingest/` to reuse anything
  from `tools/pharma-dev-draft/` (or vice versa) would blur this boundary and should treat that as
  a decision requiring its own review, not a routine refactor.
- If a future need arises to fold P.2-drafting into `cowork-p2-kit/` itself (e.g. citation-bound,
  FD-approved drafting as part of the pipeline), that remains the separately approved workstream
  D20260728 already anticipates — this record does not authorize that; it only explains why the
  standalone tool doesn't require reopening D20260727/D20260728 first.

## Related records

- `docs/decisions/D20260727-qbd-p4-reasoning-policy.md`
- `docs/decisions/D20260728-qbd-rationale-report-layer-boundary.md`
- `tools/pharma-dev-draft/README.md`
