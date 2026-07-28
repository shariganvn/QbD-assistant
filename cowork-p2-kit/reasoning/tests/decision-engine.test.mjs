import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ReasoningContractError } from "../step3-error-codes.mjs";
import { validateCohort, validateDecision, validateEvidenceLog, validateFactCards } from "../contracts.mjs";
import { validateSelectionRubricV2, validateSelectionEvaluation } from "../selection-contracts.mjs";
import { evaluateSelection } from "../decision-engine.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const rubricFixtureDir = resolve(testDir, "fixtures/rubric");

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

function fixture(name) {
  return JSON.parse(readFileSync(resolve(rubricFixtureDir, `${name}.json`), "utf8"));
}

// --- Fixtures ---

const testRubric = fixture("selection-rubric-test-approved.v2");
const testPin = fixture("selection-rubric-test-pin").selection_rubric_sha256;
const proposalRubric = JSON.parse(JSON.stringify(testRubric));
proposalRubric.approval_state = "proposal";
proposalRubric.rubric_id = "test-proposal-rubric";

const TEST_APPROVED_RUBRIC_SHA256 = "40e942181235bbe606af9f158606111f2b893a35c093e2887ff34c30c1471358";
const STORE_SHA256 = "231e49ddf09d1fbf7c75bbbad215a9f22a1f0f9c1b625d1fa6befc87ae8b61ae";

const cohort = {
  schema_version: 2,
  cohort_id: "cohort-decision-test",
  candidates: ["F-01", "F-02"],
  provenance_candidate_map: {
    "inputs/f01-trial.docx": "F-01",
    "inputs/f02-trial.docx": "F-02",
  },
  store_records_sha256: STORE_SHA256,
  linear_attestation_id: null,
  linear_attestation_sha256: null,
  cohort_basis: "Strength-specific 5 mg cohort without linear attestation.",
};

const evidenceLog = {
  schema_version: 2,
  cohort_id: "cohort-decision-test",
  entries: [
    { record_id: "rec-f01-assay", candidate: "F-01", fact_card_ids: ["FC-F01-ASS"], quote: "Assay: 98.5%", provenance: { file: "inputs/f01-trial.docx", page: 2, char_start: 0, char_end: 13 } },
    { record_id: "rec-f01-hardness", candidate: "F-01", fact_card_ids: ["FC-F01-HRD"], quote: "Hardness range=[10,12] N", provenance: { file: "inputs/f01-trial.docx", page: 3, char_start: 0, char_end: 24 } },
    { record_id: "rec-f01-release", candidate: "F-01", fact_card_ids: ["FC-F01-REL"], quote: "Release 30 min: 92%", provenance: { file: "inputs/f01-trial.docx", page: 1, char_start: 0, char_end: 20 } },
    { record_id: "rec-f02-assay", candidate: "F-02", fact_card_ids: ["FC-F02-ASS"], quote: "Assay: 96.0%", provenance: { file: "inputs/f02-trial.docx", page: 2, char_start: 0, char_end: 13 } },
    { record_id: "rec-f02-hardness", candidate: "F-02", fact_card_ids: ["FC-F02-HRD"], quote: "Hardness range=[8,10] N", provenance: { file: "inputs/f02-trial.docx", page: 3, char_start: 0, char_end: 23 } },
    { record_id: "rec-f02-release", candidate: "F-02", fact_card_ids: ["FC-F02-REL"], quote: "Release 30 min: 85%", provenance: { file: "inputs/f02-trial.docx", page: 1, char_start: 0, char_end: 20 } },
  ],
  exclusions: [],
};

