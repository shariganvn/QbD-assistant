import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalBytes, validatePublishedDecisionPackage } from "../reasoning/publication.mjs";
import { RationalePacketError } from "./errors.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RECEIPT_ARTIFACTS = ["cohort.json", "fact-cards.json", "evidence-log.json", "formula-decision.json", "selection-evaluation.json", "formula-decision.md", "evidence-log.md", "linear-attestation.json"];
const PACKET_KEYS = ["schema_version", "packet_id", "run_id", "source_publication_receipt_sha256", "source_artifacts", "decision", "evaluation", "cohort", "fact_cards", "evidence_log", "linear_attestation", "permitted_sources", "causal_evidence"];
const FACT_CARD_KEYS = ["id", "record_id", "candidate", "measure", "normalized_value", "unit", "quote", "char_start", "char_end", "provenance"];
const DECISION_STATE_FIELDS = ["status", "winner", "cohort_id", "cohort_basis", "fd_action", "rubric_sha256", "linear_attestation_id", "linear_attestation_sha256"];
const EVIDENCE_LOG_KEYS = ["schema_version", "cohort_id", "entries", "exclusions"];
const EVIDENCE_ENTRY_KEYS = ["record_id", "candidate", "fact_card_ids", "quote", "provenance"];
const EVIDENCE_EXCLUSION_KEYS = ["scope", "candidate", "record_id", "reason"];
const CAUSAL_EVIDENCE_KEYS = ["schema_version", "refs"];
const CAUSAL_REF_KEYS = ["ref_kind", "field", "value"];
const FORBIDDEN_PACKET_KEYS = new Set(["content", "raw_text", "record_content", "store_path", "store_bytes", "execution_report", "execution_report_path"]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
const sortedUnique = (values) => [...new Set(values)].sort();

function envelope(message) {
  throw new RationalePacketError("E_PACKET_ENVELOPE", message);
}

function binding(message) {
  throw new RationalePacketError("E_PACKET_BINDING", message);
}

function causal(message) {
  throw new RationalePacketError("E_PACKET_CAUSAL_UNMAPPABLE", message);
}

function readJson(path, context) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new RationalePacketError("E_PACKET_SOURCE_INVALID", `cannot read ${context}: ${error.message}`, { cause: error }); }
}

function sourcePath(root, name) {
  const path = resolve(root, name);
  if (!path.startsWith(`${root}/`)) throw new RationalePacketError("E_PACKET_PATH", "source member escapes source package root");
  return path;
}

function projectFactCards(factCards, evidenceLog) {
  const evidenceByRecord = new Map(evidenceLog.entries.map((entry) => [entry.record_id, entry]));
  return {
    schema_version: factCards.schema_version,
    cards: factCards.cards.map((card) => {
      const evidence = evidenceByRecord.get(card.record_id);
      if (!evidence || evidence.quote !== card.quote) binding(`fact card ${card.id} quote is not an admitted evidence-log quote`);
      return Object.fromEntries(FACT_CARD_KEYS.map((key) => [key, card[key]]));
    }),
  };
}

function numericTokens(value) {
  const tokens = new Set();
  const visit = (candidate) => {
    if (typeof candidate === "number" && Number.isFinite(candidate)) tokens.add(String(candidate));
    else if (Array.isArray(candidate)) candidate.forEach(visit);
    else if (isObject(candidate)) Object.values(candidate).forEach(visit);
  };
  visit(value);
  return [...tokens].sort();
}

function unitTokens(value) {
  const tokens = new Set();
  const knownUnits = new Set(["%", "mg", "g", "kg", "µg", "mcg", "mL", "L", "N", "min", "sec", "°C"]);
  const visit = (candidate) => {
    if (typeof candidate === "string") {
      if (knownUnits.has(candidate)) tokens.add(candidate);
      for (const token of candidate.matchAll(/%|\b(?:mg|g|kg|µg|mcg|mL|L|N|min|sec|°C)\b/g)) tokens.add(token[0]);
    }
    else if (Array.isArray(candidate)) candidate.forEach(visit);
    else if (isObject(candidate)) Object.values(candidate).forEach(visit);
  };
  visit(value);
  return [...tokens].sort();
}

