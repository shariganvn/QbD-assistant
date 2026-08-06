# PM Sync-Back — Template DOCX Content Demo

Date: 2026-08-06
Plan: `plans/260805-1815-template-docx-content-demo/plan.md`
Docs impact: none. Internal review-only experiment; no public-contract change.

## Status

| Item | Result |
|---|---|
| Plan status | completed |
| Frontmatter/phase status changes needed | none |
| Phases | 4/4 completed |
| Phase checklist items | 9/9 checked |
| Exit criteria | 7/7 checked |
| Sync-back delta | report refresh only |

## Evidence reconciled

| Evidence | Result |
|---|---|
| `cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs` | pass 9/9 sequentially |
| `cowork-p2-kit/workflow-trial/tests/decision-shape-probe.test.mjs` | pass 2/2 |
| `node cowork-p2-kit/workflow-trial/content-demo-run.mjs` | exit `0` |
| Reasoning suite | pass 122/122 |
| Sequential rationale tests | pass |
| Render suite | pass 79/80; only pre-existing root-`plans/` assertion |
| Retained DOCX | `/media/E/VIBECODING/MODULE3-agent/artifacts/template-docx-content-demo/run-msgvldj7/p2-draft.docx` |
| Raw DOCX SHA-256 | `2a47ab07b52f6e1fa0ccd7f56b43a7b360d97fe5e7d9428068fd009ee6c00b95` |
| Normalized OOXML SHA-256 | `9c5836848c2517b7cb9ad2450468b739a26efcd1ff0a106f2b590416ad4d59ab` |
| Receipt join | exact 3 / ambiguous 0 / unmapped 2 |
| Bubblewrap | `--unshare-net`, exit `0`, watermark first |
| Immutable roots / dirty tracked baseline | unchanged |

## Reconciliation notes

- Full phase sweep done: Phase 1 `2/2`, Phase 2 `3/3`, Phase 3 `2/2`, Phase 4 `2/2`. No stale `[ ]` remained.
- `plan.md` already matched final evidence: `status: completed`, `4/4` phases complete, `7/7` exit criteria checked. No frontmatter or checkbox edit needed.
- Prior PM report `pm-260806-0855-template-docx-content-demo-sync-back.md` is now stale on focused-test count and open-debt wording. Final evidence supersedes it.
- Handoff reconcile stayed untrusted. `baton reconcile --repair` had already refused because the stale dirty-files manifest no longer matched checkout. Sync-back used repository evidence only.

## Findings closed since prior PM report

- Exact joins now bind canonical store SHA-256, compute substring-specific offsets, and reject ambiguous/repeated matches.
- Citation envelopes are deep-cloned before draft mutation.
- Artifact containment rejects ancestor symlinks before any run write.
- CLI value parsing for `--artifact-root` and `--report-root` works.
- Default command now chooses a fresh artifact root.
- Canonical ingest source path preserves `inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`.
- Focused test cleanup is guarded.

## Risks / concerns

- Broad verification still needs sequential execution because upstream suites rewrite tracked gate evidence; this is operational, not a content-demo regression.
- Render suite remains `79/80` because `cowork-p2-kit/render/tests/isolated-network.test.mjs` still assumes no repo-root `plans/` directory. Pre-existing only.

## Next actions

| Owner | Action | Done when |
|---|---|---|
| Main agent | Treat this accepted plan as closed for demo-review scope | No further sync-back gaps; implementation/tests stay untouched |
| Main agent | If promotion or hardening is wanted, finish a separate follow-up plan | New plan has its own acceptance criteria and verification |

## Unresolved questions

- None for this plan closeout.

Status: DONE_WITH_CONCERNS
Summary: Full sync-back found no remaining plan or phase drift; only a refreshed PM report was needed to align with the final 9/9 focused suite and the now-closed review findings. The accepted demo plan is closed on its own evidence, with only a pre-existing render-suite assertion and sequential verification constraint still noted.
Concerns/Blockers: Pre-existing render-suite root-`plans/` assertion remains outside this demo’s scope; broad verification must stay sequential because upstream suites rewrite tracked gate evidence.