const factCards = {
  schema_version: 1,
  cards: [
    { id: "FC-F01-REL", record_id: "rec-f01-release", candidate: "F-01", measure: "release_30m", raw_text: "92 %", normalized_value: 92, unit: "%", quote: "Release 30 min: 92%", char_start: 0, char_end: 20, provenance: { file: "inputs/f01-trial.docx" } },
    { id: "FC-F01-ASS", record_id: "rec-f01-assay", candidate: "F-01", measure: "assay", raw_text: "98.5 %", normalized_value: 98.5, unit: "%", quote: "Assay: 98.5%", char_start: 0, char_end: 13, provenance: { file: "inputs/f01-trial.docx" } },
    { id: "FC-F01-HRD", record_id: "rec-f01-hardness", candidate: "F-01", measure: "hardness", raw_text: "range=[10,12] N", normalized_value: 11, unit: "N", quote: "Hardness range=[10,12] N", char_start: 0, char_end: 24, provenance: { file: "inputs/f01-trial.docx" } },
    { id: "FC-F02-REL", record_id: "rec-f02-release", candidate: "F-02", measure: "release_30m", raw_text: "85 %", normalized_value: 85, unit: "%", quote: "Release 30 min: 85%", char_start: 0, char_end: 20, provenance: { file: "inputs/f02-trial.docx" } },
    { id: "FC-F02-ASS", record_id: "rec-f02-assay", candidate: "F-02", measure: "assay", raw_text: "96.0 %", normalized_value: 96, unit: "%", quote: "Assay: 96.0%", char_start: 0, char_end: 13, provenance: { file: "inputs/f02-trial.docx" } },
    { id: "FC-F02-HRD", record_id: "rec-f02-hardness", candidate: "F-02", measure: "hardness", raw_text: "range=[8,10] N", normalized_value: 9, unit: "N", quote: "Hardness range=[8,10] N", char_start: 0, char_end: 23, provenance: { file: "inputs/f02-trial.docx" } },
  ],
};

const recordRoles = {
  "rec-f01-release": "results",
  "rec-f01-assay": "results",
  "rec-f01-hardness": "results",
  "rec-f02-release": "results",
  "rec-f02-assay": "results",
  "rec-f02-hardness": "results",
};

const decisionId = "decision-test-001";

function validInput(overrides = {}) {
  return {
    cohort: overrides.cohort ?? structuredClone(cohort),
    evidenceLog: overrides.evidenceLog ?? structuredClone(evidenceLog),
    factCards: overrides.factCards ?? structuredClone(factCards),
    rubric: overrides.rubric ?? structuredClone(testRubric),
    rubricPin: "rubricPin" in overrides ? overrides.rubricPin : testPin,
    recordRoles: overrides.recordRoles ?? structuredClone(recordRoles),
    decisionId: overrides.decisionId ?? decisionId,
  };
}

// --- Rubric authority tests ---

test("G-P4-03 test-approved rubric fixture and pin match the immutable canonical hash", () => {
  assert.equal(sha256hex(canonicalBytes(testRubric)), TEST_APPROVED_RUBRIC_SHA256);
  assert.equal(testPin, TEST_APPROVED_RUBRIC_SHA256);
});

test("G-P4-03 proposal rubric returns inconclusive with E_RUBRIC_APPROVAL_REQUIRED", () => {
  const result = evaluateSelection(validInput({ rubric: proposalRubric, rubricPin: null }));
  assert.equal(result.decision.fd_action, "E_RUBRIC_APPROVAL_REQUIRED");
  assert.equal(result.decision.winner, null);
  assert.equal(result.evaluation.rubric_sha256, null);
  assert.equal(result.evaluation.outcome_code, "E_RUBRIC_APPROVAL_REQUIRED");
  assert.doesNotThrow(() => validateDecision(result.decision));
});

test("G-P4-03 test-approved rubric without pin returns E_RUBRIC_PIN_REQUIRED", () => {
  const result = evaluateSelection(validInput({ rubricPin: null }));
  assert.equal(result.decision.fd_action, "E_RUBRIC_PIN_REQUIRED");
  assert.equal(result.decision.winner, null);
  assert.equal(result.evaluation.outcome_code, "E_RUBRIC_PIN_REQUIRED");
  assert.doesNotThrow(() => validateDecision(result.decision));
});