function sourceValueIndex({ factCards, evaluation, evidenceLog, decision }) {
  const factCardEntries = factCards.cards.map((card) => ({
    fact_card_id: card.id,
    value_tokens: [String(card.normalized_value)],
    unit_tokens: [card.unit],
    quote_value_tokens: numericTokens(card.quote),
    quote_unit_tokens: unitTokens(card.quote),
  })).sort((left, right) => left.fact_card_id.localeCompare(right.fact_card_id));
  const gateRefs = [];
  for (const review of evaluation.candidate_reviews) {
    for (const gate of review.hard_gates) gateRefs.push({ candidate: review.candidate, measure_id: gate.measure_id, ref_kind: "hard_gate", value_tokens: numericTokens(gate), unit_tokens: unitTokens(gate) });
    for (const evidence of review.critical_evidence) gateRefs.push({ candidate: review.candidate, measure_id: evidence.measure_id, ref_kind: "critical_evidence", value_tokens: numericTokens(evidence), unit_tokens: unitTokens(evidence) });
  }
  for (const cell of evaluation.matrix_cells) gateRefs.push({ candidate: cell.candidate, measure_id: cell.measure_id, ref_kind: "matrix_cell", value_tokens: numericTokens(cell), unit_tokens: unitTokens(cell) });
  gateRefs.sort((left, right) => [left.candidate, left.measure_id, left.ref_kind].join("\0").localeCompare([right.candidate, right.measure_id, right.ref_kind].join("\0")));
  return {
    fact_cards: factCardEntries,
    gate_refs: gateRefs,
    sensitivity_vectors: evaluation.sensitivity.vectors.map((vector, index) => ({ index, value_tokens: numericTokens(vector), unit_tokens: unitTokens(vector) })),
    exclusions: evidenceLog.exclusions.map(({ candidate, record_id, reason }) => ({ candidate, record_id, reason, value_tokens: [], unit_tokens: [] })),
    decision_state: DECISION_STATE_FIELDS.map((field) => ({ field, value_tokens: decision[field] === null ? ["null"] : [String(decision[field])], unit_tokens: [] })),
  };
}

function derivePermittedSources({ factCards, evaluation, evidenceLog, decision }) {
  const reviewRefs = (field) => evaluation.candidate_reviews.flatMap((review) => review[field].map((entry) => ({ candidate: review.candidate, measure_id: entry.measure_id })))
    .sort((left, right) => `${left.candidate}\0${left.measure_id}`.localeCompare(`${right.candidate}\0${right.measure_id}`));
  return {
    fact_card_ids: sortedUnique(factCards.cards.map((card) => card.id)),
    evidence_record_ids: sortedUnique(evidenceLog.entries.map((entry) => entry.record_id)),
    matrix_cells: evaluation.matrix_cells.map(({ candidate, measure_id }) => ({ candidate, measure_id })).sort((left, right) => `${left.candidate}\0${left.measure_id}`.localeCompare(`${right.candidate}\0${right.measure_id}`)),
    hard_gates: reviewRefs("hard_gates"),
    critical_evidence: reviewRefs("critical_evidence"),
    sensitivity_vector_count: evaluation.sensitivity.vectors.length,
    exclusions: evidenceLog.exclusions.map(({ candidate, record_id, reason }) => ({ candidate, record_id, reason })).sort((left, right) => `${left.candidate}\0${left.record_id ?? ""}\0${left.reason}`.localeCompare(`${right.candidate}\0${right.record_id ?? ""}\0${right.reason}`)),
    decision_state_fields: DECISION_STATE_FIELDS,
    source_value_index: sourceValueIndex({ factCards, evaluation, evidenceLog, decision }),
  };
}

