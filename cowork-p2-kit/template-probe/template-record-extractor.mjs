#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import {
  assertFieldMap,
  assertGrammar,
  assertMetadataCatalog,
  assertTemplateBinding,
  canonicalJson,
  loadTemplateContracts,
  ownerKey,
  sha256,
} from "./template-field-contract.mjs";
import { assertCellReceipt, writeCellReceipt } from "./template-cell-receipt.mjs";
import { readOwnerTexts } from "./template-owner-reader.mjs";

const kitDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const MVP_FIELD_IDS = Object.freeze([
  "PDS-180-CT02",
  "UOM-SPEC",
  "API-NAME",
  "ASSAY-SPEC",
  "BATCH-SIZE",
]);

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function loadFieldMap(fieldMapOrPath) {
  if (typeof fieldMapOrPath === "object" && fieldMapOrPath !== null) return fieldMapOrPath;
  if (!fieldMapOrPath) fail("E_MAP_READ", "a compiled field map is required");
  try {
    return JSON.parse(readFileSync(resolve(fieldMapOrPath), "utf8"));
  } catch (error) {
    fail("E_MAP_READ", `cannot read field map ${fieldMapOrPath}: ${error.message}`);
  }
}

export function selectTemplateFieldMap(fieldMapOrPath) {
  const fieldMap = loadFieldMap(fieldMapOrPath);
  assertFieldMap(fieldMap);
  const selected = new Map();

  for (const entry of fieldMap.entries) {
    // The authoritative map contains 146 entries; non-MVP entries are expected
    // and remain outside this derived five-entry view.
    if (!MVP_FIELD_IDS.includes(entry.canonical_field_id)) continue;
    if (selected.has(entry.canonical_field_id)) {
      fail("E_SELECTION_DUPLICATE", `selected field occurs more than once: ${entry.canonical_field_id}`);
    }
    selected.set(entry.canonical_field_id, entry);
  }

  const missing = MVP_FIELD_IDS.filter((fieldId) => !selected.has(fieldId));
  if (missing.length > 0) fail("E_SELECTION_MISSING", `selected fields are missing: ${missing.join(", ")}`);

  const entries = [...selected.values()]
    .map((entry) => structuredClone(entry))
    .sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id));
  if (entries.length !== MVP_FIELD_IDS.length) {
    fail("E_SELECTION_COUNT", `selected field count ${entries.length} differs from ${MVP_FIELD_IDS.length}`);
  }

  const selectedMap = {
    ...fieldMap,
    occurrence_count: entries.length,
    entries,
    field_map_sha256: null,
  };
  selectedMap.field_map_sha256 = sha256(canonicalJson(selectedMap));
  assertFieldMap(selectedMap);
  return selectedMap;
}

async function readDocx(sourcePath) {
  const resolvedSource = resolve(sourcePath);
  const bytes = readFileSync(resolvedSource);
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    fail("E_DOCUMENT_READ", `cannot open DOCX ${resolvedSource}: ${error.message}`);
  }
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) fail("E_DOCUMENT_READ", `DOCX has no word/document.xml: ${resolvedSource}`);
  return {
    path: resolvedSource,
    bytes,
    documentXml: await documentFile.async("string"),
  };
}

function resolveKitPath(relativePath) {
  return resolve(kitDir, relativePath);
}

function expectationForFilledDocument(manifest, options) {
  if (options.filledDocumentExpectation) return options.filledDocumentExpectation;
  if (manifest.public_mock) return manifest.public_mock;
  return null;
}

