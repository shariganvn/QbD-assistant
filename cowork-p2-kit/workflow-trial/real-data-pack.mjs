#!/usr/bin/env node

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { canonicalJson, sha256 } from "./formula-cell-receipt.mjs";

const EXACT_COHORT = ["formula-01", "formula-02", "formula-03"];
const SOURCE_FILE = "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx";
const TRUSTED_SOURCE_HASHES = {
  source_document_sha256: "01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f",
  document_xml_sha256: "ebefbf16e4f7bcae2907d6655d72a3e374cc4b2b6f185380203403f61a2bdf8a",
};
const TRUSTED_STORE_RECORDS_SHA256 = "9660f38d1234373c06aaee6e85c4e6c64478aa7ba1ab04546137c2428735b1fb";
const TRUSTED_RECEIPT_SET_SHA256 = "e2264be13ad19fd4495a1925ba17163de9e710edda5760616dbd996c35222211";
const OBSERVED_STATISTIC = {
  "dissolution-min": "minimum",
  "dissolution-mean": "mean",
  "dissolution-max": "maximum",
  "assay": "raw",
  "content-uniformity-av": "average",
};

const repoRoot = resolve(import.meta.dirname, "../..");
const kitRoot = resolve(repoRoot, "cowork-p2-kit");
const evidenceSchema = JSON.parse(readFileSync(new URL("./contracts/formulation-evidence.schema.v1.json", import.meta.url), "utf8"));
const bindingsSchema = JSON.parse(readFileSync(new URL("./contracts/fact-card-evidence-bindings.schema.v1.json", import.meta.url), "utf8"));
const packageSchema = JSON.parse(readFileSync(new URL("./contracts/formulation-data-package.schema.v1.json", import.meta.url), "utf8"));

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function inside(parent, child) {
  const value = relative(parent, child);
  return value === "" || (!value.startsWith(`..${"/"}`) && value !== "..");
}

function overlaps(left, right) {
  return inside(left, right) || inside(right, left);
}

function specBasis(measure, spec) {
  if (spec.operator === "range-inclusive") return `${measure.toUpperCase()}.SPEC ${spec.lower}-${spec.upper}`;
  return `${measure.toUpperCase()}.SPEC ${spec.operator}${spec.threshold}`;
}

function assertSchemasMatchContract() {
  if (evidenceSchema.$id !== "formulation-evidence.schema.v1"
    || canonicalJson(evidenceSchema.properties.exact_cohort.const) !== canonicalJson(EXACT_COHORT)
    || evidenceSchema.properties.observed_results.items.$ref !== "#/definitions/observed_result") {
    fail("E_EVIDENCE_SCHEMA", "formulation evidence schema does not match the typed-evidence contract");
  }
  if (bindingsSchema.$id !== "fact-card-evidence-bindings.schema.v1"
    || !bindingsSchema.properties.bindings.items.properties.binding_role.enum.includes("scoring")) {
    fail("E_BINDING_SCHEMA", "fact-card binding schema does not match the binding contract");
  }
  if (packageSchema.$id !== "formulation-data-package.schema.v1"
    || canonicalJson([...packageSchema.properties.bound_hashes.required].sort()) !== canonicalJson(["document_xml_sha256", "receipt_set_sha256", "source_document_sha256", "store_records_sha256"].sort())) {
    fail("E_PACKAGE_SCHEMA", "formulation data package schema does not match the sealed-package contract");
  }
}

