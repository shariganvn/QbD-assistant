# Step 1 — Seal the packet contract

Step 1 defines the immutable handoff between the deterministic reasoning core and the rationale
author, and the code that produces it. Nothing in this step generates or validates rationale text.

## Goal

`seal-packet` takes a published decision package plus its store, re-validates the whole package, and
writes one canonical `rationale-packet.json` that is the **only** input the rationale session ever
receives.

## Trust model

The sealer is deterministic code, so it may read the store to re-validate. The rationale session is a
model, so it receives no store path and no record content. That asymmetry is the point of the layer:
verification uses everything, authoring uses only what verification already admitted.

## CLI contract

```text
node cowork-p2-kit/rationale/cli.mjs seal-packet \
  --source-package <dir> --store <file> --output-root <dir>
```

- Exactly one value per flag. Duplicate, missing, or unknown flags fail with `E_PACKET_PATH`.
- `run_id` is derived exclusively from the validated source receipt; callers cannot choose or
  override it. `packet_id` is deterministic from that receipt run ID and the decision SHA-256.
- Production `main()` requires `--output-root` to resolve exactly to
  `docs/reports/qbd-rationale-report-layer/rationale/`. The exported
  `createRationaleCli({ publicationRoot, fileSystem })` test factory accepts only its injected
  declared root. Every other path, including the P4 decision root, fails with `E_PACKET_PATH`.

## Required pre-write validation

Before staging a byte, call the retained
`validatePublishedDecisionPackage(sourcePackage, { store })` from
`cowork-p2-kit/reasoning/publication.mjs` — imported read-only, never modified. Any failure is
re-thrown as `E_PACKET_SOURCE_INVALID` with the upstream code preserved in the message.

Then assert, failing with `E_PACKET_BINDING`:

| Binding | Required equality |
|---|---|
| Run ID | `packet.run_id === receipt.run_id`; no CLI input can override it |
| Receipt hash | `packet.source_publication_receipt_sha256 === sha256(bytes of publication-receipt.json)` |
| Member hashes | every `packet.source_artifacts[name]` equals both the receipt entry and the on-disk bytes |
| Decision identity | packet decision/evaluation/cohort IDs equal the published values |
| Decision hash | `sha256(canonicalBytes(packet.decision)) === evaluation.decision_sha256` |
| Attestation presence | non-null `cohort.linear_attestation_id` requires a non-null `packet.linear_attestation`, and vice versa |

## Packet envelope

`rationale-packet.schema.json`, exact keys, `additionalProperties: false`:

```text
schema_version                     const 1
packet_id                          non-empty string, deterministic from run_id + decision SHA-256
run_id                             receipt run-ID pattern
source_publication_receipt_sha256  64 lowercase hex
source_artifacts                   exact mirror of receipt.artifacts: its eight names, raw-byte hashes, and nullable attestation
decision                           the published formula-decision object
evaluation                         the published selection-evaluation object
cohort                             the published cohort object
fact_cards                         author-safe projection of published fact cards, never the raw P4 object
evidence_log                       the published evidence-log object
linear_attestation                 the published attestation object or null
permitted_sources                  derived index, see below
```

`source_artifacts` excludes `publication-receipt.json`: its hash is carried only by
`source_publication_receipt_sha256`, because a P4 receipt never hashes itself. `packet_id` is
deterministic: the same source package and source receipt run ID always produce byte-identical packet
bytes and the same packet SHA-256. The packet does not hash itself, following the P4 receipt
precedent.

### Forbidden packet content

No store path, no store bytes, no `record.content` field, no execution-report path or text, no prompt,
and no source-only fact-card field such as `raw_text` may enter the packet. `fact_cards` is an exact
allowlist projection of `id`, `record_id`, `candidate`, `measure`, `normalized_value`, `unit`, `quote`,
`char_start`, `char_end`, and `provenance`; retained quotes must equal their admitted evidence-log
quote byte-for-byte. The test is structural: it rejects forbidden fields and extra values, permits an
authorised quote that equals a whole record, and includes a negative raw-text injection.

### `permitted_sources`

Derived deterministically from the packet artifacts, never supplied by a caller:

