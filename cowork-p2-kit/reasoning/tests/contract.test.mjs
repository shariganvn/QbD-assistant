import assert from "node:assert/strict";
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

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ReasoningContractError);
    assert.equal(error.code, code);
    return true;
  });
}

test("G-P4-01 accepts exact valid Layer B envelopes", () => {
  const cohort = fixture("valid-cohort");
  assert.deepEqual(validateCohort(cohort), cohort);
  assert.deepEqual(validateSelectionRubric(fixture("valid-selection-rubric")), fixture("valid-selection-rubric"));
  assert.deepEqual(validateLinearAttestation(fixture("valid-linear-attestation")), fixture("valid-linear-attestation"));
  assert.deepEqual(validateDecision(fixture("valid-decision")), fixture("valid-decision"));
  assert.deepEqual(validateEvidenceLog(fixture("valid-evidence-log")), fixture("valid-evidence-log"));
  assert.deepEqual(validateFactCards(fixture("valid-fact-cards"), { cohort, records, minimumQuoteLength: 8 }), fixture("valid-fact-cards"));
});

test("G-P4-01 rejects unknown keys, missing fields, and wrong types with stable E_ codes", () => {
  const decision = fixture("valid-decision");
  decision.unexpected = true;
  expectCode(() => validateDecision(decision), "E_DECISION_ENVELOPE");

  const rubric = fixture("valid-selection-rubric");
  delete rubric.aggregation_rule;
  expectCode(() => validateSelectionRubric(rubric), "E_RUBRIC_ENVELOPE");

  const cohort = fixture("valid-cohort");
  cohort.candidates = "F-01";
  expectCode(() => validateCohort(cohort), "E_COHORT_ENVELOPE");

  const log = fixture("valid-evidence-log");
  log.entries[0].extra = "forbidden";
  expectCode(() => validateEvidenceLog(log), "E_EVIDENCE_LOG_ENVELOPE");
});

test("G-P4-01 validates fact candidate, value/unit, offset, and minimum quote bindings independently", () => {
  const cohort = fixture("valid-cohort");
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

test("G-P4-01 rejects an incomplete linear attestation from its explicit required-field list", () => {
  const attestation = fixture("valid-linear-attestation");
  delete attestation.trial_context;
  expectCode(() => validateLinearAttestation(attestation), "E_LINEAR_ATTESTATION_INCOMPLETE");
});
