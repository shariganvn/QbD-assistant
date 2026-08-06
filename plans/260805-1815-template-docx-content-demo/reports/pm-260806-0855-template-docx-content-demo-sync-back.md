# PM Sync-Back — Template DOCX Content Demo

Date: 2026-08-06
Plan: `plans/260805-1815-template-docx-content-demo/plan.md`
Docs impact: none. Internal review-only experimental demo; public contracts unchanged.

## Status

| Item | Result |
|---|---|
| Plan status | completed |
| Phases | 4/4 completed |
| Phase checklist items | 9/9 checked |
| Exit criteria | 7/7 checked |
| Gates | G-01..G-06 + G-EX backed by retained evidence |

## Evidence reconciled

| Evidence | Result |
|---|---|
| `decision-shape-probe.test.mjs` | pass 2/2 |
| Focused `content-demo.test.mjs` | pass 7/7 when run sequentially/alone |
| Reasoning suite | pass 122/122 |
| Rationale suite | all emitted tests pass sequentially |
| Render suite | pass 79/80; one pre-existing failure only |
| Retained DOCX | `/media/E/VIBECODING/MODULE3-agent/artifacts/template-docx-content-demo/run-msgvldj7/p2-draft.docx` |
| Raw DOCX SHA-256 | `2a47ab07b52f6e1fa0ccd7f56b43a7b360d97fe5e7d9428068fd009ee6c00b95` |
| Normalized OOXML SHA-256 | `9c5836848c2517b7cb9ad2450468b739a26efcd1ff0a106f2b590416ad4d59ab` |
| Receipt join | exact 3 / ambiguous 0 / unmapped 2 |
| Immutable roots | canonical + dirty tracked roots unchanged |

## Scope changes / concerns

- Handoff recovery ran first and stopped cleanly: `baton reconcile --repair` refused because `session-handoff.yaml` dirty-files manifest no longer matches checkout. Sync-back used repository evidence only; stale handoff not trusted.
- Sequential-only verification is required. `plans/.../reports/no-mutation.md` states reasoning/rationale/render verification rewrites tracked gate evidence; concurrent runs legitimately trip the demo dirty-file guard. This is operational sequencing, not a demo regression.
- Render suite failure is pre-existing, not caused by this demo: `cowork-p2-kit/render/tests/isolated-network.test.mjs:158-163` asserts no repo-root `plans/` directory exists. This repository already has a root `plans/` directory.
- Post-fix sequential rerun completed successfully: `node cowork-p2-kit/workflow-trial/content-demo-run.mjs` exits `0`, proves Bubblewrap `--unshare-net`, and retains the hashes above.
- Debug review found and the main agent fixed two contract drifts: exact joins now bind the canonical store SHA-256, compute substring-specific offsets, and reject repeated/multiple matches; the content adapter deep-clones caller-owned citation envelopes. The focused suite now includes both regressions.
- The Phase 2 citation source-path wording was reconciled to the actual ingest record path in `phase-02-synthetic-demo-data-pack.md:54-59`; the physical mock source remains under `inputs/trials/placeholder-probe/`.

## Next actions

| Owner | Action | Done when |
|---|---|---|
| Main agent | Treat this plan as closed for demo-review scope only | Canonical plan/package remains completed and no further sync-back gaps remain |
| Main agent | If promotion/hardening is desired, open and finish a separate follow-up plan immediately | CLI parsing/default artifact-root debt and managed-runner assumptions are planned with explicit acceptance criteria |

## Unresolved questions

- None for demo-plan closure. Hardening/promotion remains a separate product decision.

Status: DONE_WITH_CONCERNS
Summary: Plan sync-back complete. All four phases and all nine phase checklist items were reconciled to retained evidence; the post-review join and adapter fixes are covered by 7/7 focused tests.
Concerns/Blockers: Render suite 79/80 includes one pre-existing root-`plans/` assertion that is not a content-demo regression; broad verification must remain sequential because upstream scripts rewrite tracked gate evidence.
