import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ReasoningContractError,
  validateCohort,
  validateDecision,
  validateEvidenceLog,
  validateFactCards,
  validateLinearAttestation,
  validateSelectionRubric,
} from "../contracts.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/contract");
const records = JSON.parse(readFileSync(resolve(fixtureDir, "store-records.json"), "utf8"));
const fixture = (name) => JSON.parse(readFileSync(resolve(fixtureDir, `${name}.json`), "utf8"));

const ATTESTATION_CANONICAL_SHA256 = "fbba9e2dbffaa3c3bbe5696185e3c2c59d1e2693f14ac76b13cb09f3aa89cc95";
const STORE_SHA256 = "7c141b7b74477b6df3f1c66872ca121679a591df74c46e097f4f4e8c89951970";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalBytes(value) {
  return JSON.stringify(canonicalize(value), null, 2) + "\n";
}

function sha256hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ReasoningContractError);
    assert.equal(error.code, code);
    return true;
  });
}

// --- V2 linear attestation ---

test("G-P4-01 accepts a valid v2 cross-strength linear attestation", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  assert.deepEqual(validateLinearAttestation(attestation), attestation);
  assert.equal(attestation.schema_version, 2);
  assert.ok(attestation.members.length >= 2);
  const strengths = new Set(attestation.members.map((m) => m.strength));
  assert.ok(strengths.size >= 2);
});

test("G-P4-01 rejects a v1 linear attestation with E_LINEAR_ATTESTATION_INCOMPLETE", () => {
  const v1 = fixture("v1-linear-attestation");
  expectCode(() => validateLinearAttestation(v1), "E_LINEAR_ATTESTATION_INCOMPLETE");
});

test("G-P4-01 rejects an attestation with fewer than two members", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.members = [{ candidate: "F-01", strength: "5 mg" }];
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_INCOMPLETE");
});

test("G-P4-01 rejects an attestation with fewer than two distinct strengths", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.members = [
    { candidate: "F-01", strength: "5 mg" },
    { candidate: "F-02", strength: "5 mg" },
  ];
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_INCOMPLETE");
});

test("G-P4-01 rejects an attestation with a duplicate candidate/strength pair", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.members = [
    { candidate: "F-01", strength: "5 mg" },
    { candidate: "F-01", strength: "5 mg" },
    { candidate: "F-03", strength: "10 mg" },
  ];
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_ENVELOPE");
});

test("G-P4-01 rejects an attestation with an empty candidate string", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.members = [
    { candidate: "", strength: "5 mg" },
    { candidate: "F-03", strength: "10 mg" },
  ];
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_ENVELOPE");
});

test("G-P4-01 rejects an attestation with an empty strength string", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.members = [
    { candidate: "F-01", strength: "" },
    { candidate: "F-03", strength: "10 mg" },
  ];
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_ENVELOPE");
});

test("G-P4-01 rejects an attestation that still carries approved_sha256", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.approved_sha256 = null;
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_ENVELOPE");
});

test("G-P4-01 rejects an attestation with a wrong required_fields order", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  attestation.required_fields = ["api", "members", "dosage_form", "product_target", "trial_context"];
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_INCOMPLETE");
});

// --- V2 cohort ---

test("G-P4-01 accepts a valid v2 non-attested cohort", () => {
  const cohort = fixture("valid-cohort-v2");
  assert.deepEqual(validateCohort(cohort), cohort);
  assert.equal(cohort.schema_version, 2);
  assert.equal(cohort.linear_attestation_id, null);
  assert.equal(cohort.linear_attestation_sha256, null);
  assert.ok(cohort.cohort_basis.length > 0);
});

test("G-P4-01 accepts a valid v2 attested cohort", () => {
  const cohort = fixture("valid-cohort-attested-v2");
  assert.deepEqual(validateCohort(cohort), cohort);
  assert.equal(cohort.linear_attestation_id, "attestation-fixture-v2-001");
  assert.equal(cohort.linear_attestation_sha256, ATTESTATION_CANONICAL_SHA256);
});

