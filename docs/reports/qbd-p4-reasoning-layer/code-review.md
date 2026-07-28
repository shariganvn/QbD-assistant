# P4 Step 5 closure review — 2026-07-28

## Verdict

**PASS — G-P4-05.** The ordered acceptance suite passed and the scoped change stays within the
Layer B reasoning test/evidence boundary. Layer A, Layer C, P2 ingest behavior, provider routing,
external egress, and document-control workflow are untouched by this Step 5 implementation.

## Verification

| Check | Result | Retained source |
|---|---|---|
| Ordered acceptance | `npm run verify:reasoning` passed 122/122: 50 + 19 + 42 + 7 + 4 | immutable `gates/step-close/G-P4-05.json`, suite `020982d4-d0ed-4a0b-8686-0415eaaf4592` |
| Evidence integrity | exact schema, pass-only status, UUID/timestamp/count metadata, common suite UUID, and the committed Step 0 store SHA are required | `tests/gate-evidence-validator.mjs`, `tests/verify-reasoning-evidence.mjs`, `tests/e2e-decision.test.mjs` |
| E2E publication | non-attested, test-attested, selected-internal, receipt/missing-attestation/surplus/tamper variants pass; Markdown regeneration and receipt hashes revalidate | `gates/G-P4-05.json` |
| Diff hygiene | `git diff --check` and `baton render-test-plan --check` pass | final worktree |
| GitNexus | scoped P4 impacts are LOW with no execution flows; repository-wide detect output is MEDIUM only because of pre-existing concurrent P2 edits | impact records and raw output below |

## Fixture authority resolution

The test-only rubric authorizes a package **only as temporary G-P4-05 test evidence**. It does not
authorize committing generated decision-package bytes. The test publishes and revalidates at the
declared git-retained decision root, then restores its tracked `.gitkeep`; no generated fixture package
is relied on or retained in Git. Retaining such bytes requires a separate human/FD plan delta.

## Scoped review and raw diff

Review base: `0933cd72ba1ce50b5f054b61e8bbb333a6071ea3` (P4 Step 4 closure).

Raw `git diff --name-only <base>` also contains concurrent P2/P3/session work outside this Step 5
scope: `AGENTS.md`, `CLAUDE.md`, `docs/.session-state.md`, `session-handoff.yaml`, all listed
`cowork-p2-kit/ingest/**` and `docs/reports/qbd-p2-ingest-completion/**` paths, and P3 gate evidence.
Those paths are excluded from this verdict and were not modified by Step 5.

Scoped P4 diff paths reported by Git:

```text
TEST_PLAN.md
cowork-p2-kit/reasoning/tests/gate-evidence-validator.mjs
docs/plans/qbd-p4-reasoning-layer/gates.yaml
docs/plans/qbd-p4-reasoning-layer/plan.md
docs/reports/qbd-p4-reasoning-layer/gates/G-P4-01.json
docs/reports/qbd-p4-reasoning-layer/gates/G-P4-02.json
docs/reports/qbd-p4-reasoning-layer/gates/G-P4-03.json
docs/reports/qbd-p4-reasoning-layer/gates/G-P4-04.json
docs/test-plans/active.yaml
package.json
```

The same Git command cannot list new untracked files. The reviewed Step 5 additions are
`verify-reasoning.mjs`, `verify-reasoning-evidence.mjs`, `e2e-decision.test.mjs`,
`G-P4-05.json`, `gates/step-close/G-P4-05.json`, this review,
`T20260728-qbd-p4-reasoning-step-05.yaml`, and `P20260728-qbd-p4-reasoning-step-05.yaml`; all are
covered by the successful ordered suite and the file-level reviewer.

## Raw GitNexus detect-changes output

```json
{
  "summary": { "changed_count": 48, "affected_count": 4, "changed_files": 35, "risk_level": "medium" },
  "scoped_p4_symbols": [
    "cowork-p2-kit/reasoning/tests/gate-evidence-validator.mjs:GATE_EVIDENCE_KEYS",
    "cowork-p2-kit/reasoning/tests/gate-evidence-validator.mjs:validateGateEvidence"
  ],
  "affected_processes": [
    "Main → IngestError",
    "Main → Inside",
    "PublishRecords → IngestError",
    "ReleaseOwnedLock → ValidRunId"
  ]
}
```

The four affected processes are all P2 ingest processes from concurrent pre-existing edits, not the
P4 Step 5 scope. Pre-change GitNexus impact was LOW for `validateGateEvidence` and
`validateSuiteEvidence` (one direct caller each, zero execution flows); `evaluateSelection` and
`validatePublishedDecisionPackage` were also LOW with no affected flows.

## Review follow-up

The initial code review found that the suite validator allowed a valid-format but wrong store hash.
That P1 was remediated by pinning all five records to the committed Step 0 SHA and adding a negative
G-P4-05 assertion. The final 122-assertion rerun passed. Step-close evidence for G-P4-01 through
G-P4-04 remains unchanged.