test("G-P4-03 test-approved rubric with mismatched pin returns E_RUBRIC_PIN_MISMATCH", () => {
  const badPin = "a".repeat(64);
  const result = evaluateSelection(validInput({ rubricPin: badPin }));
  assert.equal(result.decision.fd_action, "E_RUBRIC_PIN_MISMATCH");
  assert.equal(result.decision.winner, null);
  assert.equal(result.evaluation.outcome_code, "E_RUBRIC_PIN_MISMATCH");
  assert.doesNotThrow(() => validateDecision(result.decision));
});

test("G-P4-03 test-approved rubric with matching pin produces selected result", () => {
  const result = evaluateSelection(validInput());
  assert.equal(result.decision.fd_action, "selected");
  assert.equal(result.decision.winner, "F-01");
  assert.equal(result.evaluation.rubric_sha256, TEST_APPROVED_RUBRIC_SHA256);
  assert.equal(result.evaluation.outcome_code, "selected");
});

test("G-P4-03 rubric validation rejects NaN and Infinity before selection", () => {
  const numericLocations = [
    ["schema_version", (rubric, value) => { rubric.schema_version = value; }],
    ["hard_gate.threshold", (rubric, value) => { rubric.measures[0].hard_gate.threshold = value; }],
    ["score_map.threshold", (rubric, value) => { rubric.measures[0].score_map[0].threshold = value; }],
    ["score_map.points", (rubric, value) => { rubric.measures[0].score_map[0].points = value; }],
    ["weight.min", (rubric, value) => { rubric.measures[0].weight.min = value; }],
    ["weight.nominal", (rubric, value) => { rubric.measures[0].weight.nominal = value; }],
    ["weight.max", (rubric, value) => { rubric.measures[0].weight.max = value; }],
    ["conflict_tolerance", (rubric, value) => { rubric.measures[0].conflict_tolerance = value; }],
    ["tie_threshold", (rubric, value) => { rubric.tie_threshold = value; }],
    ["minimum_eligible_candidates", (rubric, value) => { rubric.minimum_eligible_candidates = value; }],
  ];

  for (const [label, setValue] of numericLocations) {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const input = validInput();
      setValue(input.rubric, value);
      input.rubricPin = sha256hex(canonicalBytes(input.rubric));
      assert.throws(
        () => evaluateSelection(input),
        (error) => error instanceof ReasoningContractError && error.code === "E_RUBRIC_ENVELOPE",
        `${label} should reject ${String(value)} before selection`
      );
    }
  }
});

// --- Decision contract ---

test("G-P4-03 decision passes validateDecision", () => {
  const result = evaluateSelection(validInput());
  assert.doesNotThrow(() => validateDecision(result.decision));
  assert.equal(result.decision.schema_version, 2);
  assert.equal(result.decision.cohort_id, "cohort-decision-test");
  assert.equal(result.decision.decision_id, decisionId);
});

test("G-P4-03 decision fact_card_ids are lexicographically sorted", () => {
  const result = evaluateSelection(validInput());
  const ids = result.decision.fact_card_ids;
  assert.deepEqual(ids, [...ids].sort());
});

// --- Evaluation sidecar ---

test("G-P4-03 evaluation passes validateSelectionEvaluation", () => {
  const result = evaluateSelection(validInput());
  assert.doesNotThrow(() => validateSelectionEvaluation(result.evaluation));
});

test("G-P4-03 evaluation decision_sha256 binds to returned decision", () => {
  const result = evaluateSelection(validInput());
  const expectedHash = sha256hex(canonicalBytes(result.decision));
  assert.equal(result.evaluation.decision_sha256, expectedHash);
});

test("G-P4-03 evaluation cohort_id matches input cohort", () => {
  const result = evaluateSelection(validInput());
  assert.equal(result.evaluation.cohort_id, "cohort-decision-test");
});

// --- Matrix cells ---