```text
fact_card_ids            sorted unique IDs from fact_cards.cards
evidence_record_ids      sorted unique record IDs from evidence_log.entries
matrix_cells             [{ candidate, measure_id }] from evaluation.matrix_cells
hard_gates               [{ candidate, measure_id }] from candidate_reviews[].hard_gates
critical_evidence        [{ candidate, measure_id }] from candidate_reviews[].critical_evidence
sensitivity_vector_count integer length of evaluation.sensitivity.vectors
exclusions               [{ candidate, record_id, reason }] from evidence_log.exclusions
decision_state_fields    fixed list: status, winner, cohort_id, cohort_basis, fd_action,
                         rubric_sha256, linear_attestation_id, linear_attestation_sha256
source_value_index       structured exact-match index; no string-key serialization:
                         fact_cards[{fact_card_id, value_tokens, unit_tokens, quote_value_tokens,
                         quote_unit_tokens}], gate_refs[{candidate,measure_id,ref_kind,value_tokens,
                         unit_tokens}], sensitivity_vectors[{index,value_tokens,unit_tokens}],
                         exclusions[{candidate,record_id,reason,value_tokens,unit_tokens}], and
                         decision_state[{field,value_tokens,unit_tokens}]
```

`source_value_index` is what Step 2's invented-value check compares against. Building the index here
keeps the claim validator pure without letting one citation borrow a value or unit from another. Each
entry key is the same typed object/value accepted in that claim kind's `cites`, compared by exact field
equality rather than an ad-hoc concatenated key. Fact-card tokens come from its `normalized_value` and
`unit`; quote tokens are added only when that exact quote is also cited. Gate tokens are scalar
numeric/unit leaves of the exact matched matrix, hard-gate, or critical-evidence object. Sensitivity
tokens are scalar leaves of the indexed vector; exclusions contribute no values beyond their cited
IDs/reason; and a decision-state entry contributes only the exact field value. Numeric and unit
tokenizers are shared versioned constants, never conversions or rounding. Tests cover colliding
candidates/measures and a value/unit available only from a different citation.

## Files

Create: `cowork-p2-kit/rationale/rationale-packet.schema.json`, `packet.mjs`, `errors.mjs`,
`cli.mjs` (exporting the initial seal-only `createRationaleCli({ publicationRoot, fileSystem })`),
`tests/gate-evidence-validator.mjs`, `tests/run-gate.mjs`,
`tests/run-gate-contract.test.mjs`, `tests/packet-contract.test.mjs`, and the generated,
committed `tests/fixtures/rationale-packet/selected.json`.

`errors.mjs` declares this workstream's own code set and its own error class. Do **not** add codes to
`cowork-p2-kit/reasoning/errors.mjs`; G-P4-03 asserts that file is byte-identical.

`tests/run-gate.mjs` is copied with its local gate-evidence validator and contract test from
`cowork-p2-kit/reasoning/tests/run-gate.mjs` with these changes:
gate pattern `^G-RL-0[1-5]$`, default evidence dir
`docs/reports/qbd-rationale-report-layer/gates`, and the suite environment variable
`RATIONALE_SUITE_RUN_ID` (including `RATIONALE_GATE_EVIDENCE_DIR` for isolated tests). The P4 runner
is not edited, imported, or re-pointed.

## TDD sequence

1. Write `tests/run-gate-contract.test.mjs` and `tests/packet-contract.test.mjs` first, covering every
   G-RL-01 assertion, including receipt-derived run ID, exact source-artifact keys, a full-record
   authorised quote, and a forbidden `raw_text` injection.
2. Run
   `node cowork-p2-kit/rationale/tests/run-gate.mjs G-RL-01 cowork-p2-kit/rationale/tests/packet-contract.test.mjs`
   and store the failing result as `docs/reports/qbd-rationale-report-layer/gates/red/G-RL-01-<YYYYMMDD>.json`.
3. Implement the smallest deterministic behaviour until it passes.
4. Copy the passing `G-RL-01.json` to `gates/step-close/G-RL-01.json` unedited.
5. Re-run `npm run verify:reasoning` in the isolated clean worktree described in `plan.md` and confirm
   it passes without changing the active worktree's P4 boundary.
6. Set the Step 1 row in `plan.md` to `completed`.

## Success criteria

G-RL-01 passes with machine-produced evidence; the P4 suite is unchanged and still green; no file
under `cowork-p2-kit/reasoning/` or `docs/reports/qbd-p4-reasoning-layer/` is modified.

## Risks

| Risk | Mitigation |
|---|---|
| Importing P4 validators drags in a write path | Import only `validatePublishedDecisionPackage` and `canonicalBytes`; the test asserts the P4 decision root is untouched after every case |
| A future P4 schema change silently breaks the packet | The packet embeds published objects verbatim rather than reshaping them, so a schema change surfaces as a source-validation failure, not a silent mismatch |
| `permitted_sources` drifts from the artifacts it indexes | It is derived in-process on every seal and never read from input; the test asserts it invents no source and omits no admitted one |