function extractOwnerValues(templateText, filledText, occurrences, ownerDescription) {
  const ordered = [...occurrences].sort((left, right) => left.template_index - right.template_index);
  const literals = [];
  let templateCursor = 0;
  for (const occurrence of ordered) {
    const tokenIndex = templateText.indexOf(occurrence.raw_source_token, templateCursor);
    if (tokenIndex < 0) fail("E_TEMPLATE_OWNER_DRIFT", `${ownerDescription} lost ${occurrence.raw_source_token} in the frozen template owner`);
    literals.push(templateText.slice(templateCursor, tokenIndex));
    templateCursor = tokenIndex + occurrence.raw_source_token.length;
  }
  literals.push(templateText.slice(templateCursor));

  function walk(index, filledCursor, values) {
    if (index === ordered.length) {
      if (!filledText.startsWith(literals.at(-1), filledCursor)) return [];
      const end = filledCursor + literals.at(-1).length;
      return end === filledText.length ? [values] : [];
    }
    const prefix = literals[index];
    if (!filledText.startsWith(prefix, filledCursor)) return [];
    const valueStart = filledCursor + prefix.length;
    const suffix = literals[index + 1];
    if (!suffix.length) {
      if (index !== ordered.length - 1) return [];
      return walk(index + 1, filledText.length, new Map(values).set(ordered[index].occurrence_id, filledText.slice(valueStart)));
    }
    const matches = [];
    let suffixIndex = filledText.indexOf(suffix, valueStart);
    while (suffixIndex >= 0) {
      const nextValues = new Map(values).set(ordered[index].occurrence_id, filledText.slice(valueStart, suffixIndex));
      matches.push(...walk(index + 1, suffixIndex, nextValues));
      suffixIndex = filledText.indexOf(suffix, suffixIndex + 1);
    }
    return matches;
  }

  const matches = walk(0, 0, new Map());
  if (matches.length === 0) fail("E_VALUE_ROUND_TRIP", `${ownerDescription} does not preserve the template's literal owner boundaries`);
  if (matches.length > 1) fail("E_VALUE_AMBIGUOUS", `${ownerDescription} has more than one exact field/value alignment`);
  return matches[0];
}

function checkExpectedHash(actual, expected, code, label) {
  if (expected && actual !== expected) fail(code, `${label} hash ${actual} differs from frozen hash ${expected}`);
}