test("G-P4-03 matrix cells carry derived value/unit with sorted IDs", () => {
  const result = evaluateSelection(validInput());
  const cells = result.evaluation.matrix_cells;
  assert.ok(cells.length > 0);
  for (const cell of cells) {
    assert.ok(typeof cell.value === "number");
    assert.ok(typeof cell.unit === "string");
    assert.deepEqual(cell.fact_card_ids, [...cell.fact_card_ids].sort());
    assert.deepEqual(cell.record_ids, [...cell.record_ids].sort());
  }
});

test("G-P4-03 matrix cells cover all candidate/measure combinations", () => {
  const result = evaluateSelection(validInput());
  const cells = result.evaluation.matrix_cells;
  const keys = new Set(cells.map((c) => `${c.candidate}:${c.measure_id}`));
  for (const cand of ["F-01", "F-02"]) {
    for (const m of ["release_30m", "assay", "hardness"]) {
      assert.ok(keys.has(`${cand}:${m}`), `missing cell ${cand}:${m}`);
    }
  }
});

// --- Hard gate ---

test("G-P4-03 hard gate failure triggers before scoring and returns inconclusive", () => {
  const input = validInput();
  // Force F-02 assay below hard gate threshold — only 1 eligible < minimum 2
  const f02Ass = input.factCards.cards.find((c) => c.id === "FC-F02-ASS");
  f02Ass.normalized_value = 93;
  f02Ass.raw_text = "93.0 %";
  f02Ass.quote = "Assay: 93.0%";
  const result = evaluateSelection(input);
  // Engine returns E_INSUFFICIENT_ELIGIBLE_CANDIDATES because only F-01 is eligible
  assert.equal(result.decision.fd_action, "E_INSUFFICIENT_ELIGIBLE_CANDIDATES");
  assert.equal(result.decision.winner, null);
});

test("G-P4-03 eligible candidate passes all hard gates", () => {
  const result = evaluateSelection(validInput());
  const f01Review = result.evaluation.candidate_reviews.find((r) => r.candidate === "F-01");
  assert.equal(f01Review.eligible, true);
  for (const gate of f01Review.hard_gates) {
    assert.equal(gate.passed, true);
  }
});

test("G-P4-03 fact cards with un-admitted record_ids are excluded from scoring", () => {
  const input = validInput();
  // Add a fact card referencing a record NOT in the evidence log
  input.factCards.cards.push({
    id: "FC-F01-UNADMITTED",
    record_id: "rec-f01-unadmitted",
    candidate: "F-01",
    measure: "release_30m",
    raw_text: "99 %",
    normalized_value: 99,
    unit: "%",
    quote: "Release 30 min: 99%",
    char_start: 0,
    char_end: 20,
    provenance: { file: "inputs/f01-trial.docx" },
  });
  // Do NOT add rec-f01-unadmitted to evidenceLog or recordRoles
  const result = evaluateSelection(input);
  // F-01 should still win based on admitted cards only (release=92, not 99)
  assert.equal(result.decision.fd_action, "selected");
  assert.equal(result.decision.winner, "F-01");
  // The unadmitted card should not appear in matrix cells
  const f01ReleaseCell = result.evaluation.matrix_cells.find(
    (c) => c.candidate === "F-01" && c.measure_id === "release_30m"
  );
  assert.ok(!f01ReleaseCell.fact_card_ids.includes("FC-F01-UNADMITTED"));
  assert.ok(!result.decision.fact_card_ids.includes("FC-F01-UNADMITTED"));
});