function deriveCausalEvidence({ decision, evaluation }) {
  if (decision.status === "selected") {
    if (decision.fd_action !== "selected" || evaluation.outcome_code !== "selected") causal("selected decision has an unmappable fd_action or evaluation outcome");
    return { schema_version: 1, refs: [] };
  }
  if (decision.status !== "inconclusive" || evaluation.outcome_code !== decision.fd_action) causal("decision status or evaluation outcome has no causal-evidence mapping");
  if (decision.fd_action === "E_RUBRIC_PIN_REQUIRED") {
    if (decision.rubric_sha256 !== null || evaluation.rubric_sha256 !== null) causal("rubric-pin-required decision does not carry the required null rubric state");
    return {
      schema_version: 1,
      refs: [
        { ref_kind: "decision_state", field: "rubric_sha256", value: null },
        { ref_kind: "evaluation_state", field: "outcome_code", value: "E_RUBRIC_PIN_REQUIRED" },
      ],
    };
  }
  if (decision.fd_action === "E_TIE_OR_SENSITIVITY_UNSTABLE") {
    return {
      schema_version: 1,
      refs: [{ ref_kind: "evaluation_state", field: "outcome_code", value: "E_TIE_OR_SENSITIVITY_UNSTABLE" }],
    };
  }
  causal(`fd_action has no causal-evidence mapping: ${String(decision.fd_action)}`);
}

function validateCausalEvidence(causalEvidence, { decision, evaluation }) {
  if (!exactKeys(causalEvidence, CAUSAL_EVIDENCE_KEYS) || causalEvidence.schema_version !== 1 || !Array.isArray(causalEvidence.refs)) envelope("packet causal_evidence has an invalid envelope");
  for (const ref of causalEvidence.refs) {
    if (!exactKeys(ref, CAUSAL_REF_KEYS) || !["decision_state", "evaluation_state"].includes(ref.ref_kind) || typeof ref.field !== "string" || (ref.value !== null && typeof ref.value !== "string")) envelope("packet causal_evidence ref is invalid");
    const source = ref.ref_kind === "decision_state" ? decision : evaluation;
    if (!Object.hasOwn(source, ref.field) || source[ref.field] !== ref.value) binding(`packet causal_evidence ref does not equal its exact ${ref.ref_kind} source`);
  }
}

function assertSourceBindings(packet, { sourcePackage }) {
  const root = resolve(sourcePackage);
  const receiptBytes = readFileSync(sourcePath(root, "publication-receipt.json"));
  const receipt = readJson(sourcePath(root, "publication-receipt.json"), "publication receipt");
  if (packet.run_id !== receipt.run_id) binding("packet run_id does not equal receipt run_id");
  if (packet.source_publication_receipt_sha256 !== sha256(receiptBytes)) binding("packet receipt hash does not equal source receipt bytes");
  if (!exactKeys(packet.source_artifacts, RECEIPT_ARTIFACTS)) binding("packet source_artifacts keys do not equal source receipt artifact keys");
  for (const name of RECEIPT_ARTIFACTS) {
    const expected = receipt.artifacts?.[name];
    const actual = packet.source_artifacts[name];
    if (actual !== expected) binding(`packet source artifact hash disagrees with receipt for ${name}`);
    if (expected !== null && sha256(readFileSync(sourcePath(root, name))) !== expected) binding(`source artifact bytes disagree with receipt for ${name}`);
  }
  const sourceEvidenceLog = readJson(sourcePath(root, "evidence-log.json"), "source evidence log");
  const embeddedMembers = [
    ["formula-decision.json", packet.decision],
    ["selection-evaluation.json", packet.evaluation],
    ["cohort.json", packet.cohort],
    ["evidence-log.json", packet.evidence_log],
    ["fact-cards.json", packet.fact_cards, true],
    ["linear-attestation.json", packet.linear_attestation],
  ];
  for (const [name, embedded, projected] of embeddedMembers) {
    const sourceValue = name === "linear-attestation.json" && receipt.artifacts[name] === null
      ? null
      : readJson(sourcePath(root, name), `source ${name}`);
    const expected = projected ? projectFactCards(sourceValue, sourceEvidenceLog) : sourceValue;
    if (canonicalBytes(embedded) !== canonicalBytes(expected)) binding(`packet embedded ${name} does not equal its verified source artifact`);
  }
}

function assertNoForbiddenPacketFields(value) {
  if (Array.isArray(value)) return value.forEach(assertNoForbiddenPacketFields);
  if (!isObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PACKET_KEYS.has(key)) envelope(`packet contains forbidden field: ${key}`);
    assertNoForbiddenPacketFields(nested);
  }
}

