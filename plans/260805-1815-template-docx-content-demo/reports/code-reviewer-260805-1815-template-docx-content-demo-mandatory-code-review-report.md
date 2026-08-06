# Code Review Summary

## Scope

- Files: `demo-data-pack.mjs`, `demo-rationale.mjs`, `rationale-to-content-draft.mjs`, `content-demo-run.mjs`, `tests/content-demo.test.mjs`, `tests/decision-shape-probe.test.mjs`, plan/phase files, and plan evidence reports.
- LOC: 1,028 lines across the six implementation/test files.
- Focus: mandatory review of the completed Template to DOCX content-demo implementation.
- Checklist mode: base-only. `package.json` has no web framework dependency and no API route/controller tree was in scope.

## Overall Assessment

Not production-ready as-is. The implementation is scoped to new workflow-trial files and does not modify the existing high/critical GitNexus symbols, but the current workspace cannot freshly pass the main content-demo test and there are real path/provenance contract issues.

## Critical Issues

- `cowork-p2-kit/workflow-trial/content-demo-run.mjs:373` / `:378-381` validates the artifact root with a lexical prefix check and only checks the final directory for symlinks if that directory already exists. A pre-existing symlink at `artifacts/template-docx-content-demo` can make `mkdirSync(resolvedArtifactRoot)` write outside the intended artifact tree before canonical snapshots are taken. If that symlink points at a protected tree such as `cowork-p2-kit/store`, the mutation becomes part of the "before" snapshot and is not detected. This violates Phase 4's symlinked artifact-root negative case and the no-mutation boundary.
  Fix: resolve and `lstat`/`realpath` every existing parent from `artifacts/` through the final run root before creating children; reject any symlink or realpath outside the allowed artifact parent; take canonical snapshots before any filesystem write that can be influenced by `artifactRoot`.

## High Priority

- `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs` fails fresh in this review environment. Direct reproduction shows `EPERM spawnSync git EPERM` from `snapshotDirtyTrackedFiles()` at `cowork-p2-kit/workflow-trial/content-demo-run.mjs:110-111`; a minimal `node -e` child-process probe also cannot spawn `/bin/echo`, `/usr/bin/which`, or `/usr/bin/git`. Therefore Gates G-02/G-04/G-05/G-06 are not freshly verified here, and acceptance criterion "one command exits 0" is not met in the current runtime.
  Fix: either run in the same runtime where Node child processes are permitted and attach fresh output, or make the dirty-file snapshot boundary injectable/testable without requiring Node to spawn `git` in restricted runners.

- Citation provenance does not match the plan's source contract. The plan requires citation `source` to be `inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx` (`phase-02...md:54-57`), and that is the only real repo path that exists. The implementation hard-codes `REAL_SOURCE_FILE = "inputs/trials/filled-public-mock-document-030826.docx"` at `demo-data-pack.mjs:5`, copies the mock into `inputs/trials/<file>` at `content-demo-run.mjs:161`, and the retained draft cites the shortened path. That breaks traceability back to the canonical filled mock path.
  Fix: preserve the `placeholder-probe/` relative path inside the isolated ingest root and update `REAL_SOURCE_FILE`, manifest key, candidate map, and tests to assert the exact required source path.

## Medium Priority

- CLI options are broken. `parseArguments()` at `content-demo-run.mjs:448-459` consumes the value for `--artifact-root`/`--report-root` but does not advance the loop index, so the next iteration treats the value as an unknown argument. Reproduced:
  - `node cowork-p2-kit/workflow-trial/content-demo-run.mjs --report-root /tmp/content-demo-review-report` -> `E_DEMO_ARGS unknown argument: /tmp/content-demo-review-report`
  - `node cowork-p2-kit/workflow-trial/content-demo-run.mjs --artifact-root .../review-cli-parse-probe` -> `E_DEMO_ARGS unknown argument: .../review-cli-parse-probe`
  Fix: increment the index after consuming an option value and add tests for both flags.

- The default runner output is not a fresh run directory. Phase 4 requires one command to write to a fresh directory under `artifacts/template-docx-content-demo/` (`phase-04...md:30-31`), but `defaultArtifactRoot` is a fixed `artifacts/template-docx-content-demo/run` (`content-demo-run.mjs:58`). Re-running the default command overwrites the retained artifact instead of creating a unique run root.
  Fix: derive a deterministic unique run directory, for example from timestamp plus short hash, or require an artifact root argument after the CLI parser is fixed.

