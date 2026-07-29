import { RationalePacketError } from "./errors.mjs";
import { NUMERIC_TOKEN_REGEX, UNIT_TOKEN_REGEX, exactKeys, isObject, validateRationaleEnvelope } from "./rationale-contracts.mjs";

const CITE_KEYS = Object.freeze({
  fact: ["fact_card_ids", "quotes"],
  gate: ["gate_refs"],
  sensitivity: ["sensitivity_vector_indexes"],
  exclusion: ["exclusion_refs"],
  decision_state: ["decision_state_fields"],
});
const RECOMMENDATION_TOKENS = ["recommend", "we recommend", "should select", "best choice", "winner is"];

function reject(code, message) {
  throw new RationalePacketError(code, message);
}

function binding(message) {
  reject("E_RATIONALE_CLAIM_BINDING", message);
}

function outside(message) {
  reject("E_RATIONALE_EVIDENCE_OUTSIDE_PACKET", message);
}

function exactCites(cites, kind, optional = []) {
  const keys = Object.keys(cites);
  const required = CITE_KEYS[kind].filter((key) => !optional.includes(key));
  const allowed = [...CITE_KEYS[kind], ...optional];
  if (!isObject(cites) || !required.every((key) => Object.hasOwn(cites, key)) || !keys.every((key) => allowed.includes(key))) binding(`invalid ${kind} citation keys`);
}

function nonEmptyStringArray(value, message) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry === "")) binding(message);
  return value;
}

function citedIdentifiers(value) {
  if (Array.isArray(value)) return value.flatMap(citedIdentifiers);
  if (isObject(value)) return Object.values(value).flatMap(citedIdentifiers);
  return typeof value === "string" ? [value] : [];
}

function valueIndex(packet) {
  const index = packet.permitted_sources?.source_value_index;
  if (!isObject(index)) binding("sealed packet has no source value index");
  return index;
}

function tokensFromText(text, expression) {
  return [...text.matchAll(expression)].map((match) => match[0]);
}

function matchingGate(list, reference) {
  return list.find((entry) => entry.candidate === reference.candidate && entry.measure_id === reference.measure_id);
}

function resolveFact(claim, packet) {
  exactCites(claim.cites, "fact", ["quotes"]);
  const ids = nonEmptyStringArray(claim.cites.fact_card_ids, "fact_card_ids must be non-empty");
  const permitted = new Set(packet.permitted_sources.fact_card_ids);
  if (ids.some((id) => !permitted.has(id))) binding("fact claim cites an unpermitted fact card");
  if (Object.hasOwn(claim.cites, "quotes")) nonEmptyStringArray(claim.cites.quotes, "fact quotes must be non-empty when supplied");
  const index = valueIndex(packet);
  const sources = ids.map((id) => {
    const source = index.fact_cards.find((entry) => entry.fact_card_id === id);
    if (!source) binding("fact card has no citation-local value index");
    return { values: source.value_tokens, units: source.unit_tokens, quoteValues: source.quote_value_tokens, quoteUnits: source.quote_unit_tokens, id };
  });
  for (const quote of claim.cites.quotes ?? []) {
    const entries = packet.evidence_log.entries.filter((entry) => entry.quote === quote);
    if (entries.length === 0) outside("fact claim quote is outside the packet");
    if (!entries.some((entry) => entry.fact_card_ids.some((id) => ids.includes(id)))) binding("fact claim quote is not bound to a cited fact card");
    for (const source of sources.filter((entry) => packet.fact_cards.cards.find((card) => card.id === entry.id)?.quote === quote)) {
      source.values = [...source.values, ...source.quoteValues, ...tokensFromText(quote, NUMERIC_TOKEN_REGEX)];
      source.units = [...source.units, ...source.quoteUnits, ...tokensFromText(quote, UNIT_TOKEN_REGEX)];
    }
  }
  return { sources, identifiers: ids };
}