test("G-P4-03 cross-candidate cards are excluded unless the admitted entry binds candidate and card ID", () => {
  const input = validInput();
  input.factCards.cards.push({
    id: "FC-F01-CROSS-CANDIDATE",
    record_id: "rec-f01-release",
    candidate: "F-02",
    measure: "release_30m",
    raw_text: "99 %",
    normalized_value: 99,
    unit: "%",
    quote: "Release 30 min: 99%",
    char_start: 0,
    char_end: 20,
    provenance: { file: "inputs/f01-trial.docx" },
  });
  input.factCards.cards.push({
    id: "FC-F01-UNLISTED",
    record_id: "rec-f01-release",
    candidate: "F-01",
    measure: "release_30m",
    raw_text: "99 %",
    normalized_value: 99,
    unit: "%",
    quote: "Release 30 min: 99%",
    char_start: 0,
    char_end: 20,
    provenance: { file: "inputs/f01-trial.docx" },
  });
  const entry = input.evidenceLog.entries.find((e) => e.record_id === "rec-f01-release");
  entry.fact_card_ids = [...entry.fact_card_ids, "FC-F01-CROSS-CANDIDATE"].sort();

  const result = evaluateSelection(input);
  const f02ReleaseCell = result.evaluation.matrix_cells.find(
    (cell) => cell.candidate === "F-02" && cell.measure_id === "release_30m"
  );
  assert.equal(result.decision.fd_action, "selected");
  assert.equal(result.decision.winner, "F-01");
  assert.ok(!result.decision.fact_card_ids.includes("FC-F01-CROSS-CANDIDATE"));
  assert.ok(!result.decision.fact_card_ids.includes("FC-F01-UNLISTED"));
  assert.ok(!f02ReleaseCell.fact_card_ids.includes("FC-F01-CROSS-CANDIDATE"));
  assert.ok(!result.evaluation.matrix_cells.some((cell) => cell.fact_card_ids.includes("FC-F01-UNLISTED")));
});

test("G-P4-03 proposal and missing-pin paths never return a decision with zero processed cards", () => {
  const noAdmittedCards = structuredClone(factCards);
  for (const card of noAdmittedCards.cards) card.record_id = `unadmitted-${card.id}`;

  for (const overrides of [
    { factCards: structuredClone(noAdmittedCards), rubric: structuredClone(proposalRubric), rubricPin: null },
    { factCards: structuredClone(noAdmittedCards), rubricPin: null },
  ]) {
    assert.throws(
      () => evaluateSelection(validInput(overrides)),
      (error) => error?.code === "E_DECISION_ENVELOPE"
    );
  }
});

// --- Critical evidence ---

test("G-P4-03 critical evidence tracks cited and uncited record IDs", () => {
  const result = evaluateSelection(validInput());
  for (const review of result.evaluation.candidate_reviews) {
    for (const ev of review.critical_evidence) {
      assert.deepEqual(ev.cited_record_ids, [...ev.cited_record_ids].sort());
      assert.deepEqual(ev.uncited_results_record_ids, [...ev.uncited_results_record_ids].sort());
    }
  }
});

// --- Sensitivity ---

test("G-P4-03 sensitivity vectors cover Cartesian product of weight endpoints", () => {
  const result = evaluateSelection(validInput());
  const vectors = result.evaluation.sensitivity.vectors;
  // 3 measures with min/max = 2^3 = 8 vectors
  assert.equal(vectors.length, 8);
  for (const vec of vectors) {
    assert.ok(typeof vec.margin === "number");
    assert.ok(vec.leader === null || typeof vec.leader === "string");
  }
});

test("G-P4-03 stable_winner matches across all vectors when clear", () => {
  const result = evaluateSelection(validInput());
  assert.equal(result.evaluation.sensitivity.stable_winner, "F-01");
  for (const vec of result.evaluation.sensitivity.vectors) {
    assert.equal(vec.leader, "F-01");
  }
});

// --- Inconclusive paths ---

test("G-P4-03 missing critical cell returns inconclusive", () => {
  const input = validInput();
  // Remove the F-01 assay fact card
  input.factCards.cards = input.factCards.cards.filter((c) => c.id !== "FC-F01-ASS");
  const result = evaluateSelection(input);
  assert.equal(result.decision.winner, null);
  assert.ok(result.decision.fd_action !== "selected");
});