## Low Priority

- `content-demo.test.mjs:32-34` calls `rmSync(testRoot, ...)` unconditionally. If the `before` hook fails before `testRoot` is assigned, cleanup can add a secondary error. Guard the cleanup with `if (testRoot)`.

## Edge Cases Found by Scout

- New direct callers are isolated to `cowork-p2-kit/workflow-trial/content-demo-run.mjs` and the two workflow-trial tests. Existing high/critical symbols are called, not edited.
- Data-flow risk: artifact root validation is path-prefix based and occurs before immutable-root snapshotting.
- Boundary risk: citation source values are tested for count/citability but not for the exact plan-required source path.
- Error-path risk: CLI argument paths are not covered by tests.
- Environment risk: the main acceptance test relies on Node child-process spawning, which is blocked in this managed review runtime.

## Spec Compliance

- Phase 1: partially verified fresh. `node --test cowork-p2-kit/workflow-trial/tests/decision-shape-probe.test.mjs` exits 0.
- Phase 2: not accepted fresh because the shared `content-demo.test.mjs` command exits 1 here; also the citation source path is non-compliant.
- Phase 3: source review shows same-packet rationale validation and draft guard are present, but the owning test command did not pass fresh.
- Phase 4: not accepted fresh. Main test command exits 1; symlink containment and fresh artifact directory requirements are not satisfied by the current implementation.
- Plan statuses remain `pending`; do not mark phases complete until the blocking items above are fixed and the focused tests pass in the target runtime.

## GitNexus Impact Boundary

- `buildCohortEvidence`: HIGH, 5 direct dependents, 2 affected workflow-trial processes.
- `runIngest`: HIGH, 4 direct dependents, 3 affected processes.
- `createRationaleCli`: HIGH, 8 direct dependents, 3 affected processes.
- `validateRationale`: CRITICAL, 9 direct dependents, 5 affected processes.
- `evaluateSelection`: LOW, 4 direct dependents, 2 affected workflow-trial processes.
- `detect_changes(scope=all)` reported low risk for tracked edits and no affected execution flows, but it does not cover the untracked implementation files. Source review confirmed only isolated new callers were added for the requested touchpoints.

## Verification

- Pass: `node --check` on all six new implementation/test `.mjs` files.
- Pass: `node --test cowork-p2-kit/workflow-trial/tests/decision-shape-probe.test.mjs`.
- Fail: `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs` exits 1.
- Fail reproduced: direct `runContentDemo({ reportRoot: null })` exits with `EPERM spawnSync git EPERM`.
- Fail reproduced: CLI option parsing for `--report-root` and `--artifact-root`.
- Not run: package-level `npm run verify:*` scripts, because the repo's own research notes and current dirty state show those scripts rewrite tracked gate evidence, which would violate the preservation constraint.
- Lint/type/build: no lint, typecheck, or build scripts are defined in `package.json`.

## Metrics

- Type Coverage: N/A (plain JavaScript, no type-coverage tooling).
- Test Coverage: not measured.
- Linting Issues: N/A (no lint script configured).

## Recommended Actions

1. Fix artifact-root realpath/symlink containment and snapshot ordering.
2. Fix citation source path to preserve `inputs/trials/placeholder-probe/...` and assert it in tests.
3. Fix CLI argument parsing and use a fresh default artifact directory.
4. Re-run the focused content-demo test in a runtime where Node child processes are permitted, or change the test seam so this guard is verifiable under the managed runner.

## Unresolved Questions

- Is the target execution environment expected to allow Node child processes? The existing implementation and much of the repo assume yes, but this review runtime blocks them.

Status: DONE_WITH_CONCERNS

## Post-review disposition — 2026-08-06

The findings above were reviewed against the final implementation. The exact
join now binds the canonical augmented-store SHA-256, computes substring-local
offsets, and rejects repeated or multi-record matches. The adapter deep-clones
citation envelopes. Artifact containment now snapshots protected state before
creating the requested root and rejects symlinks in every path component; CLI
option parsing consumes values; and the default command chooses a fresh
`run-<stamp>` directory. The ingest copy preserves the canonical
`inputs/trials/placeholder-probe/` source path. These fixes are covered by
9/9 focused workflow tests and a successful default end-to-end run.

The one render-suite `plans/` assertion remains pre-existing and is documented
in the plan reports. The original managed-runtime `EPERM spawnSync` limitation
was not reproducible in the final shell rerun.
