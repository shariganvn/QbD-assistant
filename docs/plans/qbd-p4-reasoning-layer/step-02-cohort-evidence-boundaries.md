# Step 2 — Enforce cohort and evidence boundaries

After the revised G-P4-01 contract passes, test then implement candidate identity/cohort checks,
FD-selected-package admission, provenance and extraction-quality requirements, and the FD-declared
linear-formulation exception. Use the committed store snapshot in
`cowork-p2-kit/reasoning/tests/fixtures/store/` — never the gitignored live `store/records.jsonl` —
so fixtures survive a re-ingest. Keep its 17 F-01/F-02/F-03 records byte-identical and hash-pinned;
add separate synthetic fixtures for selected internal records, low-confidence/needs-OCR exclusions,
and complete/incomplete/out-of-scope attestations. This policy revision must not repin the Step 0
baseline.

## MVP package-admission boundary

The exact record array explicitly supplied to the reasoning invocation is the selected MVP package.
Layer B neither searches a broader store nor authenticates that Mr. Tiển personally selected the
array. Within that bounded input, `classification.label`, `classification.citable`, and absent
document-version/approval/rights metadata are non-gating. This is the deliberate low-friction pilot
policy, not a general authorization rule.

The boundary remains fail-closed for deterministic evidence integrity: unknown candidate provenance,
candidate/formulation mismatch, low extraction confidence, `needs-ocr`, invalid quote offsets,
value/unit absent from the quote, missing critical measures, and conflicts are not waived. The last
two become decision states in Step 3 rather than invented numeric penalties.

## Candidate identity is a committed map, not an agent assertion

The `provenance.file → candidate` map is the deterministic cohort-identity source and is part of the
cohort artifact. Formulation identity does not reliably exist inside record `content`: 13 of 17
records carry no `F-0x` token, and values collide across records (F-01's AV `6.8` also appears inside
an F-02 observations record; `"72 N"` occurs in two records). Cohort assignment resolves through the
map, never through a string match on the agent's claim.

Validated fact cards, not raw `table.rows`, are the evidence unit. Quote-substring containment,
char-offset equality, and candidate-map agreement are all asserted here as well as in Step 1, because
together they are what bind an agent-produced card to admitted evidence. A record is inadmissible when
its provenance/candidate binding fails, its `confidence` is `low`, or its `extraction_status` is
`needs-ocr`; each rejection is recorded with its named reason in the evidence log. A selected internal
or internal-derived record, including one carrying `citable: false`, is a
positive admission fixture when the remaining integrity checks pass.

## Complete attestation forms a cohort; it does not score it

Without a complete, hash-pinned attestation, F-03 remains outside the F-01/F-02 cohort. A complete
test-only attestation with a matching test pin must enumerate the exact F-01/F-02/F-03
candidate/strength scope and match every candidate profile before Step 2 admits one combined cohort.
The cohort artifact retains the attestation ID and SHA-256. Missing/mismatched pins and omitted,
duplicate, extra, or mismatched members fail closed. Step 2 does not calculate a score or declare a
ranking; those assertions belong to G-P4-03 after the decision engine exists.

## Evidence-log v2 prerequisite

G-P4-02 requires the evidence log to retain page-level provenance and named exclusions, while the
completed G-P4-01 explicitly proves that its version-1 evidence-log envelope remains unchanged and
does not carry those fields. `D20260727` assigns the representation, ownership,
versioning, compatibility policy, and test oracle. Execute
[Step 1E](./step-01e-evidence-log-v2-contract-delta.md) and obtain a fresh G-P4-01 pass before editing
this step.

Evidence-log v2 is the sole admitted-record and named-exclusion ledger. The cohort artifact retains
only admitted candidates, candidate map, store pin, attestation binding, and cohort basis; do not add
duplicate exclusions to `cohort.schema.json`. G-P4-02 must pass its actual builder result through
`validateEvidenceLog()` and the CLI publication boundary. A unit test against a private in-memory
shape cannot close the gate.

## Implementation contract — current-policy rewrite

Treat the 2026-07-24 `cohort-evidence.mjs`, `cohort-evidence.test.mjs`, G-P4-02 latest evidence, and
step-close evidence as historical only. Do not repair their old assertions. Replace the Step 2 test
suite first and generate a new G-P4-02 evidence record only from that replacement suite.

### Exact builder interface and result

`buildCohortEvidence()` accepts exactly one object with these keys:

```js
{
  records,                    // the explicitly supplied MVP package; no discovery or store read
  candidateMap,               // committed provenance.file -> candidate map
  candidateProfiles,          // candidate -> { api, strength, dosage_form, product_target, trial_context }
  rankingCandidates,          // requested candidate IDs, in desired cohort order
  cohortId,
  storeRecordsSha256,         // SHA-256 for the supplied committed fixture bytes
  factCards,                  // the validated v1 { schema_version, cards } envelope
  linearAttestation,          // null or the v2 attestation envelope
  linearAttestationPin        // null or an external 64-lowercase-hex SHA-256 pin
}
```

It returns exactly `{ cohort, evidenceLog }`; neither value is a private helper shape. `cohort` must
pass `validateCohort()` and contain every required v2 field: the admitted candidates in
`rankingCandidates` order, the complete supplied `candidateMap`, the supplied `storeRecordsSha256`,
the coupled attestation ID/hash values, and `cohort_basis`. `evidenceLog` must pass
`validateEvidenceLog()` and use the same `cohort_id`. The builder must not create a `cohort.exclusions`
field.

