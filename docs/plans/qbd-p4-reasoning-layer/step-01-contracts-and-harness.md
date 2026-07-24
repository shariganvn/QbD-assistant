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
Authenticity uses the same human-committed SHA-256 pin as the selection rubric.

## Gate harness

Bare `node --test` writes no gate evidence, so this step also delivers
`cowork-p2-kit/reasoning/tests/run-gate.mjs`, a parameterized adaptation of `render/tests/run-gate.mjs`:

- gate-ID pattern `^G-P4-0[1-5]$` (the P3 wrapper hardcodes `^G-P3-0[1-5]$`)
- evidence directory `docs/reports/qbd-p4-reasoning-layer/gates/` (the P3 wrapper hardcodes qbd-p3)
- multiple test paths in one invocation (the P3 wrapper takes a single `testPath`)
- explicit `--test-reporter=tap`, because the wrapper parses the `# tests N` TAP epilogue and Node 23
  changed the default reporter to `spec`

`package.json` gains `engines.node` pinned to the v22 line. The wrapper's own contract test asserts
the parsed TAP format.

## Error convention

Typed failures follow the Layer A/C convention: `ReasoningContractError` carries a stable `E_` string
code, and the CLI exits nonzero with that code on stderr. There are no per-category numeric exit
statuses.

Gate: G-P4-01, run as
`node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-01 cowork-p2-kit/reasoning/tests/contract.test.mjs cowork-p2-kit/reasoning/tests/output-preservation.test.mjs cowork-p2-kit/reasoning/tests/run-gate-contract.test.mjs`.

<!-- Updated: Validation Session 1 - fact-card contract ownership, exit-code convention, split gate command -->
<!-- Updated: Red Team Session 2026-07-24 - full fact-card binding, linear-attestation schema, run-gate wrapper, Node pin, unit fields -->