export async function extractTemplateCellReceipt(fieldMapOrPath, filledSourcePath, options = {}) {
  const fieldMap = loadFieldMap(fieldMapOrPath);
  const { manifest, grammar, metadata } = loadTemplateContracts({
    manifest: options.manifest,
    grammar: options.grammar,
    metadata: options.metadata,
  });
  assertGrammar(grammar);
  assertMetadataCatalog(metadata, grammar, manifest);
  assertFieldMap(fieldMap, metadata);
  const ownerFieldMap = options.ownerFieldMap ?? fieldMap;
  assertFieldMap(ownerFieldMap, metadata);
  if (ownerFieldMap.template_sha256 !== fieldMap.template_sha256) {
    fail("E_MAP_JOIN", "owner context map is bound to another template");
  }
  const templatePath = options.templateSourcePath ?? resolveKitPath(manifest.template.source_path);
  const filledRelativePath = manifest.public_mock?.source_path;
  if (!filledSourcePath && !filledRelativePath) fail("E_DOCUMENT_READ", "a filled public/mock DOCX is required");
  const filledPath = filledSourcePath ?? resolveKitPath(filledRelativePath);

  const [template, filled] = await Promise.all([readDocx(templatePath), readDocx(filledPath)]);
  assertTemplateBinding(manifest, grammar, metadata, sha256(template.bytes), sha256(template.documentXml));
  checkExpectedHash(sha256(template.bytes), fieldMap.template_sha256, "E_TEMPLATE_DRIFT", "template");
  checkExpectedHash(sha256(template.documentXml), manifest.template.document_xml_sha256, "E_TEMPLATE_DRIFT", "template document.xml");
  const filledExpectation = expectationForFilledDocument(manifest, options);
  checkExpectedHash(sha256(filled.bytes), filledExpectation?.sha256, "E_FILLED_DOCUMENT_DRIFT", "filled document");
  checkExpectedHash(sha256(filled.documentXml), filledExpectation?.document_xml_sha256, "E_FILLED_DOCUMENT_DRIFT", "filled document.xml");

  const templateOwners = readOwnerTexts(template.documentXml);
  const filledOwners = readOwnerTexts(filled.documentXml);
  const occurrencesByOwner = new Map();
  for (const entry of ownerFieldMap.entries) {
    const key = ownerKey(entry.owner);
    if (!templateOwners.has(key) || !filledOwners.has(key)) fail("E_STRUCTURE_DRIFT", `field-map owner is absent from template or filled document: ${key}`);
    const ownerEntries = occurrencesByOwner.get(key) ?? [];
    ownerEntries.push({
      occurrence_id: entry.occurrence_id,
      raw_source_token: entry.raw_source_token,
      template_index: templateOwners.get(key).text.indexOf(entry.raw_source_token),
    });
    occurrencesByOwner.set(key, ownerEntries);
  }

  const values = new Map();
  for (const [key, occurrences] of occurrencesByOwner.entries()) {
    if (occurrences.some((occurrence) => occurrence.template_index < 0)) {
      fail("E_TEMPLATE_OWNER_DRIFT", `field-map token is absent from its frozen owner: ${key}`);
    }
    const ownerValues = extractOwnerValues(
      templateOwners.get(key).text,
      filledOwners.get(key).text,
      occurrences,
      key,
    );
    for (const [occurrenceId, value] of ownerValues) values.set(occurrenceId, value);
  }

  const entries = fieldMap.entries.map((entry) => {
    const rawValue = values.get(entry.occurrence_id);
    if (rawValue === undefined) fail("E_FIELD_COUNT", `no extracted value for ${entry.occurrence_id}`);
    if (entry.metadata.required && rawValue.length === 0) fail("E_REQUIRED_VALUE", `required field is blank: ${entry.canonical_field_id}`);
    const rawValueSha256 = sha256(rawValue);
    return {
      occurrence_id: entry.occurrence_id,
      canonical_field_id: entry.canonical_field_id,
      raw_source_token: entry.raw_source_token,
      owner: entry.owner,
      metadata: entry.metadata,
      raw_value: rawValue,
      raw_value_sha256: rawValueSha256,
      cell_round_trip: {
        status: "pass",
        raw_value_sha256: rawValueSha256,
      },
      record_id: null,
    };
  });
  const receipt = {
    schema_version: "template-cell-receipt/v1",
    template_version: fieldMap.template_version,
    template_sha256: fieldMap.template_sha256,
    field_map_sha256: fieldMap.field_map_sha256,
    source_document_sha256: sha256(filled.bytes),
    occurrence_count: entries.length,
    entries,
    record_projection: {
      status: "not_available",
      reason_code: "E_PAGE_PROVENANCE_UNAVAILABLE",
      record_count: 0,
    },
    receipt_sha256: null,
  };
  receipt.receipt_sha256 = sha256(canonicalJson(receipt));
  assertCellReceipt(receipt, fieldMap, metadata);
  if (options.outputPath) writeCellReceipt(receipt, options.outputPath, fieldMap, metadata);
  return receipt;
}

export const extractTemplateRecords = extractTemplateCellReceipt;

function parseArgs(argv) {
  if (argv.length !== 8 || argv[0] !== "--map" || argv[2] !== "--filled" || argv[4] !== "--template" || argv[6] !== "--output") {
    throw new Error("Usage: template-record-extractor.mjs --map <field-map.json> --filled <mock.docx> --template <template.docx> --output <receipt.json>");
  }
  return { map: argv[1], filled: argv[3], template: argv[5], output: argv[7] };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { map, filled, template, output } = parseArgs(process.argv.slice(2));
  extractTemplateCellReceipt(map, filled, { templateSourcePath: template, outputPath: output })
    .then((receipt) => console.log(`Wrote deterministic cell receipt: ${basename(output)} (${receipt.occurrence_count} occurrences)`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
