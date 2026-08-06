# Template Receipt to Ingest Contract Research

Date: 2026-08-05
Scope: planning research only; no production promotion

## Recommendation

Use a **same-source, document-level join** for the isolated trial:

1. Keep the completed five-entry `template-cell-receipt/v1` unchanged, including
   `record_projection.status = "not_available"` and null `record_id` values.
2. Copy the exact filled public/mock DOCX bytes into a temporary kit root and
   assert their SHA-256 equals `receipt.source_document_sha256` before parsing.
3. Run the existing `runIngest` pipeline against that isolated copy and the
   unchanged `store/records.schema.json`. This is the sole authority for
   renderer-derived `page`, `char_start`, `char_end`, `quote`, and record IDs.
4. Write a trial-only join manifest that binds the receipt hash, source-document
   hash, isolated records JSONL hash, and record IDs. Per-entry matches are
   optional exact-substring observations; unmatched or ambiguous values remain
   explicitly unmapped.
5. Smoke-test the generated records with `buildCohortEvidence` using an explicit
   trial candidate map/profile, but do not publish a reasoning package.

This is the smallest bridge that produces records usable by current reasoning
without inventing page data or changing public contracts. It is a join between
two truthful views of the **same source bytes**, not a claim that OOXML cell
coordinates have been converted into page coordinates.

## Current Contract Facts

- The receipt records exact raw values, stable occurrence IDs, tagged OOXML
  owners, and cell-level hashes. Its schema already permits string `record_id`
  values and an `available` projection, but the completed MVP intentionally and
  correctly emits no records because it lacks page provenance.
- `store/records.schema.json` requires non-null `file`, 1-indexed `page`,
  page-global offsets, exact `quote`, and `page_kind` (`pdf` or
  `renderer-derived`). `buildRecords` obtains those only from LiteParse pages;
  `verifyRoundTrips` reparses the same file and checks the exact substring.
- `runIngest` is already the required composition boundary:
  `admitInputs -> buildRecords -> verifyRoundTrips -> publishRecords`.
- Reasoning can consume high-confidence, `ok` records when
  `provenance.file` is present in its candidate map. `buildCohortEvidence` copies
  the record's page/offset/quote into the evidence log. Reasoning publication
  later demands an exact store/evidence binding.
- `buildCohortEvidence` does **not** check `classification.citable`. Therefore
  records classified `citable: false` are suitable only for a guarded trial
  smoke test, not reasoning publication.
- The requested path `cowork-p2-kit/ingest/records.schema.json` does not exist;
  the owning public schema is `cowork-p2-kit/store/records.schema.json`.

GitNexus was four commits behind HEAD, so it was not refreshed under the
report-only write constraint. Its indexed context still confirmed that
`runIngest` calls `buildRecords`, `verifyRoundTrips`, and `publishRecords`, and
that `buildCohortEvidence` feeds the reasoning contract validators. Current
source and tests were used as the authority for the newer template probe.

## Empirical Provenance Check

LiteParse reported version `2.0.0` and parsed the unchanged filled public/mock
DOCX into three pages. Exact page-text presence for the five receipt values was:

| Field | Exact raw value present in page text? |
| --- | --- |
| `PDS-180-CT02` (`29,08`) | Yes |
| `UOM-SPEC` (`± 5% `) | No |
| `API-NAME` (`bisoprolol fumarate 90`) | No |
| `ASSAY-SPEC` (`110%`) | Yes |
| `BATCH-SIZE` (`1.000 viên`) | Yes |

The rendered/OCR text contains transformations such as `KLTB + 5%`, so a
complete five-field receipt-to-page crosswalk cannot be claimed from exact
matching. This does not prevent the same-source ingest record set from being
used by reasoning, but it does prevent claiming that every receipt entry has a
truthful current-contract record ID.

## Approaches Compared

### A. Same-source dual extraction and join manifest (recommended for trial)

The receipt remains the authority for OOXML owner/value evidence. Existing
ingest runs independently over an isolated copy of the exact same DOCX bytes
and remains the authority for page evidence. A new sidecar binds the two at the
document/hash level.

Schema and provenance implications:

- No changes to the receipt, record, ingest, or reasoning schemas.
- The isolated classification manifest should be `label: "public"` and
  `citable: false`.
- Record provenance truthfully names the isolated same-byte DOCX and contains
  only LiteParse-derived page/offset/quote values.
