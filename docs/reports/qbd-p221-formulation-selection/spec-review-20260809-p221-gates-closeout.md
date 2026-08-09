# P.2.2.1 formulation-selection gate spec review

Date: 2026-08-09
Plan: `docs/plans/qbd-p221-formulation-selection/`
Machine authority: `gates.yaml` and `test-verdict.json`

## Verdict

**PASS — G-00 through G-05 are supported by fresh implementation, review and
machine evidence.** The canonical proposal/review runs are bound to both frozen
DOCX authorities:

- filled public mock: `filled-public-mock-document-030826.docx`;
- official placeholder template: `official-placeholder-template-v3-040826.docx`.

## Spec compliance

| Requirement | Verdict | Evidence |
|---|---|---|
| Frozen template + filled mock, 146-field round trip | PASS | `template-field-map.v1.json`, `template-cell-receipt.v1.json` |
| Exact formula-01/02/03 evidence and strict spec compilation | PASS | proposal/review rubric, compile receipt, diagnostic |
| Proposal lane remains inconclusive; CT03 is proposal-only | PASS | `formula-decision.json`, `engineering-proposal.json` |
| Confirmed lane publishes the exact authorized rubric it evaluates | PASS | confirmed-lane publication regression |
| Complete review-only P.2.2.1 DOCX with page header and internal provenance | PASS | `review-run/p2.2.1-review.docx`, `review-verification.json` |
| Owner-level template content survives final render | PASS | refreshed-hash DOCX mutation regression |
| Every required negative has an explicit machine verdict | PASS | `test-verdict.json` |

## Review findings resolved

1. Coordinated rubric/receipt drift is rejected by source regeneration.
2. Rationale claims are exact, non-empty, truth-bound and non-citable.
3. The post-render verifier rechecks required filled values at their exact DOCX
   owners; refreshing render hashes cannot bless altered template content.
4. The `fd-confirmed` lane source-compiles and publishes the same
   `test-approved` rubric hash used by the decision/evaluation and downstream
   rationale/render.
5. G-05 records pass/fail evidence for every required negative boundary.

Stage 2 review initially returned one Critical and two Important findings. The
remediation re-review returned `DONE` with no remaining Critical or Important
finding.

## Fresh verification

- Aggregate: **291/291 passed**, failed/skipped/todo: **0/0/0**.
- Canonical verifier:
  - DOCX SHA-256: `6a0a1ec323085af3698b33947e55a6da2ad908b4c845429ae93ece9340df7947`;
  - normalized OOXML: `c45e123d6d20b05aa67ebdd09a0e759e0420b1464178aa9169b686a2ee1e7785`;
  - rationale SHA-256: `c08c6ddfce2c21451072fe26acafc5d01686c42aeb83edce155a4153a4a404f2`;
  - page-level marker, P.2.2.1 sections and internal provenance: `true`.
- Full-ingest and downstream-from-pinned-store determinism: pass as separate
  lanes.
- GitNexus `detect_changes(scope: all)`: `CRITICAL` for the dirty shared
  worktree (69 changed symbols, 26 affected processes). This is not treated as a
  false-safe result; the affected reasoning/render contracts are covered by the
  fresh 291-test aggregate and the two-stage review/re-review above.

## Deferred scope

Cryptographic/insider-proof FD authorization remains a separate follow-on. The
current `fd-confirmed` flag is an explicit MVP trust seam, not a security proof.
