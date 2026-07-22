/**
 * admission-negative.test.mjs — G-07 Fail-closed admission.
 *
 * Executes the real cli.mjs as a child process once per case.
 * Each case copies committed fixtures into a temporary root, seeds the store
 * with valid schema and known records, and asserts byte-for-byte store equality.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, copyFileSync, rmSync, mkdtempSync,
  readdirSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/admission");
const happyFixtureDir = resolve(testDir, "fixtures/happy-path");
const repoRoot = resolve(testDir, "../../../");
const cliPath = resolve(testDir, "../cli.mjs");
const litBinary = resolve(repoRoot, "node_modules/.bin/lit");

const SEED_RECORDS = '{"id":"test-record","source_type":"text","content":"seed","provenance":{"file":"inputs/trials/formulation-trial-01.docx","page":1,"char_start":0,"char_end":4,"quote":"seed","page_kind":"renderer-derived"},"confidence":"high","extraction_status":"ok","classification":{"label":"public","citable":true}}\n';

// ─── Helpers ──────────────────────────────────────────────────────────

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashDir(dir) {
  const entries = [];
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) entries.push([p.slice(dir.length + 1), hashFile(p)]);
    }
  }
  walk(dir);
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function extractErrorCode(stderr) {
  const match = stderr.match(/^\[([A-Z_]+)\]/m);
  return match ? match[1] : null;
}

function appendEvidence(data) {
  const evidencePath = process.env.GATE_EVIDENCE_PATH;
  if (!evidencePath) return;
  const existing = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf8")) : [];
  existing.push(data);
  writeFileSync(evidencePath, JSON.stringify(existing, null, 2) + "\n");
}

// ─── Cases ────────────────────────────────────────────────────────────

const CASES = [
  {
    name: "unsupported-extension",
    mutateInputs: (inputsDir) => {
      writeFileSync(join(inputsDir, "trials", "readme.txt"), "unsupported file");
    },
    mutateManifest: null,
    expectedCode: "E_INPUT_UNSUPPORTED",
  },
  {
    name: "manifest-entry-missing",
    mutateInputs: null,
    mutateManifest: (manifest) => {
      delete manifest["inputs/trials/formulation-trial-01.docx"];
    },
    expectedCode: "E_MANIFEST_ENTRY_MISSING",
  },
  {
    name: "non-public-label",
    mutateInputs: null,
    mutateManifest: (manifest) => {
      manifest["inputs/trials/formulation-trial-01.docx"].label = "internal";
    },
    expectedCode: "E_NOT_PUBLIC",
  },
  {
    name: "invalid-manifest-metadata",
    mutateInputs: null,
    mutateManifest: (manifest) => {
      manifest["inputs/trials/formulation-trial-01.docx"].citable = "yes";
    },
    expectedCode: "E_MANIFEST_INVALID",
  },
  {
    name: "dependency-unavailable",
    mutateInputs: null,
    mutateManifest: null,
    expectedCode: "E_DEPENDENCY_UNAVAILABLE",
    configOverride: { litBinary: "/nonexistent/binary/that/does/not/exist" },
  },
  {
    name: "schema-invariant-failure",
    mutateInputs: null,
    mutateManifest: null,
    expectedCode: "E_RECORD_SCHEMA",
    useRequiredExtra: true,
  },
];

// ─── Hash committed fixtures before any test ──────────────────────────

const committedHashesBefore = {};
for (const f of ["inputs/product-profile.docx", "inputs/trials/formulation-trial-01.docx",
  "inputs/trials/formulation-trial-02.docx", "inputs/trials/formulation-trial-03.docx",
  "inputs/classification-manifest.json"]) {
  committedHashesBefore[f] = hashFile(join(fixtureDir, f));
}

// ─── Main test ────────────────────────────────────────────────────────

test("all six admission cases exit nonzero with expected error codes and preserve store", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "ingest-g07-"));
  const tmpTessdata = join(tmpDir, "tessdata");
  mkdirSync(tmpTessdata, { recursive: true });
  writeFileSync(join(tmpTessdata, "eng.traineddata"), "");
  writeFileSync(join(tmpTessdata, "vie.traineddata"), "");

  try {
    for (const testCase of CASES) {
      const caseDir = join(tmpDir, testCase.name);
      const caseInputs = join(caseDir, "inputs");
      const caseStore = join(caseDir, "store");

      // Copy fixture inputs
      cpSync(join(fixtureDir, "inputs"), caseInputs, { recursive: true });

      // Create store with schema and seed records
      mkdirSync(caseStore, { recursive: true });
      copyFileSync(join(fixtureDir, "records.schema.json"), join(caseStore, "records.schema.json"));

      // For schema-invariant-failure, use a schema requiring a property records never emit
      if (testCase.useRequiredExtra) {
        const schema = JSON.parse(readFileSync(join(caseStore, "records.schema.json"), "utf-8"));
        schema.required = [...(schema.required || []), "mandatory_extra_field_never_emitted"];
        writeFileSync(join(caseStore, "records.schema.json"), JSON.stringify(schema));
      }

      writeFileSync(join(caseStore, "records.jsonl"), SEED_RECORDS);

      // Apply mutations
      if (testCase.mutateInputs) testCase.mutateInputs(caseInputs);
      if (testCase.mutateManifest) {
        const manifestPath = join(caseInputs, "classification-manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        testCase.mutateManifest(manifest);
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      }

      // Hash store before
      const storeBefore = hashDir(caseStore);

      // Build config
      const config = {
        inputsRoot: caseInputs,
        storeRoot: caseStore,
        kitDir: caseDir,
        litBinary: testCase.configOverride?.litBinary ?? litBinary,
        sofficeBinary: process.execPath,
        ghostscriptBinary: process.execPath,
        tessdataRoot: tmpTessdata,
      };
      const configPath = join(caseDir, "config.json");
      writeFileSync(configPath, JSON.stringify(config));

      // Run CLI
      const result = spawnSync(process.execPath, [cliPath, "--config", configPath], {
        encoding: "utf-8",
        timeout: 120_000,
      });

      // Assert nonzero exit
      assert.notEqual(result.status, 0, `${testCase.name}: CLI should exit nonzero`);

      // Assert expected error code in stderr
      const stderrCode = extractErrorCode(result.stderr ?? "");
      assert.equal(stderrCode, testCase.expectedCode,
        `${testCase.name}: expected [${testCase.expectedCode}] in stderr, got [${stderrCode}]: ${result.stderr}`);

      // Assert store is byte-for-byte identical
      const storeAfter = hashDir(caseStore);
      assert.deepEqual(storeBefore, storeAfter, `${testCase.name}: store was modified`);

      appendEvidence({
        case: testCase.name,
        before: storeBefore,
        after: storeAfter,
        exit_code: result.status,
        stderr_code: stderrCode,
      });

      // Cleanup case dir
      rmSync(caseDir, { recursive: true, force: true });
    }

    // Verify committed fixtures unchanged
    for (const [f, expectedHash] of Object.entries(committedHashesBefore)) {
      assert.equal(hashFile(join(fixtureDir, f)), expectedHash, `Committed fixture ${f} was modified`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