test("G-P4-01 rejects a v1 cohort with E_COHORT_ENVELOPE", () => {
  const v1 = fixture("v1-cohort");
  expectCode(() => validateCohort(v1), "E_COHORT_ENVELOPE");
});

test("G-P4-01 rejects a cohort with half-null attestation ID (ID null, hash non-null)", () => {
  const cohort = fixture("valid-cohort-v2");
  cohort.linear_attestation_id = null;
  cohort.linear_attestation_sha256 = ATTESTATION_CANONICAL_SHA256;
  expectCode(() => validateCohort(cohort), "E_COHORT_ENVELOPE");
});

test("G-P4-01 rejects a cohort with half-null attestation hash (ID non-null, hash null)", () => {
  const cohort = fixture("valid-cohort-v2");
  cohort.linear_attestation_id = "attestation-fixture-v2-001";
  cohort.linear_attestation_sha256 = null;
  expectCode(() => validateCohort(cohort), "E_COHORT_ENVELOPE");
});

test("G-P4-01 rejects a cohort with empty cohort_basis", () => {
  const cohort = fixture("valid-cohort-v2");
  cohort.cohort_basis = "";
  expectCode(() => validateCohort(cohort), "E_COHORT_ENVELOPE");
});

test("G-P4-01 rejects a cohort with an invalid attestation SHA-256", () => {
  const cohort = fixture("valid-cohort-attested-v2");
  cohort.linear_attestation_sha256 = "zz" + "0".repeat(62);
  expectCode(() => validateCohort(cohort), "E_COHORT_ENVELOPE");
});

// --- V2 decision ---

test("G-P4-01 accepts a valid v2 non-attested decision", () => {
  const decision = fixture("valid-decision-v2");
  assert.deepEqual(validateDecision(decision), decision);
  assert.equal(decision.schema_version, 2);
  assert.equal(decision.linear_attestation_id, null);
  assert.equal(decision.linear_attestation_sha256, null);
  assert.ok(decision.cohort_basis.length > 0);
});

test("G-P4-01 accepts a valid v2 attested decision", () => {
  const decision = fixture("valid-decision-attested-v2");
  assert.deepEqual(validateDecision(decision), decision);
  assert.equal(decision.linear_attestation_id, "attestation-fixture-v2-001");
  assert.equal(decision.linear_attestation_sha256, ATTESTATION_CANONICAL_SHA256);
});

test("G-P4-01 rejects a v1 decision with E_DECISION_ENVELOPE", () => {
  const v1 = fixture("v1-decision");
  expectCode(() => validateDecision(v1), "E_DECISION_ENVELOPE");
});

test("G-P4-01 rejects a decision with half-null attestation ID", () => {
  const decision = fixture("valid-decision-v2");
  decision.linear_attestation_id = null;
  decision.linear_attestation_sha256 = ATTESTATION_CANONICAL_SHA256;
  expectCode(() => validateDecision(decision), "E_DECISION_ENVELOPE");
});

test("G-P4-01 rejects a decision with half-null attestation hash", () => {
  const decision = fixture("valid-decision-v2");
  decision.linear_attestation_id = "attestation-fixture-v2-001";
  decision.linear_attestation_sha256 = null;
  expectCode(() => validateDecision(decision), "E_DECISION_ENVELOPE");
});

test("G-P4-01 rejects a decision with empty cohort_basis", () => {
  const decision = fixture("valid-decision-v2");
  decision.cohort_basis = "";
  expectCode(() => validateDecision(decision), "E_DECISION_ENVELOPE");
});

// --- Unrelated v1 artifacts remain valid ---