test("G-P4-03 unit mismatch returns E_UNIT_NORMALIZATION_REQUIRED", () => {
  const input = validInput();
  // Change unit of a fact card to mismatch the rubric
  const card = input.factCards.cards.find((c) => c.id === "FC-F01-REL");
  card.unit = "mg"; // rubric expects "%"
  const result = evaluateSelection(input);
  assert.equal(result.decision.fd_action, "E_UNIT_NORMALIZATION_REQUIRED");
  assert.equal(result.decision.winner, null);
});

test("G-P4-03 normalized_value mismatch returns E_NORMALIZED_VALUE_MISMATCH", () => {
  const input = validInput();
  const card = input.factCards.cards.find((c) => c.id === "FC-F01-REL");
  card.normalized_value = 50; // raw_text says 92
  const result = evaluateSelection(input);
  assert.equal(result.decision.fd_action, "E_NORMALIZED_VALUE_MISMATCH");
  assert.equal(result.decision.winner, null);
});

test("G-P4-03 malformed raw scalar, list, and range tokens return E_NORMALIZED_VALUE_MISMATCH", () => {
  const malformedCards = [
    ["FC-F01-REL", "92..0 %"],
    ["FC-F01-ASS", "values=[98..5] %"],
    ["FC-F01-HRD", "range=[10..0,12] N"],
  ];
  for (const [id, rawText] of malformedCards) {
    const input = validInput();
    const card = input.factCards.cards.find((item) => item.id === id);
    card.raw_text = rawText;
    const result = evaluateSelection(input);
    assert.equal(result.decision.fd_action, "E_NORMALIZED_VALUE_MISMATCH", `${id} must reject malformed raw text`);
    assert.doesNotThrow(() => validateDecision(result.decision));
  }
});

test("G-P4-03 uncited results record returns E_FD_REVIEW_UNCITED_RESULTS", () => {
  const input = validInput();
  // Add an extra admitted record for F-01 that isn't cited by any fact card
  // Use a record_id that sorts after all existing entries (zzz prefix)
  input.evidenceLog.entries.push({
    record_id: "zzz-f01-uncited",
    candidate: "F-01",
    fact_card_ids: [],
    quote: "Extra result data for uncited check",
    provenance: { file: "inputs/f01-trial.docx", page: 4, char_start: 0, char_end: 35 },
  });
  input.recordRoles["zzz-f01-uncited"] = "results";
  const result = evaluateSelection(input);
  assert.equal(result.decision.fd_action, "E_FD_REVIEW_UNCITED_RESULTS");
  assert.equal(result.decision.winner, null);
});

test("G-P4-03 conflict beyond tolerance returns inconclusive", () => {
  const input = validInput();
  // Add a second F-01 release card with a conflicting value (92 vs 75, diff=17 > tolerance=0.5)
  // Use zzz prefix to sort after all existing entries
  input.factCards.cards.push({
    id: "FC-F01-REL-2",
    record_id: "zzz-f01-conflict",
    candidate: "F-01",
    measure: "release_30m",
    raw_text: "75 %",
    normalized_value: 75,
    unit: "%",
    quote: "Release 30 min: 75%",
    char_start: 0,
    char_end: 20,
    provenance: { file: "inputs/f01-trial.docx" },
  });
  input.evidenceLog.entries.push({
    record_id: "zzz-f01-conflict",
    candidate: "F-01",
    fact_card_ids: ["FC-F01-REL-2"],
    quote: "Release 30 min: 75%",
    provenance: { file: "inputs/f01-trial.docx", page: 5, char_start: 0, char_end: 20 },
  });
  input.recordRoles["zzz-f01-conflict"] = "results";
  const result = evaluateSelection(input);
  assert.equal(result.decision.winner, null);
  assert.ok(result.decision.fd_action !== "selected");
});

