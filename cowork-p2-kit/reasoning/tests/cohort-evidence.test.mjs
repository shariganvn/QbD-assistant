import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createReasoningCli } from "../cli.mjs";
import { validateEvidenceLog } from "../contracts.mjs";
import { ReasoningContractError } from "../errors.mjs";
import { buildCohortEvidence } from "../cohort-evidence.mjs";
import { canonicalBytes } from "../publication.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const storeFixtureDir = resolve(testDir, "fixtures/store");
const contractFixtureDir = resolve(testDir, "fixtures/contract");

const readJsonl = (name) => readFileSync(resolve(storeFixtureDir, name), "utf8")
  .trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const readJson = (name) => JSON.parse(readFileSync(resolve(contractFixtureDir, name), "utf8"));

const storeRecords = readJsonl("records.jsonl");
const selectedInternalRecords = readJsonl("selected-internal-package.jsonl");
const extractionNegatives = readJsonl("extraction-quality-negatives.jsonl");

function fixturePackage(name) {
  const bytes = readFileSync(resolve(storeFixtureDir, name));
  return {
    bytes,
    records: bytes.toString("utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function packageFromRecords(records) {
  const bytes = Buffer.from(`${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return {
    bytes,
    records: bytes.toString("utf8").trim().split("\n").map((line) => JSON.parse(line)),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const baselinePackage = fixturePackage("records.jsonl");
const BASELINE_STORE_SHA256 = "6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56";
const storeRecordsSha256 = BASELINE_STORE_SHA256;

const candidateMap = {
  "inputs/trials/formulation-trial-01.docx": "F-01",
  "inputs/trials/formulation-trial-02.docx": "F-02",
  "inputs/trials/formulation-trial-03.docx": "F-03",
};

const candidateProfiles = {
  "F-01": { api: "bisoprolol fumarate", strength: "5 mg", dosage_form: "film-coated tablet", product_target: "immediate release", trial_context: "comparative trial" },
  "F-02": { api: "bisoprolol fumarate", strength: "5 mg", dosage_form: "film-coated tablet", product_target: "immediate release", trial_context: "comparative trial" },
  "F-03": { api: "bisoprolol fumarate", strength: "10 mg", dosage_form: "film-coated tablet", product_target: "immediate release", trial_context: "comparative trial" },
};

const testAttestation = readJson("step-2-linear-attestation.json");
const testAttestationPin = readJson("step-2-linear-attestation-pin.json").linear_attestation_sha256;

const miniRecord = {
  id: "cli-test-record-001",
  content: "Assay result: 98.5 mg",
  provenance: { file: "inputs/cli-test.docx", page: 1, char_start: 0, char_end: 22, quote: "Assay result: 98.5 mg" },
  confidence: "high",
  extraction_status: "ok",
};
const miniStoreBytes = Buffer.from(JSON.stringify(miniRecord) + "\n");
const miniStoreSha256 = createHash("sha256").update(miniStoreBytes).digest("hex");
const miniMap = { "inputs/cli-test.docx": "F-01" };
const miniProfiles = { "F-01": candidateProfiles["F-01"] };

function miniBuild(options = {}) {
  return buildCohortEvidence({
    records: [miniRecord],
    candidateMap: miniMap,
    candidateProfiles: miniProfiles,
    rankingCandidates: ["F-01"],
    cohortId: "cohort-cli-test",
    storeRecordsSha256: miniStoreSha256,
    ...options,
  });
}

function miniFactCards(cards = [{ id: "FC-CLI-001", measure: "assay" }]) {
  return {
    schema_version: 1,
    cards: cards.map(({ id, measure }) => ({
      id, record_id: miniRecord.id, candidate: "F-01", measure,
      raw_text: "98.5 mg", normalized_value: 98.5, unit: "mg",
      quote: miniRecord.content, char_start: 0, char_end: miniRecord.content.length,
      provenance: { file: miniRecord.provenance.file },
    })),
  };
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalBytes(value)).digest("hex");
}

function build(options = {}) {
  return buildCohortEvidence({
    records: baselinePackage.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: ["F-01", "F-02", "F-03"],
    cohortId: "cohort-test",
    storeRecordsSha256,
    ...options,
  });
}

test("baseline package is the committed 17-record byte-pinned store", () => {
  assert.equal(baselinePackage.records.length, 17);
  assert.equal(baselinePackage.sha256, BASELINE_STORE_SHA256);
});

// --- G-P4-02: Non-attested cohort excludes different-strength candidates ---

test("without attestation, F-03 at 10 mg is excluded from 5 mg cohort", () => {
  const result = build();
  assert.deepEqual(result.cohort.candidates, ["F-01", "F-02"]);
  assert.equal(result.cohort.linear_attestation_id, null);
  assert.equal(result.cohort.linear_attestation_sha256, null);
  assert.ok(result.cohort.cohort_basis.includes("Strength-specific"));
  assert.equal(Object.hasOwn(result.cohort, "exclusions"), false);
  assert.ok(result.evidenceLog.exclusions.some(
    (e) => e.scope === "candidate" && e.candidate === "F-03" && e.reason === "E_COHORT_STRENGTH_MISMATCH"
  ));
  assert.ok(result.evidenceLog.entries.every((e) => e.candidate !== "F-03"));
  assert.deepEqual(result.cohort.provenance_candidate_map, candidateMap);
  assert.deepEqual(validateEvidenceLog(result.evidenceLog), result.evidenceLog);
});

// --- G-P4-02: Attested cohort admits all declared members ---

test("complete attestation with matching pin produces combined cohort", () => {
  const result = build({ linearAttestation: testAttestation, linearAttestationPin: testAttestationPin });
  assert.deepEqual(result.cohort.candidates, ["F-01", "F-02", "F-03"]);
  assert.equal(result.cohort.linear_attestation_id, testAttestation.attestation_id);
  assert.equal(result.cohort.linear_attestation_sha256, testAttestationPin);
  assert.ok(result.cohort.cohort_basis.includes("Cross-strength"));
  assert.ok(result.evidenceLog.entries.some((e) => e.candidate === "F-03"));
  assert.deepEqual(validateEvidenceLog(result.evidenceLog), result.evidenceLog);
});

// --- G-P4-02: Attestation rejection cases ---

test("incomplete attestation is rejected", () => {
  const incomplete = { ...testAttestation, members: testAttestation.members.slice(0, 2) };
  assert.throws(
    () => build({ linearAttestation: incomplete, linearAttestationPin: testAttestationPin }),
    (err) => err instanceof ReasoningContractError && err.code === "E_LINEAR_ATTESTATION_INCOMPLETE"
  );
});

test("attestation scope mismatch is rejected even with a matching pin", () => {
  const wrongScope = {
    ...testAttestation,
    members: [...testAttestation.members.slice(0, 2), { candidate: "F-04", strength: "10 mg" }],
  };
  assert.throws(
    () => build({ linearAttestation: wrongScope, linearAttestationPin: canonicalSha256(wrongScope) }),
    (err) => err instanceof ReasoningContractError && err.code === "E_LINEAR_ATTESTATION_INCOMPLETE"
  );
});

test("attestation profile mismatch is rejected even with a matching pin", () => {
  const wrongProfile = { ...testAttestation, product_target: "modified release" };
  assert.throws(
    () => build({ linearAttestation: wrongProfile, linearAttestationPin: canonicalSha256(wrongProfile) }),
    (err) => err instanceof ReasoningContractError && err.code === "E_LINEAR_ATTESTATION_INCOMPLETE"
  );
});

test("attestation with missing pin is rejected", () => {
  assert.throws(
    () => build({ linearAttestation: testAttestation, linearAttestationPin: null }),
    (err) => err instanceof ReasoningContractError && err.code === "E_REASONING_ARTIFACT_BINDING"
  );
});

test("attestation with wrong pin is rejected", () => {
  assert.throws(
    () => build({ linearAttestation: testAttestation, linearAttestationPin: "a".repeat(64) }),
    (err) => err instanceof ReasoningContractError && err.code === "E_REASONING_ARTIFACT_BINDING"
  );
});

test("null attestation with non-null pin is rejected", () => {
  assert.throws(
    () => build({ linearAttestation: null, linearAttestationPin: testAttestationPin }),
    (err) => err instanceof ReasoningContractError && err.code === "E_REASONING_ARTIFACT_BINDING"
  );
});

// --- G-P4-02: Internal/admissible records admitted, extraction negatives excluded ---

test("selected internal records are admitted; low-confidence and needs-OCR are excluded", () => {
  const selectedPackage = fixturePackage("selected-internal-package.jsonl");
  const selectedResult = build({ records: selectedPackage.records, storeRecordsSha256: selectedPackage.sha256 });
  // Internal records should be admitted
  for (const id of ["synthetic-label-internal", "synthetic-label-internal-derived", "synthetic-not-citable"]) {
    assert.ok(selectedResult.evidenceLog.entries.some((e) => e.record_id === id), `expected ${id} admitted`);
  }
  const negativesPackage = fixturePackage("extraction-quality-negatives.jsonl");
  const negativesResult = build({ records: negativesPackage.records, storeRecordsSha256: negativesPackage.sha256 });
  // Extraction negatives should be excluded
  for (const [id, reason] of [["synthetic-low-confidence", "E_EVIDENCE_LOW_CONFIDENCE"], ["synthetic-needs-ocr", "E_EVIDENCE_NEEDS_OCR"]]) {
    assert.ok(negativesResult.evidenceLog.exclusions.some(
      (e) => e.scope === "record" && e.record_id === id && e.reason === reason
    ), `expected ${id} excluded with ${reason}`);
  }
});

// --- G-P4-02: Unknown provenance excluded ---

test("record with unknown provenance.file is excluded with E_COHORT_CANDIDATE_MAP", () => {
  const badRecord = {
    id: "bad-provenance",
    content: "test content",
    provenance: { file: "inputs/unknown.docx", page: 1, char_start: 0, char_end: 11, quote: "test content" },
    confidence: "high",
    extraction_status: "ok",
  };
  const suppliedPackage = packageFromRecords([...baselinePackage.records, badRecord]);
  const result = build({ records: suppliedPackage.records, storeRecordsSha256: suppliedPackage.sha256 });
  assert.ok(result.evidenceLog.exclusions.some(
    (e) => e.scope === "record" && e.record_id === "bad-provenance" && e.reason === "E_COHORT_CANDIDATE_MAP"
  ));
});

// --- G-P4-02: Evidence log entries preserve provenance ---

test("admitted entries retain provenance file, page, char offsets, and quote", () => {
  const result = build();
  for (const entry of result.evidenceLog.entries) {
    const record = baselinePackage.records.find((r) => r.id === entry.record_id);
    assert.ok(record, `record ${entry.record_id} exists`);
    assert.equal(entry.provenance.file, record.provenance.file);
    assert.equal(entry.provenance.page, record.provenance.page);
    assert.equal(entry.provenance.char_start, record.provenance.char_start);
    assert.equal(entry.provenance.char_end, record.provenance.char_end);
    assert.equal(entry.quote, record.provenance.quote);
  }
});

// --- G-P4-02: Fact-card candidate/provenance binding ---

test("card citing wrong candidate for an admitted record is refused", () => {
  const badCards = {
    schema_version: 1,
    cards: [{
      id: "FC-BAD-001",
      record_id: miniRecord.id,
      candidate: "F-02", // wrong: this admitted record maps to F-01
      measure: "assay",
      raw_text: "98.5 mg",
      normalized_value: 98.5,
      unit: "mg",
      quote: miniRecord.content,
      char_start: 0,
      char_end: miniRecord.content.length,
      provenance: { file: miniRecord.provenance.file },
    }],
  };
  assert.throws(
    () => miniBuild({ factCards: badCards }),
    (err) => err instanceof ReasoningContractError && err.code === "E_FACT_CANDIDATE_BINDING"
  );
});

// --- G-P4-02: Fact-card value/unit absent from quote ---

test("card whose admitted-record quote omits its value is refused", () => {
  const badCards = {
    schema_version: 1,
    cards: [{
      id: "FC-BAD-002",
      record_id: miniRecord.id,
      candidate: "F-01",
      measure: "assay",
      raw_text: "98.5 mg",
      normalized_value: 98.5,
      unit: "mg",
      quote: "Assay result: 99.5 mg",
      char_start: 0,
      char_end: miniRecord.content.length,
      provenance: { file: miniRecord.provenance.file },
    }],
  };
  assert.throws(
    () => miniBuild({ factCards: badCards }),
    (err) => err instanceof ReasoningContractError && err.code === "E_FACT_QUOTE_VALUE_UNIT"
  );
});

test("card whose admitted-record offsets do not bind content is refused", () => {
  const badCards = {
    schema_version: 1,
    cards: [{
      id: "FC-BAD-003", record_id: miniRecord.id, candidate: "F-01", measure: "assay",
      raw_text: "99.5 mg", normalized_value: 99.5, unit: "mg",
      quote: "Assay result: 99.5 mg", char_start: 0, char_end: miniRecord.content.length,
      provenance: { file: miniRecord.provenance.file },
    }],
  };
  assert.throws(
    () => miniBuild({ factCards: badCards }),
    (err) => err instanceof ReasoningContractError && err.code === "E_FACT_QUOTE_OFFSET"
  );
});

// --- G-P4-02: Cohort artifact passes validateCohort ---

test("cohort artifact has all required v2 fields and passes validation", () => {
  const result = build();
  assert.equal(result.cohort.schema_version, 2);
  assert.equal(typeof result.cohort.cohort_id, "string");
  assert.ok(Array.isArray(result.cohort.candidates));
  assert.ok(typeof result.cohort.provenance_candidate_map === "object");
  assert.equal(result.cohort.store_records_sha256, storeRecordsSha256);
  assert.equal(result.cohort.linear_attestation_id, null);
  assert.equal(result.cohort.linear_attestation_sha256, null);
  assert.equal(typeof result.cohort.cohort_basis, "string");
});

test("requested ranking candidate without a committed candidateMap entry fails closed", () => {
  assert.throws(
    () => build({ rankingCandidates: ["F-01", "F-04"] }),
    (err) => err instanceof ReasoningContractError && err.code === "E_COHORT_CANDIDATE_MAP"
  );
});

// --- G-P4-02: Builder output validates and publishes through CLI ---

test("builder output validates and publishes through the CLI", () => {
  const factCards = miniFactCards([
    { id: "FC-CLI-002", measure: "assay-secondary" },
    { id: "FC-CLI-001", measure: "assay-primary" },
  ]);
  const result = miniBuild({ factCards });
  assert.deepEqual(validateEvidenceLog(result.evidenceLog), result.evidenceLog);
  assert.deepEqual(result.evidenceLog.entries[0].fact_card_ids, ["FC-CLI-001", "FC-CLI-002"]);
  const temp = mkdtempSync(join(tmpdir(), "reasoning-step2-cli-"));
  try {
    const storePath = join(temp, "store.jsonl");
    writeFileSync(storePath, miniStoreBytes);
    const cohortPath = join(temp, "cohort.json");
    writeFileSync(cohortPath, canonicalBytes(result.cohort));
    const evidencePath = join(temp, "evidence-log.json");
    writeFileSync(evidencePath, canonicalBytes(result.evidenceLog));
    const factCardsPath = join(temp, "fact-cards.json");
    writeFileSync(factCardsPath, canonicalBytes(factCards));
    const decisionPath = join(temp, "decision.json");
    writeFileSync(decisionPath, canonicalBytes({
      schema_version: 2, decision_id: "dec-cli-test", status: "inconclusive", winner: null,
      cohort_id: "cohort-cli-test", fact_card_ids: ["FC-CLI-001", "FC-CLI-002"], rubric_sha256: null, fd_action: "test",
      linear_attestation_id: null, linear_attestation_sha256: null,
      cohort_basis: result.cohort.cohort_basis,
    }));
    const output = createReasoningCli({ publicationRoot: temp }).main([
      "publish",
      "--decision", decisionPath,
      "--cohort", cohortPath,
      "--fact-cards", factCardsPath,
      "--evidence-log", evidencePath,
      "--store", storePath,
      "--output-root", temp,
    ]);
    assert.equal(output, temp);
    assert.equal(existsSync(join(temp, "linear-attestation.json")), false);

    writeFileSync(join(temp, "linear-attestation.json"), canonicalBytes(testAttestation));
    createReasoningCli({ publicationRoot: temp }).main([
      "publish", "--decision", decisionPath, "--cohort", cohortPath, "--fact-cards", factCardsPath,
      "--evidence-log", evidencePath, "--store", storePath, "--output-root", temp,
    ]);
    assert.equal(existsSync(join(temp, "linear-attestation.json")), false);

    writeFileSync(storePath, Buffer.concat([miniStoreBytes, Buffer.from("\n")]));
    assert.throws(
      () => createReasoningCli({ publicationRoot: temp }).main([
        "publish", "--decision", decisionPath, "--cohort", cohortPath, "--fact-cards", factCardsPath,
        "--evidence-log", evidencePath, "--store", storePath, "--output-root", temp,
      ]),
      (err) => err instanceof ReasoningContractError && err.code === "E_STORE_SHA256"
    );

    writeFileSync(storePath, miniStoreBytes);
    const unrelatedAttestationPath = join(temp, "unrelated-attestation.json");
    writeFileSync(unrelatedAttestationPath, canonicalBytes(testAttestation));
    assert.throws(
      () => createReasoningCli({ publicationRoot: temp }).main([
        "publish", "--decision", decisionPath, "--cohort", cohortPath, "--fact-cards", factCardsPath,
        "--linear-attestation", unrelatedAttestationPath, "--evidence-log", evidencePath,
        "--store", storePath, "--output-root", temp,
      ]),
      (err) => err instanceof ReasoningContractError && err.code === "E_REASONING_ARTIFACT_BINDING"
    );
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

// --- G-P4-02: Deterministic ordering ---

test("entries sorted by record_id, exclusions sorted deterministically", () => {
  const result = build();
  const entryIds = result.evidenceLog.entries.map((e) => e.record_id);
  assert.deepEqual(entryIds, [...entryIds].sort());
  const exclusionKeys = result.evidenceLog.exclusions.map(
    (e) => [e.scope, e.candidate, e.record_id ?? "", e.reason].join("\0")
  );
  assert.deepEqual(exclusionKeys, [...exclusionKeys].sort());
});
