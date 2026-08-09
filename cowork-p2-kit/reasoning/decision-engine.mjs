import { createHash } from "node:crypto";
import { ReasoningContractError } from "./step3-error-codes.mjs";
import { validateCohort, validateDecision, validateEvidenceLog } from "./contracts.mjs";
import { validateSelectionRubricV2, validateSelectionEvaluation, validateSelectionRubricV3 } from "./selection-contracts.mjs";
import { canonicalBytes } from "./publication.mjs";
import { validateBindings, validateDataPackage, validateEvidenceEnvelope } from "../workflow-trial/real-data-pack.mjs";
import { canonicalJson } from "../workflow-trial/formula-cell-receipt.mjs";
import { createFdConfirmFlag, validateFdConfirmFlag } from "../rubric/fd-confirm-flag.mjs";
import { compileRubricFromSpec, validateSpecCompileReceipt } from "../rubric/compile-rubric-from-spec.mjs";

const isPlainObject = (value) => typeof value === "object" && value !== null
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function reject(code, message) {
  throw new ReasoningContractError(code, message);
}

function deterministicEvaluationId(decisionId, decisionSha256) {
  return createHash("sha256").update(`${decisionId}:${decisionSha256}`).digest("hex").slice(0, 36);
}

function validateFactCardsSchema(factCards, cohort) {
  const code = "E_FACT_CANDIDATE_BINDING";
  if (!isPlainObject(factCards)) reject(code, "fact cards must be an object");
  if (factCards.schema_version !== 1) reject(code, "fact cards.schema_version must be 1");
  if (!Array.isArray(factCards.cards) || factCards.cards.length === 0) reject(code, "fact cards.cards must be a non-empty array");
  const candidateSet = new Set(cohort.candidates);
  for (const card of factCards.cards) {
    if (!candidateSet.has(card.candidate)) {
      reject(code, `fact card ${card.id} candidate "${card.candidate}" is not in the cohort`);
    }
  }
}

function parseRawText(rawText, rawShape) {
  const decimal = "\\d+(?:\\.\\d+)?";
  if (rawShape === "scalar") {
    const m = rawText.match(new RegExp(`^(${decimal})\\s+(.+)$`));
    if (!m) return null;
    return { value: Number(m[1]), unit: m[2] };
  }
  if (rawShape === "list") {
    const m = rawText.match(new RegExp(`^values=\\[(${decimal}(?:\\s*,\\s*${decimal})*)\\]\\s+(.+)$`));
    if (!m) return null;
    const values = m[1].split(",").map((v) => Number(v.trim()));
    return { value: values, unit: m[2] };
  }
  if (rawShape === "range") {
    const m = rawText.match(new RegExp(`^range=\\[(${decimal})\\s*,\\s*(${decimal})\\]\\s+(.+)$`));
    if (!m) return null;
    return { value: [Number(m[1]), Number(m[2])], unit: m[3] };
  }
  return null;
}

function aggregate(parsed, aggregation) {
  if (aggregation === "identity") return parsed;
  if (aggregation === "mean") return parsed.reduce((s, v) => s + v, 0) / parsed.length;
  if (aggregation === "midpoint") return (parsed[0] + parsed[1]) / 2;
  return parsed;
}

function scoreCell(value, scoreMap) {
  const matches = [];
  for (const rule of scoreMap) {
    const { operator, threshold, points } = rule;
    let match = false;
    if (operator === ">=") match = value >= threshold;
    else if (operator === "<=") match = value <= threshold;
    else if (operator === ">") match = value > threshold;
    else if (operator === "<") match = value < threshold;
    if (match) matches.push(points);
  }
  return matches;
}

function cartesianProduct(arrays) {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  return first.flatMap((item) => restProduct.map((r) => [item, ...r]));
}