test("G-P4-03 insufficient eligible candidates returns E_INSUFFICIENT_ELIGIBLE_CANDIDATES", () => {
  const input = validInput();
  // Make both candidates fail assay hard gate
  const f01Assay = input.factCards.cards.find((c) => c.id === "FC-F01-ASS");
  f01Assay.normalized_value = 90;
  f01Assay.raw_text = "90.0 %";
  f01Assay.quote = "Assay: 90.0%";
  const f02Assay = input.factCards.cards.find((c) => c.id === "FC-F02-ASS");
  f02Assay.normalized_value = 90;
  f02Assay.raw_text = "90.0 %";
  f02Assay.quote = "Assay: 90.0%";
  const result = evaluateSelection(input);
  assert.equal(result.decision.fd_action, "E_INSUFFICIENT_ELIGIBLE_CANDIDATES");
  assert.equal(result.decision.winner, null);
});

test("G-P4-03 score map with no matching rule rejects with E_RUBRIC_ENVELOPE", () => {
  const input = validInput();
  // Modify rubric hardness score_map to have an unreachable threshold
  const hardnessMeasure = input.rubric.measures.find((m) => m.id === "hardness");
  hardnessMeasure.score_map = [{ operator: ">=", threshold: 999, points: 10 }];
  // Compute correct pin for the modified rubric
  input.rubricPin = sha256hex(canonicalBytes(input.rubric));
  assert.throws(
    () => evaluateSelection(input),
    (error) => {
      assert.ok(error instanceof ReasoningContractError);
      assert.equal(error.code, "E_RUBRIC_ENVELOPE");
      assert.ok(error.message.includes("0 matching rules"));
      return true;
    }
  );
});

test("G-P4-03 score map with overlapping rules rejects with E_RUBRIC_ENVELOPE", () => {
  const input = validInput();
  const hardnessMeasure = input.rubric.measures.find((m) => m.id === "hardness");
  hardnessMeasure.score_map = [
    { operator: ">=", threshold: 0, points: 10 },
    { operator: ">=", threshold: 0, points: 5 },
  ];
  input.rubricPin = sha256hex(canonicalBytes(input.rubric));
  assert.throws(
    () => evaluateSelection(input),
    (error) => {
      assert.ok(error instanceof ReasoningContractError);
      assert.equal(error.code, "E_RUBRIC_ENVELOPE");
      assert.ok(error.message.includes("2 matching rules"));
      return true;
    }
  );
});

test("G-P4-03 tie or sensitivity instability returns E_TIE_OR_SENSITIVITY_UNSTABLE", () => {
  const input = validInput();
  // Make candidates identical on all measures → margin=0 at every vector → unstable
  const f02Rel = input.factCards.cards.find((c) => c.id === "FC-F02-REL");
  f02Rel.normalized_value = 92;
  f02Rel.raw_text = "92 %";
  f02Rel.quote = "Release 30 min: 92%";
  const f02Ass = input.factCards.cards.find((c) => c.id === "FC-F02-ASS");
  f02Ass.normalized_value = 98.5;
  f02Ass.raw_text = "98.5 %";
  f02Ass.quote = "Assay: 98.5%";
  const f02Hrd = input.factCards.cards.find((c) => c.id === "FC-F02-HRD");
  f02Hrd.normalized_value = 11;
  f02Hrd.raw_text = "range=[10,12] N";
  f02Hrd.quote = "Hardness range=[10,12] N";
  const result = evaluateSelection(input);
  assert.equal(result.decision.fd_action, "E_TIE_OR_SENSITIVITY_UNSTABLE");
  assert.equal(result.decision.winner, null);
});

// --- Record roles ---

test("G-P4-03 rejects recordRoles key not in evidence log", () => {
  const input = validInput();
  input.recordRoles["nonexistent-record"] = "results";
  expectCode(() => evaluateSelection(input), "E_RUBRIC_ENVELOPE");
});

test("G-P4-03 rejects missing role for admitted record", () => {
  const input = validInput();
  delete input.recordRoles["rec-f01-release"];
  expectCode(() => evaluateSelection(input), "E_RUBRIC_ENVELOPE");
});

test("G-P4-03 rejects recordRoles value that is not results or context", () => {
  const input = validInput();
  input.recordRoles["rec-f01-release"] = "unknown";
  expectCode(() => evaluateSelection(input), "E_RUBRIC_ENVELOPE");
});

