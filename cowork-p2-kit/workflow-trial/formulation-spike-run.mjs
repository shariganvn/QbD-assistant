#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import JSZip from "jszip";

import { createConfig } from "../ingest/config.mjs";
import { runIngest } from "../ingest/pipeline.mjs";
import { buildFormulaEvidenceMatrix, canonicalJson, deriveQuoteFidelityReplacements, extractFormulaCellReceipts, reconcileFormulaReceipts, sha256 } from "./formula-cell-receipt.mjs";
import { buildFormulationTemplateBinding } from "./formulation-template-binding.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const kitRoot = resolve(repoRoot, "cowork-p2-kit");
const sourcePath = resolve(kitRoot, "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx");
const sourceFile = "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx";
const expectedPath = resolve(import.meta.dirname, "tests/fixtures/expected-formula-matrix.json");
const canonicalRoots = [resolve(kitRoot, "inputs"), resolve(kitRoot, "store")];
const protectedRoots = [...canonicalRoots, resolve(kitRoot, "outputs")];
const frozenPins = {
  source_document_sha256: "01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f",
  document_xml_sha256: "ebefbf16e4f7bcae2907d6655d72a3e374cc4b2b6f185380203403f61a2bdf8a",
};

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

function snapshotTree(root) {
  const entries = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) entries.push(`${relative(root, path)}:${sha256(readFileSync(path))}`);
    }
  }
  walk(root);
  return entries.sort();
}

function assertRealDirectory(path, code) {
  if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) fail(code, `unsafe directory: ${path}`);
}