For reproducible assertions, `cohort_basis` is exactly one of:

- non-attested: `Strength-specific cohort: <candidate>@<strength>, <candidate>@<strength>` using the
  admitted candidates in order;
- attested: `Cross-strength cohort under linear attestation <attestation_id>.`

The builder validates the complete `factCards` envelope against the returned cohort and an ID-keyed
view of the supplied records. Each admitted evidence-log row contains the lexicographically sorted,
unique IDs of cards citing that same record and candidate; an admitted record with no card has `[]`.
It copies `record.provenance.file`, `page`, `char_start`, `char_end`, and `quote` verbatim into the
row. It never slices `record.content` using those page-global offsets.

### Pin source and combined-cohort rule

`linearAttestationPin` is an injected value; the builder does not read YAML or infer authority. A
non-null attestation requires a non-null pin exactly equal to the SHA-256 of
`canonicalBytes(linearAttestation)`. The production caller supplies the human-committed
`pins.linear_attestation_sha256`; while that pin is `null`, production cannot form a combined cohort.
The G-P4-02 test creates the test-only attestation at
`cowork-p2-kit/reasoning/tests/fixtures/contract/step-2-linear-attestation.json` and its pin at
`cowork-p2-kit/reasoning/tests/fixtures/contract/step-2-linear-attestation-pin.json`. The pin fixture
contains exactly `{ "linear_attestation_sha256": "<64 lowercase hex>" }`; its value is an immutable,
precomputed SHA-256 literal of the attestation's canonical bytes. The test passes that literal as
`linearAttestationPin`; missing and deliberately changed literals are negative cases. Test fixtures
never populate or repin the FD-owned production pin in `gates.yaml`.

Create the selected-package and extraction-quality record fixtures at
`cowork-p2-kit/reasoning/tests/fixtures/store/selected-internal-package.jsonl` and
`cowork-p2-kit/reasoning/tests/fixtures/store/extraction-quality-negatives.jsonl`. They supplement,
never modify, the byte-pinned `records.jsonl` baseline.

With no attestation, `linearAttestation` and `linearAttestationPin` are both `null`, and a candidate
whose strength differs from the first requested compatible candidate is excluded. With an attestation,
the declared candidate/strength members must match `rankingCandidates` exactly, each member must match
its candidate profile, all common profile fields must agree, and the pin must match before one combined
cohort is returned. This step forms a cohort only; it never computes a score, winner, or ranking.

### Deterministic refusal table

| Condition | Required outcome |
| --- | --- |
| Unknown `provenance.file` on a supplied record | Record exclusion `E_COHORT_CANDIDATE_MAP` |
| Low confidence | Record exclusion `E_EVIDENCE_LOW_CONFIDENCE` |
| `needs-ocr` extraction status | Record exclusion `E_EVIDENCE_NEEDS_OCR` |
| Requested candidate differs from the anchor in API, dosage form, product target, or trial context | Candidate exclusion `E_COHORT_PROFILE_MISMATCH` |
| Compatible requested candidate has a different strength without an attestation | Candidate exclusion `E_COHORT_STRENGTH_MISMATCH` |
| Malformed, incomplete, duplicate, extra, omitted, or profile-mismatched attestation member | Throw `E_LINEAR_ATTESTATION_INCOMPLETE`; return no artifact |
| Non-null attestation with a missing, malformed, or non-matching external pin | Throw `E_REASONING_ARTIFACT_BINDING`; return no artifact |
| Fact-card provenance/candidate mismatch, including a card that claims F-01 for an F-03 record | Throw `E_FACT_CANDIDATE_BINDING`; return no artifact |
| Fact-card value or unit absent from its quote | Throw `E_FACT_QUOTE_VALUE_UNIT`; return no artifact |
| Fact-card quote/segment-local offsets do not bind its record content | Throw `E_FACT_QUOTE_OFFSET`; return no artifact |

`classification.label`, `classification.citable`, and absent document-control fields are deliberately
absent from this table: they never cause an exclusion inside the explicitly supplied package. No new
error taxonomy is introduced by Step 2.

Gate: G-P4-02, run as
`node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-02 cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs`.
Depends on G-P4-01.

## Closure status — 2026-07-27

**Revised for FD-selected-package admission and v2 attestation policy.**

G-P4-02 passed 19/19 against the revised policy. The builder now:
- Accepts `storeRecordsSha256` and `linearAttestationPin` parameters
- Returns a full v2 cohort artifact that passes `validateCohort()`
- Returns a v2 evidence log that passes `validateEvidenceLog()`
- Validates fact-card bindings against the cohort and store
- Validates attestation pin against canonical bytes
- Admits selected internal/internal-derived records without document-control gating
- Excludes low-confidence and needs-OCR records with named reasons
- Forms combined cross-strength cohorts only with complete, hash-pinned attestations
- Refuses requested ranking candidates that have no committed candidate-map identity
- Rejects unrelated attestations for non-attested publication and removes stale attestation output atomically

The retained closure evidence is
`docs/reports/qbd-p4-reasoning-layer/gates/G-P4-02.json`.

<!-- Updated: Validation Session 1 - fact cards as admission unit, quote containment, per-gate command -->
<!-- Updated: Red Team Session 2026-07-24 - committed store snapshot, candidate map as identity source, synthetic inadmissible records -->
