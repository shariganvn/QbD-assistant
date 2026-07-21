/**
 * publication.mjs — Atomic write seam for record publication.
 *
 * publishRecords(records, config) writes temp → validate → rename.
 * Future hardening: lock, unique-temp, complete-schema, and failure-path handling.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";
import { IngestError } from "./errors.mjs";

/**
 * Validate records against the JSON schema (hand-rolled, matching monolith behavior).
 * @param {object[]} records
 * @param {object} schema — parsed records.schema.json
 * @returns {string[]} validation error messages (empty = valid)
 */
function validateRecords(records, schema) {
  const errors = [];

  for (const rec of records) {
    for (const field of schema.required) {
      if (rec[field] === undefined) {
        errors.push(`Record ${rec.id} missing required field: ${field}`);
      }
    }
    if (rec.provenance) {
      for (const field of schema.properties.provenance.required) {
        if (rec.provenance[field] === undefined) {
          errors.push(`Record ${rec.id} missing provenance.${field}`);
        }
      }
    }
    if (rec.classification) {
      for (const field of schema.properties.classification.required) {
        if (rec.classification[field] === undefined) {
          errors.push(`Record ${rec.id} missing classification.${field}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Publish records: write temp → validate → atomic rename.
 *
 * @param {object[]} records
 * @param {object} config — from createConfig
 * @returns {{ storeHash: string, recordCount: number, storePath: string }}
 * @throws {IngestError} on validation or publication failure
 */
export function publishRecords(records, config) {
  const { storeRoot, schemaPath, fileOps } = config;
  const recordsPath = join(storeRoot, "records.jsonl");
  const tempPath = join(storeRoot, "records.jsonl.tmp");

  // Ensure store dir exists
  if (!fileOps.existsSync(storeRoot)) {
    fileOps.mkdirSync(storeRoot, { recursive: true });
  }

  // Assert non-empty store
  if (records.length === 0) {
    throw new IngestError("E_EMPTY_STORE", "Store is EMPTY after ingest — admission gate may have silently dropped all files");
  }

  // Load schema
  if (!fileOps.existsSync(schemaPath)) {
    throw new IngestError("E_RECORD_SCHEMA", `Schema not found: ${schemaPath}`, {
      details: { path: schemaPath },
    });
  }
  const schema = JSON.parse(fileOps.readFileSync(schemaPath, "utf-8"));

  // Validate records
  const validationErrors = validateRecords(records, schema);
  if (validationErrors.length > 0) {
    throw new IngestError("E_RECORD_SCHEMA", `${validationErrors.length} schema validation errors`, {
      details: { errors: validationErrors },
    });
  }

  // Write to temp file
  const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fileOps.writeFileSync(tempPath, jsonl);

  try {
    // Atomic replace: rename temp to final
    fileOps.renameSync(tempPath, recordsPath);
  } catch (err) {
    // Clean up temp on failure
    try { fileOps.unlinkSync(tempPath); } catch { /* ignore cleanup error */ }
    throw new IngestError("E_PUBLICATION_FAILED", `Failed to atomically replace store: ${err.message}`, {
      cause: err,
    });
  }

  // Compute store hash
  const writtenStore = fileOps.readFileSync(recordsPath, "utf-8");
  const storeHash = createHash("sha256").update(writtenStore).digest("hex");

  return { storeHash, recordCount: records.length, storePath: recordsPath };
}
