import { readFileSync } from "node:fs";
import {
  assertFieldMap,
  canonicalJson,
  ownerKey,
  sha256,
  validateJsonSchema,
  writeCanonicalJsonAtomic,
} from "./template-field-contract.mjs";

export const CELL_RECEIPT_SCHEMA_VERSION = "template-cell-receipt/v1";

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function requireCondition(condition, code, message) {
  if (!condition) fail(code, message);
}

export function assertCellReceipt(receipt, fieldMap = null, metadata = null) {
  requireCondition(receipt?.schema_version === CELL_RECEIPT_SCHEMA_VERSION, "E_RECEIPT_VERSION", "unsupported cell receipt version");
  for (const key of ["template_sha256", "field_map_sha256", "source_document_sha256", "receipt_sha256"]) {
    requireCondition(/^[a-f0-9]{64}$/.test(receipt[key]), "E_RECEIPT_HASH", `${key} is invalid`);
  }
  requireCondition(typeof receipt.template_version === "string" && receipt.template_version.length > 0, "E_RECEIPT_VERSION", "template_version is required");
  requireCondition(Number.isInteger(receipt.occurrence_count) && receipt.occurrence_count >= 0, "E_RECEIPT_COUNT", "occurrence_count is invalid");
  requireCondition(Array.isArray(receipt.entries) && receipt.entries.length === receipt.occurrence_count, "E_RECEIPT_COUNT", "occurrence_count does not match entries");
  if (fieldMap) {
    assertFieldMap(fieldMap, metadata);
    requireCondition(receipt.template_sha256 === fieldMap.template_sha256, "E_RECEIPT_JOIN", "receipt template hash differs from field map");
    requireCondition(receipt.field_map_sha256 === fieldMap.field_map_sha256, "E_RECEIPT_JOIN", "receipt field-map hash differs from field map");
    requireCondition(receipt.occurrence_count === fieldMap.occurrence_count, "E_RECEIPT_JOIN", "receipt occurrence count differs from field map");
  }
  const ids = new Set();
  for (const [index, entry] of receipt.entries.entries()) {
    requireCondition(/^occ-[a-f0-9]{64}$/.test(entry.occurrence_id), "E_RECEIPT_ENTRY", `entry ${index} occurrence_id is invalid`);
    requireCondition(/^<[A-Z][A-Z0-9%-]*>$/.test(entry.raw_source_token), "E_RECEIPT_ENTRY", `entry ${index} raw source token is invalid`);
    requireCondition(typeof entry.raw_value === "string", "E_RECEIPT_ENTRY", `entry ${index} raw value must be a string`);
    requireCondition(entry.raw_value_sha256 === sha256(entry.raw_value), "E_RECEIPT_ENTRY", `entry ${index} raw value hash does not match`);
    requireCondition(entry.cell_round_trip?.status === "pass", "E_RECEIPT_ROUND_TRIP", `entry ${index} cell round-trip did not pass`);
    requireCondition(entry.cell_round_trip.raw_value_sha256 === entry.raw_value_sha256, "E_RECEIPT_ROUND_TRIP", `entry ${index} cell round-trip hash does not match`);
    requireCondition(entry.record_id === null || typeof entry.record_id === "string", "E_RECEIPT_ENTRY", `entry ${index} record_id is invalid`);
    requireCondition(!ids.has(entry.occurrence_id), "E_RECEIPT_ENTRY", `duplicate occurrence_id ${entry.occurrence_id}`);
    ids.add(entry.occurrence_id);
    if (index > 0) requireCondition(receipt.entries[index - 1].occurrence_id < entry.occurrence_id, "E_RECEIPT_ORDER", "receipt entries must be sorted by occurrence_id");
    if (fieldMap) {
      const mapped = fieldMap.entries.find((candidate) => candidate.occurrence_id === entry.occurrence_id);
      requireCondition(mapped, "E_RECEIPT_JOIN", `receipt occurrence_id is absent from field map: ${entry.occurrence_id}`);
      requireCondition(mapped.canonical_field_id === entry.canonical_field_id, "E_RECEIPT_JOIN", `canonical field mismatch for ${entry.occurrence_id}`);
      requireCondition(mapped.raw_source_token === entry.raw_source_token, "E_RECEIPT_JOIN", `raw source token mismatch for ${entry.occurrence_id}`);
      requireCondition(ownerKey(mapped.owner) === ownerKey(entry.owner), "E_RECEIPT_JOIN", `owner mismatch for ${entry.occurrence_id}`);
      requireCondition(JSON.stringify(mapped.metadata) === JSON.stringify(entry.metadata), "E_RECEIPT_JOIN", `metadata mismatch for ${entry.occurrence_id}`);
    }
  }
  requireCondition(["not_available", "available"].includes(receipt.record_projection?.status), "E_RECEIPT_PROJECTION", "record projection status is invalid");
  requireCondition(receipt.record_projection.status === "not_available" ? receipt.record_projection.reason_code === "E_PAGE_PROVENANCE_UNAVAILABLE" : receipt.record_projection.reason_code === null, "E_RECEIPT_PROJECTION", "record projection reason is invalid");
  requireCondition(Number.isInteger(receipt.record_projection.record_count) && receipt.record_projection.record_count >= 0, "E_RECEIPT_PROJECTION", "record projection count is invalid");
  const unsigned = { ...receipt, receipt_sha256: null };
  requireCondition(receipt.receipt_sha256 === sha256(canonicalJson(unsigned)), "E_RECEIPT_HASH", "receipt_sha256 does not match canonical bytes");
  const schema = JSON.parse(readFileSync(new URL("./contracts/template-cell-receipt.schema.v1.json", import.meta.url), "utf8"));
  const schemaErrors = validateJsonSchema(receipt, schema);
  requireCondition(schemaErrors.length === 0, "E_RECEIPT_SCHEMA", schemaErrors.join("; "));
  return receipt;
}

export function writeCellReceipt(receipt, outputPath, fieldMap = null, metadata = null) {
  assertCellReceipt(receipt, fieldMap, metadata);
  writeCanonicalJsonAtomic(receipt, outputPath, "E_RECEIPT_WRITE");
  return receipt;
}
