import { ReasoningContractError } from "./errors.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const isPlainObject = (value) => typeof value === "object" && value !== null
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function reject(code, message) {
  throw new ReasoningContractError(code, message);
}

function exactObject(value, keys, code, context) {
  if (!isPlainObject(value)) reject(code, `${context} must be an object`);
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== [...keys].sort()[index])) {
    reject(code, `${context} keys must match the contract`);
  }
}

function string(value, code, context) {
  if (typeof value !== "string" || value.trim() === "") reject(code, `${context} must be a non-empty string`);
}

function integer(value, code, context) {
  if (!Number.isInteger(value) || value < 0) reject(code, `${context} must be a non-negative integer`);
}

function version(value, code, context) {
  if (value !== 1) reject(code, `${context} must be schema version 1`);
}

function shaOrNull(value, code, context) {
  if (value !== null && (typeof value !== "string" || !SHA256.test(value))) {
    reject(code, `${context} must be a SHA-256 hex string or null`);
  }
}

function attestationCoupledNull(id, hash, code, context) {
  const idNull = id === null;
  const hashNull = hash === null;
  if (idNull !== hashNull) {
    reject(code, `${context} attestation ID and hash must be both null or both non-null`);
  }
}

export function validateCohort(cohort) {
  const code = "E_COHORT_ENVELOPE";
  exactObject(cohort, ["schema_version", "cohort_id", "candidates", "provenance_candidate_map", "store_records_sha256", "linear_attestation_id", "linear_attestation_sha256", "cohort_basis"], code, "cohort");
  if (cohort.schema_version !== 2) reject(code, "cohort.schema_version must be 2");
  string(cohort.cohort_id, code, "cohort.cohort_id");
  if (!Array.isArray(cohort.candidates) || cohort.candidates.length === 0) reject(code, "cohort.candidates must be a non-empty array");
  cohort.candidates.forEach((candidate, index) => string(candidate, code, `cohort.candidates[${index}]`));
  if (new Set(cohort.candidates).size !== cohort.candidates.length) reject(code, "cohort.candidates must be unique");
  if (!isPlainObject(cohort.provenance_candidate_map)) reject(code, "cohort.provenance_candidate_map must be an object");
  for (const [file, candidate] of Object.entries(cohort.provenance_candidate_map)) {
    string(file, code, "cohort provenance file");
    // This is the complete committed candidate-identity map, not a projection of
    // the admitted cohort. It may therefore retain candidates excluded by the
    // current cohort boundary (for example, a different-strength formulation).
    string(candidate, code, "cohort provenance candidate");
  }
  if (typeof cohort.store_records_sha256 !== "string" || !SHA256.test(cohort.store_records_sha256)) reject(code, "cohort.store_records_sha256 must be a SHA-256 hex string");
  attestationCoupledNull(cohort.linear_attestation_id, cohort.linear_attestation_sha256, code, "cohort");
  if (cohort.linear_attestation_id !== null) string(cohort.linear_attestation_id, code, "cohort.linear_attestation_id");
  shaOrNull(cohort.linear_attestation_sha256, code, "cohort.linear_attestation_sha256");
  string(cohort.cohort_basis, code, "cohort.cohort_basis");
  return cohort;
}

export function validateSelectionRubric(rubric) {
  const code = "E_RUBRIC_ENVELOPE";
  exactObject(rubric, ["schema_version", "rubric_id", "measures", "unit_vocabulary", "aggregation_rule", "approved_sha256"], code, "selection rubric");
  version(rubric.schema_version, code, "selection rubric.schema_version");
  string(rubric.rubric_id, code, "selection rubric.rubric_id");
  for (const [field, value] of [["measures", rubric.measures], ["unit_vocabulary", rubric.unit_vocabulary]]) {
    if (!Array.isArray(value) || value.length === 0) reject(code, `selection rubric.${field} must be a non-empty array`);
    value.forEach((entry, index) => string(entry, code, `selection rubric.${field}[${index}]`));
  }
  string(rubric.aggregation_rule, code, "selection rubric.aggregation_rule");
  shaOrNull(rubric.approved_sha256, code, "selection rubric.approved_sha256");
  return rubric;
}

