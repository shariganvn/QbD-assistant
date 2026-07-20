---
title: "Brainstorm — Phase 2 ingest completion after failed code review"
status: approved
created: 2026-07-17
approved_by: user
scope: phase-2-ingest
---

# Brainstorm — Phase 2 ingest completion

## Problem

Phase 1–3 are execution phases inside the existing Cowork MVP plan. Phase 2 and Phase 3 have
implementation artifacts, but neither may be treated as code-review complete. This decision record
only covers **Phase 2 — ingest/store**. Phase 3 remains a separate open review gate.

The old plan and its reports contain contradictory status claims:

- the Phase 2 file is `in-progress` and its success checklist is open;
- the aggregate plan and implementation notes contain `Done` / `All gates pass` language;
- the same implementation notes admit that required negative tests were not run;
- the latest `store/run-log.json` records an atomic rename failure;
- `store/ingest.mjs` exists locally but is ignored by `cowork-p2-kit/.gitignore`.

For the new edition, executable evidence outranks status prose.

## Confirmed requirements

| Requirement | Decision |
|---|---|
| Expected artifact | Single canonical package at `docs/plans/qbd-p2-ingest-completion/`; old material quarantined under `OUTDATED` |
| Completion meaning | Source tracked, all positive/negative/determinism/security gates pass, fresh code review has no blocking findings |
| Scope | Phase 2 ingest/store only |
| Out of scope | Phase 3 remediation, Phase 4 reasoning, OCR execution, `qbd_core`, real confidential corpus |
| Implementation direction | Modularize the 639-line ingest script; do not keep patching the monolith |
| Compatibility | Preserve the JSONL record contract and default `npm run ingest` behavior |

## Codebase findings

1. Existing useful work: deterministic IDs, provenance offsets, classification fields, JSON schema,
   round-trip concept, best-effort table reconstruction, and an atomic-publication intent.
2. GitNexus upstream impact for `deterministicId`, `writeRunLog`, `enumerateAllFiles`,
   `tryReconstructTable`, and `splitIntoSegments` is **LOW**: one direct caller each, all inside the
   current monolith, no detected cross-module process.
3. `ingest.mjs` is 639 lines while the active standard says code files stay under 200 lines.
4. The installed CLI does not expose the planned `is-complex` capability. Warning and continuing
   with an empty eligibility list is not a valid passing gate.
5. The current shared `records.jsonl.tmp` name permits writer races. The most recent run log shows
   `ENOENT` during rename, consistent with a shared-temp collision; the cause must be reproduced,
   not assumed.

## Options evaluated

### A. Minimal patch to the monolith

Pros: smallest initial diff. Cons: preserves the ignored-source problem, poor test seams, shared
mutable state, and the file-size violation. Rejected.

### B. Modularize and close every review gate

Move executable source out of generated `store/`, split pure contracts from side effects, inject
roots/adapters for isolated tests, harden publication and file boundaries, then rerun review.

Pros: directly addresses review failures; preserves existing contracts; enables reliable negative
tests. Cons: larger diff than a patch and requires careful package-script coordination with the
dirty Phase 3 worktree. **Approved.**

### C. Rewrite Layer A in Python

Pros: closer to future `qbd_core`. Cons: changes runtime and scope, duplicates the MVP effort, and
does not help finish the current Phase 2. Rejected.

## Approved design

- Source code moves to `cowork-p2-kit/ingest/`; `store/` remains generated-data plus schema/docs.
- The CLI is a thin composition root. Library modules throw typed errors; only the CLI decides the
  exit code. No library helper calls `process.exit()`.
- Parser invocation uses argument arrays (`execFile`/`spawn`), never a shell command string.
- Input, manifest, and store roots are configurable so negative tests operate only in temporary
  directories.
- Publication uses a single-writer lock, a unique sibling temp file, validation before rename, and
  unconditional cleanup in `finally`.
- The prior published store must remain byte-identical after every failing case.
- `is-complex` is capability-detected and reported explicitly as supported/unsupported. Because OCR
  execution is deferred, Phase 2 must not fabricate OCR-eligibility data when the capability is
  absent. Text-absence handling is based on actual parse output.
- Full schema validation is mechanical. If a JSON-schema dependency is added, it must be direct,
  exact-pinned, documented, and coordinated with Phase 3's existing package changes.
- Tests use Node's built-in test runner; real LiteParse remains mandatory for the positive and
  deterministic integration gates.

The official LiteParse CLI reference checked on 2026-07-17 documents `parse`, `batch-parse`, and
`screenshot`, but not `is-complex`: https://github.com/run-llama/liteparse

## Success criteria

- A fresh clone contains all Phase 2 executable source.
- The default mock workflow produces a non-empty, schema-valid, round-trippable store.
- Two isolated runs over identical inputs produce byte-identical JSONL.
- Every required negative and security case exits nonzero without changing the prior store.
- Concurrent writers cannot share or steal a temp file.
- A fresh `ck:code-review` reports no blocking Phase 2 findings.
- Phase 3 stays explicitly open; Phase 4 remains blocked until both Phase 2 and Phase 3 reviews pass.