function schemaTypeMatches(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function resolveSchemaReference(schema, root) {
  if (typeof schema.$ref !== "string" || !schema.$ref.startsWith("#/")) return schema;
  const resolved = schema.$ref.slice(2).split("/").reduce((value, key) => value?.[key], root);
  if (!resolved) fail("E_PACKAGE_SCHEMA", `unresolvable schema reference ${schema.$ref}`);
  return resolved;
}

function validateJsonSchema(value, schema, path = "value", root = schema) {
  const resolved = resolveSchemaReference(schema, root);
  const errors = [];
  const types = resolved.type === undefined ? [] : (Array.isArray(resolved.type) ? resolved.type : [resolved.type]);
  if (types.length > 0 && !types.some((type) => schemaTypeMatches(value, type))) return [`${path} must be ${types.join(" or ")}`];
  if (Object.hasOwn(resolved, "const") && canonicalJson(value) !== canonicalJson(resolved.const)) errors.push(`${path} must equal the declared constant`);
  if (resolved.enum && !resolved.enum.includes(value)) errors.push(`${path} must be one of ${resolved.enum.join(", ")}`);
  if (typeof value === "string") {
    if (resolved.minLength !== undefined && value.length < resolved.minLength) errors.push(`${path} is too short`);
    if (resolved.pattern && !(new RegExp(resolved.pattern).test(value))) errors.push(`${path} does not match ${resolved.pattern}`);
  }
  if (typeof value === "number" && resolved.minimum !== undefined && value < resolved.minimum) errors.push(`${path} must be >= ${resolved.minimum}`);
  if (Array.isArray(value)) {
    if (resolved.minItems !== undefined && value.length < resolved.minItems) errors.push(`${path} has too few items`);
    if (resolved.items) value.forEach((item, index) => errors.push(...validateJsonSchema(item, resolved.items, `${path}[${index}]`, root)));
  }
  if (schemaTypeMatches(value, "object")) {
    for (const key of resolved.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path} missing required field ${key}`);
    if (resolved.additionalProperties === false) {
      const allowed = new Set(Object.keys(resolved.properties ?? {}));
      for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
    }
    for (const [key, child] of Object.entries(resolved.properties ?? {})) {
      if (Object.hasOwn(value, key)) errors.push(...validateJsonSchema(value[key], child, `${path}.${key}`, root));
    }
  }
  return errors;
}

function assertSchema(value, schema, code, label) {
  const errors = validateJsonSchema(value, schema);
  if (errors.length > 0) fail(code, `${label} violates its schema: ${errors.join("; ")}`);
}

export function assertExactCohort(formulaIds) {
  if (!Array.isArray(formulaIds) || formulaIds.length !== EXACT_COHORT.length
    || formulaIds.some((id, index) => id !== EXACT_COHORT[index])) {
    fail("E_EXACT_COHORT", `candidate set must be exactly ${EXACT_COHORT.join(", ")}`);
  }
  return EXACT_COHORT;
}

export function deriveRecordRoles(receipts) {
  const byRecord = new Map();
  for (const receipt of receipts) {
    const recordId = receipt.record_binding.record_id;
    if (!byRecord.has(recordId)) byRecord.set(recordId, []);
    const roles = byRecord.get(recordId);
    if (!roles.includes(receipt.evidence_kind)) roles.push(receipt.evidence_kind);
  }
  const derived = {};
  for (const [recordId, roles] of byRecord) derived[recordId] = [...roles].sort();
  return derived;
}

export function validateEvidenceEnvelope(evidence) {
  assertSchema(evidence, evidenceSchema, "E_EVIDENCE_SCHEMA", "evidence envelope");
  const expectedKeys = ["composition_context", "exact_cohort", "observed_results", "schema_version", "specifications"];
  const actualKeys = Object.keys(evidence).sort();
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) fail("E_EVIDENCE_ENVELOPE", "evidence envelope keys must match the contract");
  for (const [key, kind] of [["observed_results", "observed_result"], ["specifications", "specification"], ["composition_context", "composition_context"]]) {
    for (const item of evidence[key]) {
      if (item.kind !== kind) fail("E_EVIDENCE_ENVELOPE", `evidence item kind mismatch in ${key}`);
    }
  }
  assertExactCohort(evidence.exact_cohort);
  const allEvidence = [...evidence.observed_results, ...evidence.specifications, ...evidence.composition_context];
  if (allEvidence.length !== 21 || evidence.observed_results.length !== 15 || evidence.specifications.length !== 3 || evidence.composition_context.length !== 3) {
    fail("E_EVIDENCE_ENVELOPE", "evidence envelope must contain the complete observed, specification and composition sets");
  }
  const evidenceIds = new Set();
  const resultKeys = new Set();
  for (const entry of allEvidence) {
    if (evidenceIds.has(entry.evidence_id)) fail("E_EVIDENCE_ENVELOPE", `duplicate evidence id ${entry.evidence_id}`);
    evidenceIds.add(entry.evidence_id);
    if (entry.source_file !== SOURCE_FILE
      || entry.source_document_sha256 !== TRUSTED_SOURCE_HASHES.source_document_sha256
      || entry.store_records_sha256 !== TRUSTED_STORE_RECORDS_SHA256
      || sha256(entry.raw_cell_text) !== entry.raw_cell_sha256) {
      fail("E_EVIDENCE_ENVELOPE", `evidence ${entry.evidence_id} does not preserve its trusted source provenance`);
    }
    const expectedEvidenceId = entry.kind === "specification"
      ? entry.receipt_id
      : `${entry.kind.replaceAll("_", "-")}:${entry.receipt_id}`;
    if (entry.evidence_id !== expectedEvidenceId) {
      fail("E_EVIDENCE_ENVELOPE", `evidence ${entry.evidence_id} does not match its receipt id`);
    }
    if (entry.char_end <= entry.char_start) {
      fail("E_EVIDENCE_ENVELOPE", `evidence ${entry.evidence_id} has invalid source offsets`);
    }
    const normalizedValue = entry.kind === "specification"
      ? Object.fromEntries(["operator", "lower", "upper", "threshold", "unit"].filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]))
      : { value: entry.value, unit: entry.unit };
    if (sha256(canonicalJson(normalizedValue)) !== entry.normalized_value_sha256) {
      fail("E_EVIDENCE_ENVELOPE", `evidence ${entry.evidence_id} normalized value hash does not match its value`);
    }
    if (entry.kind !== "specification") {
      const key = `${entry.kind}:${entry.candidate}:${entry.measure}`;
      if (resultKeys.has(key)) fail("E_EVIDENCE_ENVELOPE", `duplicate candidate and measure evidence ${key}`);
      resultKeys.add(key);
    }
  }
  return evidence;
}

function buildEvidence({ receipts, matrix }) {
  const seen = new Set();
  for (const receipt of receipts) {
    if (seen.has(receipt.receipt_id)) fail("E_BINDING_AMBIGUOUS", `duplicate receipt id ${receipt.receipt_id}`);
    seen.add(receipt.receipt_id);
  }
  const observedResults = [];
  const specifications = [];
  const compositionContext = [];
  for (const receipt of [...receipts].sort((left, right) => left.receipt_id.localeCompare(right.receipt_id))) {
    const value = receipt.normalized_value;
    const base = {
      receipt_id: receipt.receipt_id,
      record_id: receipt.record_binding.record_id,
      source_document_sha256: receipt.source_document_sha256,
      store_records_sha256: receipt.record_binding.store_records_sha256,
      raw_cell_sha256: receipt.raw_cell_sha256,
      normalized_value_sha256: receipt.normalized_value_sha256,
      source_file: receipt.source_file,
      quote_sha256: receipt.record_binding.quote_sha256,
      page: receipt.record_binding.page,
      char_start: receipt.record_binding.char_start,
      char_end: receipt.record_binding.char_end,
    };
    if (receipt.evidence_kind === "specification") {
      const measure = receipt.receipt_id.replace("specification:", "").replaceAll("-", "_");
      const entry = {
        evidence_id: receipt.receipt_id,
        kind: "specification",
        measure,
        operator: value.operator,
        ...(value.lower !== undefined ? { lower: value.lower } : {}),
        ...(value.upper !== undefined ? { upper: value.upper } : {}),
        ...(value.threshold !== undefined ? { threshold: value.threshold } : {}),
        unit: value.unit,
        basis: specBasis(measure, value),
        raw_cell_text: receipt.raw_cell_text,
        ...base,
      };
      const matrixSpec = matrix.specifications?.[measure];
      if (!matrixSpec) fail("E_EVIDENCE_ENVELOPE", `missing matrix specification ${measure}`);
      for (const key of Object.keys(matrixSpec)) {
        if (entry[key] !== matrixSpec[key]) fail("E_EVIDENCE_ENVELOPE", `specification ${measure} drifts from source-derived matrix`);
      }
      specifications.push(entry);
    } else if (receipt.evidence_kind === "observed_result") {
      const prefix = receipt.receipt_id.slice(0, receipt.receipt_id.lastIndexOf(":"));
      const measure = prefix.replaceAll("-", "_");
      const statistic = OBSERVED_STATISTIC[prefix];
      if (!statistic) fail("E_EVIDENCE_ENVELOPE", `unknown observed measure ${prefix}`);
      const entry = {
        evidence_id: `observed-result:${receipt.receipt_id}`,
        kind: "observed_result",
        candidate: receipt.formula_id,
        measure,
        statistic,
        value: value.value,
        unit: value.unit,
        raw_cell_text: receipt.raw_cell_text,
        ...base,
      };
      if (matrix.formulas?.[entry.candidate]?.[measure] !== entry.value) {
        fail("E_EVIDENCE_ENVELOPE", `observed ${entry.evidence_id} drifts from source-derived matrix`);
      }
      observedResults.push(entry);
    } else if (receipt.evidence_kind === "composition_context") {
      const prefix = receipt.receipt_id.slice(0, receipt.receipt_id.lastIndexOf(":"));
      const measure = prefix.replaceAll("-", "_");
      const entry = {
        evidence_id: `composition-context:${receipt.receipt_id}`,
        kind: "composition_context",
        candidate: receipt.formula_id,
        measure,
        value: value.value,
        unit: value.unit,
        raw_cell_text: receipt.raw_cell_text,
        ...base,
      };
      if (matrix.formulas?.[entry.candidate]?.[measure] !== entry.value) {
        fail("E_EVIDENCE_ENVELOPE", `composition ${entry.evidence_id} drifts from source-derived matrix`);
      }
      compositionContext.push(entry);
    } else {
      fail("E_EVIDENCE_ENVELOPE", `unsupported evidence kind ${receipt.evidence_kind}`);
    }
  }
  return validateEvidenceEnvelope({
    schema_version: "formulation-evidence/v1",
    exact_cohort: EXACT_COHORT,
    observed_results: observedResults,
    specifications,
    composition_context: compositionContext,
  });
}

function buildCardsAndBindings(evidence, receipts) {
  // These cards are binding-validator-only by design (see report note H1): they
  // satisfy the v1 fact-card JSON schema but are NOT fed to the canonical
  // reasoning validateFactCards (comma-decimal raw cells cannot carry the dot-
  // decimal String(value) token it requires). Structural safety for the
  // formulation path lives in the evidence envelope + fact-card-evidence
  // bindings consumed by the formulation evaluator.
  const receiptById = new Map(receipts.map((receipt) => [receipt.receipt_id, receipt]));
  const items = [...evidence.observed_results, ...evidence.composition_context]
    .sort((left, right) => left.evidence_id.localeCompare(right.evidence_id));
  const pairs = items.map((entry) => {
    const receipt = receiptById.get(entry.receipt_id);
    if (!receipt) fail("E_BINDING_AMBIGUOUS", `no receipt for evidence ${entry.evidence_id}`);
    const quote = receipt.record_binding.quote;
    const card = {
      id: `FC-${entry.measure.toUpperCase()}-${entry.candidate}`,
      record_id: entry.record_id,
      candidate: entry.candidate,
      measure: entry.measure,
      raw_text: entry.raw_cell_text,
      normalized_value: entry.value,
      unit: entry.unit,
      quote,
      char_start: entry.char_start,
      char_end: entry.char_end,
      provenance: { file: SOURCE_FILE },
    };
    return {
      card,
      binding: {
        card_id: card.id,
        evidence_id: entry.evidence_id,
        kind: entry.kind,
        binding_role: entry.kind === "observed_result" ? "scoring" : "rationale_support",
      },
    };
  });
  return {
    cards: { schema_version: 1, cards: pairs.map((pair) => pair.card) },
    bindings: { schema_version: "fact-card-evidence-bindings/v1", bindings: pairs.map((pair) => pair.binding) },
  };
}

function trustedReceiptsById(receipts) {
  if (!Array.isArray(receipts) || sha256(canonicalJson(receipts)) !== TRUSTED_RECEIPT_SET_SHA256) {
    fail("E_FACT_PROVENANCE", "fact-card validation requires the exact trusted receipt authority");
  }
  const receiptById = new Map();
  for (const receipt of receipts) {
    if (receiptById.has(receipt.receipt_id)) fail("E_FACT_PROVENANCE", `trusted receipt authority has duplicate receipt ${receipt.receipt_id}`);
    if (receipt.source_file !== SOURCE_FILE
      || receipt.source_document_sha256 !== TRUSTED_SOURCE_HASHES.source_document_sha256
      || receipt.document_xml_sha256 !== TRUSTED_SOURCE_HASHES.document_xml_sha256
      || receipt.record_binding?.store_records_sha256 !== TRUSTED_STORE_RECORDS_SHA256) {
      fail("E_FACT_PROVENANCE", `receipt ${receipt.receipt_id} does not preserve trusted source provenance`);
    }
    receiptById.set(receipt.receipt_id, receipt);
  }
  return receiptById;
}

function matchesReceiptAuthority(entry, receipt) {
  if (!receipt
    || entry.receipt_id !== receipt.receipt_id
    || entry.kind !== receipt.evidence_kind
    || entry.record_id !== receipt.record_binding.record_id
    || entry.raw_cell_sha256 !== receipt.raw_cell_sha256
    || entry.normalized_value_sha256 !== receipt.normalized_value_sha256
    || entry.source_file !== receipt.source_file
    || entry.source_document_sha256 !== receipt.source_document_sha256
    || entry.store_records_sha256 !== receipt.record_binding.store_records_sha256
    || entry.quote_sha256 !== receipt.record_binding.quote_sha256
    || entry.page !== receipt.record_binding.page
    || entry.char_start !== receipt.record_binding.char_start
    || entry.char_end !== receipt.record_binding.char_end) {
    return false;
  }
  if (receipt.evidence_kind === "specification") {
    const expectedMeasure = receipt.receipt_id.replace("specification:", "").replaceAll("-", "_");
    return entry.measure === expectedMeasure
      && entry.operator === receipt.normalized_value.operator
      && entry.lower === receipt.normalized_value.lower
      && entry.upper === receipt.normalized_value.upper
      && entry.threshold === receipt.normalized_value.threshold
      && entry.unit === receipt.normalized_value.unit;
  }
  const prefix = receipt.receipt_id.slice(0, receipt.receipt_id.lastIndexOf(":"));
  if (entry.candidate !== receipt.formula_id
    || entry.measure !== prefix.replaceAll("-", "_")
    || entry.value !== receipt.normalized_value.value
    || entry.unit !== receipt.normalized_value.unit) {
    return false;
  }
  return receipt.evidence_kind !== "observed_result" || entry.statistic === OBSERVED_STATISTIC[prefix];
}

function assertEvidenceReceiptAuthority(evidence, receiptById) {
  const entries = [...evidence.observed_results, ...evidence.specifications, ...evidence.composition_context];
  for (const entry of entries) {
    if (!matchesReceiptAuthority(entry, receiptById.get(entry.receipt_id))) {
      fail("E_FACT_PROVENANCE", `evidence ${entry.evidence_id} does not preserve the trusted receipt provenance`);
    }
  }
}

export function validateBindings({ bindings, evidence, cards, receipts }) {
  validateEvidenceEnvelope(evidence);
  const bindingEnvelope = Array.isArray(bindings)
    ? { schema_version: "fact-card-evidence-bindings/v1", bindings }
    : bindings;
  assertSchema(bindingEnvelope, bindingsSchema, "E_BINDING_SCHEMA", "fact-card bindings");
  const bindingItems = bindingEnvelope.bindings;
  const receiptById = trustedReceiptsById(receipts);
  assertEvidenceReceiptAuthority(evidence, receiptById);
  if (!Array.isArray(cards?.cards)) fail("E_BINDING_AMBIGUOUS", "fact cards must contain a cards array");
  const cardIds = new Set();
  for (const card of cards.cards) {
    if (cardIds.has(card.id)) fail("E_BINDING_AMBIGUOUS", `duplicate fact-card id ${card.id}`);
    cardIds.add(card.id);
  }
  const evidenceById = new Map([
    ...evidence.observed_results,
    ...evidence.specifications,
    ...evidence.composition_context,
  ].map((entry) => [entry.evidence_id, entry]));
  const cardsById = new Map(cards.cards.map((card) => [card.id, card]));
  for (const binding of bindingItems) {
    const entry = evidenceById.get(binding.evidence_id);
    const card = cardsById.get(binding.card_id);
    const receipt = entry && receiptById.get(entry.receipt_id);
    if (!entry || !card) fail("E_BINDING_AMBIGUOUS", `binding ${binding.evidence_id} -> ${binding.card_id} does not resolve`);
    if (entry.kind === "specification") fail("E_SPEC_AS_RESULT", `binding targets specification evidence ${binding.evidence_id}`);
    if (binding.kind !== entry.kind) fail("E_BINDING_AMBIGUOUS", `binding kind ${binding.kind} does not match evidence kind ${entry.kind}`);
    if (binding.binding_role === "scoring" && entry.kind !== "observed_result") fail("E_BINDING_AMBIGUOUS", "scoring bindings require observed_result evidence");
    if (binding.binding_role === "rationale_support" && entry.kind !== "composition_context") fail("E_BINDING_AMBIGUOUS", "rationale-support bindings require composition_context evidence");
    if (card.record_id !== entry.record_id) fail("E_BINDING_AMBIGUOUS", "binding card and evidence disagree on record_id");
    if (card.candidate !== entry.candidate) fail("E_BINDING_AMBIGUOUS", "binding card and evidence disagree on candidate");
    if (card.measure !== entry.measure) fail("E_BINDING_AMBIGUOUS", "binding card and evidence disagree on measure");
    if (card.normalized_value !== entry.value) fail("E_BINDING_AMBIGUOUS", "binding card and evidence disagree on value");
    if (typeof card.quote !== "string"
      || !Number.isInteger(card.char_start)
      || !Number.isInteger(card.char_end)
      || card.raw_text !== receipt.raw_cell_text
      || card.provenance?.file !== receipt.source_file
      || card.char_start !== receipt.record_binding.char_start
      || card.char_end !== receipt.record_binding.char_end
      || sha256(card.quote) !== receipt.record_binding.quote_sha256) {
      fail("E_FACT_PROVENANCE", `card ${card.id} does not preserve the trusted receipt provenance`);
    }
  }
  // Completeness: a caller must not hide an adverse result by dropping its
  // binding. Every evidence card is covered exactly once and every observed or
  // composition evidence has its mandatory binding present.
  const cardCount = new Map();
  const scoringCovered = new Set();
  const rationaleCovered = new Set();
  for (const binding of bindingItems) {
    cardCount.set(binding.card_id, (cardCount.get(binding.card_id) ?? 0) + 1);
    if (binding.binding_role === "scoring") scoringCovered.add(binding.evidence_id);
    else rationaleCovered.add(binding.evidence_id);
  }
  for (const card of cards.cards) {
    const count = cardCount.get(card.id) ?? 0;
    if (count !== 1) fail("E_BINDING_INCOMPLETE", `card ${card.id} must have exactly one binding, found ${count}`);
  }
  for (const entry of evidence.observed_results) {
    if (!scoringCovered.has(entry.evidence_id)) fail("E_BINDING_INCOMPLETE", `missing scoring binding for observed ${entry.evidence_id}`);
  }
  for (const entry of evidence.composition_context) {
    if (!rationaleCovered.has(entry.evidence_id)) fail("E_BINDING_INCOMPLETE", `missing rationale-support binding for composition ${entry.evidence_id}`);
  }
  return bindings;
}

function reconcileInventory({ receipts, inventory }) {
  const byRecord = new Map();
  for (const receipt of receipts) {
    const recordId = receipt.record_binding.record_id;
    if (!byRecord.has(recordId)) byRecord.set(recordId, { record_id: recordId, receipt_ids: [], evidence_kinds: [] });
    const entry = byRecord.get(recordId);
    if (!entry.receipt_ids.includes(receipt.receipt_id)) entry.receipt_ids.push(receipt.receipt_id);
    if (!entry.evidence_kinds.includes(receipt.evidence_kind)) entry.evidence_kinds.push(receipt.evidence_kind);
  }
  for (const entry of byRecord.values()) {
    entry.receipt_ids.sort();
    entry.evidence_kinds.sort();
  }
  const receiptRecordIds = new Set(byRecord.keys());
  const inventoryRecords = inventory.records ?? [];
  const inventoryRecordIds = new Set(inventoryRecords.map((record) => record.record_id));
  const missing = [...receiptRecordIds].filter((id) => !inventoryRecordIds.has(id));
  const extra = [...inventoryRecordIds].filter((id) => !receiptRecordIds.has(id));
  if (missing.length > 0 || extra.length > 0) {
    fail("E_INVENTORY_RECONCILIATION", `inventory record set must equal receipt-bound set (missing ${missing.join(",")}, extra ${extra.join(",")})`);
  }
  for (const record of inventoryRecords) {
    const derived = byRecord.get(record.record_id);
    const recordReceiptIds = [...(record.receipt_ids ?? [])].sort();
    if (canonicalJson(recordReceiptIds) !== canonicalJson(derived.receipt_ids)) {
      fail("E_INVENTORY_RECONCILIATION", `inventory record ${record.record_id} receipt set does not match receipts`);
    }
    const recordKinds = [...(record.evidence_kinds ?? [])].sort();
    if (canonicalJson(recordKinds) !== canonicalJson(derived.evidence_kinds)) {
      fail("E_INVENTORY_RECONCILIATION", `inventory record ${record.record_id} evidence kinds do not match receipts (role downgrade)`);
    }
  }
  const records = [...byRecord.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([, entry]) => ({
    record_id: entry.record_id,
    status: "admitted",
    evidence_kinds: entry.evidence_kinds,
    roles: entry.evidence_kinds,
    receipt_ids: entry.receipt_ids,
  }));
  const derivedRoles = Object.fromEntries(
    [...byRecord.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([recordId, entry]) => [recordId, entry.evidence_kinds]),
  );
  return {
    schema_version: "formula-inventory-reconciliation/v1",
    record_count: records.length,
    records,
    exclusions: [],
    derived_roles: derivedRoles,
  };
}

export function buildRealDataPackage({
  matrix,
  inventory,
  receipts,
  sourceHashes,
  storeRecordsSha256,
  receiptSetSha256,
  recordRoles,
}) {
  assertSchemasMatchContract();
  if (!matrix || !inventory || !Array.isArray(receipts) || !sourceHashes) {
    fail("E_PACKAGE_INPUTS", "matrix, inventory, receipts and sourceHashes are required");
  }
  assertExactCohort(matrix.formula_ids);
  if (sourceHashes.source_document_sha256 !== TRUSTED_SOURCE_HASHES.source_document_sha256
    || sourceHashes.document_xml_sha256 !== TRUSTED_SOURCE_HASHES.document_xml_sha256
    || storeRecordsSha256 !== TRUSTED_STORE_RECORDS_SHA256) {
    fail("E_PACKAGE_HASH_BINDING", "source and store hashes must match the trusted extraction authority");
  }
  const seenReceiptIds = new Set();
  for (const receipt of receipts) {
    if (seenReceiptIds.has(receipt.receipt_id)) fail("E_BINDING_AMBIGUOUS", `duplicate receipt id ${receipt.receipt_id}`);
    seenReceiptIds.add(receipt.receipt_id);
  }
  for (const receipt of receipts) {
    if (receipt.source_document_sha256 !== sourceHashes.source_document_sha256
      || receipt.document_xml_sha256 !== sourceHashes.document_xml_sha256) {
      fail("E_PACKAGE_HASH_BINDING", "receipt source/document.xml hash differs from source authority");
    }
    if (receipt.record_binding.store_records_sha256 !== storeRecordsSha256) {
      fail("E_PACKAGE_HASH_BINDING", "receipt store hash differs from store authority");
    }
  }
  if (receiptSetSha256 != null && receiptSetSha256 !== TRUSTED_RECEIPT_SET_SHA256) {
    fail("E_PACKAGE_HASH_BINDING", "caller-supplied receipt set hash differs from the trusted extraction authority");
  }
  const computedReceiptSetSha256 = sha256(canonicalJson(receipts));
  if (computedReceiptSetSha256 !== TRUSTED_RECEIPT_SET_SHA256) {
    fail("E_PACKAGE_HASH_BINDING", "receipt set hash differs from the trusted extraction authority");
  }

  const evidence = buildEvidence({ receipts, matrix });
  const { cards, bindings } = buildCardsAndBindings(evidence, receipts);
  validateBindings({ bindings: bindings.bindings, evidence, cards, receipts });
  const reconciliation = reconcileInventory({ receipts, inventory });

  const derivedRoles = deriveRecordRoles(receipts);
  if (canonicalJson(derivedRoles) !== canonicalJson(reconciliation.derived_roles)) {
    fail("E_ROLE_OVERRIDE", "derived roles must be identical to reconciliation roles");
  }
  if (recordRoles != null && canonicalJson(recordRoles) !== canonicalJson(derivedRoles)) {
    fail("E_ROLE_OVERRIDE", "caller-supplied record roles must exactly match roles derived from evidence");
  }

  const evidenceEnvelopeSha256 = sha256(canonicalJson(evidence));
  const factCardsSha256 = sha256(canonicalJson(cards));
  const factCardBindingsSha256 = sha256(canonicalJson(bindings));
  const inventoryReconciliationSha256 = sha256(canonicalJson(reconciliation));

  const pkg = {
    schema_version: "formulation-data-package/v1",
    exact_cohort: EXACT_COHORT,
    candidate_ids: EXACT_COHORT,
    record_count: reconciliation.record_count,
    evidence_envelope_sha256: evidenceEnvelopeSha256,
    fact_cards_sha256: factCardsSha256,
    fact_card_bindings_sha256: factCardBindingsSha256,
    inventory_reconciliation_sha256: inventoryReconciliationSha256,
    bound_hashes: {
      source_document_sha256: sourceHashes.source_document_sha256,
      document_xml_sha256: sourceHashes.document_xml_sha256,
      store_records_sha256: storeRecordsSha256,
      receipt_set_sha256: computedReceiptSetSha256,
    },
  };
  validateDataPackage(pkg);

  return {
    evidence,
    cards,
    bindings,
    reconciliation,
    package: pkg,
    hashes: {
      source_document_sha256: sourceHashes.source_document_sha256,
      document_xml_sha256: sourceHashes.document_xml_sha256,
      store_records_sha256: storeRecordsSha256,
      receipt_set_sha256: computedReceiptSetSha256,
      evidence_envelope_sha256: evidenceEnvelopeSha256,
      fact_cards_sha256: factCardsSha256,
      fact_card_bindings_sha256: factCardBindingsSha256,
      inventory_reconciliation_sha256: inventoryReconciliationSha256,
      package_sha256: sha256(canonicalJson(pkg)),
    },
  };
}

export function validateDataPackage(pkg) {
  assertSchema(pkg, packageSchema, "E_PACKAGE_SCHEMA", "formulation data package");
  assertExactCohort(pkg.exact_cohort);
  assertExactCohort(pkg.candidate_ids);
  return pkg;
}

function writeCanonicalJson(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${canonicalJson(value)}\n`);
  renameSync(temporary, path);
}

function parseArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (argv[index] !== "--evidence" && argv[index] !== "--out") {
      fail("E_PACKAGE_ARGS", "Usage: real-data-pack.mjs --evidence <dir> [--out <dir>]");
    }
    args[argv[index]] = argv[index + 1];
  }
  if (!args["--evidence"]) fail("E_PACKAGE_ARGS", "an evidence directory is required");
  return { evidenceDir: resolve(args["--evidence"]), outDir: resolve(args["--out"] ?? args["--evidence"]) };
}