export function validateLinearAttestation(attestation) {
  const code = "E_LINEAR_ATTESTATION_ENVELOPE";
  const requiredCommon = ["api", "dosage_form", "product_target", "trial_context"];
  const requiredMemberFields = ["members"];
  const allRequired = [...requiredMemberFields, ...requiredCommon];

  if (isPlainObject(attestation)) {
    for (const field of allRequired) {
      if (!Object.hasOwn(attestation, field)) {
        reject("E_LINEAR_ATTESTATION_INCOMPLETE", `linear attestation is missing required field: ${field}`);
      }
    }
  }

  exactObject(attestation, ["schema_version", "attestation_id", "required_fields", "members", "api", "dosage_form", "product_target", "trial_context"], code, "linear attestation");
  if (attestation.schema_version !== 2) reject(code, "linear attestation.schema_version must be 2");
  string(attestation.attestation_id, code, "linear attestation.attestation_id");

  if (!Array.isArray(attestation.required_fields) || attestation.required_fields.length !== allRequired.length
    || attestation.required_fields.some((field, index) => field !== allRequired[index])) {
    reject("E_LINEAR_ATTESTATION_INCOMPLETE", "linear attestation.required_fields must declare every required field in order");
  }

  for (const field of requiredCommon) {
    if (typeof attestation[field] !== "string" || attestation[field].trim() === "") {
      reject("E_LINEAR_ATTESTATION_INCOMPLETE", `linear attestation.${field} is required`);
    }
  }

  if (!Array.isArray(attestation.members) || attestation.members.length < 2) {
    reject("E_LINEAR_ATTESTATION_INCOMPLETE", "linear attestation.members must contain at least two entries");
  }

  const seenPairs = new Set();
  const strengths = new Set();
  for (const [index, member] of attestation.members.entries()) {
    const context = `linear attestation.members[${index}]`;
    if (!isPlainObject(member)) reject(code, `${context} must be an object`);
    const memberKeys = Object.keys(member).sort();
    if (memberKeys.length !== 2 || memberKeys[0] !== "candidate" || memberKeys[1] !== "strength") {
      reject(code, `${context} must have exactly candidate and strength keys`);
    }
    string(member.candidate, code, `${context}.candidate`);
    string(member.strength, code, `${context}.strength`);
    const pair = `${member.candidate}\0${member.strength}`;
    if (seenPairs.has(pair)) reject(code, `${context} duplicate candidate/strength pair`);
    seenPairs.add(pair);
    strengths.add(member.strength);
  }

  if (strengths.size < 2) {
    reject("E_LINEAR_ATTESTATION_INCOMPLETE", "linear attestation.members must span at least two distinct strengths");
  }

  return attestation;
}

export function validateDecision(decision) {
  const code = "E_DECISION_ENVELOPE";
  exactObject(decision, ["schema_version", "decision_id", "status", "winner", "cohort_id", "fact_card_ids", "rubric_sha256", "fd_action", "linear_attestation_id", "linear_attestation_sha256", "cohort_basis"], code, "decision");
  if (decision.schema_version !== 2) reject(code, "decision.schema_version must be 2");
  string(decision.decision_id, code, "decision.decision_id");
  if (!["selected", "inconclusive"].includes(decision.status)) reject(code, "decision.status is unsupported");
  if (decision.status === "selected") string(decision.winner, code, "decision.winner");
  else if (decision.winner !== null) reject(code, "inconclusive decision.winner must be null");
  string(decision.cohort_id, code, "decision.cohort_id");
  if (!Array.isArray(decision.fact_card_ids) || decision.fact_card_ids.length === 0) reject(code, "decision.fact_card_ids must be a non-empty array");
  decision.fact_card_ids.forEach((id, index) => string(id, code, `decision.fact_card_ids[${index}]`));
  shaOrNull(decision.rubric_sha256, code, "decision.rubric_sha256");
  string(decision.fd_action, code, "decision.fd_action");
  attestationCoupledNull(decision.linear_attestation_id, decision.linear_attestation_sha256, code, "decision");
  if (decision.linear_attestation_id !== null) string(decision.linear_attestation_id, code, "decision.linear_attestation_id");
  shaOrNull(decision.linear_attestation_sha256, code, "decision.linear_attestation_sha256");
  string(decision.cohort_basis, code, "decision.cohort_basis");
  return decision;
}

