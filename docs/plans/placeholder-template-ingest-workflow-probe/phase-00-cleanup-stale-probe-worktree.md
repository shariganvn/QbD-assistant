---
phase: 0
title: "Clean up stale probe worktree"
status: completed
priority: P1
effort: "1-2h"
dependencies: []
---

# Phase 00: Clean up stale probe worktree

<!-- Updated: Validation Session 1 - plan relocated to docs/plans/; context links made absolute; new probe code lives in cowork-p2-kit/template-probe/, not preprocess/ -->

## Context links

- Superseded plan: `../../../artifacts/260804-1207-placeholder-template-ingest-workflow-probe/quarantine/plans/260803-1903-p0-preprocess-public-formulation-docx-workflow-probe/plan.md`
- Prior test finding: `../../../artifacts/260804-1207-placeholder-template-ingest-workflow-probe/quarantine/plans/reports/tester-260803-1903-p0-preprocess-public-formulation-docx-workflow-probe.md`

## Overview

Remove the unfinished wide-table probe from the active worktree without losing
recoverability. Preserve evidence first, then restore only explicitly inventoried
tracked session artifacts and quarantine only explicitly inventoried untracked WIP.

## Requirements

- Functional: inventory every dirty path and classify it as stale probe WIP,
  session bookkeeping, or current authorized plan work.
- Functional: create a recoverable patch/archive or targeted stash with a path
  manifest and checksum before moving or restoring anything.
- Non-functional: never use `git reset --hard`, broad `git clean`, wildcard
  deletion, or overwrite unrelated user changes.

## Architecture

Phase 00 is a repository hygiene boundary only. Quarantine stale untracked files
under an ignored, session-specific artifact directory (or an equivalent targeted
stash), preserve tracked diffs separately, then restore tracked bookkeeping from
`HEAD` by explicit path. The new plan directory remains active work.

## Related code files

- Quarantine: `../../../artifacts/260804-1207-placeholder-template-ingest-workflow-probe/quarantine/cowork-p2-kit/preprocess/`
- Quarantine: `../../../artifacts/260804-1207-placeholder-template-ingest-workflow-probe/quarantine/plans/260803-1903-p0-preprocess-public-formulation-docx-workflow-probe/`
- Quarantine: `../../../artifacts/260804-1207-placeholder-template-ingest-workflow-probe/quarantine/plans/reports/tester-260803-1903-p0-preprocess-public-formulation-docx-workflow-probe.md`
- Restore after capture: `/media/E/VIBECODING/MODULE3-agent/BUG_REPORT.md`
- Restore after capture: `/media/E/VIBECODING/MODULE3-agent/session-handoff.yaml`
- Restore after capture: `/media/E/VIBECODING/MODULE3-agent/docs/.session-state.md`

## Implementation Steps

1. Capture `git status --short --untracked-files=all` and verify no unexpected
   path overlaps the cleanup scope.
2. Save tracked binary patch plus an explicit untracked-file manifest and
   checksums in an ignored recovery artifact or targeted stash.
3. Move the stale preprocess implementation, old plan, and old tester report to
   recoverable quarantine by exact path; do not delete them.
4. Restore the three tracked session bookkeeping files from `HEAD` only after
   confirming their patch is recoverable.
5. Verify status contains the new plan/current authorized work only. Record the
   recovery location in Phase 00 evidence without copying stale claims forward.

## Todo

- [x] Dirty-path inventory reviewed against exact cleanup allowlist.
- [x] Recovery patch/archive created and checksum recorded.
- [x] Stale WIP removed from active paths without deletion.
- [x] Tracked session bookkeeping restored to committed baseline.
- [x] Post-cleanup status shows no unexplained paths.

## Evidence — 2026-08-04

- Pre-cleanup inventory and complete untracked manifest: local recovery bundle
  `artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/`.
- Tracked bookkeeping patch: `tracked-bookkeeping.patch`, SHA-256
  `d082a5bc6864822840f99e75d04f60bb8b8b8a914ab3508fcf3979a961ba0b6f`.
- Stale WIP archive: `stale-wip.tar`, checksum verified against
  `stale-wip.tar.sha256`; its 16 file hashes match `stale-wip-sha256.txt`.
- The active Phase 00 file’s original bytes were verified against the complete
  untracked manifest (`48b2b928…70cb8`) and retained as `phase-00-pre-cleanup.md`
  plus `phase-00-pre-cleanup.tar` in the same recovery bundle.
- The original active `plan.md` likewise matches its recorded hash
  (`80eeaa3a…b75040`) and is retained as `plan-pre-cleanup.md` plus
  `plan-pre-cleanup.tar`.
- Recoverable quarantine: `artifacts/260804-1207-placeholder-template-ingest-workflow-probe/quarantine/`.
- Post-cleanup `git status --short --untracked-files=all` contains only the
  seven files in this active plan directory; `git diff --check` is clean.
- `cowork-p2-kit/preprocess/`, the superseded `plans/260803-1903.../` tree,
  and the superseded tester report are absent from active paths. No committed
  source, canonical input, or store content changed.

## Closeout verification — 2026-08-04

- Attested cleanup validation: `artifacts/260804-1418/test-verdict.json`
  (`passed`, exit-code-only evidence; framework test counts are unavailable).
- Rechecked the stale-WIP archive SHA-256, all 16 archived-file SHA-256 values,
  pre-cleanup plan snapshot checksums, obsolete active paths, and `git diff --check`.
- The earlier `phase-00-post-completion.md` recovery snapshot predates the
  plan-relocation and context-link corrections; it is retained as recovery
  evidence and is not the authoritative completed Phase 00 document.

## Success Criteria

- Every pre-cleanup byte can be recovered from the recorded artifact/stash.
- No committed source, canonical input, or store content changed.
- Old semantic failure evidence remains available but the old implementation no
  longer participates in the new plan.

## Risk assessment and rollback

Main risk is sweeping up unrelated user work. Mitigate with exact paths,
pre/post manifests, checksums, and stop-on-surplus. Roll back by restoring the
captured patch/archive to the recorded paths; never reverse via history rewrite.

## Next steps

Proceed to Phase 01 only after cleanup evidence passes. Phase 01 remains blocked
until the user provides the official placeholder DOCX.
