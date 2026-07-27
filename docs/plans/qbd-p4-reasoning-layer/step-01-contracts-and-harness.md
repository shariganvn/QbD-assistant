# Step 1 — Freeze contracts and TDD harness

Depends on the reviewed Step 0 fixture baseline and store SHA-256 pin.

Create failing Node built-in tests and fixtures for the exact decision, selection-rubric, cohort,
fact-card, linear-attestation, and evidence-log envelopes before creating production validators.
Define stable error categories, JSON-only canonical artifacts, and validate-before-publication
behavior. Record each red result under `docs/reports/qbd-p4-reasoning-layer/gates/red/`.

## Fact-card contract

The fact-card contract is created here, before any validator. The Cowork agent produces
`fact-cards.json` from record `content`; this layer never calls a model. Store `table.headers` and
`table.rows` are unreliable for 12 of 17 current records and are not a fact source.

Quote-substring containment alone is not sufficient: it checks the quote, and it binds a card to a
record but never a record to a candidate. Forged or mislabeled cards would otherwise pass every
declared assertion, and 10 mg data could enter the 5 mg ranking without touching F-03's record. The
contract therefore requires all of:

- `candidate` — validated against a committed, schema-checked `provenance.file → candidate` map that
  is part of the cohort artifact. A numeric measure card may cite only records whose
  `provenance.file` maps to that card's candidate.