function assertSafeOutputRoot(path) {
  const resolved = resolve(path);
  for (const protectedRoot of protectedRoots) {
    if (overlaps(protectedRoot, resolved)) fail("E_SPIKE_OUTPUT", `output root overlaps a protected canonical root: ${resolved}`);
  }
  let current = resolved;
  while (!existsSync(current)) current = resolve(current, "..");
  const checked = [];
  while (true) {
    checked.push(current);
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  for (const directory of checked) assertRealDirectory(directory, "E_SPIKE_OUTPUT");
}

function writeCanonicalJson(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${canonicalJson(value)}\n`);
  renameSync(temporary, path);
}

export async function verifyFrozenSource({ expectedPins = frozenPins } = {}) {
  const sourceBytes = readFileSync(sourcePath);
  const sourceHash = sha256(sourceBytes);
  if (sourceHash !== expectedPins.source_document_sha256) fail("E_SOURCE_HASH", `source hash ${sourceHash} differs from frozen pin`);
  const zip = await JSZip.loadAsync(sourceBytes);
  const document = zip.file("word/document.xml");
  if (!document) fail("E_DOCUMENT_XML", "source DOCX has no word/document.xml");
  const documentXml = await document.async("string");
  const documentHash = sha256(documentXml);
  if (documentHash !== expectedPins.document_xml_sha256) fail("E_DOCUMENT_HASH", `document.xml hash ${documentHash} differs from frozen pin`);
  return { source_document_sha256: sourceHash, document_xml_sha256: documentHash };
}

export function assertIsolatedConfig(config) {
  for (const root of canonicalRoots) {
    if (overlaps(root, resolve(config.inputsRoot)) || overlaps(root, resolve(config.storeRoot))) {
      fail("E_CANONICAL_INGEST", "Phase 0 must not use or contain a canonical ingest root");
    }
  }
  if (!inside(resolve(config.kitDir), resolve(config.inputsRoot)) || !inside(resolve(config.kitDir), resolve(config.storeRoot))) {
    fail("E_ISOLATED_CONFIG", "isolated input/store roots must remain below the temporary kit root");
  }
}

export function assertIsolatedManifest(manifest) {
  const entries = Object.entries(manifest ?? {});
  if (entries.length !== 1 || entries[0][0] !== sourceFile
    || canonicalJson(entries[0][1]) !== canonicalJson({ label: "public", citable: false, ocr_language: "vie" })) {
    fail("E_ISOLATED_MANIFEST", "isolated manifest must admit only the frozen filled mock with public/non-citable classification");
  }
  return manifest;
}

async function stageIsolatedRun(root) {
  const inputsRoot = join(root, "inputs");
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  mkdirSync(join(inputsRoot, "trials", "placeholder-probe"), { recursive: true });
  mkdirSync(storeRoot, { recursive: true });
  cpSync(sourcePath, join(inputsRoot, "trials", "placeholder-probe", "filled-public-mock-document-030826.docx"));
  cpSync(resolve(kitRoot, "store/records.schema.json"), join(storeRoot, "records.schema.json"));
  const manifest = {
    [sourceFile]: { label: "public", citable: false, ocr_language: "vie" },
  };
  assertIsolatedManifest(manifest);
  writeCanonicalJson(join(inputsRoot, "classification-manifest.json"), manifest);
  const sourceZip = await JSZip.loadAsync(readFileSync(sourcePath));
  const documentXml = await sourceZip.file("word/document.xml")?.async("string");
  if (!documentXml) fail("E_DOCUMENT_XML", "source DOCX has no word/document.xml");
  const config = createConfig({ kitDir: root, inputsRoot, storeRoot, artifactRoot });
  config.textFidelityReplacements = deriveQuoteFidelityReplacements(documentXml);
  assertIsolatedConfig(config);
  return { config, manifest };
}

async function runIsolatedIngest() {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-formulation-spike-"));
  try {
    const { config, manifest } = await stageIsolatedRun(root);
    const result = runIngest(config);
    const storeBytes = readFileSync(join(config.storeRoot, "records.jsonl"));
    return {
      manifest,
      result,
      store_bytes_sha256: sha256(storeBytes),
      store_bytes: storeBytes,
      store_path: join(config.storeRoot, "records.jsonl"),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertExpectedMatrix(actual, expected) {
  if (canonicalJson(actual.formula_ids) !== canonicalJson(expected.formula_ids)
    || canonicalJson(actual.formulas) !== canonicalJson(expected.formulas)
    || canonicalJson(actual.specifications) !== canonicalJson(expected.specifications)) {
    fail("E_FORMULA_EXPECTED", "source-derived formula matrix differs from comparison fixture");
  }
}

function sourceDerivedInventory(receipts) {
  const byRecord = new Map();
  for (const receipt of receipts) {
    const binding = receipt.record_binding;
    const entry = byRecord.get(binding.record_id) ?? {
      record_id: binding.record_id,
      page: binding.page,
      quote_sha256: binding.quote_sha256,
      receipt_ids: [],
      evidence_kinds: [],
    };
    entry.receipt_ids.push(receipt.receipt_id);
    if (!entry.evidence_kinds.includes(receipt.evidence_kind)) entry.evidence_kinds.push(receipt.evidence_kind);
    byRecord.set(binding.record_id, entry);
  }
  return {
    schema_version: "formula-result-inventory/v1",
    record_count: byRecord.size,
    records: [...byRecord.values()].sort((left, right) => left.record_id.localeCompare(right.record_id)),
  };
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--out") fail("E_SPIKE_ARGS", "Usage: formulation-spike-run.mjs --out <directory>");
  return { outDir: resolve(argv[1]) };
}

export async function runFormulationSpike({ outDir }) {
  if (!outDir) fail("E_SPIKE_ARGS", "an output directory is required");
  assertSafeOutputRoot(outDir);
  const canonicalBefore = Object.fromEntries(canonicalRoots.map((root) => [root, snapshotTree(root)]));
  const sourceHashes = await verifyFrozenSource();
  const templateBinding = await buildFormulationTemplateBinding();
  const first = await runIsolatedIngest();
  const second = await runIsolatedIngest();
  if (!first.store_bytes.equals(second.store_bytes) || first.result.storeHash !== second.result.storeHash) {
    fail("E_FULL_INGEST_NONDETERMINISTIC", "two fresh isolated ingests produced different stores");
  }
  const { receipts: extracted } = await extractFormulaCellReceipts({ sourcePath, sourceHashes });
  const receipts = reconcileFormulaReceipts({ receipts: extracted, records: first.result.records, storeRecordsSha256: first.result.storeHash });
  const matrix = buildFormulaEvidenceMatrix(receipts);
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  assertExpectedMatrix(matrix, expected);
  const inventory = sourceDerivedInventory(receipts);
  const canonicalAfter = Object.fromEntries(canonicalRoots.map((root) => [root, snapshotTree(root)]));
  if (canonicalJson(canonicalBefore) !== canonicalJson(canonicalAfter)) fail("E_CANONICAL_MUTATION", "isolated run changed canonical inputs or store");

  const evidence = {
    "template-field-map.v1.json": templateBinding.fieldMap,
    "template-cell-receipt.v1.json": templateBinding.receipt,
    "source-hashes.json": sourceHashes,
    "isolated-config-receipt.json": {
      source_file: sourceFile,
      classification: { label: "public", citable: false },
      manifest_sha256: sha256(canonicalJson(first.manifest)),
      canonical_inputs_unchanged: true,
      canonical_store_unchanged: true,
    },
    "formula-evidence-matrix.json": matrix,
    "result-inventory.json": inventory,
    "formula-cell-receipts.json": {
      schema_version: "formula-cell-receipts/v1",
      receipt_count: receipts.length,
      receipt_set_sha256: sha256(canonicalJson(receipts)),
      receipts,
    },
    "two-run-ingest-hashes.json": {
      first_store_sha256: first.result.storeHash,
      second_store_sha256: second.result.storeHash,
      first_store_bytes_sha256: first.store_bytes_sha256,
      second_store_bytes_sha256: second.store_bytes_sha256,
      byte_identical: true,
    },
    "go-no-go.json": {
      gate: "G-00",
      verdict: "GO",
      receipt_count: receipts.length,
      receipt_set_sha256: sha256(canonicalJson(receipts)),
      formula_ids: matrix.formula_ids,
      record_bindings: receipts.filter((entry) => entry.record_binding.status === "exact").length,
      full_ingest_deterministic: true,
      template_field_count: templateBinding.fieldMap.occurrence_count,
      template_receipt_count: templateBinding.receipt.occurrence_count,
    },
  };
  for (const [name, value] of Object.entries(evidence)) writeCanonicalJson(join(outDir, name), value);
  return { sourceHashes, matrix, receipts, inventory, evidence, templateBinding };
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const result = await runFormulationSpike(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${canonicalJson(result.evidence["go-no-go.json"])}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
