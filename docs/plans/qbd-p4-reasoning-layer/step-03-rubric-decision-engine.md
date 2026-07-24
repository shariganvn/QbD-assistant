# Step 3 — Implement approved selection-rubric decision engine

Test then implement proposal versus approved selection-rubric states, hard gates, score mapping,
explicit matrix calculations, evidence links, unit normalization, missing/conflict outcomes, ties,
and sensitivity review. A selection without a hash-pinned approval or without complete eligible
evidence must fail closed to `inconclusive`.

## Rubric lifecycle — approval is deferred, not fabricated

This step delivers `cowork-p2-kit/rubric/selection-rubric.schema.json` and
`selection-rubric-proposal.json` only. It does **not** deliver
`selection-rubric-approved.json`: `rubric/` is an agent-writable directory, so an agent could
otherwise copy the proposal into an "approved" file with fabricated `version`/`approver`/`date`
fields and pass every gate, with the forgery indistinguishable afterwards.

- The real approved rubric is deferred — owner FD, reopen condition = FD signature plus a
  human-committed SHA-256 pin in `gates.yaml`. This does not block this step or Steps 4-5.
- Gates run against `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.json`,
  named test-only so it can never be mistaken for the real artifact, and never publishable.
- At runtime the engine applies an approved rubric only when its SHA-256 matches the human-committed
  pin. Missing pin or hash mismatch → `inconclusive`, never a winner.
- `formula-decision.json` embeds the SHA-256 of the rubric it actually applied.
- The FD linear attestation uses the same pin mechanism against the Step 1 schema.

The selection rubric also owns the unit vocabulary and the range/list aggregation rules (which
statistic enters a matrix cell per measure), so the validator can check a card's `normalized_value`
against its `raw_text`.

## Withheld-evidence detection and its honest limit

The engine records, per scored candidate and critical measure, which admitted records were cited and
which admitted records mapping to that candidate were not. An uncited Results-type record for a scored
candidate yields a named FD-review decision state. Without this, an agent emitting one favorable card
per measure produces a card set containing no conflict at all, and a conflict gate over handed-in
conflicts would only ever test the honest path.

This does not close the residual risk of values withheld *within* a cited record — see the residual
risk table in `plan.md`. Independent FD adjudication is that control.

Selection-rubric artifacts live beside the existing dossier-readiness rubric `scoring-90-100.md`. The
two are different instruments: `scoring-90-100.md` scores dossier readiness, the selection rubric
scores formulation choice.

Gate: G-P4-03, run as
`node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-03 cowork-p2-kit/reasoning/tests/decision-engine.test.mjs`.
Depends on G-P4-02.

<!-- Updated: Validation Session 1 - selection-rubric artifacts relocated to cowork-p2-kit/rubric/, per-gate command -->
<!-- Updated: Red Team Session 2026-07-24 - approved rubric deferred + hash-pinned, uncited-evidence detection, unit normalization ownership -->
