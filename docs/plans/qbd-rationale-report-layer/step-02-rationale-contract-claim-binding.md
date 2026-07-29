# Step 2 — Bind claims to permitted sources

Step 2 is the heart of the layer: the contract for what a rationale may say, and the pure validator
that rejects anything else. No file I/O, no CLI, no Markdown, no publication.

## Goal

Given a sealed packet and a candidate rationale artifact, either return a validated rationale or throw
a typed error. Every accepted claim is traceable to a permitted packet source; every rejected one
fails the whole artifact.

## Why claims need more than fact-card citations

D20260728 requires a human-readable explanation for `inconclusive` decisions. An inconclusive decision
frequently has **no** usable fact card for the measure in question — that is why it is inconclusive.
A contract that only allowed fact-card citations would make the mandated inconclusive explanation
impossible to write. Claim kinds therefore cover every source the decision actually rested on.

## Rationale envelope

`rationale.schema.json`, exact keys, `additionalProperties: false`:

```text
schema_version        const 1
rationale_id          non-empty string
packet_id             equals packet.packet_id
packet_sha256         64 lowercase hex, equals sha256(canonicalBytes(packet))
run_id                equals packet.run_id
decision_id           equals packet.decision.decision_id
decision_sha256       equals packet.evaluation.decision_sha256
cohort_id             equals packet.cohort.cohort_id
decision_status       equals packet.decision.status
winner                equals packet.decision.winner
fd_action             equals packet.decision.fd_action
display_state         const "internal_only"
claims                non-empty array, unique claim_id values, stored in sorted claim_id order
```

Each claim:

```text
claim_id  non-empty string, unique
kind      one of fact | gate | sensitivity | exclusion | decision_state
text      non-empty string, English
cites     object whose permitted keys depend on kind
```

## Claim kinds and their permitted citations

| Kind | Required `cites` | Resolution rule |
|---|---|---|
| `fact` | `fact_card_ids` non-empty, optional `quotes` | Each ID is in `permitted_sources.fact_card_ids`. Each quote is byte-identical to an `evidence_log.entries[].quote` whose entry lists one of the cited card IDs |
| `gate` | `gate_refs` non-empty: `{ candidate, measure_id, ref_kind: hard_gate \| critical_evidence \| matrix_cell }` | Each triple resolves exactly in the matching `permitted_sources` slice |
| `sensitivity` | `sensitivity_vector_indexes` non-empty | Each index is an integer in `[0, permitted_sources.sensitivity_vector_count)` |
| `exclusion` | `exclusion_refs` non-empty: `{ candidate, record_id, reason }` | Each object matches a `permitted_sources.exclusions` member exactly, including the `E_` reason code and the null/non-null `record_id` rule |
| `decision_state` | `decision_state_fields` non-empty; for an inconclusive causal explanation also `causal_evidence_refs` non-empty | Each name is in `permitted_sources.decision_state_fields`; the claim text is the exact stored value of its cited field. Each causal ref is exact-key `{ ref_kind, field, value }` and must equal a member of `packet.causal_evidence.refs` |

Any other `cites` key, an empty citation array, or a citation that does not resolve fails with
`E_RATIONALE_CLAIM_BINDING`. A quote or record ID that is not in the packet fails with
`E_RATIONALE_EVIDENCE_OUTSIDE_PACKET` — the distinct code exists because that failure means the author
reached outside its sealed corpus, which is a different problem from a typo.

## Invented value and unit control

D20260728 requires that invented numeric values and units fail validation.

1. Extract every numeric token from `claim.text` with a declared, documented regular expression.
2. Extract every unit token with a declared versioned tokenizer and compare it only with the union of
   tokens in `source_value_index` for that claim's resolved citations. The closed vocabulary and
   numeric regular expression are constants tested with decimals, IDs, percentages, and units.
   A fact quote contributes its quote-local tokens only when that quote is present in the same
   `cites.quotes` array; all other per-kind index records match their citation object exactly.
3. A numeric token passes only if it is a member of the numeric-value set reachable from **that
   claim's own cited sources**, or it appears verbatim inside one of the cited IDs (record IDs and
   card IDs legitimately contain digits).
4. Anything else — a rounded value, a converted unit, a computed average, a percentage the evaluation
   never produced — fails with `E_RATIONALE_INVENTED_VALUE`.

This check is deliberately narrow and mechanical. It catches fabricated numbers; it does not judge
whether a true number is used fairly. That remains FD review.

## Decision-state control

- `decision_status`, `winner`, `cohort_id`, and `fd_action` must equal the packet values. Any
  difference fails with `E_RATIONALE_DECISION_ALTERED`.
- When `decision_status` is `inconclusive`, the artifact requires a `decision_state` claim citing only
  `fd_action`, whose text exactly equals the packet field, **and** one or more
  `causal_evidence_refs` whose duplicate-free, order-insensitive set exactly equals the non-empty
  `packet.causal_evidence.refs` index.
  A gate or exclusion may be a separately bound claim when it is relevant, but it cannot substitute
  for a causal ref or be relabelled as one. Missing either fails with
  `E_RATIONALE_INCONCLUSIVE_EXPLANATION`. An added top-level explanation field fails the envelope;
  there is no unbound narrative bypass.
- When `decision_status` is `inconclusive`, claim text is scanned against a declared
  recommendation-token denylist (for example `recommend`, `we recommend`, `should select`,
  `best choice`, `winner is`). A hit fails with `E_RATIONALE_DECISION_ALTERED`. The gate records this
  as a **best-effort drift signal**; paraphrase evades it, and FD review is the semantic authority.
- `display_state` accepts only `internal_only`. It is a schema constant, not an input. Supplying it as
  a CLI flag or packet field fails with `E_RATIONALE_DISPLAY_STATE`.

## Purity requirement

`rationale-contracts.mjs` and `claim-binding.mjs` read no file, call no model, open no socket, and
consult no clock or random source. Same inputs, same result. The test asserts this by calling each
validator twice and comparing deep-equal results, and by keeping both modules free of `node:fs`,
`node:http`, and `node:child_process` imports.

## Files

Create: `cowork-p2-kit/rationale/rationale.schema.json`, `rationale-contracts.mjs`,
`claim-binding.mjs`, `tests/claim-binding.test.mjs`.
Extend: `cowork-p2-kit/rationale/errors.mjs` with the Step 2 codes.

## TDD sequence

1. Write `tests/claim-binding.test.mjs` first, covering every G-RL-02 assertion over all three
   committed source branches, including the exact causal-evidence citation shape for both
   inconclusive actions, cross-source values/units, a forbidden top-level FD explanation field, and
   a decision-state claim that paraphrases rather than exactly restates its field.
2. Record the red result as `gates/red/G-RL-02-<YYYYMMDD>.json`.
3. Implement, pass, copy `G-RL-02.json` to `gates/step-close/`.
4. Re-run G-RL-01 and run `npm run verify:reasoning` in the isolated clean worktree; both must pass.
5. Set the Step 2 row in `plan.md` to `completed`.

## Risks

| Risk | Mitigation |
|---|---|
| The numeric regex flags dates, versions, or IDs and blocks valid claims | Cited-ID substring exemption plus fixtures containing record IDs with digits; tune the declared regex, never loosen the value-set rule |
| Claim kinds grow ad hoc during implementation | The five kinds are the contract; a sixth requires a plan delta |
| The denylist is mistaken for a real guarantee | `gates.yaml` and this file both label it best-effort; the residual-risk table in `plan.md` carries the control |
| An author cites a valid card but writes text about a different measure | Not machine-detectable; FD review. Do not claim G-RL-02 closes it |