- A small trial-only join schema should contain at least:
  `receipt_sha256`, `source_document_sha256`, `source_path`,
  `records_sha256`, `record_count`, sorted `record_ids`, and per-occurrence
  `match_status` (`exact`, `unmapped`, or `ambiguous`). Exact matches may carry
  a record ID and record-local value offsets; unmapped/ambiguous entries must
  carry neither.
- The original receipt must continue to say projection unavailable. The join
  manifest is sibling trial evidence, not a rewritten receipt.

Advantages: minimal, uses the real ingest pipeline, preserves every public
contract, and gives reasoning a normal record store. Limitation: document-level
lineage is complete, while field-to-page lineage is partial.

### B. Direct native-OOXML provenance migration

Extend the public record contract with a tagged provenance union, for example
existing `renderer-derived` provenance versus an `ooxml-owner` variant carrying
the receipt's table/row/cell or paragraph owner plus source and receipt hashes.
Template entries could then become one record each without page claims.

Schema and provenance implications:

- Requires a versioned change to `store/records.schema.json`; silently adding
  dummy page 1/offset 0/quote values is not acceptable.
- Requires new deterministic ID semantics for OOXML records.
- Requires reasoning evidence-log and publication contracts to accept and bind
  the same tagged provenance union. Current reasoning explicitly requires a
  positive page and increasing offsets and compares them to the store record.
- Requires qbd_core/shared-schema compatibility review and migration evidence.

Advantages: preserves first-class per-field provenance back to the original
DOCX owner. Disadvantages: it is a cross-layer public-contract migration, not a
minimum trial bridge. It needs explicit user approval and should be considered
only for promotion.

### C. Derived linear projection document (fallback, not first choice)

A deterministic non-citable DOCX can linearize receipt occurrence IDs and raw
values, then pass through normal ingest. A temporary proof preserved all five
raw values exactly, including the trailing space in `± 5% `, and produced one
renderer-derived page. Its page provenance is truthful only for the derived
document, not the original filled template.

This is useful only if the trial requires an exact five-of-five reasoning input
and accepts derived-source provenance. It adds a transformation and lineage
artifact, so prefer the same-source join unless that stricter trial outcome is
explicitly requested.

## Likely Implementation Inventory

Recommended approach creates only:

- `cowork-p2-kit/template-probe/template-ingest-bridge.mjs`
  - `assertSameSourceBinding(receipt, sourceBytes)`
  - `runSameSourceIngestTrial({ receipt, fieldMap, sourcePath, outputRoot })`
  - `buildTemplateIngestJoin({ receipt, records, storeHash, sourcePath })`
  - CLI arguments should require receipt, selected map, source, and an absolute
    isolated output root.
- `cowork-p2-kit/template-probe/contracts/template-ingest-bridge.schema.v1.json`
  - closed, trial-only join manifest described above.
- `cowork-p2-kit/template-probe/tests/template-ingest-bridge.test.mjs`
  - synthetic focused tests plus one isolated official five-field trial.

Existing symbols should be imported, not edited:

- `assertCellReceipt`, `canonicalJson`, and `sha256` from template-probe.
- `createConfig` and `runIngest` from ingest.
- `validateJsonl` and `verifyRoundTrips` for assertions.
- `buildCohortEvidence` for a non-publishing reasoning compatibility smoke test.

The runner should create its own `inputs/`, `store/`, and `artifacts/` under the
provided isolated root; copy the source DOCX bytes and unchanged record schema;
write a one-file public/non-citable classification manifest; then run with the
real installed LiteParse, LibreOffice, Ghostscript, and tessdata. The required
dependencies are currently present. No file under canonical `inputs/` or
`store/` is an output target.

If approach B is approved, likely changed surfaces expand to:

- `cowork-p2-kit/store/records.schema.json`
- `cowork-p2-kit/ingest/records.mjs` and record-contract tests
- `cowork-p2-kit/template-probe/template-record-extractor.mjs` and receipt tests
- `cowork-p2-kit/reasoning/evidence-log.schema.json`
- `cowork-p2-kit/reasoning/contracts.mjs`
- `cowork-p2-kit/reasoning/cohort-evidence.mjs`
- `cowork-p2-kit/reasoning/publication.mjs`
- corresponding reasoning contract, cohort, publication, and end-to-end tests

That migration inventory is intentionally excluded from the isolated trial.