function validateEmbeddedEvidenceLog(evidenceLog) {
  if (!exactKeys(evidenceLog, EVIDENCE_LOG_KEYS) || !Array.isArray(evidenceLog.entries) || !Array.isArray(evidenceLog.exclusions)) envelope("packet evidence_log has an invalid envelope");
  for (const entry of evidenceLog.entries) if (!exactKeys(entry, EVIDENCE_ENTRY_KEYS)) envelope("packet evidence_log entry fields are invalid");
  for (const exclusion of evidenceLog.exclusions) if (!exactKeys(exclusion, EVIDENCE_EXCLUSION_KEYS)) envelope("packet evidence_log exclusion fields are invalid");
}

function validateEmbeddedEvaluation(evaluation) {
  if (!Array.isArray(evaluation.candidate_reviews) || !Array.isArray(evaluation.matrix_cells)
    || !isObject(evaluation.sensitivity) || !Array.isArray(evaluation.sensitivity.vectors)) {
    envelope("packet evaluation has an invalid envelope");
  }
  for (const review of evaluation.candidate_reviews) {
    if (!isObject(review) || typeof review.candidate !== "string" || !Array.isArray(review.hard_gates) || !Array.isArray(review.critical_evidence)) envelope("packet evaluation candidate review is invalid");
    for (const gate of [...review.hard_gates, ...review.critical_evidence]) {
      if (!isObject(gate) || typeof gate.measure_id !== "string") envelope("packet evaluation gate or critical-evidence reference is invalid");
    }
  }
  for (const cell of evaluation.matrix_cells) if (!isObject(cell) || typeof cell.candidate !== "string" || typeof cell.measure_id !== "string") envelope("packet evaluation matrix cell is invalid");
}

export function validateRationalePacket(packet, { sourcePackage } = {}) {
  if (!exactKeys(packet, PACKET_KEYS)) envelope("packet keys must exactly match the rationale packet contract");
  if (packet.schema_version !== 2 || typeof packet.packet_id !== "string" || packet.packet_id === "" || typeof packet.run_id !== "string" || !RUN_ID.test(packet.run_id) || typeof packet.source_publication_receipt_sha256 !== "string" || !SHA256.test(packet.source_publication_receipt_sha256)) envelope("packet envelope fields are invalid");
  if (!exactKeys(packet.source_artifacts, RECEIPT_ARTIFACTS) || RECEIPT_ARTIFACTS.some((name) => packet.source_artifacts[name] !== null && !SHA256.test(packet.source_artifacts[name]))) envelope("packet source artifacts are invalid");
  for (const key of ["decision", "evaluation", "cohort", "fact_cards", "evidence_log", "permitted_sources", "causal_evidence"]) if (!isObject(packet[key])) envelope(`packet ${key} must be an object`);
  if (packet.linear_attestation !== null && !isObject(packet.linear_attestation)) envelope("packet linear_attestation must be an object or null");
  assertNoForbiddenPacketFields(packet);
  validateEmbeddedEvidenceLog(packet.evidence_log);
  validateEmbeddedEvaluation(packet.evaluation);
  const expectedCausalEvidence = deriveCausalEvidence({ decision: packet.decision, evaluation: packet.evaluation });
  validateCausalEvidence(packet.causal_evidence, { decision: packet.decision, evaluation: packet.evaluation });
  if (canonicalBytes(packet.causal_evidence) !== canonicalBytes(expectedCausalEvidence)) binding("packet causal_evidence is not the exact deterministic projection of packet decision state");
  if (!Array.isArray(packet.fact_cards.cards)) envelope("packet fact_cards.cards must be an array");
  const evidenceByRecord = new Map(packet.evidence_log.entries?.map((entry) => [entry.record_id, entry]));
  for (const card of packet.fact_cards.cards) {
    if (!exactKeys(card, FACT_CARD_KEYS)) envelope("packet fact card fields are not author-safe");
    if (!evidenceByRecord.get(card.record_id) || evidenceByRecord.get(card.record_id).quote !== card.quote) binding(`packet fact card ${card.id} quote is not bound to evidence`);
  }
  if (canonicalBytes(packet.permitted_sources) !== canonicalBytes(derivePermittedSources({
    factCards: packet.fact_cards, evaluation: packet.evaluation, evidenceLog: packet.evidence_log, decision: packet.decision,
  }))) binding("packet permitted_sources is not the exact deterministic projection of packet artifacts");
  if (packet.decision.decision_id !== packet.evaluation.decision_id || packet.decision.cohort_id !== packet.cohort.cohort_id || packet.evaluation.cohort_id !== packet.cohort.cohort_id) binding("packet decision, evaluation, and cohort identities disagree");
  if (sha256(canonicalBytes(packet.decision)) !== packet.evaluation.decision_sha256) binding("packet decision SHA-256 does not equal evaluation decision_sha256");
  if ((packet.cohort.linear_attestation_id !== null) !== (packet.linear_attestation !== null)) binding("packet cohort and linear attestation presence disagree");
  if (packet.linear_attestation !== null && (packet.linear_attestation.attestation_id !== packet.cohort.linear_attestation_id || sha256(canonicalBytes(packet.linear_attestation)) !== packet.cohort.linear_attestation_sha256)) binding("packet linear attestation does not equal the cohort binding");
  if (packet.packet_id !== `rationale-packet-${packet.run_id}-${sha256(canonicalBytes(packet.decision))}`) binding("packet_id is not the deterministic receipt run_id and decision hash binding");
  if (sourcePackage !== undefined) assertSourceBindings(packet, { sourcePackage });
  return packet;
}

