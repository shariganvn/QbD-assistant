import { ReasoningContractError } from "./step3-error-codes.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const isPlainObject = (value) => typeof value === "object" && value !== null
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function reject(code, message) {
  throw new ReasoningContractError(code, message);
}

function exactObject(value, keys, code, context) {
  if (!isPlainObject(value)) reject(code, `${context} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    reject(code, `${context} keys must match the contract`);
  }
}

function string(value, code, context) {
  if (typeof value !== "string" || value.trim() === "") reject(code, `${context} must be a non-empty string`);
}

function finiteNumber(value, code, context) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    reject(code, `${context} must be a finite number`);
  }
}

const SHAPE_AGGREGATION = { scalar: "identity", list: "mean", range: "midpoint" };

function validateMeasure(measure, code, index) {
  const ctx = `rubric.measures[${index}]`;
  exactObject(measure, ["id", "critical", "direction", "canonical_unit", "raw_shape", "aggregation", "hard_gate", "score_map", "weight", "conflict_tolerance"], code, ctx);
  string(measure.id, code, `${ctx}.id`);
  if (typeof measure.critical !== "boolean") reject(code, `${ctx}.critical must be a boolean`);
  if (measure.direction !== "higher-is-better" && measure.direction !== "lower-is-better") {
    reject(code, `${ctx}.direction must be higher-is-better or lower-is-better`);
  }
  string(measure.canonical_unit, code, `${ctx}.canonical_unit`);
  if (!["scalar", "list", "range"].includes(measure.raw_shape)) reject(code, `${ctx}.raw_shape must be scalar, list, or range`);
  if (!["identity", "mean", "midpoint"].includes(measure.aggregation)) reject(code, `${ctx}.aggregation must be identity, mean, or midpoint`);
  if (SHAPE_AGGREGATION[measure.raw_shape] !== measure.aggregation) {
    reject(code, `${ctx}.raw_shape and aggregation are coupled: ${measure.raw_shape}/${measure.aggregation} is invalid`);
  }
  // hard_gate
  if (measure.hard_gate !== null) {
    if (!isPlainObject(measure.hard_gate)) reject(code, `${ctx}.hard_gate must be null or an object`);
    exactObject(measure.hard_gate, ["operator", "threshold"], code, `${ctx}.hard_gate`);
    if (!["<=", ">="].includes(measure.hard_gate.operator)) reject(code, `${ctx}.hard_gate.operator must be <= or >=`);
    finiteNumber(measure.hard_gate.threshold, code, `${ctx}.hard_gate.threshold`);
  }
  // score_map
  if (!Array.isArray(measure.score_map) || measure.score_map.length === 0) {
    reject(code, `${ctx}.score_map must be a non-empty array`);
  }
  for (const [si, rule] of measure.score_map.entries()) {
    exactObject(rule, ["operator", "threshold", "points"], code, `${ctx}.score_map[${si}]`);
    if (!["<=", ">=", "<", ">"].includes(rule.operator)) reject(code, `${ctx}.score_map[${si}].operator invalid`);
    finiteNumber(rule.threshold, code, `${ctx}.score_map[${si}].threshold`);
    finiteNumber(rule.points, code, `${ctx}.score_map[${si}].points`);
  }
  // weight
  exactObject(measure.weight, ["nominal", "min", "max"], code, `${ctx}.weight`);
  for (const f of ["nominal", "min", "max"]) {
    finiteNumber(measure.weight[f], code, `${ctx}.weight.${f}`);
    if (measure.weight[f] < 0) {
      reject(code, `${ctx}.weight.${f} must be a non-negative number`);
    }
  }
  if (measure.weight.min > measure.weight.nominal || measure.weight.nominal > measure.weight.max) {
    reject(code, `${ctx}.weight must satisfy min <= nominal <= max`);
  }
  finiteNumber(measure.conflict_tolerance, code, `${ctx}.conflict_tolerance`);
  if (measure.conflict_tolerance < 0) {
    reject(code, `${ctx}.conflict_tolerance must be a non-negative number`);
  }
}

export function validateSelectionRubricV2(rubric) {
  const code = "E_RUBRIC_ENVELOPE";
  exactObject(rubric, ["schema_version", "rubric_id", "approval_state", "measures", "tie_threshold", "minimum_eligible_candidates"], code, "selection rubric v2");
  finiteNumber(rubric.schema_version, code, "selection rubric v2.schema_version");
  if (rubric.schema_version !== 2) reject(code, "selection rubric v2.schema_version must be 2");
  string(rubric.rubric_id, code, "selection rubric v2.rubric_id");
  if (rubric.approval_state !== "proposal" && rubric.approval_state !== "test-approved") {
    reject(code, "selection rubric v2.approval_state must be proposal or test-approved");
  }
  if (!Array.isArray(rubric.measures) || rubric.measures.length === 0) {
    reject(code, "selection rubric v2.measures must be a non-empty array");
  }
  const ids = new Set();
  for (const [i, measure] of rubric.measures.entries()) {
    validateMeasure(measure, code, i);
    if (ids.has(measure.id)) reject(code, `rubric measure id "${measure.id}" is duplicated`);
    ids.add(measure.id);
  }
  finiteNumber(rubric.tie_threshold, code, "selection rubric v2.tie_threshold");
  if (rubric.tie_threshold < 0) {
    reject(code, "selection rubric v2.tie_threshold must be a non-negative number");
  }
  if (!Number.isFinite(rubric.minimum_eligible_candidates) || !Number.isInteger(rubric.minimum_eligible_candidates) || rubric.minimum_eligible_candidates < 2) {
    reject(code, "selection rubric v2.minimum_eligible_candidates must be an integer >= 2");
  }
  // weight sum check
  const weightSum = rubric.measures.reduce((s, m) => s + m.weight.nominal, 0);
  if (Math.abs(weightSum - 1) > 1e-10) {
    reject(code, "selection rubric v2 measure nominal weights must sum to 1");
  }
  return rubric;
}

function validateV3HardGate(gate, code, context) {
  exactObject(gate, ["operator", "threshold", "specification_evidence_id"], code, context);
  if (!["<", "<=", ">=", ">"].includes(gate.operator)) {
    reject(code, `${context}.operator is not supported`);
  }
  finiteNumber(gate.threshold, code, `${context}.threshold`);
  string(gate.specification_evidence_id, code, `${context}.specification_evidence_id`);
}

function validateV3ScoreRule(rule, code, context) {
  exactObject(rule, ["operator", "threshold", "points"], code, context);
  if (!["<", "<=", ">=", ">"].includes(rule.operator)) reject(code, `${context}.operator is not supported`);
  finiteNumber(rule.threshold, code, `${context}.threshold`);
  finiteNumber(rule.points, code, `${context}.points`);
}

export function validateSelectionRubricV3(rubric) {
  const code = "E_RUBRIC_ENVELOPE";
  exactObject(rubric, [
    "schema_version",
    "rubric_id",
    "approval_state",
    "required_candidate_ids",
    "minimum_eligible_candidates",
    "selection_mode",
    "measures",
    "tie_threshold",
  ], code, "selection rubric v3");
  if (rubric.schema_version !== 3) reject(code, "selection rubric v3.schema_version must be 3");
  string(rubric.rubric_id, code, "selection rubric v3.rubric_id");
  if (rubric.approval_state !== "proposal" && rubric.approval_state !== "test-approved") {
    reject(code, "selection rubric v3.approval_state must be proposal or test-approved");
  }
  if (!Array.isArray(rubric.required_candidate_ids) || rubric.required_candidate_ids.length === 0) {
    reject(code, "selection rubric v3.required_candidate_ids must be a non-empty array");
  }
  rubric.required_candidate_ids.forEach((candidate, index) => string(candidate, code, `selection rubric v3.required_candidate_ids[${index}]`));
  if (new Set(rubric.required_candidate_ids).size !== rubric.required_candidate_ids.length) {
    reject(code, "selection rubric v3.required_candidate_ids must be unique");
  }
  if (!Number.isInteger(rubric.minimum_eligible_candidates) || rubric.minimum_eligible_candidates < 1) {
    reject(code, "selection rubric v3.minimum_eligible_candidates must be an integer >= 1");
  }
  if (rubric.selection_mode !== "single-survivor-after-complete-cohort") {
    reject(code, "selection rubric v3.selection_mode is unsupported");
  }
  if (!Array.isArray(rubric.measures) || rubric.measures.length === 0) reject(code, "selection rubric v3.measures must be non-empty");
  const ids = new Set();
  for (const [index, measure] of rubric.measures.entries()) {
    const context = `selection rubric v3.measures[${index}]`;
    exactObject(measure, ["id", "source_measure", "statistic", "critical", "direction", "canonical_unit", "hard_gates", "score_map", "weight", "conflict_tolerance"], code, context);
    string(measure.id, code, `${context}.id`);
    if (ids.has(measure.id)) reject(code, `rubric v3 measure id "${measure.id}" is duplicated`);
    ids.add(measure.id);
    string(measure.source_measure, code, `${context}.source_measure`);
    string(measure.statistic, code, `${context}.statistic`);
    if (typeof measure.critical !== "boolean") reject(code, `${context}.critical must be boolean`);
    if (!["higher-is-better", "lower-is-better"].includes(measure.direction)) reject(code, `${context}.direction is unsupported`);
    string(measure.canonical_unit, code, `${context}.canonical_unit`);
    if (!Array.isArray(measure.hard_gates)) reject(code, `${context}.hard_gates must be an array`);
    measure.hard_gates.forEach((gate, gateIndex) => validateV3HardGate(gate, code, `${context}.hard_gates[${gateIndex}]`));
    if (!Array.isArray(measure.score_map) || measure.score_map.length === 0) reject(code, `${context}.score_map must be non-empty`);
    measure.score_map.forEach((rule, ruleIndex) => validateV3ScoreRule(rule, code, `${context}.score_map[${ruleIndex}]`));
    exactObject(measure.weight, ["nominal", "min", "max"], code, `${context}.weight`);
    for (const field of ["nominal", "min", "max"]) {
      finiteNumber(measure.weight[field], code, `${context}.weight.${field}`);
      if (measure.weight[field] < 0) reject(code, `${context}.weight.${field} must be non-negative`);
    }
    if (measure.weight.min > measure.weight.nominal || measure.weight.nominal > measure.weight.max) {
      reject(code, `${context}.weight must satisfy min <= nominal <= max`);
    }
    finiteNumber(measure.conflict_tolerance, code, `${context}.conflict_tolerance`);
    if (measure.conflict_tolerance < 0) reject(code, `${context}.conflict_tolerance must be non-negative`);
  }
  finiteNumber(rubric.tie_threshold, code, "selection rubric v3.tie_threshold");
  if (rubric.tie_threshold < 0) reject(code, "selection rubric v3.tie_threshold must be non-negative");
  const weightSum = rubric.measures.reduce((sum, measure) => sum + measure.weight.nominal, 0);
  if (Math.abs(weightSum - 1) > 1e-10) reject(code, "selection rubric v3 measure nominal weights must sum to 1");
  return rubric;
}

export function validateSelectionEvaluation(evaluation) {
  const code = "E_RUBRIC_ENVELOPE";
  exactObject(evaluation, ["schema_version", "evaluation_id", "decision_id", "decision_sha256", "cohort_id", "rubric_sha256", "matrix_cells", "candidate_reviews", "sensitivity", "outcome_code"], code, "selection evaluation");
  if (evaluation.schema_version !== 1) reject(code, "selection evaluation.schema_version must be 1");
  string(evaluation.evaluation_id, code, "evaluation.evaluation_id");
  string(evaluation.decision_id, code, "evaluation.decision_id");
  if (!SHA256.test(evaluation.decision_sha256)) reject(code, "evaluation.decision_sha256 must be a SHA-256 hex string");
  string(evaluation.cohort_id, code, "evaluation.cohort_id");
  if (evaluation.rubric_sha256 !== null && !SHA256.test(evaluation.rubric_sha256)) {
    reject(code, "evaluation.rubric_sha256 must be a SHA-256 hex string or null");
  }
  if (!Array.isArray(evaluation.matrix_cells)) reject(code, "evaluation.matrix_cells must be an array");
  for (const [i, cell] of evaluation.matrix_cells.entries()) {
    exactObject(cell, ["candidate", "measure_id", "value", "unit", "fact_card_ids", "record_ids"], code, `matrix_cells[${i}]`);
  }
  if (!Array.isArray(evaluation.candidate_reviews)) reject(code, "evaluation.candidate_reviews must be an array");
  for (const [i, review] of evaluation.candidate_reviews.entries()) {
    exactObject(review, ["candidate", "eligible", "hard_gates", "critical_evidence"], code, `candidate_reviews[${i}]`);
    for (const [j, gate] of review.hard_gates.entries()) {
      exactObject(gate, ["measure_id", "passed", "value", "operator", "threshold", "record_ids"], code, `candidate_reviews[${i}].hard_gates[${j}]`);
    }
    for (const [j, ev] of review.critical_evidence.entries()) {
      exactObject(ev, ["measure_id", "cited_record_ids", "uncited_results_record_ids"], code, `candidate_reviews[${i}].critical_evidence[${j}]`);
    }
  }
  exactObject(evaluation.sensitivity, ["vectors", "stable_winner"], code, "evaluation.sensitivity");
  for (const [i, vec] of evaluation.sensitivity.vectors.entries()) {
    exactObject(vec, ["weights", "totals", "leader", "margin"], code, `sensitivity.vectors[${i}]`);
  }
  string(evaluation.outcome_code, code, "evaluation.outcome_code");
  return evaluation;
}
