# Step 3 — Rebuild the test-only selection-decision core

Step 3 starts again from a frozen Step 2 cohort/evidence result. It implements a deterministic,
**test-only** decision core; it does not create, simulate, or claim an FD-approved production rubric.
The existing G-P4-01 and G-P4-02 closures remain upstream and are not reopened by this step.

## Goal and authority boundary

The core turns one valid Step 2 `{ cohort, evidenceLog }`, its validated fact cards, and an injected
rubric state into either a traceable `selected` result for the committed test fixture or a typed
`inconclusive` result. It never reads `gates.yaml`, discovers records, writes publication files, or
renders Markdown. Step 4 owns publication, receipts, and deterministic derivatives after this
contract is frozen.

`D20260727` defers real scoring/ranking authority. Its
[Step 3 test-only authorization](../../decisions/D20260727-qbd-p4-reasoning-policy.md#amendment--step-3-test-only-decision-core-authorization)
authorizes this **test-fixture mechanism** only; it does not authorize production selection. Step 3
remains `pending` only until its implementation and G-P4-03 closure; this document is not a substitute
for FD approval.

Production input is always fail-closed while `pins.selection_rubric_approved_sha256` remains `null`:
the engine returns `inconclusive`, `winner: null`, `rubric_sha256: null`, and
`fd_action: "E_RUBRIC_APPROVAL_REQUIRED"`. A linear attestation changes cohort membership only; it
never substitutes for a matching rubric pin.

## Frozen compatibility boundary

Do not change the completed v1 selection-rubric validator, the completed v2 decision envelope, their
schemas, `version()`, `buildCohortEvidence()`, or the G-P4-01/02 fixtures. In particular,
`formula-decision.json` remains the exact v2 summary contract already published by Step 1/2.

Step 3 introduces a separate namespace rather than silently extending that envelope:

| New path | Responsibility |
|---|---|
| `cowork-p2-kit/rubric/selection-rubric-v2.schema.json` | Exact-key test/proposed rubric contract described below; does not replace the v1 schema |
| `cowork-p2-kit/rubric/selection-rubric-proposal.v2.json` | Unpinned proposal with `approval_state: "proposal"`; never selects a winner |
| `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json` | Committed synthetic rubric with `approval_state: "test-approved"`; it is never publishable or FD evidence |
| `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-pin.json` | Exact `{ "selection_rubric_sha256": "<64 lowercase hex>" }` canonical-byte pin for the test fixture |
| `cowork-p2-kit/reasoning/selection-evaluation.schema.json` | Exact-key trace sidecar bound to the v2 summary decision by ID and canonical SHA-256 |
| `cowork-p2-kit/reasoning/selection-contracts.mjs` | New isolated v2 rubric/evaluation validators; the completed `contracts.mjs` remains unchanged |
| `cowork-p2-kit/reasoning/decision-engine.mjs` | Pure engine; accepts data only, performs no filesystem read/write and no model/API call |
| `cowork-p2-kit/reasoning/tests/decision-engine.test.mjs` | Sole G-P4-03 test file and the source of machine-produced evidence |

The evaluation sidecar is an engine result in Step 3, not a newly published artifact. Step 4 must
decide its final publication name, transaction membership, receipt entry, and Markdown presentation
from this stable contract. This prevents an unbound sidecar from being mistaken for a completed
publication format.

## Exact v2 rubric contract

Every rubric is an exact-key object:

```json
{
  "schema_version": 2,
  "rubric_id": "string",
  "approval_state": "proposal | test-approved",
  "measures": [],
  "tie_threshold": 0,
  "minimum_eligible_candidates": 2
}
```

`measures` is a non-empty, unique-by-`id`, declaration-order array. Each exact-key measure is:

```json
{
  "id": "string",
  "critical": true,
  "direction": "higher-is-better | lower-is-better",
  "canonical_unit": "string",
  "raw_shape": "scalar | list | range",
  "aggregation": "identity | mean | midpoint",
  "hard_gate": { "operator": ">= | <=", "threshold": 0 },
  "score_map": [{ "operator": ">= | <=", "threshold": 0, "points": 0 }],
  "weight": { "nominal": 0, "min": 0, "max": 0 },
  "conflict_tolerance": 0
}
```

Rules, enforced by the v2 validator:

- `raw_shape` and `aggregation` are coupled: `scalar/identity`, `list/mean`, or `range/midpoint`.
- The only accepted input unit is `canonical_unit`; no conversion table exists in the test contract.
  A different or ambiguous unit is `E_UNIT_NORMALIZATION_REQUIRED`, never an inferred conversion.
- `raw_text` must use the declared canonical grammar exactly: scalar `value <unit>`; list
  `values=[v1,v2,...] <unit>`; range `range=[low,high] <unit>`. The parsed aggregate must equal
  `normalized_value`; otherwise the candidate is `inconclusive` with
  `E_NORMALIZED_VALUE_MISMATCH`. This is intentionally limited to deterministic fixtures, not a
  parser for arbitrary pharmaceutical prose.
- `hard_gate` is evaluated before `score_map`; failure makes only that candidate ineligible.
  `score_map` has at least one ordered rule and exactly one matching rule for an eligible matrix cell.
- `weight` values are finite non-negative numbers with `min <= nominal <= max`; all nominal weights
  sum to `1`. `tie_threshold` is finite and non-negative. `minimum_eligible_candidates` is an integer
  of at least `2`.
- Two aggregated values for the same candidate/measure conflict when their absolute difference is
  greater than that measure's `conflict_tolerance`. A conflict is an inconclusive decision state,
  not a tie-break input.

The committed test-only rubric must contain three synthetic measures, in this order:

1. `release_30m`: critical, `%`, scalar/identity, `>= 80` hard gate, higher-is-better.
2. `assay`: critical, `%`, scalar/identity, `>= 95` hard gate, higher-is-better.
3. `hardness`: non-critical, `N`, range/midpoint, lower-is-better only through its declared score map.

Its score maps, weights, tolerances, and tie threshold are fixture data committed in the file; the
test must assert the canonical hash literal, not recalculate and bless a changed fixture. These values
are synthetic test parameters only and must not be copied into a production rubric.

## Decision-engine interface and deterministic algorithm

`evaluateSelection()` accepts exactly one object:

```js
{
  cohort,             // validated Step 2 v2 cohort
  evidenceLog,        // validated Step 2 v2 evidence log
  factCards,          // validated Step 1 v1 fact cards
  rubric,             // v2 proposal or test-approved rubric
  rubricPin,          // null or injected 64-lowercase-hex pin; never read from YAML
  recordRoles,        // exact { record_id: "results" | "context" } map for admitted fixture records
  decisionId
}
```

The engine validates that every `recordRoles` key is an admitted evidence-log ID and that every
admitted ID has exactly one role. This explicit test input replaces the undefined old phrase
"Results-type record"; it does not add a classification field to Layer A records.

Algorithm, in order:

1. Validate the Step 2 artifacts, their shared cohort ID, fact-card candidate bindings, rubric v2,
   record-role map, and `decisionId`. Hash the rubric with `canonicalBytes()`.
2. If `approval_state` is `proposal`, return the v2 summary decision as `inconclusive` with
   `E_RUBRIC_APPROVAL_REQUIRED`; do not evaluate gates, cells, scores, or winners. If it is
   `test-approved`, require `rubricPin` to match the canonical hash. A missing or mismatched pin
   returns respectively `E_RUBRIC_PIN_REQUIRED` or `E_RUBRIC_PIN_MISMATCH`, again without scoring.
3. For each cohort candidate and measure, gather only cards of that candidate/measure whose record is
   admitted in the evidence log. Parse and aggregate each card under the measure's declared grammar.
   Each matrix cell records `candidate`, `measure_id`, `value`, `unit`, `fact_card_ids`, and sorted
   `record_ids`.
4. Before scoring, return inconclusive for any missing critical cell, parsing/unit mismatch, or
   conflict. For every candidate and critical measure, record sorted `cited_record_ids` and sorted
   `uncited_results_record_ids`; an uncited admitted `results` record returns
   `E_FD_REVIEW_UNCITED_RESULTS`.
5. Evaluate hard gates in declaration order. A failing candidate has `eligible: false` and no soft
   score. If fewer than `minimum_eligible_candidates` remain, return
   `E_INSUFFICIENT_ELIGIBLE_CANDIDATES`.
6. Score remaining cells under each measure's unique `score_map` rule and nominal weights. At every
   vector in the Cartesian product of each measure's `{min,max}` weight endpoints, recompute totals.
   A winner is stable only when the same candidate is the strict leader and exceeds the runner-up by
   more than `tie_threshold` at every vector. A nominal tie/margin or any unstable leader returns
   `E_TIE_OR_SENSITIVITY_UNSTABLE`.
7. Only then return `selected`, with the winning candidate and the applied rubric canonical SHA-256.
   A combined cohort merely flows through its existing Step 2 attestation ID/hash/basis; the engine
   rejects no new cross-strength scope and cannot manufacture one.

The returned exact-key pair is `{ decision, evaluation }`. `decision` passes the unchanged v2
`validateDecision()` contract: `fact_card_ids` is the lexicographically sorted IDs of every processed
card, and `fd_action` equals the returned `outcome_code`. `evaluation` has exactly
`schema_version`, `evaluation_id`, `decision_id`, `decision_sha256`, `cohort_id`, `rubric_sha256`,
`matrix_cells`, `candidate_reviews`, `sensitivity`, and `outcome_code`.

Its nested objects are exact-key as well:

- a matrix cell has `candidate`, `measure_id`, `value`, `unit`, `fact_card_ids`, and `record_ids`;
- a candidate review has `candidate`, `eligible`, `hard_gates`, and `critical_evidence`; each hard
  gate has `measure_id`, `passed`, `value`, `operator`, `threshold`, and `record_ids`; each critical
  evidence entry has `measure_id`, `cited_record_ids`, and `uncited_results_record_ids`;
- `sensitivity` has `vectors` and `stable_winner`; every vector has `weights`, `totals`, `leader`, and
  `margin`. `weights` has exactly the declared measure IDs and `totals` is in candidate declaration
  order; `leader` and `stable_winner` are a candidate ID or null.

`decision_sha256` is the canonical SHA-256 of that returned summary decision; the test asserts the
binding after any semantic change. Arrays use rubric/candidate declaration order, with record and card
IDs lexicographically sorted. No value is encoded in a hand-written explanation string.

## TDD and G-P4-03 acceptance

First create `decision-engine.test.mjs`, run it through the gate wrapper, and retain the failing TAP
result under `gates/red/G-P4-03.json`. The green command is:

```text
node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-03 cowork-p2-kit/reasoning/tests/decision-engine.test.mjs
```

The test must prove all of the following with synthetic cards/records only:

- proposal, missing pin, and mismatched pin produce the mapped inconclusive outcome and no winner;
- test-approved fixture plus matching fixture pin produces a selected test result and embeds its hash;
- hard-gate rejection happens before score mapping; missing critical data, unit/normalization failure,
  conflict, uncited `results` evidence, tie, and sensitivity instability each fail closed with the
  mapped code;
- every matrix cell carries derived value/unit plus sorted card and record IDs; no candidate outside
  the cohort can appear;
- non-attested and correctly attested Step 2 cohorts preserve their existing strength and attestation
  semantics, including a test-only combined cohort;
- the v1 rubric/decision validators, G-P4-01/02 code, fixtures, and evidence remain byte-identical.

No Markdown assertion belongs in G-P4-03. Step 4 will consume the frozen `{ decision, evaluation }`
pair and own all generated derivatives, final publication transaction, and re-validation.

## Files and verification boundary

Step 3 may edit only the new source and fixture paths named in the compatibility table, the new test fixtures under
`cowork-p2-kit/reasoning/tests/fixtures/rubric/`, `decision-engine.test.mjs`, this step file,
`plan.md`, `gates.yaml`, and the machine-produced G-P4-03 red/latest/step-close evidence. It must not
modify the Step 0 store fixture/pin, any G-P4-01/02 code or evidence, `package.json`, the CLI,
publication module, SKILL, or Step 4.

Before a future implementation edit, run GitNexus impact analysis on every existing symbol selected
for change. The current rebuilt step deliberately adds new symbols only; it preserves the LOW-risk
upstream contract seam confirmed during replan.

<!-- Replanned: 2026-07-27 — replaces the underspecified original Step 3; preserves G-P4-01/02 and defers Markdown/publication to Step 4 -->
