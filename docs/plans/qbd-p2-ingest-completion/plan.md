---
title: QbD P.2 ingest completion
workstream: qbd-p2-ingest-completion
status: in-progress
canonical: true
created: 2026-07-20
scope: phase-2-ingest-only
---

# QbD P.2 Ingest Completion

## Goal

Finish the Phase 2 ingest/store layer as tracked, testable source code. Preserve the current JSONL
record contract and default `npm run ingest` behavior while replacing the ignored 639-line monolith
with testable modules and closing all positive, negative, determinism, concurrency, and file-boundary
gates.

## Source-of-truth contract

- This file is the only source for execution scope, sequencing, and step status.
- [`gates.yaml`](./gates.yaml) is the only source for acceptance definitions and gate evidence.
- Step files define how to execute a step; they do not declare their own completion status.
- Reports are evidence or rationale only. They cannot override this plan.
- `docs/plans/OUTDATED/` and `docs/reports/OUTDATED/` are excluded from normal agent reads.

## Assumptions

- Phase 1 mock inputs and the JSONL record schema remain compatible.
- OCR execution remains deferred. Capability absence must be explicit; it must not be represented as
  successful OCR detection.
- Phase 3 render work is out of scope and its dirty files must not be modified except for a narrowly
  reviewed shared `package.json` script change.
- Real LiteParse is mandatory for integration and determinism gates; unit tests may inject an
  adapter only to exercise failure behavior.
- Implementation starts from the current worktree. No archived status claim is trusted.

## Scope

### In scope

- Move executable ingest source from ignored generated `store/` into tracked `cowork-p2-kit/ingest/`.
- Preserve `npm run ingest` as the user-facing command.
- Split configuration, admission, LiteParse invocation, record construction, and publication into
  modules below the repository's 200-line standard.
- Make input, manifest, store, and tool paths injectable for isolated tests.
- Use argument-array process execution; library modules throw typed errors and never call
  `process.exit()`.
- Add Node built-in test-runner coverage and retain evidence for every gate.
- Implement single-writer publication with unique sibling temp files and unconditional cleanup.

### Out of scope

- Phase 3 render remediation or viewer verification.
- Phase 4 reasoning and CTD drafting.
- OCR execution, OCR model download, or OCR egress proof.
- `qbd_core`, confidential corpus, or provider-routing work.
- Changes to the JSONL public contract unless separately approved.

## Planned modules

| Path | Responsibility |
|---|---|
| `cowork-p2-kit/ingest/cli.mjs` | Thin composition root and exit-code mapping |
| `cowork-p2-kit/ingest/config.mjs` | Resolved roots, binaries, and injected options |
| `cowork-p2-kit/ingest/errors.mjs` | Typed failure taxonomy |
| `cowork-p2-kit/ingest/admission.mjs` | Enumeration, manifest checks, and fail-closed admission |
| `cowork-p2-kit/ingest/liteparse-adapter.mjs` | Argument-array CLI invocation and capability discovery |
| `cowork-p2-kit/ingest/records.mjs` | Deterministic IDs, provenance, schema and round-trip checks |
| `cowork-p2-kit/ingest/publication.mjs` | Lock, unique temp, validation-before-rename, cleanup |
| `cowork-p2-kit/ingest/table-reconstruction.mjs` | Best-effort deterministic table reconstruction |
| `cowork-p2-kit/ingest/pipeline.mjs` | Injectable orchestration of admission, parsing, record construction, and publication |
| `cowork-p2-kit/ingest/tests/**` | Fixtures, unit, integration, negative, and concurrency gates |

## Ordered execution

| Step | Execution file | Status | Blocking gates |
|---|---|---|---|
| 1 | [Repository boundary and contract freeze](./step-01-repository-boundary-and-contract-freeze.md) | completed | G-01, G-02 |
| 2 | [Modularize ingest pipeline](./step-02-modularize-ingest-pipeline.md) | completed | G-03 |
| 3 | [Harden publication and file boundaries](./step-03-harden-publication-and-file-boundaries.md) | completed | G-04, G-05, G-06 |
| 4 | [Run isolated gate suite](./step-04-isolated-gate-suite.md) | completed | G-07, G-08, G-09, G-10 |
| 5 | [Code-review closure and handoff](./step-05-code-review-closure-and-handoff.md) | pending | G-11, G-12 |

Only this table may change step status. Valid transitions are `pending → in-progress → completed`;
`completed` requires all listed gates to be `pass` with readable, version-controlled evidence. A blocking
review may correct a premature `completed` claim back to `in-progress`; this correction is not an execution
transition and must name the blocking remediation in the applicable step file.

## Dependencies

1. Step 1 freezes compatibility and makes source trackable.
2. Step 2 may begin only after repository-boundary tests exist.
3. Step 3 depends on injected roots and typed errors from Step 2.
4. Step 4 runs after production behavior is complete; it cannot weaken a gate to accommodate code. Its
   canonical execution contract fixes the six G-07 child-CLI failures, real-LiteParse-only G-09 execution,
   and the complete evidence schema and ordered G-01 through G-10 runner.
5. Step 5 requires the full suite and a clean traceability review.

## Exit acceptance

Phase 2 is complete only when all of the following are true:

- G-01 through G-12 are `pass` and each evidence artifact exists.
- A fresh checkout contains every executable ingest source file.
- `npm run verify:ingest` passes using real LiteParse where specified.
- Two identical runs produce byte-identical JSONL.
- Every forced failure leaves the previously published store byte-identical.
- Concurrent invocations do not share, delete, or steal temp files.
- A valid optional-capability result is retained even when LiteParse uses a nonzero semantic exit; only a
  genuinely unavailable dependency is reported as unsupported and never treated as PASS.
- A fresh code review has no blocking Phase 2 finding.
- Phase 3 remains explicitly open and Phase 4 remains blocked by its own dependency chain.

## Risks and unknowns

- The current worktree contains overlapping uncommitted Phase 3 and workflow-state changes.
- GitNexus indexes symbols but currently has zero execution flows; runtime gates are authoritative.
- The fixed `records.jsonl.tmp` race has been reproduced; publication changes need failure and
  concurrency tests before refactoring is considered safe.
- The installed repo-local `is-complex` command emits valid JSON and exits 1 for complex pages. Step 4 must
  classify valid JSON as available before interpreting the exit status; only ENOENT/127 without valid JSON
  is unsupported, while malformed or otherwise unusable output is invalid.
- Gate evidence must be retained as version-controlled Step 5 review input rather than ignored local
  artifacts, and the runner must enforce the approved per-gate and suite deadlines.
- The first Step 4 completion claim is under blocking review remediation: trust-validation must be invalid,
  evidence/schema validation must be complete, the suite deadline must be hard, every suite test must be
  isolated, and the new tests/fixtures/evidence must be tracked before a replacement claim.
- The accepted TOCTOU hardening follow-up is intentionally outside Step 4; green gates do not close it.
- Package scripts are a shared-file boundary; inspect the existing diff before any implementation edit.

## Design basis

The approved design rationale is retained at
`docs/reports/qbd-p2-ingest-completion/design-basis.md`. It is rationale only; this plan and
`gates.yaml` win on execution details.
