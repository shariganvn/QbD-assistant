# Step 0 — Freeze the source decision-package fixtures

Setup step. It produces the committed, hash-pinned decision packages that every later gate consumes.
No rationale code is written here.

## Why this step exists

The rationale layer needs a real published P4 package as input. There is none:
`git ls-files docs/reports/qbd-p4-reasoning-layer/decision/` returns only `.gitkeep`, and the P4 e2e
test publishes into a temporary directory it deletes afterwards. Without a committed source package,
G-RL-01 through G-RL-05 would have to re-derive a decision on every run, which would couple this
workstream to the P4 decision engine instead of to its published contract.

## Requirements

1. Create a rationale-local, test-only fixture generator that calls retained
   `buildCohortEvidence()` and `evaluateSelection()` to build the selected, unpinned inconclusive,
   and attested artifacts. The generator publishes each result only through the retained, injectable
   P4 factory
   `createReasoningCli({ publicationRoot })` and its `publish-package` command. Do not call
   `publishDecisionPackage()` directly and do not add a new publishing path.
2. Commit each package under `cowork-p2-kit/rationale/tests/fixtures/decision-package/<branch>/`
   with the exact P4 member names, byte-identical to what the CLI wrote.
3. Record each package's `publication-receipt.json` SHA-256 into the matching
   `pins.source_package_*_sha256` entry of `gates.yaml`.
4. Commit the P4 store snapshot path used, not a copy of the store. The store stays where P4 Step 0
   pinned it: `cowork-p2-kit/reasoning/tests/fixtures/store/`. Its SHA-256 must equal
   `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56`.

## Required branches

| Branch | Source decision | Why it is needed |
|---|---|---|
| `selected/` | Test-approved rubric fixture, non-attested cohort, `status: selected`, non-null winner | Proves the fact/gate/sensitivity claim path over a complete evaluation |
| `inconclusive/` | Production-shaped run with no rubric pin, `status: inconclusive`, `winner: null`, `rubric_sha256: null` | The realistic production path while the FD rubric stays deferred; proves the exclusion and FD-action explanation path |
| `attested/` | Test attestation, cross-strength combined cohort, non-null `linear_attestation_id`/`_sha256` | Proves the packet carries and binds the attestation, and that the optional member is handled |

Each branch's `cohort.store_records_sha256` and `publication-receipt.json.input_store_sha256` must
equal the pinned store SHA-256.

## Files created

- `cowork-p2-kit/rationale/tests/fixtures/decision-package/{selected,inconclusive,attested}/` —
  `cohort.json`, `fact-cards.json`, `evidence-log.json`, `formula-decision.json`,
  `selection-evaluation.json`, `formula-decision.md`, `evidence-log.md`,
  `publication-receipt.json`, and `linear-attestation.json` in the attested branch only.
- `cowork-p2-kit/rationale/tests/fixtures/decision-package/README.md` — one paragraph recording how
  each package was generated, the generating commit, and the rule that they are regenerated, never
  hand-edited.
- `docs/reports/qbd-rationale-report-layer/rationale/.gitkeep` and
  `docs/reports/qbd-rationale-report-layer/gates/{,red/,step-close/}` placeholders.

`.gitkeep` is a first-publication placeholder only. Step 4 may remove exactly that tracked file
before its initial allowlist check; it must reject every other pre-existing entry. Step 5 removes
`.gitkeep` from version control when it commits the four-member reference package.

## Files that must not change

`cowork-p2-kit/reasoning/**` and `docs/reports/qbd-p4-reasoning-layer/**`. Verify with
`git diff --name-only` before closing; any modification there is a blocker, not a fix-up.

## Readiness checklist

- [x] Three package directories exist with exactly their allowed members.
- [x] `validatePublishedDecisionPackage(<branch>, { store })` returns successfully for all three,
      run as a throwaway script or Node one-liner; record the raw output in the step-close note.
- [x] Each `publication-receipt.json` SHA-256 is written to its `gates.yaml` pin.
- [x] Store SHA-256 matches the P4 pin.
- [x] The fixture generator's provenance test proves the unpinned branch has null rubric fields and
      proves all committed bytes equal the injected CLI output.
- [x] `git diff --name-only` shows no change under `cowork-p2-kit/reasoning/` or
      `docs/reports/qbd-p4-reasoning-layer/`.
- [x] Step 0 row in `plan.md` set to `completed` after independent test and review closeout.

## Risks

| Risk | Mitigation |
|---|---|
| A fixture is hand-edited later and silently drifts from what P4 would publish | `gates.yaml` pins the receipt SHA-256; G-RL-05 fails on any change without a repin reason |
| Generating fixtures tempts an edit to the P4 publisher | The factory already accepts an injected `publicationRoot`; no P4 change is needed or permitted |
| The inconclusive branch is produced by faking fields instead of a real unpinned run | The package must come from the CLI over a genuinely unpinned rubric input, so `rubric_sha256` is null in both decision and evaluation |