## Tests to Reuse and Missing Tests

Reuse:

- `template-record-extractor.test.mjs`: exact raw values, occurrence joins,
  unavailable projection, and deterministic receipts.
- `template-workflow-probe.test.mjs`: official five-field selection, two-run
  determinism, and canonical input/store immutability.
- `ingest/tests/record-contract.test.mjs`: required record fields,
  deterministic IDs, relative paths, and page substring checks.
- `ingest/tests/pipeline.test.mjs`: isolated CLI/public boundary and fixed
  `runIngest` success contract.
- `ingest/tests/determinism.integration.test.mjs`: two real-LiteParse runs,
  schema validation, JSONL byte equality, and `verifyRoundTrips`.
- `reasoning/tests/cohort-evidence.test.mjs`: candidate-map admission and exact
  evidence-log provenance retention.

Missing tests for the new bridge:

1. Reject source bytes whose hash differs from `source_document_sha256` before
   invoking ingest.
2. Reject a receipt/selected-map hash or occurrence mismatch.
3. Run against an isolated same-byte DOCX and prove every emitted record passes
   the unchanged schema and round-trip verifier.
4. Assert exact matches only when one record contains the raw value; encode zero
   and multiple matches without a record ID.
5. Assert the empirical five-field result does not claim five exact mappings.
6. Run twice and compare records and join-manifest canonical bytes/hashes.
7. Snapshot the canonical template, mock, `inputs/`, and `store/` before/after.
8. Prove a supplied trial candidate map/profile lets `buildCohortEvidence`
   consume at least one high/ok record without invoking reasoning publication.
9. Reject an output root inside canonical `inputs/`, canonical `store/`, or the
   source tree.

## Validation Commands

```bash
node --check cowork-p2-kit/template-probe/template-ingest-bridge.mjs
node --test cowork-p2-kit/template-probe/tests/template-ingest-bridge.test.mjs
node --test cowork-p2-kit/template-probe/tests/template-record-extractor.test.mjs cowork-p2-kit/template-probe/tests/template-workflow-probe.test.mjs
node --test cowork-p2-kit/ingest/tests/record-contract.test.mjs cowork-p2-kit/ingest/tests/determinism.integration.test.mjs
node --test cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs
git diff --check
```

Do not run the write-capable full ingest gate verifier merely to validate this
trial; it updates committed gate evidence. Run the bridge's isolated real-tool
test instead.

## Rollback Boundary

The rollback unit is the three new bridge files plus the caller-supplied
isolated output root. Deleting those restores the exact pre-trial state. No
receipt, canonical input, canonical store, public schema, ingest module, or
reasoning module should require rollback.

## Trial-Only Versus Promotion

Trial-only:

- Same-source hash binding, isolated ingest, non-citable records, join manifest,
  and a reasoning admission smoke test.
- Partial exact per-field mapping is acceptable only when reported honestly.
- No reasoning publication, dossier citation, canonical store admission, or
  public-contract change.

Promotion requires a separate decision and plan covering native provenance or
another verified five-of-five mapping method, schema versioning, qbd_core
compatibility, reasoning enforcement of `classification.citable`, security and
contract review, public documentation, and full write-capable gates.

## Hard Blockers and User Decisions

1. **Required join granularity:** approve document-level same-source lineage for
   the isolated trial, or require every receipt occurrence to map to a record.
   The latter is blocked under the current original-DOCX renderer output for at
   least `UOM-SPEC` and `API-NAME`.
2. **Candidate identity:** reasoning needs an explicit candidate ID and complete
   profile. These are business inputs and must not be inferred from the five
   placeholders. Without them, stop after schema-valid records.
3. **Derived-source fallback:** if five-of-five reasoning input is mandatory,
   decide whether a non-citable deterministic projection DOCX is acceptable.
   Otherwise approve the larger native-provenance migration.
4. **Promotion:** any change to the record or reasoning provenance contract
   requires explicit migration approval; the isolated trial does not grant it.

## Unresolved Questions

1. Is document-level same-source lineage sufficient for this trial, with exact
   receipt-entry mappings reported as partial rather than required?
2. What explicit trial candidate ID/profile should be used for the reasoning
   compatibility smoke test, if reasoning is in scope beyond record creation?
3. If five-of-five field mapping is mandatory, is derived-document provenance
   acceptable, or should planning move directly to a versioned OOXML provenance
   migration?
