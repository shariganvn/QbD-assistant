---
title: Evidence-log v2 is the canonical evidence-admission ledger
id: D20260727-P4-EVIDENCE-LOG-V2
status: active
date: "2026-07-27"
scope: qbd-p4-reasoning-layer
affects:
  - cowork-p2-kit/reasoning/evidence-log.schema.json
  - cowork-p2-kit/reasoning/contracts.mjs
  - cowork-p2-kit/reasoning/cli.mjs
  - cowork-p2-kit/reasoning/cohort-evidence.mjs
  - docs/plans/qbd-p4-reasoning-layer/gates.yaml
read_when: Changing evidence admission, provenance, exclusions, G-P4-01, or G-P4-02.
---

# D20260727-P4-EVIDENCE-LOG-V2 — Canonical Evidence-Admission Ledger

## Decision

Advance only `evidence-log.schema.json` from version 1 to version 2 before resuming Step 2. The
evidence log becomes the single canonical ledger for admitted records and named exclusions. The
cohort artifact continues to own the admitted candidate set, candidate map, store pin, attestation
binding, and cohort basis; it does not duplicate exclusion rows.

The exact version-2 top-level keys are `schema_version`, `cohort_id`, `entries`, and `exclusions`.

- Each `entries[]` item represents one admitted store record and has exact keys `record_id`,
  `candidate`, `fact_card_ids`, `quote`, and `provenance`.
- `fact_card_ids` is a unique, lexicographically sorted array and may be empty. This preserves admitted
  but uncited records for the later G-P4-03 completeness check.
- `provenance` has exact keys `file`, `page`, `char_start`, and `char_end`. These offsets are Layer A
  page-global coordinates, not offsets into segment-local `record.content`. Layer B runtime binding
  requires the complete provenance tuple and `quote` to equal `record.provenance`; it MUST NOT slice
  `record.content` with provenance offsets. Layer A remains the sole authority that verifies the
  page-text slice represented by the persisted tuple and quote.
- Each `exclusions[]` item has exact keys `scope`, `candidate`, `record_id`, and `reason`. `scope` is
  `candidate` or `record`; candidate exclusions use `record_id: null`, and record exclusions use a
  non-empty record ID. `reason` is a stable `E_` string. The existing literal candidate `unmapped`
  remains permitted for a record rejected because its provenance file has no candidate-map entry.
- Arrays are emitted deterministically: entries sort by `record_id`; exclusions sort by
  `scope`, `candidate`, nullable `record_id`, then `reason`.

G-P4-01 owns the portable schema, runtime envelope/binding validator, CLI publication boundary, error
mapping, version rejection, and output-preservation proof. G-P4-02 owns which records/candidates are
admitted or excluded and the scientific/policy meaning of each named reason. G-P4-02 may begin only
after the revised G-P4-01 passes.

`evidenceLog.cohort_id` must equal `cohort.cohort_id` before publication. Evidence-log v1 is rejected
at runtime; there is no dual-version reader or migration code. Historical v1 fixtures and gate
evidence remain retained as scoped evidence. Malformed v2 envelopes keep the existing
`E_EVIDENCE_LOG_ENVELOPE`; cross-artifact or store-binding failures use the existing
`E_REASONING_ARTIFACT_BINDING`. No new error taxonomy is introduced.

## Rationale

The original G-P4-02 required page-level provenance and named exclusions, while G-P4-01 froze a v1
evidence log that could represent neither. Making the evidence log the sole admission ledger removes
the duplicate exclusion representation from the cohort artifact and gives the publication CLI one
schema-checked audit source.

Record-level entries, rather than one row per fact card, also preserve admitted-but-uncited records.
That is required for G-P4-03 to detect selective omission without inventing another artifact.

## Consequences

- The 2026-07-26 G-P4-01 45/45 result remains historical for the pre-evidence-log-v2 contract.
- `valid-evidence-log.json` is replaced by an explicitly named v2 fixture; a v1 fixture becomes a
  required negative case.
- Step 2 must return a complete schema-v2 evidence log, not its current private in-memory shape.
- A focused builder-to-validator test and a CLI publication test become blocking oracles.
- `cohort.schema.json`, fact-card/rubric schemas, the shared `version()` helper, gate runner,
  `package.json`, Step 0 store fixture, and store SHA pin remain unchanged in this delta.
- This offset-authority clarification does not change the evidence-log v2 shape/version or the
  fact-card local-offset contract; fact cards continue to validate against segment-local `content`.

## Non-goals

- No change to FD package authorization, document control, external egress, rubric approval, scoring,
  ranking, Markdown generation, or Layer A/C behavior.
- No evidence-log v1 migration service, dual writer, generic audit framework, or new sidecar artifact.
- This decision does not by itself complete G-P4-02; it only removes the publication-contract blocker.
