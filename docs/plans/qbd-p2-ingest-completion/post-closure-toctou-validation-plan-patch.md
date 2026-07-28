---
title: Post-closure P2 TOCTOU validation — plan patch
status: completed
canonical_plan: docs/plans/qbd-p2-ingest-completion/plan.md
decision: docs/decisions/D20260722-qbd-p2-ingest-toctou-tech-debt.md
---

# Plan patch — validate and close P2 changes before spec-diff review

## Goal

Validate the bounded cooperative-writer, file-boundary, and publication-cleanup changes now
present in the P2 worktree; close that implementation session with an accepting, isolated
verdict. Only then open the separate publication-lock spec-diff review.

This patch does **not** reopen the historical P2 completion table, close D20260722, or
authorize a hostile same-host safety claim.

## Verified scope

| Area | Files |
|---|---|
| Recursive input and artifact-root boundaries | `cowork-p2-kit/ingest/admission.mjs`, `cowork-p2-kit/ingest/config.mjs`, `cowork-p2-kit/ingest/tests/file-boundaries.test.mjs` |
| Publication cleanup and cooperative lock handling | `cowork-p2-kit/ingest/publication.mjs`, `cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs`, `cowork-p2-kit/ingest/tests/publication-failure.test.mjs` |
| Fresh evidence and execution records | `docs/reports/qbd-p2-ingest-completion/gates/G-01.json` through `G-10.json`, `suite.json`, a new canonical P2 test-plan record, its progress event, and an attested verdict bundle |

Do not include the dirty P3 gate evidence, P4 files, or `.codex/hooks.json` in this work.
Defer `D20260722`, `docs/plans/qbd-p2-ingest-completion/plan.md`,
`docs/reports/qbd-p2-ingest-completion/code-review.md`, and the spec-diff report as
review outputs until the closeout checkpoint below has completed.

## Impact and assumptions

- `filesIn` has one direct caller (`admitInputs`) and reaches the CLI ingest flow plus
  `pipeline.test.mjs` and `file-boundaries.test.mjs`.
- `publishRecords` has three direct test callers; `releaseOwnedLock` feeds directly into
  `publishRecords` and its publication-failure/concurrency/boundary tests.
- GitNexus rates the individual symbols LOW; the combined dirty P2 worktree is MEDIUM because
  it affects four ingest execution flows. Treat runtime evidence as the release gate.
- The current lock-release logic may improve cooperative behaviour only. A portable,
  identity-bound unlink guarantee for a hostile same-host actor remains deferred by D20260722.

## Ordered execution

1. Freeze the file list above. Run GitNexus impact for every symbol changed after this patch;
   inspect the direct callers before any further code edit. Do not stage or rewrite P3 evidence.
2. Create a temporary isolated worktree from the current HEAD and replay only the six scoped P2
   source/test diffs into it. Run the full `npm run verify:ingest` there through
   `baton verdict --root "$PWD" --session-id <session> -- npm --prefix <isolated-root> run verify:ingest`.
   Validate the resulting `artifacts/<session>/test-verdict.json`; it must be accepting and
   the primary worktree must remain stable during the verdict command.
3. Bring the machine-produced P2 gate evidence from that isolated run into the primary worktree
   without importing unrelated P3 evidence. Update a new canonical P2 test-plan record with the
   verdict path and actual counts, point `docs/test-plans/active.yaml` to it, append one progress
   event, then run both workflow/test-plan renderers and their `--check` modes.
4. **Closeout checkpoint — required before spec-diff review.** Run `git diff --check`,
   GitNexus `detect_changes`, and mandatory Devil’s Advocate review (file-boundary and lock
   cleanup are security-sensitive). Resolve blocking findings, then perform the normal C1 →
   handoff/reconcile → C2 closeout with only the verified P2 scope and its evidence. The handoff
   must name the spec-diff review as the next pickup.
5. In a new reconciled session, review the committed P2 diff and fresh evidence against
   D20260722, then update or create the publication-lock spec-diff report. Its verdict may
   describe cooperative-writer behaviour; it must not state that hostile same-host TOCTOU is
   closed unless a separately approved identity-bound design and tests exist.

## Acceptance checkpoints

- The isolated full P2 suite passes; G-01 through G-10 evidence and `suite.json` are fresh,
  readable, and match the tested source.
- Nested symlink/unsupported-input rejection, artifact-root rejection, locked-writer
  non-mutation, stale-live-lock fail-closed handling, recursive preservation on failure, and
  late lock replacement all have passing executable coverage.
- The verdict is accepting, the generated views are current, and reconciliation succeeds before
  spec-diff review begins.
- No commit or report claims D20260722 is resolved, and no P3/P4 evidence is bundled into P2
  closeout.