function runPack({ evidenceDir, outDir }) {
  if (overlaps(kitRoot, outDir)) fail("E_PACKAGE_OUTPUT", "output must not live inside the kit");
  const read = (name) => JSON.parse(readFileSync(join(evidenceDir, name), "utf8"));
  const sourceHashes = read("source-hashes.json");
  const runHashes = read("two-run-ingest-hashes.json");
  const goNoGo = read("go-no-go.json");
  const matrix = read("formula-evidence-matrix.json");
  const inventory = read("result-inventory.json");
  const receiptWrapper = read("formula-cell-receipts.json");
  const inputs = {
    matrix,
    inventory,
    receipts: receiptWrapper.receipts,
    sourceHashes,
    storeRecordsSha256: runHashes.first_store_sha256,
    receiptSetSha256: goNoGo.receipt_set_sha256,
  };
  const first = buildRealDataPackage(inputs);
  const second = buildRealDataPackage(inputs);
  const byteIdentical = first.hashes.package_sha256 === second.hashes.package_sha256;
  const artifacts = {
    "formulation-evidence.json": first.evidence,
    "fact-cards.json": first.cards,
    "fact-card-evidence-bindings.json": first.bindings,
    "inventory-reconciliation.json": first.reconciliation,
    "formulation-data-package.json": first.package,
    "hashes.json": { ...first.hashes, second_build_package_sha256: second.hashes.package_sha256, byte_identical: byteIdentical },
  };
  for (const [name, value] of Object.entries(artifacts)) writeCanonicalJson(join(outDir, name), value);
  return { package: first.package, hashes: artifacts["hashes.json"] };
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const result = runPack(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${canonicalJson(result.hashes)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