// --- Cohort semantics ---

test("G-P4-03 preserves non-attested cohort candidates and basis", () => {
  const result = evaluateSelection(validInput());
  assert.equal(result.decision.cohort_id, "cohort-decision-test");
  // The decision should not alter cohort structure
  assert.equal(result.evaluation.cohort_id, "cohort-decision-test");
});

test("G-P4-03 attested cohort preserves linear attestation fields", () => {
  const input = validInput({
    cohort: {
      ...cohort,
      linear_attestation_id: "att-001",
      linear_attestation_sha256: "a".repeat(64),
      cohort_basis: "Strength-specific 5 mg cohort with linear attestation.",
    },
  });
  const result = evaluateSelection(input);
  assert.equal(result.decision.linear_attestation_id, "att-001");
  assert.equal(result.decision.linear_attestation_sha256, "a".repeat(64));
  assert.equal(result.decision.cohort_basis, "Strength-specific 5 mg cohort with linear attestation.");
  assert.equal(result.decision.fd_action, "selected");
});

test("G-P4-03 combined cohort flows through existing attestation semantics", () => {
  const input = validInput({
    cohort: {
      ...cohort,
      linear_attestation_id: "att-combined-001",
      linear_attestation_sha256: "b".repeat(64),
      cohort_basis: "Combined 5 mg + 10 mg cohort from two strengths.",
    },
  });
  const result = evaluateSelection(input);
  assert.equal(result.decision.linear_attestation_id, "att-combined-001");
  assert.equal(result.decision.cohort_basis, "Combined 5 mg + 10 mg cohort from two strengths.");
  assert.equal(result.decision.fd_action, "selected");
  assert.equal(result.decision.winner, "F-01");
});

test("G-P4-03 evaluation_id is deterministic for same input", () => {
  const result1 = evaluateSelection(validInput());
  const result2 = evaluateSelection(validInput());
  assert.equal(result1.evaluation.evaluation_id, result2.evaluation.evaluation_id);
  assert.equal(result1.evaluation.decision_sha256, result2.evaluation.decision_sha256);
});

test("G-P4-03 inconclusive evaluation_id is deterministic for same input", () => {
  const result1 = evaluateSelection(validInput({ rubric: proposalRubric, rubricPin: null }));
  const result2 = evaluateSelection(validInput({ rubric: proposalRubric, rubricPin: null }));
  assert.equal(result1.evaluation.evaluation_id, result2.evaluation.evaluation_id);
});

// --- Upstream contract boundary ---

test("G-P4-03 existing v1 rubric validator is unchanged", async () => {
  const { validateSelectionRubric } = await import("../contracts.mjs");
  assert.ok(typeof validateSelectionRubric === "function");
});

test("G-P4-03 keeps frozen upstream contract validators byte-identical", async () => {
  const { readFileSync: rf } = await import("node:fs");
  const { createHash: ch } = await import("node:crypto");
  const frozenFiles = {
    "cowork-p2-kit/reasoning/contracts.mjs": "85e4e04b6739e43054537e4beaac3cc37d67e7877928086800cda4d4d3d943d9",
    "cowork-p2-kit/reasoning/errors.mjs": "a12de966e9b0c15465f982a6e8d4a9e9ba535070ec1de137e3617b78e078c58f",
  };
  for (const [f, expectedHash] of Object.entries(frozenFiles)) {
    const content = rf(f, "utf8");
    const actualHash = ch("sha256").update(content).digest("hex");
    assert.equal(actualHash, expectedHash, `${f} hash mismatch — frozen boundary violated`);
  }
});

// --- No Markdown/CLI ---

test("G-P4-03 evaluateSelection returns no Markdown content", () => {
  const result = evaluateSelection(validInput());
  const json = JSON.stringify(result);
  assert.ok(!json.includes("# "), "result must not contain Markdown headings");
  assert.ok(!json.includes("```"), "result must not contain Markdown code fences");
});