export function evaluateSelection({ cohort, evidenceLog, factCards, rubric, rubricPin, recordRoles, decisionId }) {
  // Step 1: Validate artifacts
  validateCohort(cohort);
  validateEvidenceLog(evidenceLog);
  validateFactCardsSchema(factCards, cohort);
  validateSelectionRubricV2(rubric);

  if (evidenceLog.cohort_id !== cohort.cohort_id) {
    reject("E_REASONING_ARTIFACT_BINDING", "evidence log cohort_id must match cohort");
  }

  // Validate recordRoles
  const admittedEntriesById = new Map(evidenceLog.entries.map((entry) => [entry.record_id, entry]));
  const admittedIds = new Set(admittedEntriesById.keys());
  for (const [key, value] of Object.entries(recordRoles)) {
    if (!admittedIds.has(key)) reject("E_RUBRIC_ENVELOPE", `recordRoles key "${key}" is not an admitted record`);
    if (value !== "results" && value !== "context") {
      reject("E_RUBRIC_ENVELOPE", `recordRoles["${key}"] must be "results" or "context", got "${value}"`);
    }
  }
  for (const id of admittedIds) {
    if (!(id in recordRoles)) reject("E_RUBRIC_ENVELOPE", `admitted record "${id}" missing from recordRoles`);
  }

  if (typeof decisionId !== "string" || decisionId.trim() === "") {
    reject("E_DECISION_ENVELOPE", "decisionId must be a non-empty string");
  }

  // Hash rubric
  const rubricBytes = canonicalBytes(rubric);
  const rubricSha256 = createHash("sha256").update(rubricBytes).digest("hex");

  // A card is usable only when the admitted record binds both its candidate and its card ID.
  const candidateSet = new Set(cohort.candidates);
  const isAdmittedCard = (card) => {
    const entry = admittedEntriesById.get(card.record_id);
    return candidateSet.has(card.candidate)
      && entry !== undefined
      && entry.candidate === card.candidate
      && entry.fact_card_ids.includes(card.id);
  };
  const admittedCards = factCards.cards.filter(isAdmittedCard);
  const processedFactCardIds = admittedCards
    .map((card) => card.id)
    .sort();

  // Step 2: Check rubric approval state (BEFORE any matrix work)
  if (rubric.approval_state === "proposal") {
    return buildInconclusive("E_RUBRIC_APPROVAL_REQUIRED", { cohort, decisionId, rubricSha256: null, factCardIds: processedFactCardIds });
  }
  if (rubricPin === null || rubricPin === undefined) {
    return buildInconclusive("E_RUBRIC_PIN_REQUIRED", { cohort, decisionId, rubricSha256: null, factCardIds: processedFactCardIds });
  }
  if (rubricPin !== rubricSha256) {
    return buildInconclusive("E_RUBRIC_PIN_MISMATCH", { cohort, decisionId, rubricSha256: null, factCardIds: processedFactCardIds });
  }

  // Step 3: Build matrix cells

  // Group fact cards by candidate:measure — only admitted records
  const cardsByCandidateMeasure = new Map();
  for (const card of admittedCards) {
    const key = `${card.candidate}:${card.measure}`;
    if (!cardsByCandidateMeasure.has(key)) cardsByCandidateMeasure.set(key, []);
    cardsByCandidateMeasure.get(key).push(card);
  }

  // Build set of all cited record_ids (across all measures)
  const allCitedRecordIds = new Set(admittedCards.map((card) => card.record_id));

  const matrixCells = [];
  const candidateReviews = new Map();

  for (const candidate of cohort.candidates) {
    const review = { candidate, eligible: true, hard_gates: [], critical_evidence: [] };
    candidateReviews.set(candidate, review);

    for (const measure of rubric.measures) {
      const key = `${candidate}:${measure.id}`;
      const cards = cardsByCandidateMeasure.get(key) || [];

      // Gather cited record IDs from cards for this measure
      const citedRecordIds = [...new Set(cards.map((c) => c.record_id))].sort();

      // Find uncited results records for this candidate (any measure)
      const uncitedResults = [];
      for (const entry of evidenceLog.entries) {
        if (entry.candidate !== candidate) continue;
        if (recordRoles[entry.record_id] !== "results") continue;
        if (!allCitedRecordIds.has(entry.record_id)) uncitedResults.push(entry.record_id);
      }
      uncitedResults.sort();

      if (measure.critical) {
        review.critical_evidence.push({
          measure_id: measure.id,
          cited_record_ids: citedRecordIds,
          uncited_results_record_ids: uncitedResults,
        });
      }

      // Parse and aggregate cards into cell value
      if (cards.length === 0) continue;

      const parsedValues = [];
      const allRecordIds = [];
      const allCardIds = [];

      for (const card of cards) {
        if (card.unit !== measure.canonical_unit) {
          return buildInconclusive("E_UNIT_NORMALIZATION_REQUIRED", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
        }

        const parsed = parseRawText(card.raw_text, measure.raw_shape);
        if (parsed === null) {
          return buildInconclusive("E_NORMALIZED_VALUE_MISMATCH", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
        }
        if (parsed.unit !== measure.canonical_unit) {
          return buildInconclusive("E_UNIT_NORMALIZATION_REQUIRED", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
        }

        let aggregated;
        if (measure.aggregation === "identity") aggregated = parsed.value;
        else if (measure.aggregation === "mean") aggregated = aggregate(parsed.value, "mean");
        else if (measure.aggregation === "midpoint") aggregated = aggregate(parsed.value, "midpoint");

        if (Math.abs(aggregated - card.normalized_value) > 1e-10) {
          return buildInconclusive("E_NORMALIZED_VALUE_MISMATCH", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
        }

        parsedValues.push(aggregated);
        allRecordIds.push(card.record_id);
        allCardIds.push(card.id);
      }

      // Conflict check
      if (parsedValues.length > 1) {
        for (let i = 0; i < parsedValues.length; i++) {
          for (let j = i + 1; j < parsedValues.length; j++) {
            if (Math.abs(parsedValues[i] - parsedValues[j]) > measure.conflict_tolerance) {
              return buildInconclusive("E_TIE_OR_SENSITIVITY_UNSTABLE", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
            }
          }
        }
      }

      const cellValue = parsedValues.reduce((s, v) => s + v, 0) / parsedValues.length;

      matrixCells.push({
        candidate,
        measure_id: measure.id,
        value: cellValue,
        unit: measure.canonical_unit,
        fact_card_ids: [...new Set(allCardIds)].sort(),
        record_ids: [...new Set(allRecordIds)].sort(),
      });
    }
  }

  // Step 4: Check missing critical cells and uncited results
  for (const candidate of cohort.candidates) {
    for (const measure of rubric.measures) {
      if (!measure.critical) continue;
      const cell = matrixCells.find((c) => c.candidate === candidate && c.measure_id === measure.id);
      if (!cell) {
        return buildInconclusive("E_RUBRIC_ENVELOPE", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
      }
    }
    // Check uncited results for this candidate
    const review = candidateReviews.get(candidate);
    for (const ev of review.critical_evidence) {
      if (ev.uncited_results_record_ids.length > 0) {
        return buildInconclusive("E_FD_REVIEW_UNCITED_RESULTS", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
      }
    }
  }

  // Step 5: Evaluate hard gates
  for (const candidate of cohort.candidates) {
    const review = candidateReviews.get(candidate);
    for (const measure of rubric.measures) {
      const cell = matrixCells.find((c) => c.candidate === candidate && c.measure_id === measure.id);
      if (!measure.hard_gate) {
        review.hard_gates.push({
          measure_id: measure.id,
          passed: true,
          value: null,
          operator: ">=",
          threshold: 0,
          record_ids: [],
        });
        continue;
      }
      const cellValue = cell ? cell.value : null;
      let passed = false;
      if (cellValue !== null) {
        const { operator, threshold } = measure.hard_gate;
        if (operator === ">=") passed = cellValue >= threshold;
        else if (operator === "<=") passed = cellValue <= threshold;
      }
      review.hard_gates.push({
        measure_id: measure.id,
        passed,
        value: cellValue,
        operator: measure.hard_gate.operator,
        threshold: measure.hard_gate.threshold,
        record_ids: cell ? cell.record_ids : [],
      });
      if (!passed) review.eligible = false;
    }
  }

  const eligibleCandidates = cohort.candidates.filter((c) => candidateReviews.get(c).eligible);
  if (eligibleCandidates.length < rubric.minimum_eligible_candidates) {
    return buildInconclusive("E_INSUFFICIENT_ELIGIBLE_CANDIDATES", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
  }

  // Step 6: Score + sensitivity analysis
  const measureEndpoints = rubric.measures.map((m) => [m.weight.min, m.weight.max]);
  const vectors = cartesianProduct(measureEndpoints);

  const sensitivityResults = [];
  let stableWinner = null;
  let winnerStable = true;

  for (const weightVector of vectors) {
    const weights = {};
    rubric.measures.forEach((m, i) => { weights[m.id] = weightVector[i]; });

    const totals = {};
    for (const candidate of eligibleCandidates) {
      let total = 0;
      for (const measure of rubric.measures) {
        const cell = matrixCells.find((c) => c.candidate === candidate && c.measure_id === measure.id);
        if (!cell) continue;
        const matchingPoints = scoreCell(cell.value, measure.score_map);
        if (matchingPoints.length !== 1) {
          reject("E_RUBRIC_ENVELOPE", `score_map for measure "${measure.id}" has ${matchingPoints.length} matching rules for value ${cell.value}; exactly one is required`);
        }
        total += matchingPoints[0] * weights[measure.id];
      }
      totals[candidate] = total;
    }

    const sorted = eligibleCandidates.slice().sort((a, b) => totals[b] - totals[a]);
    const leader = sorted[0];
    const runnerUp = sorted[1];
    const margin = totals[leader] - (runnerUp ? totals[runnerUp] : 0);

    sensitivityResults.push({ weights, totals, leader, margin });

    if (margin <= rubric.tie_threshold) winnerStable = false;
    if (stableWinner === null) stableWinner = leader;
    else if (stableWinner !== leader) winnerStable = false;
  }

  if (!winnerStable || sensitivityResults.some((v) => v.margin <= rubric.tie_threshold)) {
    return buildInconclusive("E_TIE_OR_SENSITIVITY_UNSTABLE", { cohort, decisionId, rubricSha256, factCardIds: processedFactCardIds });
  }

  // Step 7: Return selected
  const winner = stableWinner;

  const decision = {
    schema_version: 2,
    decision_id: decisionId,
    status: "selected",
    winner,
    cohort_id: cohort.cohort_id,
    fact_card_ids: processedFactCardIds,
    rubric_sha256: rubricSha256,
    fd_action: "selected",
    linear_attestation_id: cohort.linear_attestation_id,
    linear_attestation_sha256: cohort.linear_attestation_sha256,
    cohort_basis: cohort.cohort_basis,
  };

  validateDecision(decision);
  const decisionSha256 = createHash("sha256").update(canonicalBytes(decision)).digest("hex");
  const evaluationId = deterministicEvaluationId(decisionId, decisionSha256);

  const evaluation = {
    schema_version: 1,
    evaluation_id: evaluationId,
    decision_id: decisionId,
    decision_sha256: decisionSha256,
    cohort_id: cohort.cohort_id,
    rubric_sha256: rubricSha256,
    matrix_cells: matrixCells,
    candidate_reviews: [...candidateReviews.values()],
    sensitivity: { vectors: sensitivityResults, stable_winner: winner },
    outcome_code: "selected",
  };

  validateSelectionEvaluation(evaluation);
  return { decision, evaluation };
}

function buildInconclusive(outcomeCode, { cohort, decisionId, rubricSha256, factCardIds }) {
  const decision = {
    schema_version: 2,
    decision_id: decisionId,
    status: "inconclusive",
    winner: null,
    cohort_id: cohort.cohort_id,
    fact_card_ids: factCardIds ?? [],
    rubric_sha256: rubricSha256,
    fd_action: outcomeCode,
    linear_attestation_id: cohort.linear_attestation_id,
    linear_attestation_sha256: cohort.linear_attestation_sha256,
    cohort_basis: cohort.cohort_basis,
  };

  // The frozen v2 envelope forbids an empty fact_card_ids array.  Validate before
  // emitting an early outcome so this function never returns an invalid pair.
  validateDecision(decision);

  const decisionSha256 = createHash("sha256").update(canonicalBytes(decision)).digest("hex");
  const evaluationId = deterministicEvaluationId(decisionId, decisionSha256);

  const evaluation = {
    schema_version: 1,
    evaluation_id: evaluationId,
    decision_id: decisionId,
    decision_sha256: decisionSha256,
    cohort_id: cohort.cohort_id,
    rubric_sha256: rubricSha256,
    matrix_cells: [],
    candidate_reviews: [],
    sensitivity: { vectors: [], stable_winner: null },
    outcome_code: outcomeCode,
  };

  validateSelectionEvaluation(evaluation);
  return { decision, evaluation };
}

const FORMULATION_COHORT = ["formula-01", "formula-02", "formula-03"];
const FORMULATION_DECISION_SCHEMA = "formulation-fd-decision/v1";
const FORMULATION_EVALUATION_SCHEMA = "formulation-selection-evaluation/v1";
const sha256Json = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

function v3Fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function exactCandidateSet(actual, expected, code = "E_EXACT_COHORT") {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    v3Fail(code, `candidate set must be exactly ${expected.join(", ")}`);
  }
}

function v3PackageParts(dataPackage) {
  const parts = dataPackage?.package ? dataPackage : { package: dataPackage };
  const required = ["package", "evidence", "cards", "bindings", "reconciliation", "receipts"];
  if (required.some((key) => parts[key] === undefined)) v3Fail("E_RUBRIC_PACKAGE_INPUT", "a complete real-data package and trusted receipts are required");
  validateDataPackage(parts.package);
  validateEvidenceEnvelope(parts.evidence);
  validateBindings({ bindings: parts.bindings, evidence: parts.evidence, cards: parts.cards, receipts: parts.receipts });
  if (sha256Json(parts.evidence) !== parts.package.evidence_envelope_sha256
    || sha256Json(parts.cards) !== parts.package.fact_cards_sha256
    || sha256Json(parts.bindings) !== parts.package.fact_card_bindings_sha256
    || sha256Json(parts.reconciliation) !== parts.package.inventory_reconciliation_sha256) {
    v3Fail("E_RUBRIC_PACKAGE_HASH", "real-data package member hash does not match its sealed package");
  }
  exactCandidateSet(parts.package.exact_cohort, FORMULATION_COHORT);
  exactCandidateSet(parts.evidence.exact_cohort, FORMULATION_COHORT);
  if (parts.reconciliation.record_count !== parts.package.record_count) v3Fail("E_INVENTORY_RECONCILIATION", "inventory record count disagrees with package");
  return parts;
}

function validateV3Bindings({ parts, rubric, compileReceipt, fdConfirmFlag }) {
  validateSelectionRubricV3(rubric);
  validateSpecCompileReceipt(compileReceipt);
  validateFdConfirmFlag(fdConfirmFlag);
  if (compileReceipt.source_document_sha256 !== parts.package.bound_hashes.source_document_sha256
    || compileReceipt.document_xml_sha256 !== parts.package.bound_hashes.document_xml_sha256
    || compileReceipt.store_records_sha256 !== parts.package.bound_hashes.store_records_sha256
    || compileReceipt.receipt_set_sha256 !== parts.package.bound_hashes.receipt_set_sha256
    || compileReceipt.evidence_envelope_sha256 !== parts.package.evidence_envelope_sha256) {
    v3Fail("E_RUBRIC_SPEC_DRIFT", "spec compile receipt is not bound to the real-data package");
  }
  const specs = parts.evidence.specifications.slice().sort((left, right) => left.evidence_id.localeCompare(right.evidence_id));
  if (sha256Json(specs) !== compileReceipt.specification_evidence_sha256
    || sha256Json(rubric) !== compileReceipt.rubric_sha256
    || JSON.stringify(compileReceipt.specification_evidence_ids) !== JSON.stringify(specs.map((entry) => entry.evidence_id))) {
    v3Fail("E_RUBRIC_SPEC_DRIFT", "specification evidence or rubric hash does not match the compile receipt");
  }
  if (JSON.stringify(compileReceipt.fd_confirm_flag) !== JSON.stringify(fdConfirmFlag)) {
    v3Fail("E_FD_CONFIRM_FLAG", "fd-confirm flag differs from the compile receipt");
  }
  let expected;
  try {
    expected = compileRubricFromSpec({ dataPackage: parts, fdConfirmFlag });
  } catch (error) {
    v3Fail("E_RUBRIC_SPEC_DRIFT", `source-derived rubric cannot be regenerated: ${error.message}`);
  }
  if (canonicalJson(expected.rubric) !== canonicalJson(rubric)
    || canonicalJson(expected.receipt) !== canonicalJson(compileReceipt)) {
    v3Fail("E_RUBRIC_SPEC_DRIFT", "rubric or compile receipt differs from the source-derived compiler output");
  }
  exactCandidateSet(rubric.required_candidate_ids, FORMULATION_COHORT);
}

export function compare(operator, value, threshold) {
  if (operator === "<") return value < threshold;
  if (operator === "<=") return value <= threshold;
  if (operator === ">=") return value >= threshold;
  if (operator === ">") return value > threshold;
  return false;
}

function formulationEvidenceIndex(evidence) {
  const index = new Map();
  for (const entry of evidence.observed_results) {
    index.set(`${entry.candidate}:${entry.measure}:${entry.statistic}`, entry);
  }
  return index;
}

function scoreV3(value, rules, measureId) {
  const matches = rules.filter((rule) => compare(rule.operator, value, rule.threshold));
  if (matches.length !== 1) v3Fail("E_RUBRIC_ENVELOPE", `score_map for ${measureId} must match exactly one rule`);
  return matches[0].points;
}

function buildFormulationEvaluation(parts, rubric, decisionId) {
  const index = formulationEvidenceIndex(parts.evidence);
  const matrixCells = [];
  const candidateReviews = FORMULATION_COHORT.map((candidate) => ({ candidate, eligible: true, hard_gates: [], critical_evidence: [] }));
  for (const review of candidateReviews) {
    for (const measure of rubric.measures) {
      const evidence = index.get(`${review.candidate}:${measure.source_measure}:${measure.statistic}`);
      if (!evidence) v3Fail("E_RUBRIC_ENVELOPE", `missing observed evidence for ${review.candidate}/${measure.id}`);
      const cell = {
        candidate: review.candidate,
        measure_id: measure.id,
        value: evidence.value,
        unit: evidence.unit,
        fact_card_ids: parts.bindings.bindings.filter((binding) => binding.evidence_id === evidence.evidence_id).map((binding) => binding.card_id).sort(),
        record_ids: [evidence.record_id],
        evidence_id: evidence.evidence_id,
      };
      matrixCells.push(cell);
      for (const gate of measure.hard_gates) {
        const passed = compare(gate.operator, evidence.value, gate.threshold);
        review.hard_gates.push({
          measure_id: measure.id,
          passed,
          value: evidence.value,
          operator: gate.operator,
          threshold: gate.threshold,
          record_ids: [evidence.record_id],
          specification_evidence_id: gate.specification_evidence_id,
        });
        if (!passed) review.eligible = false;
      }
    }
  }
  const eligibleCandidates = candidateReviews.filter((review) => review.eligible).map((review) => review.candidate);
  if (eligibleCandidates.length < rubric.minimum_eligible_candidates) {
    return { matrixCells, candidateReviews, eligibleCandidates, winner: null, outcomeCode: "E_INSUFFICIENT_ELIGIBLE_CANDIDATES" };
  }
  const totals = Object.fromEntries(eligibleCandidates.map((candidate) => [candidate, 0]));
  for (const cell of matrixCells) {
    if (!Object.hasOwn(totals, cell.candidate)) continue;
    const measure = rubric.measures.find((entry) => entry.id === cell.measure_id);
    totals[cell.candidate] += scoreV3(cell.value, measure.score_map, measure.id) * measure.weight.nominal;
  }
  const ordered = eligibleCandidates.slice().sort((left, right) => totals[right] - totals[left] || left.localeCompare(right));
  const winner = ordered[0] ?? null;
  const margin = winner === null ? 0 : totals[winner] - (ordered[1] === undefined ? 0 : totals[ordered[1]]);
  const sensitivity = [{ weights: Object.fromEntries(rubric.measures.map((measure) => [measure.id, measure.weight.nominal])), totals, leader: winner, margin }];
  if (winner === null || margin <= rubric.tie_threshold) return { matrixCells, candidateReviews, eligibleCandidates, winner: null, outcomeCode: "E_TIE_OR_SENSITIVITY_UNSTABLE", sensitivity };
  return { matrixCells, candidateReviews, eligibleCandidates, winner, outcomeCode: "selected", sensitivity };
}

function emptyFormulationEvaluation({ decisionId, decisionSha256 = null, rubricSha256 = null, outcomeCode }) {
  return {
    schema_version: FORMULATION_EVALUATION_SCHEMA,
    evaluation_id: `formulation-evaluation-${decisionId}`,
    decision_id: decisionId,
    decision_sha256: decisionSha256,
    rubric_sha256: rubricSha256,
    matrix_cells: [],
    candidate_reviews: [],
    sensitivity: { vectors: [], stable_winner: null },
    outcome_code: outcomeCode,
    selection_evaluated: false,
  };
}

function formulationDecision({ decisionId, status, winner, rubricSha256, fdAction, fdConfirmFlag, package: packageArtifact }) {
  const decision = {
    schema_version: FORMULATION_DECISION_SCHEMA,
    decision_id: decisionId,
    status,
    winner,
    cohort_id: "qbd-p221-formulation-cohort",
    exact_cohort: FORMULATION_COHORT,
    fact_card_ids: packageArtifact.cards.cards.map((card) => card.id).sort(),
    rubric_sha256: rubricSha256,
    fd_action: fdAction,
    fd_confirm_flag: fdConfirmFlag,
  };
  return { ...decision, decision_sha256: sha256Json(decision) };
}

export function evaluateSelectionV3({ dataPackage, rubric, compileReceipt, fdConfirmFlag = createFdConfirmFlag(), decisionId = "qbd-p221-formulation-decision" } = {}) {
  const parts = v3PackageParts(dataPackage);
  if (arguments[0]?.rubricPin !== undefined || arguments[0]?.approval_state !== undefined) {
    v3Fail("E_RUBRIC_APPROVAL_INPUT", "caller-supplied approval state or rubric pin is not accepted");
  }
  validateV3Bindings({ parts, rubric, compileReceipt, fdConfirmFlag });
  if (fdConfirmFlag.flag_state !== "confirmed") {
    const decision = formulationDecision({ decisionId, status: "inconclusive", winner: null, rubricSha256: null, fdAction: "E_RUBRIC_APPROVAL_REQUIRED", fdConfirmFlag, package: parts });
    return { fd_decision: decision, selection_evaluation: emptyFormulationEvaluation({ decisionId, decisionSha256: decision.decision_sha256, outcomeCode: decision.fd_action }), authorized_rubric: null };
  }
  if (rubric.approval_state !== "test-approved") {
    v3Fail("E_RUBRIC_SPEC_DRIFT", "confirmed FD evaluation requires the source-compiled test-approved rubric");
  }
  const authorizedRubric = rubric;
  validateSelectionRubricV3(authorizedRubric);
  const computed = buildFormulationEvaluation(parts, authorizedRubric, decisionId);
  if (computed.winner === null) {
    const decision = formulationDecision({ decisionId, status: "inconclusive", winner: null, rubricSha256: sha256Json(authorizedRubric), fdAction: computed.outcomeCode, fdConfirmFlag, package: parts });
    return {
      fd_decision: decision,
      selection_evaluation: {
        ...emptyFormulationEvaluation({ decisionId, decisionSha256: decision.decision_sha256, rubricSha256: decision.rubric_sha256, outcomeCode: computed.outcomeCode }),
        matrix_cells: computed.matrixCells,
        candidate_reviews: computed.candidateReviews,
        sensitivity: { vectors: computed.sensitivity ?? [], stable_winner: null },
        selection_evaluated: true,
      },
      authorized_rubric: authorizedRubric,
    };
  }
  const decision = formulationDecision({ decisionId, status: "selected", winner: computed.winner, rubricSha256: sha256Json(authorizedRubric), fdAction: "selected", fdConfirmFlag, package: parts });
  return {
    fd_decision: decision,
    selection_evaluation: {
      schema_version: FORMULATION_EVALUATION_SCHEMA,
      evaluation_id: `formulation-evaluation-${decisionId}`,
      decision_id: decisionId,
      decision_sha256: decision.decision_sha256,
      rubric_sha256: decision.rubric_sha256,
      matrix_cells: computed.matrixCells,
      candidate_reviews: computed.candidateReviews,
      sensitivity: { vectors: computed.sensitivity, stable_winner: computed.winner },
      outcome_code: "selected",
      selection_evaluated: true,
    },
    authorized_rubric: authorizedRubric,
  };
}

export function computeFormulationProposal({ dataPackage, rubric, compileReceipt, fdConfirmFlag = createFdConfirmFlag(), decisionId = "qbd-p221-formulation-decision" } = {}) {
  const parts = v3PackageParts(dataPackage);
  validateV3Bindings({ parts, rubric, compileReceipt, fdConfirmFlag });
  const proposed = buildFormulationEvaluation(parts, rubric, decisionId);
  return {
    proposed_survivor: proposed.winner,
    excluded_candidates: proposed.candidateReviews.filter((review) => !review.eligible).map((review) => ({
      candidate: review.candidate,
      failed_gates: review.hard_gates.filter((gate) => !gate.passed).map(({ measure_id, operator, threshold, value, specification_evidence_id }) => ({ measure_id, operator, threshold, value, specification_evidence_id })),
    })),
    matrix_cells: proposed.matrixCells,
    candidate_reviews: proposed.candidateReviews,
    sensitivity: proposed.sensitivity ?? [],
  };
}
