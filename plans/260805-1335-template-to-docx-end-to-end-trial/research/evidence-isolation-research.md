---
title: "Evidence Isolation Research"
status: complete
researched_at: "2026-08-05T13:41:52+07:00"
scope: "Template-to-DOCX end-to-end acceptance harness"
---

# Evidence Isolation Research

## Contents

- [Executive Summary](#executive-summary)
- [Scope and Method](#scope-and-method)
- [Current Mutation Boundaries](#current-mutation-boundaries)
- [Missing End-to-End Seams](#missing-end-to-end-seams)
- [Recommended Acceptance Harness](#recommended-acceptance-harness)
- [Protected-State Snapshots](#protected-state-snapshots)
- [Execution and Test Order](#execution-and-test-order)
- [Negative, Idempotence, and Determinism Coverage](#negative-idempotence-and-determinism-coverage)
- [Failure Diagnostics, Cleanup, and Rollback](#failure-diagnostics-cleanup-and-rollback)
- [Retained Gate Evidence](#retained-gate-evidence)
- [Implementation Recommendations](#implementation-recommendations)
- [References](#references)
- [Unresolved Questions](#unresolved-questions)

## Executive Summary

Do not run `npm run inputs:build`, `npm run ingest`, or any `npm run verify:*`
command in the current worktree. Those commands can overwrite canonical inputs,
the canonical store, production publications, or retained gate JSON. The current
worktree already has 18 tracked dirty files: `AGENTS.md`, `CLAUDE.md`, all 11
ingest gate/suite JSON files, and all five reasoning gate JSON files. These bytes
belong to the current user/session and must be treated as protected input.

The repeatable acceptance shape is one controller test that creates two
equivalent system-temporary run roots, copies only approved public/synthetic
inputs and the record schema, injects every writable root, executes stages
serially with network isolation and timeouts, compares stable bytes/hashes, and
then proves every protected repository byte is unchanged. Gate evidence is not
part of focused acceptance: UUIDs, timestamps, durations, and TAP output make it
run-specific, and current runners publish it to production report roots.

The repository does not yet implement one truthful template-to-DOCX call chain.
GitNexus shows separate ingest, reasoning publication, rationale publication,
and DOCX build graphs. File inspection finds three missing production seams:
template receipt to ingest records, ingested store to decision inputs, and
rationale package to render draft. The harness can isolate each existing stage,
but the plan must approve these seam policies before claiming a complete product
trial.

## Scope and Method

- Sources: repository instructions, package scripts, the prior isolated template
  probe, all four verification entry points, their gate runners/validators,
  production CLIs/publication code, mapped end-to-end tests, fixtures, current
  read-only Git status/diff, and GitNexus symbol context.
- No network research; repository code is the authoritative and current source.
- Planning only. No source, test, config, gate, store, or production report was
  changed.
- Evaluation criteria: byte preservation, explicit write-root injection,
  deterministic artifacts, fail-closed behavior, process ownership, useful
  diagnostics, and minimal implementation surface.

## Current Mutation Boundaries

| Command or entry point | Writes by default | Isolation support | Acceptance decision |
|---|---|---|---|
| `npm run inputs:build` | Rebuilds DOCX files under `cowork-p2-kit/inputs/` and rewrites `classification-manifest.json` | None | Never run during acceptance. Treat as canonical-input maintenance. |
| `npm run ingest` | Replaces `cowork-p2-kit/store/records.jsonl`; creates/uses a store lock and temp file; may write failure JSON under `artifacts/qbd-p2-ingest-completion/runs/` | `--config <absolute-json>` can inject `kitDir`, `inputsRoot`, `storeRoot`, and `artifactRoot` | Safe only with a run-local absolute config and copied schema/input bytes. No-argument form is forbidden. |
| `npm run verify:ingest` | Overwrites `docs/reports/qbd-p2-ingest-completion/gates/G-01.json` through `G-10.json` and repeatedly rewrites `suite.json` | Gate detail snapshots use temp dirs, but the runner and suite manifest have fixed production paths | Forbidden in focused acceptance and in the current dirty worktree. |
| `node .../ingest/tests/run-gate.mjs ...` | Overwrites one production ingest gate JSON | No gate-root override | Same prohibition as the suite. |
| Direct ingest mapped tests | Most create invocation-owned temporary inputs/store/artifacts; `complete-ingest-verification.test.mjs` reads retained production gate JSON | Test-dependent | Run only the known temp-root contract tests. Exclude the completion/evidence test from focused acceptance. |
| Spawned `node .../reasoning/cli.mjs ...` | Production root is fixed to `docs/reports/qbd-p4-reasoning-layer/decision` | `--output-root` must equal that fixed root; environment override is intentionally ignored. A custom root is available only through `createReasoningCli({ publicationRoot })` | Acceptance must call the injected factory from the controller; never spawn the default CLI for a successful publication. |
| `npm run verify:reasoning` | Overwrites five `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-*.json` files; G-P4-05 temporarily removes `.gitkeep`, writes/tampers/republishes the production decision root, then restores it | Individual runner accepts `REASONING_GATE_EVIDENCE_DIR`, but suite post-validation still reads the production gate root | Forbidden in focused acceptance and current dirty worktree. The G-P4-05 test is not an isolated acceptance test. |
| Spawned `node .../rationale/cli.mjs ...` | Production root is fixed to `docs/reports/qbd-rationale-report-layer/rationale` | Custom root only through `createRationaleCli({ publicationRoot })` | Acceptance must call the injected factory. |
| `npm run verify:rationale` | Overwrites five `docs/reports/qbd-rationale-report-layer/gates/G-RL-*.json`; G-RL-05 republishes the production rationale package | Individual runner accepts `RATIONALE_GATE_EVIDENCE_DIR`, but suite post-validation reads production | Forbidden in focused acceptance. |
| `npm run render` without an input/root | Reads canonical store in demo mode and writes `cowork-p2-kit/outputs/p2-draft.docx` | An explicit draft plus absolute `--output-root` is supported | No-argument form is forbidden. Explicit run-local form is safe. |
| `npm run render:spike -- --draft ... --output-root ... --report-root ...` | Writes one DOCX and `render-spike-report.json` beneath supplied roots | Both roots injectable | Safe when both roots are invocation-owned and outside the repository. Report bytes include volatile path/timestamp data and are diagnostic, not determinism evidence. |
| `run-isolated-spike.mjs` | Writes only supplied output/report roots | Requires both roots to be direct `/tmp/isolated-{output,report}-*` children; requires draft to resolve inside the repository | Useful network boundary, but cannot consume a draft generated in an external run root without a small isolation-boundary change. No unisolated fallback. |
| `npm run verify:render` | Overwrites five `docs/reports/qbd-p3-render-layer/gates/G-P3-*.json` files | No gate-root override | Forbidden in focused acceptance. G-P3-04 also currently assumes the repository has no root `plans/`, which is false in this worktree. |
| Template workflow probe test | Creates two distinct system-temporary roots, writes selected map/receipt only, removes those roots, and snapshots canonical template/mock/inputs/store | Fully isolated today | Safe focused baseline: `node --test cowork-p2-kit/template-probe/tests/*.test.mjs`. |

Production/publication roots to include in the protected set even when currently
clean:

- `cowork-p2-kit/inputs/`
- `cowork-p2-kit/store/`
- `cowork-p2-kit/outputs/`
- `artifacts/qbd-p2-ingest-completion/runs/`
- `docs/reports/qbd-p2-ingest-completion/gates/`
- `docs/reports/qbd-p4-reasoning-layer/gates/`
- `docs/reports/qbd-p4-reasoning-layer/decision/`
- `docs/reports/qbd-rationale-report-layer/gates/`
- `docs/reports/qbd-rationale-report-layer/rationale/`
- `docs/reports/qbd-p3-render-layer/gates/`

The canonical store observed during research contains 17 records and has
SHA-256 `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56`.
Reasoning/rationale gate validators pin this exact hash; an isolated trial store
will have a different hash and therefore must not be represented as a retained
P4/rationale gate run without intentionally updating those contracts.

## Missing End-to-End Seams

1. **Template receipt to ingest.** The template probe emits a five-entry receipt
   with `record_id: null` and `record_projection.status: not_available`. Ingest
   independently parses admitted DOCX/PDF files into page-provenanced records.
   No module promotes receipt entries into ingest records, and the prior probe
   explicitly prohibited downstream processing.
2. **Store to reasoning decision package.** Production reasoning APIs validate
   and publish supplied cohort/fact-card/evidence/decision/evaluation artifacts.
   There is no production orchestration command that derives those complete
   artifacts from an arbitrary newly ingested store. The current reasoning E2E
   test constructs formulation-specific artifacts in test helpers.
3. **Decision to rationale content.** The rationale layer seals a packet and
   validates/publishes a supplied rationale JSON. The claims remain an explicit
   authored input; there is no automatic rationale generator.
4. **Rationale to render draft.** Render accepts `{title, citations, blocks}`.
   Rationale publishes an internal-only claim envelope and Markdown. No adapter
   maps the package to a citable render draft.

Recommended acceptance contract: keep these seams explicit. The controller may
use approved deterministic policy functions or checked public/synthetic fixture
inputs, but it must label which bytes are produced by a production stage and
which are approved handoff inputs. It must not silently reuse unrelated
formulation fixtures and call that a template-derived E2E run.

## Recommended Acceptance Harness

Implement one Node test controller, tentatively
`cowork-p2-kit/acceptance/tests/template-to-docx-acceptance.test.mjs`. Keep
helpers local until reuse is proven. The controller should own all temporary
roots, manifests, child processes, stage assertions, and diagnostics.

### Run-root layout

```text
/tmp/qbd-template-to-docx-trial-<controller-id>/
├── .trial-owner.json
├── protected-before.json
├── protected-after.json
├── comparison.json
├── run-01/
│   ├── source/
│   │   ├── official-template.docx
│   │   └── filled-public-mock.docx
│   ├── template-probe/
│   │   ├── field-map/template-field-map.selected.v1.json
│   │   └── receipt/template-cell-receipt.v1.json
│   ├── kit/
│   │   ├── inputs/
│   │   │   ├── classification-manifest.json
│   │   │   ├── reference/
│   │   │   └── trials/filled-public-mock.docx
│   │   └── store/
│   │       ├── records.schema.json
│   │       └── records.jsonl
│   ├── ingest-artifacts/
│   ├── reasoning/
│   ├── rationale/
│   ├── render/
│   │   ├── draft.json
│   │   ├── output/p2-draft.docx
│   │   └── report/
│   ├── stage-manifest.json
│   └── diagnostics/
└── run-02/                         # exact same relative layout and inputs
```

Use fresh byte copies, never symlinks or hard links, for the template, mock,
schema, and admitted input. Set ingest `kitDir` to each run's `kit/`, so record
provenance is the same stable POSIX path in both runs. Admit only the intended
filled public mock unless the plan explicitly decides the blank template is
also an ingest source. The copied manifest must name exactly the copied files
and declare only public/synthetic, citable material.

### Stage policy

1. Snapshot protected repository state before creating stage outputs.
2. Copy and hash approved source bytes into both run roots; assert Run 1 and Run
   2 source manifests are equal.
3. Run the template field-map/receipt behavior against each run's copied source.
4. Run ingest through an absolute run-local config. Store, locks, temps, and
   failure logs must remain under that run.
5. Execute approved store-to-decision policy, then publish through
   `createReasoningCli({ publicationRoot: runReasoningRoot })`.
6. Seal and publish through
   `createRationaleCli({ publicationRoot: runRationaleRoot })` using an approved
   deterministic rationale input.
7. Build the render draft through the approved rationale-to-draft policy.
8. Render with network disabled and only run output/report roots writable.
9. Validate per-stage file allowlists, bindings, receipts, and absence of temp,
   backup, lock, reclaim, or release files.
10. Repeat the complete stage sequence in `run-02`, compare stable artifacts,
    take the post snapshot, and fail if protected state changed.

Do not parallelize Run 1 and Run 2. Serial execution gives clearer failure
ownership and avoids misleading lock/concurrency effects. No stage starts a
server, watcher, daemon, or background job.

## Protected-State Snapshots

The controller should create canonical JSON manifests, not shell tarballs. Each
entry records normalized relative path, entry type, byte size, SHA-256, and for
symlinks the link target. Missing optional roots are represented explicitly so
creation is detectable. Sort paths lexically before canonical JSON encoding.

Snapshot scopes:

- Every file under the ten protected roots listed above.
- The 18 tracked dirty files observed at preflight, captured individually by
  worktree bytes. Do not use `HEAD` bytes as the expected state because those
  files are intentionally already modified.
- The frozen template and filled public mock as explicit top-level anchors.
- Read-only `git status --short --untracked-files=all` and `git diff --name-only`
  as diagnostics. Do not make full-worktree equality the acceptance predicate
  while other agents may legitimately add files under the untracked plan tree.

Take snapshots at controller start, after each write-capable stage, and at final
exit. A stage-level mismatch identifies the first violator. On mismatch, stop
before the next stage, preserve the run root, and emit a path-level manifest
diff. The final protected manifest must be byte-identical to the initial one.

## Execution and Test Order

### 1. Read-only preflight

```bash
node --version
npm --version
command -v bwrap
command -v soffice
command -v gs
git status --short --untracked-files=all
git diff --name-only
```

Fail if Node is not 22.x, required local binaries are absent, public source
hashes differ from the accepted plan, or a protected path is a symlink. Do not
fall back to network installation or an unisolated renderer.

### 2. Narrow existing tests that do not publish retained evidence

```bash
node --test cowork-p2-kit/template-probe/tests/*.test.mjs

node --test \
  cowork-p2-kit/ingest/tests/record-contract.test.mjs \
  cowork-p2-kit/ingest/tests/pipeline.test.mjs \
  cowork-p2-kit/ingest/tests/publication-failure.test.mjs \
  cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs \
  cowork-p2-kit/ingest/tests/file-boundaries.test.mjs \
  cowork-p2-kit/ingest/tests/admission-negative.test.mjs \
  cowork-p2-kit/ingest/tests/determinism.integration.test.mjs

node --test \
  cowork-p2-kit/reasoning/tests/contract.test.mjs \
  cowork-p2-kit/reasoning/tests/output-preservation.test.mjs \
  cowork-p2-kit/reasoning/tests/run-gate-contract.test.mjs \
  cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs \
  cowork-p2-kit/reasoning/tests/decision-engine.test.mjs \
  cowork-p2-kit/reasoning/tests/skill-artifacts.test.mjs

node --test \
  cowork-p2-kit/rationale/tests/packet-contract.test.mjs \
  cowork-p2-kit/rationale/tests/claim-binding.test.mjs \
  cowork-p2-kit/rationale/tests/rationale-markdown.test.mjs \
  cowork-p2-kit/rationale/tests/rationale-publication.test.mjs \
  cowork-p2-kit/rationale/tests/verify-rationale-contract.test.mjs

node --test \
  cowork-p2-kit/render/tests/contract.test.mjs \
  cowork-p2-kit/render/tests/output-preservation.test.mjs \
  cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs \
  cowork-p2-kit/render/tests/determinism.test.mjs
```

These lists intentionally omit ingest completion evidence, reasoning
`e2e-decision`, rationale `e2e-rationale`, render `isolated-network`, and every
top-level verification runner. Before adopting the list mechanically, the new
controller should wrap the entire group in the protected pre/post snapshot; a
new test-side default write must then fail visibly.

### 3. Focused complete acceptance

After the missing seam decisions and controller exist:

```bash
node --test cowork-p2-kit/acceptance/tests/template-to-docx-acceptance.test.mjs
```

The one command must internally execute two fresh roots and the idempotence
passes described below. It must return nonzero on any protected-state change,
network-isolation failure, orphaned process, unexpected file, binding error, or
hash mismatch.

### 4. Broader non-retained regression

Repeat the narrow commands as one serial CI job, then run syntax/lint/build
checks that exist at implementation time. Do not substitute `npm run verify:*`
for this step; those commands are retained-evidence generation.

## Negative, Idempotence, and Determinism Coverage

Required negative cases:

- Reject any run root equal to, nested under, or resolving through a symlink to
  canonical inputs/store/outputs/report roots.
- Reject copied inputs not declared public and citable, undeclared files,
  unsupported extensions, path traversal, and symlinks; prove isolated store
  bytes are unchanged.
- Reject missing parser/system dependencies and failed round trips before store
  replacement; prove no stale lock/temp and retain a run-local failure log.
- Inject ingest publication failure and verify pre-existing run-store bytes are
  restored.
- Reject reasoning store-hash mismatch, cross-candidate record binding,
  decision/evaluation mismatch, surplus files, and mid-publication failure;
  prove prior reasoning bytes are restored.
- Reject rationale source-receipt/store mismatch, altered decision state,
  unbound claims, surplus files, and publication failure; prove prior rationale
  bytes are restored.
- Reject render invalid JSON, invalid/uncitable/unresolved citations,
  unapproved links, path escape, and output write failure; prove seeded output
  bytes survive.
- Attempt a network connection inside the stage sandbox and require failure.
  Absence of intended network calls is insufficient proof of isolation.
- Kill one stage at its timeout and verify only the controller-owned process
  group is terminated and all protected repository bytes remain unchanged.

Idempotence within each run root:

- Execute each publication stage twice against the same root with identical
  inputs.
- Compare the complete stage file allowlist and bytes before/after the second
  execution.
- Require no `.tmp`, `.bak`, `.lock`, `.reclaim`, `.release`, or surplus file.
- Use fixed approved IDs (`run_id`, cohort/decision/rationale IDs) where those
  IDs are part of stable contract bytes. Never freeze gate-evidence UUIDs.

Two-run determinism across fresh roots:

- Byte-equal selected field map and template receipt, including their embedded
  hashes.
- Byte-equal `records.jsonl`, equal record count, record IDs, provenance, and
  store SHA-256.
- Byte-equal reasoning package allowlist and receipt bindings.
- Byte-equal rationale package allowlist and receipt bindings.
- Byte-equal render draft and raw DOCX SHA-256; also compare normalized OOXML
  manifests to make failures diagnosable.
- Equal relative file manifests for each run. Exclude only declared diagnostics
  whose schemas intentionally contain timestamp, absolute root, duration, PID,
  or random execution ID; compare their stable projections instead.

## Failure Diagnostics, Cleanup, and Rollback

Use argument arrays, not shell strings. Spawn every external stage in a new
controller-owned process group with a stage timeout. On timeout, send `SIGTERM`
to that exact group, wait briefly, then `SIGKILL` only the same group if needed.
Record command argv, cwd, allowed environment keys, PID/group ID, start/end
timestamps, exit code/signal, timeout state, stdout/stderr paths and hashes,
stage input/output manifests, and protected-state diff in
`diagnostics/failure.json`. Never record tokens, full environment dumps, or
private data.

Use bubblewrap `--unshare-net`, a read-only repository bind, read-only runtime
binds, a temporary `/tmp`, and only the active run root writable. The current
render wrapper's restriction to a repository-owned draft must be resolved
without placing generated trial bytes in the worktree. If `bwrap` is absent or
unusable, fail; do not silently render outside isolation.

Rollback does not restore canonical state because canonical state must never
change. On success, cleanup is optional. If enabled, remove only a real,
non-symlink temporary directory that is a direct child of the expected system
temp root and contains the controller's matching `.trial-owner.json` sentinel.
On failure, retain both run roots and print their exact paths. Never issue a
broad recursive delete, glob, or environment-derived delete target.

Before exit, assert no controller-owned child remains and scan the run roots for
publication locks/temps/backups. Do not kill unrelated `node`, `soffice`,
LiteParse, or other user processes.

## Retained Gate Evidence

Retained gate JSON answers a different question from focused acceptance. It
records a particular suite execution and legitimately changes UUIDs,
timestamps, duration, and TAP output. Therefore:

1. Finish and pass focused isolated acceptance first.
2. Obtain explicit ownership/approval before replacing current dirty gate
   evidence.
3. Create a clean disposable worktree/copy at the exact implementation commit,
   with no root-level untracked `plans/` directory and no prior production
   publication residue. Stop all processes from that copy before disposal.
4. Run, serially, only in that clean evidence workspace:

   ```bash
   npm run verify:ingest
   npm run verify:reasoning
   npm run verify:rationale
   npm run verify:render
   ```

5. Validate each suite's gate JSON and publication allowlists in place. Review
   failures before copying anything; never import partial evidence from a failed
   suite.
6. Copy back only the explicitly approved gate/publication files, inspect the
   exact diff, and run `gitnexus_detect_changes()` before any commit.

The environment variables for reasoning/rationale individual gate directories
do not make their top-level suites isolated because post-validation still reads
production roots. Ingest and render gate runners do not expose a gate-root
override at all. Avoid adding override plumbing solely for this trial unless
the project wants reusable non-retained gate suites; the dedicated acceptance
controller is the smaller solution.

## Implementation Recommendations

1. Approve the three seam policies and the exact public/synthetic input slice.
2. Add one controller test with local manifest/process helpers; do not create a
   new framework.
3. Generalize or wrap the existing bubblewrap boundary just enough to read a
   generated draft from the run root while keeping the repository read-only and
   network unavailable.
4. Make all stage output roots explicit in the controller. Do not change
   production defaults merely to support a test.
5. Add stage-level negative tests first, then one two-run/idempotence acceptance
   case.
6. Run focused tests and inspect protected manifests before considering a
   separate retained-evidence refresh.

## References

- `package.json`
- `docs/plans/placeholder-template-ingest-workflow-probe/phase-04-run-isolated-end-to-end-probe.md`
- `cowork-p2-kit/template-probe/tests/template-workflow-probe.test.mjs`
- `cowork-p2-kit/ingest/{cli,config,pipeline,publication}.mjs`
- `cowork-p2-kit/ingest/tests/{verify-ingest,run-gate,gate-evidence-validator}.mjs`
- `cowork-p2-kit/reasoning/{cli,publication}.mjs`
- `cowork-p2-kit/reasoning/tests/{verify-reasoning,run-gate,verify-reasoning-evidence,e2e-decision}.mjs`
- `cowork-p2-kit/rationale/{cli,rationale-contracts,rationale-publication}.mjs`
- `cowork-p2-kit/rationale/tests/{verify-rationale,run-gate,verify-rationale-evidence,e2e-rationale}.mjs`
- `cowork-p2-kit/render/{render-docx,render-spike,run-isolated-spike}.mjs`
- `cowork-p2-kit/render/tests/{verify-render,run-gate,verify-render-evidence}.mjs`
- GitNexus contexts for `runIngest`, `createReasoningCli`,
  `createRationaleCli`, and `buildDocumentBuffer`.

## Unresolved Questions

1. Does “complete template-to-DOCX” require ingesting only the filled public
   mock, both the blank official template and the mock, or a wider formulation
   cohort?
2. What approved production policy converts template receipt/ingest records
   into the cohort, fact cards, evidence log, decision, and evaluation required
   by reasoning?
3. Is rationale content a checked deterministic synthetic input, a human-authored
   trial artifact, or expected to be generated by a new component?
4. What approved mapping converts internal-only rationale claims into the
   renderer's public, citable `{title, citations, blocks}` draft?
5. Should the existing render isolation wrapper be generalized to read one
   run-root draft, or should the whole acceptance controller execute inside a
   broader bubblewrap sandbox?
6. Are the current 18 dirty tracked files intentional retained evidence that
   must be preserved indefinitely, or should a later explicitly approved clean
   evidence run replace them?