export function validateEvidenceLog(log) {
  const code = "E_EVIDENCE_LOG_ENVELOPE";
  exactObject(log, ["schema_version", "cohort_id", "entries", "exclusions"], code, "evidence log");
  if (log.schema_version !== 2) reject(code, "evidence log.schema_version must be 2");
  string(log.cohort_id, code, "evidence log.cohort_id");
  if (!Array.isArray(log.entries)) reject(code, "evidence log.entries must be an array");
  log.entries.forEach((entry, index) => {
    const context = `evidence log.entries[${index}]`;
    exactObject(entry, ["record_id", "candidate", "fact_card_ids", "quote", "provenance"], code, context);
    for (const field of ["record_id", "candidate", "quote"]) string(entry[field], code, `${context}.${field}`);
    if (!Array.isArray(entry.fact_card_ids)) reject(code, `${context}.fact_card_ids must be an array`);
    entry.fact_card_ids.forEach((id, idIndex) => string(id, code, `${context}.fact_card_ids[${idIndex}]`));
    if (new Set(entry.fact_card_ids).size !== entry.fact_card_ids.length
      || entry.fact_card_ids.some((id, idIndex) => idIndex > 0 && entry.fact_card_ids[idIndex - 1] >= id)) {
      reject(code, `${context}.fact_card_ids must be unique and lexicographically sorted`);
    }
    exactObject(entry.provenance, ["file", "page", "char_start", "char_end"], code, `${context}.provenance`);
    string(entry.provenance.file, code, `evidence log.entries[${index}].provenance.file`);
    if (!Number.isInteger(entry.provenance.page) || entry.provenance.page < 1) reject(code, `${context}.provenance.page must be a positive integer`);
    integer(entry.provenance.char_start, code, `${context}.provenance.char_start`);
    integer(entry.provenance.char_end, code, `${context}.provenance.char_end`);
    if (entry.provenance.char_end <= entry.provenance.char_start) reject(code, `${context}.provenance offsets must be increasing`);
  });
  if (log.entries.some((entry, index) => index > 0 && log.entries[index - 1].record_id >= entry.record_id)) {
    reject(code, "evidence log.entries must be sorted by record_id without duplicates");
  }
  if (!Array.isArray(log.exclusions)) reject(code, "evidence log.exclusions must be an array");
  log.exclusions.forEach((exclusion, index) => {
    const context = `evidence log.exclusions[${index}]`;
    exactObject(exclusion, ["scope", "candidate", "record_id", "reason"], code, context);
    if (!['candidate', 'record'].includes(exclusion.scope)) reject(code, `${context}.scope is unsupported`);
    string(exclusion.candidate, code, `${context}.candidate`);
    if (exclusion.scope === 'candidate' && exclusion.record_id !== null) reject(code, `${context}.record_id must be null for a candidate exclusion`);
    if (exclusion.scope === 'record') string(exclusion.record_id, code, `${context}.record_id`);
    if (typeof exclusion.reason !== 'string' || !/^E_[A-Z0-9_]+$/.test(exclusion.reason)) reject(code, `${context}.reason must be a stable E_ code`);
  });
  const exclusionKey = (exclusion) => [exclusion.scope, exclusion.candidate, exclusion.record_id ?? "", exclusion.reason].join("\0");
  if (log.exclusions.some((exclusion, index) => index > 0 && exclusionKey(log.exclusions[index - 1]) >= exclusionKey(exclusion))) {
    reject(code, "evidence log.exclusions must be deterministically sorted without duplicates");
  }
  return log;
}

export function validateFactCards(factCards, { cohort, records, minimumQuoteLength = 16 } = {}) {
  const code = "E_FACT_CANDIDATE_BINDING";
  validateCohort(cohort);
  exactObject(factCards, ["schema_version", "cards"], code, "fact cards");
  version(factCards.schema_version, code, "fact cards.schema_version");
  if (!Array.isArray(factCards.cards) || factCards.cards.length === 0) reject(code, "fact cards.cards must be a non-empty array");
  if (!isPlainObject(records)) reject(code, "fact-card records must be an object keyed by record ID");
  factCards.cards.forEach((card, index) => {
    const context = `fact cards.cards[${index}]`;
    exactObject(card, ["id", "record_id", "candidate", "measure", "raw_text", "normalized_value", "unit", "quote", "char_start", "char_end", "provenance"], code, context);
    for (const field of ["id", "record_id", "candidate", "measure", "raw_text", "unit", "quote"]) string(card[field], code, `${context}.${field}`);
    if (typeof card.normalized_value !== "number" || !Number.isFinite(card.normalized_value)) reject(code, `${context}.normalized_value must be finite`);
    integer(card.char_start, code, `${context}.char_start`);
    integer(card.char_end, code, `${context}.char_end`);
    exactObject(card.provenance, ["file"], code, `${context}.provenance`);
    string(card.provenance.file, code, `${context}.provenance.file`);
    const record = records[card.record_id];
    const mappedCandidate = cohort.provenance_candidate_map[card.provenance.file];
    if (!record || record.provenance?.file !== card.provenance.file || mappedCandidate !== card.candidate || !cohort.candidates.includes(card.candidate)) {
      reject(code, `${context} does not bind its record provenance to its candidate`);
    }
    const valueToken = String(card.normalized_value);
    if (!card.raw_text.includes(valueToken) || !card.quote.includes(valueToken) || !card.quote.includes(card.unit)) {
      reject("E_FACT_QUOTE_VALUE_UNIT", `${context} quote and raw_text must contain the value and unit tokens`);
    }
    if (card.quote.length < minimumQuoteLength) reject("E_FACT_QUOTE_LENGTH", `${context} quote is shorter than the declared minimum`);
    if (card.char_end < card.char_start || record.content?.slice(card.char_start, card.char_end) !== card.quote) {
      reject("E_FACT_QUOTE_OFFSET", `${context} quote does not match the declared record offsets`);
    }
  });
  return factCards;
}

export { ReasoningContractError };
