# Rationale/report layer closure

Date: 2026-07-29  
Workstream: `qbd-rationale-report-layer`  
Status: completed

## Acceptance result

`npm run verify:rationale` passed under suite UUID
`2923d61b-ec4f-4382-a8d3-cfc43d423470`.

| Gate | Result | Assertions |
|---|---:|---:|
| G-RL-01 | pass | 11 |
| G-RL-02 | pass | 9 |
| G-RL-03 | pass | 4 |
| G-RL-04 | pass | 8 |
| G-RL-05 | pass | 6 |

The current evidence is machine-produced in `gates/G-RL-01.json` through `G-RL-05.json`; the
G-RL-05 record is retained unchanged at `gates/step-close/G-RL-05.json`. G-RL-05 ran every gate
in order, stopped on first failure by contract, revalidated the five current evidence records, and
proved their shared suite UUID.

The committed reference package is the selected test fixture in `rationale/`. It is labelled
`internal_only`, is not an FD-approved decision explanation, and revalidates its packet hash,
source-package receipt pin, each member hash, claim binding, and byte-exact Markdown regeneration.
The selected, inconclusive, and attested source branches were all exercised through the real
seal-then-publish CLI path. Tampered members, stale receipts, surplus files, and a missing attestation
failed closed.

`npm run verify:reasoning` also passed in an isolated detached worktree. A hash set over the active
`cowork-p2-kit/reasoning/` and `docs/reports/qbd-p4-reasoning-layer/` boundary was byte-identical
before and after that isolated run.

## Deferred items

- External-facing display and its FD-approval, hash-binding, and revocation mechanism.
- A real FD-approved rubric decision; the selected package remains test-only.
- Vietnamese or bilingual rationale output.
- Any P.2.2/P.2.3 drafting bridge or Layer C dossier-prose integration.

## Residual risks not closed by these gates

- Structurally bound claims can still carry misleading rhetorical emphasis; FD/human review remains
  the control.
- Separate-session instructions do not technically prevent an operator from carrying raw-record
  knowledge into a rationale session.
- A human can copy an internal-only artifact outside the repository.
- The recommendation-token denylist is a best-effort drift signal and cannot detect paraphrase.