- the card's literal value and unit token must appear inside the `quote` string.
- `char_start` / `char_end` on the quote, with `content.slice(char_start, char_end) === quote`.
- a declared minimum quote length.
- `raw_text` (validator-checked: must contain the quote's value token exactly), plus
  `normalized_value` and `unit`. The unit vocabulary and the range/list aggregation rules — which
  statistic enters a matrix cell per measure — belong to the selection-rubric schema, not to the card.

Each violation carries its own `E_` code.

## Linear-attestation contract

`cowork-p2-kit/reasoning/linear-attestation.schema.json` (or an attestation sub-object of the cohort
contract) defines the explicit required-field list that is the only meaning of "complete". Without it,
Step 2 would have to invent attestation fields mid-step, outside this gate's contract freeze.
Authenticity uses the parallel human-committed `linear_attestation_sha256` pin mechanism.

## Policy revision checkpoint — 2026-07-26

The original G-P4-01 pass is historical evidence for the pre-clarification envelopes. Before Step 2
is revised, execute only the coupled Step 1R contract slice defined below and rerun this gate.

### Exact version-2 envelopes

All objects remain exact-key objects with `additionalProperties: false`. Version 1 is historical and
is rejected by the three reopened validators; no dual-version runtime is in scope.

| Artifact | Exact version-2 fields | Conditional rules |
|---|---|---|
| linear attestation | `schema_version`, `attestation_id`, `required_fields`, `members`, `api`, `dosage_form`, `product_target`, `trial_context` | `schema_version` is `2`. `required_fields` is the ordered array `members`, `api`, `dosage_form`, `product_target`, `trial_context`, with no other entry. `members` contains at least two exact `{candidate, strength}` objects, has no duplicate candidate/strength pair, and spans at least two distinct strengths. Every string is non-empty. The payload has no `approved_sha256`; authority is an external pin |
| cohort | `schema_version`, `cohort_id`, `candidates`, `provenance_candidate_map`, `store_records_sha256`, `linear_attestation_id`, `linear_attestation_sha256`, `cohort_basis` | `schema_version` is `2`. Attestation ID/hash are either both null or both non-null. A non-null hash is 64 lowercase hex characters. `cohort_basis` is always a non-empty string |
| decision | `schema_version`, `decision_id`, `status`, `winner`, `cohort_id`, `fact_card_ids`, `rubric_sha256`, `fd_action`, `linear_attestation_id`, `linear_attestation_sha256`, `cohort_basis` | `schema_version` is `2`. Existing selected/inconclusive rules remain. Attestation ID/hash use the same coupled-null rule as the cohort, and `cohort_basis` is always non-empty |

The standalone attestation validator can prove shape, completeness, pair uniqueness, and the
cross-strength nature of the declaration. It cannot know the requested ranking set or candidate
profiles. Exact-set equality, missing/extra members relative to `rankingCandidates`, and common-profile
matching belong exclusively to Step 2 / G-P4-02.

### Hash and cross-artifact binding

- Add one exported canonical JSON byte serializer in `publication.mjs`: recursively sort object keys,
  preserve array order, serialize with two-space indentation, and append exactly one LF. Publication
  and attestation hashing must call this same function.
- `linear_attestation_sha256` is SHA-256 over those canonical bytes. It is not a field inside the
  attestation payload and is not a hash of raw input-file formatting.
- `gates.yaml` remains the external human-controlled pin. Step 1R proves deterministic hashing and
  artifact binding with test values; Step 2 compares the computed value with the supplied test/runtime
  pin before treating the attestation as applied.
- Before publication, `createReasoningCli()` requires cohort and decision to have the same
  `cohort_id`, `linear_attestation_id`, `linear_attestation_sha256`, and `cohort_basis`. When the ID/hash
  are non-null, the ID must equal `linear-attestation.attestation_id` and the hash must equal the
  canonical hash of that supplied artifact. Any mismatch fails before the first write.
- The CLI continues to require a linear-attestation input for the current artifact bundle. Null
  cohort/decision attestation fields mean that the supplied attestation was validated but not applied;
  this avoids changing the publication bundle or CLI argument grammar in Step 1R.

### Stable error mapping

| Failure | Error code |
|---|---|
| Attestation missing a required common field, fewer than two members, or fewer than two distinct strengths | `E_LINEAR_ATTESTATION_INCOMPLETE` |
| Attestation wrong version/type, unknown key, malformed member, or duplicate candidate/strength pair | `E_LINEAR_ATTESTATION_ENVELOPE` |
| Cohort wrong version/type/key, invalid hash, empty basis, or half-null attestation ID/hash | `E_COHORT_ENVELOPE` |
| Decision wrong version/type/key, invalid hash, empty basis, or half-null attestation ID/hash | `E_DECISION_ENVELOPE` |
| Cohort/decision disagreement, attestation ID mismatch, or canonical attestation hash mismatch | `E_REASONING_ARTIFACT_BINDING` |

Add `E_REASONING_ARTIFACT_BINDING` to `errors.mjs`. Do not change the shared `version()` helper: its
GitNexus impact is CRITICAL across six validators and five execution flows. Each of the three reopened
validators checks `schema_version === 2` locally; unrelated version-1 validators remain unchanged.

### Required TDD cases

1. Record a red run for the version-2 contract tests before production edits.
2. Accept exact non-attested and exact attested cohort/decision branches.
3. Reject version 1, unknown/missing/wrong-type fields, empty/duplicate/single-strength member sets,
   invalid SHA, empty basis, and every half-null ID/hash combination with the mapped code above.
4. Prove canonical attestation hash stability across object-key reorderings and sensitivity to a
   semantic member change.
5. Through the injected CLI, reject each cohort/decision/attestation binding mismatch with
   `E_REASONING_ARTIFACT_BINDING` and prove every pre-existing output byte is preserved.
6. Rerun the retained publication rollback, fixed-root, store-pin, runner-contract, and old unrelated
   envelope tests without changing the Step 0 store pin.

Step 1R may edit only the three schemas; `contracts.mjs`, `errors.mjs`, `cli.mjs`, `publication.mjs`;
the contract/output-preservation tests and version-2 fixtures; this step file, `plan.md`, `gates.yaml`;
and machine-produced G-P4-01 red/latest/step-close evidence. `run-gate.mjs`, `package.json`, fact-card,
rubric, evidence-log, store fixture, and Step 2 implementation are outside the edit scope.

The real FD attestation remains deferred. G-P4-01 uses a clearly test-only attestation fixture and
test pin to prove the envelope; it does not fabricate FD approval.

## Gate harness

Bare `node --test` writes no gate evidence, so the original Step 1 delivered
`cowork-p2-kit/reasoning/tests/run-gate.mjs`, a parameterized adaptation of `render/tests/run-gate.mjs`:

- gate-ID pattern `^G-P4-0[1-5]$` (the P3 wrapper hardcodes `^G-P3-0[1-5]$`)
- evidence directory `docs/reports/qbd-p4-reasoning-layer/gates/` (the P3 wrapper hardcodes qbd-p3)
- multiple test paths in one invocation (the P3 wrapper takes a single `testPath`)
- explicit `--test-reporter=tap`, because the wrapper parses the `# tests N` TAP epilogue and Node 23
  changed the default reporter to `spec`

`package.json` is already pinned to Node `22.x`. The wrapper's own contract test asserts the parsed
TAP format. Step 1R re-runs these checks but does not edit either file.

## Error convention

Typed failures follow the Layer A/C convention: `ReasoningContractError` carries a stable `E_` string
code, and the CLI exits nonzero with that code on stderr. There are no per-category numeric exit
statuses.

Gate: G-P4-01, run as
`node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-01 cowork-p2-kit/reasoning/tests/contract.test.mjs cowork-p2-kit/reasoning/tests/output-preservation.test.mjs cowork-p2-kit/reasoning/tests/run-gate-contract.test.mjs`.

Status: **completed**. The 2026-07-24 pass is historical evidence for the pre-clarification
envelopes. The 2026-07-26 Step 1R pass proves the version-2 contract with 45/45 tests at
commit `40755b6`.

The later evidence-log mismatch is not retroactively folded into Step 1R. Its canonical decision and
TDD execution checkpoint are [Step 1E — Evidence-log v2 contract delta](./step-01e-evidence-log-v2-contract-delta.md).
Until Step 1E passes, the retained 45/45 result is historical for evidence-log v1 and G-P4-01 is
pending for the current evidence-log-v2 acceptance contract.

<!-- Updated: Validation Session 1 - fact-card contract ownership, exit-code convention, split gate command -->
<!-- Updated: Red Team Session 2026-07-24 - full fact-card binding, linear-attestation schema, run-gate wrapper, Node pin, unit fields -->