function resolveGate(claim, packet) {
  exactCites(claim.cites, "gate");
  if (!Array.isArray(claim.cites.gate_refs) || claim.cites.gate_refs.length === 0) binding("gate_refs must be non-empty");
  const index = valueIndex(packet);
  const sources = claim.cites.gate_refs.map((reference) => {
    if (!exactKeys(reference, ["candidate", "measure_id", "ref_kind"]) || typeof reference.candidate !== "string" || typeof reference.measure_id !== "string"
      || !["hard_gate", "critical_evidence", "matrix_cell"].includes(reference.ref_kind)) binding("gate reference is invalid");
    const permittedKey = { hard_gate: "hard_gates", critical_evidence: "critical_evidence", matrix_cell: "matrix_cells" }[reference.ref_kind];
    const permitted = packet.permitted_sources[permittedKey];
    if (!matchingGate(permitted, reference)) binding("gate reference is not permitted by the packet");
    const source = index.gate_refs.find((entry) => entry.candidate === reference.candidate && entry.measure_id === reference.measure_id && entry.ref_kind === reference.ref_kind);
    if (!source) binding("gate reference has no citation-local value index");
    return { values: source.value_tokens, units: source.unit_tokens };
  });
  return { sources, identifiers: claim.cites.gate_refs.flatMap(({ candidate, measure_id }) => [candidate, measure_id]) };
}

function resolveSensitivity(claim, packet) {
  exactCites(claim.cites, "sensitivity");
  if (!Array.isArray(claim.cites.sensitivity_vector_indexes) || claim.cites.sensitivity_vector_indexes.length === 0) binding("sensitivity_vector_indexes must be non-empty");
  const index = valueIndex(packet);
  const sources = claim.cites.sensitivity_vector_indexes.map((entry) => {
    if (!Number.isInteger(entry) || entry < 0 || entry >= packet.permitted_sources.sensitivity_vector_count) binding("sensitivity vector index is outside the packet");
    const source = index.sensitivity_vectors.find((vector) => vector.index === entry);
    if (!source) binding("sensitivity vector has no citation-local value index");
    return { values: source.value_tokens, units: source.unit_tokens };
  });
  return { sources, identifiers: [] };
}

function resolveExclusion(claim, packet) {
  exactCites(claim.cites, "exclusion");
  if (!Array.isArray(claim.cites.exclusion_refs) || claim.cites.exclusion_refs.length === 0) binding("exclusion_refs must be non-empty");
  const index = valueIndex(packet);
  const sources = claim.cites.exclusion_refs.map((reference) => {
    if (!exactKeys(reference, ["candidate", "record_id", "reason"]) || typeof reference.candidate !== "string"
      || (typeof reference.record_id !== "string" && reference.record_id !== null) || typeof reference.reason !== "string" || !reference.reason.startsWith("E_")) binding("exclusion reference is invalid");
    if (reference.record_id !== null && !packet.permitted_sources.evidence_record_ids.includes(reference.record_id)) outside("exclusion record_id is outside the packet");
    const permitted = packet.permitted_sources.exclusions.find((entry) => entry.candidate === reference.candidate && entry.record_id === reference.record_id && entry.reason === reference.reason);
    if (!permitted) binding("exclusion reference is not permitted by the packet");
    const source = index.exclusions.find((entry) => entry.candidate === reference.candidate && entry.record_id === reference.record_id && entry.reason === reference.reason);
    if (!source) binding("exclusion reference has no citation-local value index");
    return { values: source.value_tokens, units: source.unit_tokens };
  });
  return { sources, identifiers: claim.cites.exclusion_refs.flatMap(({ candidate, record_id }) => [candidate, ...(record_id === null ? [] : [record_id])]) };
}