export function buildRationalePacket({ sourcePackage, store }) {
  const root = resolve(sourcePackage);
  try {
    validatePublishedDecisionPackage(root, { store });
  } catch (error) {
    if (error instanceof RationalePacketError) throw error;
    throw new RationalePacketError("E_PACKET_SOURCE_INVALID", `source decision package is invalid${error?.code ? ` (${error.code})` : ""}: ${error.message}`, { cause: error });
  }
  const receiptBytes = readFileSync(sourcePath(root, "publication-receipt.json"));
  const receipt = readJson(sourcePath(root, "publication-receipt.json"), "publication receipt");
  const decision = readJson(sourcePath(root, "formula-decision.json"), "formula decision");
  const evaluation = readJson(sourcePath(root, "selection-evaluation.json"), "selection evaluation");
  const cohort = readJson(sourcePath(root, "cohort.json"), "cohort");
  const evidenceLog = readJson(sourcePath(root, "evidence-log.json"), "evidence log");
  const factCards = projectFactCards(readJson(sourcePath(root, "fact-cards.json"), "fact cards"), evidenceLog);
  const linearAttestation = receipt.artifacts["linear-attestation.json"] === null ? null : readJson(sourcePath(root, "linear-attestation.json"), "linear attestation");
  const packet = {
    schema_version: 2,
    packet_id: `rationale-packet-${receipt.run_id}-${sha256(canonicalBytes(decision))}`,
    run_id: receipt.run_id,
    source_publication_receipt_sha256: sha256(receiptBytes),
    source_artifacts: receipt.artifacts,
    decision,
    evaluation,
    cohort,
    fact_cards: factCards,
    evidence_log: evidenceLog,
    linear_attestation: linearAttestation,
    permitted_sources: derivePermittedSources({ factCards, evaluation, evidenceLog, decision }),
    causal_evidence: deriveCausalEvidence({ decision, evaluation }),
  };
  return validateRationalePacket(packet, { sourcePackage: root });
}

export function sealRationalePacket({ sourcePackage, store, outputRoot, fileSystem = { mkdirSync, writeFileSync } }) {
  const packet = buildRationalePacket({ sourcePackage, store });
  const root = resolve(outputRoot);
  const target = resolve(root, "rationale-packet.json");
  if (!target.startsWith(`${root}/`)) throw new RationalePacketError("E_PACKET_PATH", "packet output escapes the declared root");
  if (existsSync(root) && (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink())) throw new RationalePacketError("E_PACKET_PATH", "rationale packet root must be a real directory");
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile())) throw new RationalePacketError("E_PACKET_PATH", "rationale packet target must be a regular file");
  try {
    fileSystem.mkdirSync(root, { recursive: true });
    fileSystem.writeFileSync(target, canonicalBytes(packet));
  } catch (error) {
    if (error instanceof RationalePacketError) throw error;
    throw new RationalePacketError("E_PACKET_WRITE", `cannot write rationale packet: ${error.message}`, { cause: error });
  }
  return target;
}
