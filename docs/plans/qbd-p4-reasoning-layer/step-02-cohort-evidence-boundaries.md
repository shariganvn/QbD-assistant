# Step 2 — Enforce cohort and evidence boundaries

Test then implement candidate identity/cohort checks, public/mock evidence admission, provenance
requirements, and the FD-declared linear-formulation exception. Use the committed store snapshot in
`cowork-p2-kit/reasoning/tests/fixtures/store/` — never the gitignored live `store/records.jsonl` —
so fixtures survive a re-ingest. It holds F-01/F-02 (5 mg) and F-03 (10 mg) records plus five
synthetic inadmissible records, one per exclusion reason, because all 17 current live records are
admissible and would otherwise exercise none of the rejection paths.

## Candidate identity is a committed map, not an agent assertion

The `provenance.file → candidate` map is the deterministic cohort-identity source and is part of the
cohort artifact. Formulation identity does not reliably exist inside record `content`: 13 of 17
records carry no `F-0x` token, and values collide across records (F-01's AV `6.8` also appears inside
an F-02 observations record; `"72 N"` occurs in two records). Cohort assignment resolves through the
map, never through a string match on the agent's claim.

Validated fact cards, not raw `table.rows`, are the admission unit. Quote-substring containment,
char-offset equality, and candidate-map agreement are all asserted here as well as in Step 1, because
together they are what bind an agent-produced card to admitted evidence. A record is inadmissible when
its classification label is not `public`, its `citable` is false, its `confidence` is `low`, or its
`extraction_status` is `needs-ocr`; each rejection is recorded with its named reason in the published
cohort artifact and evidence log.

Gate: G-P4-02, run as
`node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-02 cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs`.
Depends on G-P4-01.

<!-- Updated: Validation Session 1 - fact cards as admission unit, quote containment, per-gate command -->
<!-- Updated: Red Team Session 2026-07-24 - committed store snapshot, candidate map as identity source, synthetic inadmissible records -->