function resolveDecisionState(claim, packet) {
  exactCites(claim.cites, "decision_state", ["causal_evidence_refs"]);
  const fields = nonEmptyStringArray(claim.cites.decision_state_fields, "decision_state_fields must be non-empty");
  if (fields.length !== 1 || !packet.permitted_sources.decision_state_fields.includes(fields[0])) binding("decision-state claim must cite one permitted field");
  const field = fields[0];
  const expected = packet.decision[field] === null ? "null" : String(packet.decision[field]);
  if (claim.text !== expected) reject("E_RATIONALE_DECISION_ALTERED", "decision-state text must exactly equal its cited packet field");
  const source = valueIndex(packet).decision_state.find((entry) => entry.field === field);
  if (!source) binding("decision-state field has no citation-local value index");
  const causalRefs = claim.cites.causal_evidence_refs ?? [];
  if (!Array.isArray(causalRefs)) binding("causal_evidence_refs must be an array when supplied");
  if (Object.hasOwn(claim.cites, "causal_evidence_refs") && causalRefs.length === 0) binding("causal_evidence_refs must be non-empty when supplied");
  const permittedRefs = packet.causal_evidence?.refs;
  if (!Array.isArray(permittedRefs)) binding("sealed packet has no causal-evidence index");
  const seenRefs = new Set();
  for (const ref of causalRefs) {
    if (!exactKeys(ref, ["ref_kind", "field", "value"]) || !["decision_state", "evaluation_state"].includes(ref.ref_kind)
      || typeof ref.field !== "string" || (ref.value !== null && typeof ref.value !== "string")) binding("causal-evidence reference is invalid");
    const identity = `${ref.ref_kind}\u0000${ref.field}\u0000${String(ref.value)}`;
    if (seenRefs.has(identity) || !permittedRefs.some((candidate) => candidate.ref_kind === ref.ref_kind && candidate.field === ref.field && candidate.value === ref.value)) binding("causal-evidence reference is not sealed in the packet");
    seenRefs.add(identity);
  }
  return { sources: [{ values: source.value_tokens, units: source.unit_tokens }], identifiers: [], causalRefs };
}

function assertNoInventedValues(claim, resolved) {
  const values = new Set(resolved.sources.flatMap((source) => source.values));
  const units = new Set(resolved.sources.flatMap((source) => source.units));
  const identifiers = resolved.identifiers;
  for (const match of claim.text.matchAll(NUMERIC_TOKEN_REGEX)) {
    const token = match[0];
    if (!values.has(token) && !identifiers.some((id) => id.includes(token))) reject("E_RATIONALE_INVENTED_VALUE", `claim ${claim.claim_id} contains an uncited numeric token`);
  }
  for (const match of claim.text.matchAll(UNIT_TOKEN_REGEX)) if (!units.has(match[0])) reject("E_RATIONALE_INVENTED_VALUE", `claim ${claim.claim_id} contains an uncited unit token`);
}

function resolveClaim(claim, packet) {
  const resolved = ({
    fact: resolveFact,
    gate: resolveGate,
    sensitivity: resolveSensitivity,
    exclusion: resolveExclusion,
    decision_state: resolveDecisionState,
  })[claim.kind](claim, packet);
  assertNoInventedValues(claim, resolved);
  return resolved;
}

function assertInconclusiveExplanation(rationale, packet) {
  if (packet.decision.status !== "inconclusive") return;
  const hasCompleteCausalEvidence = (refs) => Array.isArray(refs) && refs.length === packet.causal_evidence.refs.length
    && refs.every((ref) => packet.causal_evidence.refs.some((sealed) => sealed.ref_kind === ref.ref_kind && sealed.field === ref.field && sealed.value === ref.value));
  const hasFdAction = rationale.claims.some((claim) => claim.kind === "decision_state" && claim.text === packet.decision.fd_action
    && Array.isArray(claim.cites.decision_state_fields) && claim.cites.decision_state_fields.length === 1 && claim.cites.decision_state_fields[0] === "fd_action"
    && hasCompleteCausalEvidence(claim.cites.causal_evidence_refs));
  if (!hasFdAction) reject("E_RATIONALE_INCONCLUSIVE_EXPLANATION", "inconclusive rationale requires fd_action and its complete sealed causal evidence");
  const text = rationale.claims.map((claim) => claim.text.toLowerCase()).join("\n");
  if (RECOMMENDATION_TOKENS.some((token) => text.includes(token))) reject("E_RATIONALE_DECISION_ALTERED", "inconclusive rationale contains a recommendation drift token");
}

export function validateRationale(rationale, packet) {
  validateRationaleEnvelope(rationale, packet);
  for (const claim of rationale.claims) resolveClaim(claim, packet);
  assertInconclusiveExplanation(rationale, packet);
  return rationale;
}