test("G-P4-01 retains v1 evidence-log and fact-card validation unchanged", () => {
  const cohort = fixture("valid-cohort-v2");
  assert.deepEqual(validateEvidenceLog(fixture("valid-evidence-log")), fixture("valid-evidence-log"));
  assert.deepEqual(validateFactCards(fixture("valid-fact-cards"), { cohort, records, minimumQuoteLength: 8 }), fixture("valid-fact-cards"));
});

test("G-P4-01 retains v1 selection-rubric validation unchanged", () => {
  assert.deepEqual(validateSelectionRubric(fixture("valid-selection-rubric")), fixture("valid-selection-rubric"));
});

// --- Canonical attestation hash stability ---

test("G-P4-01 canonical attestation hash is stable across object-key reorderings", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  const bytes1 = canonicalBytes(attestation);
  const reordered = { members: attestation.members, trial_context: attestation.trial_context, schema_version: attestation.schema_version, api: attestation.api, dosage_form: attestation.dosage_form, attestation_id: attestation.attestation_id, required_fields: attestation.required_fields, product_target: attestation.product_target };
  const bytes2 = canonicalBytes(reordered);
  assert.equal(sha256hex(bytes1), sha256hex(bytes2));
  assert.equal(sha256hex(bytes1), ATTESTATION_CANONICAL_SHA256);
});

test("G-P4-01 canonical attestation hash changes on semantic member change", () => {
  const attestation = fixture("valid-linear-attestation-v2");
  const original = sha256hex(canonicalBytes(attestation));
  attestation.members[0].candidate = "F-99";
  const changed = sha256hex(canonicalBytes(attestation));
  assert.notEqual(original, changed);
});

// --- Fact-card bindings ---

test("G-P4-01 validates fact candidate, value/unit, offset, and minimum quote bindings independently", () => {
  const cohort = fixture("valid-cohort-v2");
  const options = { cohort, records, minimumQuoteLength: 8 };

  const wrongCandidate = fixture("valid-fact-cards");
  wrongCandidate.cards[0].candidate = "F-02";
  expectCode(() => validateFactCards(wrongCandidate, options), "E_FACT_CANDIDATE_BINDING");

  const missingToken = fixture("valid-fact-cards");
  missingToken.cards[0].quote = "Assay result: 98.5";
  missingToken.cards[0].char_end = missingToken.cards[0].quote.length;
  expectCode(() => validateFactCards(missingToken, options), "E_FACT_QUOTE_VALUE_UNIT");

  const wrongOffset = fixture("valid-fact-cards");
  wrongOffset.cards[0].char_start = 1;
  wrongOffset.cards[0].char_end = 23;
  expectCode(() => validateFactCards(wrongOffset, options), "E_FACT_QUOTE_OFFSET");

  const shortQuote = fixture("valid-fact-cards");
  shortQuote.cards[0].quote = "98.5 mg";
  shortQuote.cards[0].char_start = 14;
  shortQuote.cards[0].char_end = 21;
  expectCode(() => validateFactCards(shortQuote, { ...options, minimumQuoteLength: 8 }), "E_FACT_QUOTE_LENGTH");
});

// --- V2 regression: unknown keys, missing fields, wrong types ---

test("G-P4-01 rejects unknown keys, missing fields, and wrong types with stable E_ codes", () => {
  const decision = fixture("valid-decision-v2");
  decision.unexpected = true;
  expectCode(() => validateDecision(decision), "E_DECISION_ENVELOPE");

  const rubric = fixture("valid-selection-rubric");
  delete rubric.aggregation_rule;
  expectCode(() => validateSelectionRubric(rubric), "E_RUBRIC_ENVELOPE");

  const cohort = fixture("valid-cohort-v2");
  cohort.candidates = "F-01";
  expectCode(() => validateCohort(cohort), "E_COHORT_ENVELOPE");

  const log = fixture("valid-evidence-log");
  log.entries[0].extra = "forbidden";
  expectCode(() => validateEvidenceLog(log), "E_EVIDENCE_LOG_ENVELOPE");
});
