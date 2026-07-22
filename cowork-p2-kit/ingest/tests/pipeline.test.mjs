/**
 * pipeline.test.mjs — Modular pipeline compatibility verification.
 *
 * Copies happy-path fixture to isolated roots, writes an absolute JSON config,
 * starts a child CLI process, and verifies byte-identical output.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, copyFileSync, rmSync, mkdtempSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { admitInputs } from "../admission.mjs";
import { createConfig } from "../config.mjs";
import { ERROR_CODES } from "../errors.mjs";
import { createLiteparseAdapter } from "../liteparse-adapter.mjs";
import { buildRecords } from "../records.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/happy-path");
const repoRoot = resolve(testDir, "../../../");
const cliPath = resolve(testDir, "../cli.mjs");
const litBinary = resolve(repoRoot, "node_modules/.bin/lit");
const harmlessProbeBinary = process.execPath;

// ─── Helpers ───────────────────────────────────────────────────────────

function makeIsolatedDir(testName) {
  return mkdtempSync(join(tmpdir(), `ingest-${testName}-`));
}

function cleanupDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// ─── Tests ─────────────────────────────────────────────────────────────

test("happy-path fixture produces byte-identical output via child CLI", () => {
  const tmpDir = makeIsolatedDir("happy-path");
  const tmpInputs = join(tmpDir, "inputs");
  const tmpStore = join(tmpDir, "store");

  try {
    // Copy fixture inputs to isolated dir
    cpSync(join(fixtureDir, "inputs"), tmpInputs, { recursive: true });

    // Ensure store dir exists with schema
    mkdirSync(tmpStore, { recursive: true });
    copyFileSync(join(fixtureDir, "records.schema.json"), join(tmpStore, "records.schema.json"));

    // Write absolute JSON config
    const configPath = join(tmpDir, "config.json");
    const childConfig = {
      inputsRoot: tmpInputs,
      storeRoot: tmpStore,
      kitDir: tmpDir,
      litBinary,
      sofficeBinary: harmlessProbeBinary,
      ghostscriptBinary: "/usr/bin/gs",
      tessdataRoot: "/usr/share/tesseract-ocr/5/tessdata",
    };
    assert.equal(childConfig.sofficeBinary, process.execPath);
    assert.ok(isAbsolute(childConfig.sofficeBinary));
    assert.notEqual(childConfig.sofficeBinary, "/usr/bin/soffice");
    const pipelineSource = readFileSync(resolve(testDir, "../pipeline.mjs"), "utf-8");
    assert.match(pipelineSource, /probeBinary\(sofficeBinary, "LibreOffice", config\)/);
    writeFileSync(configPath, JSON.stringify(childConfig));

    // Start child CLI process
    const result = spawnSync(process.execPath, [cliPath, "--config", configPath], {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    });

    // Assert exit 0
    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);

    // Compare records.jsonl byte-for-byte with expected
    const produced = readFileSync(join(tmpStore, "records.jsonl"), "utf-8");
    const expected = readFileSync(join(fixtureDir, "expected-records.jsonl"), "utf-8");
    assert.equal(produced, expected, "Produced records.jsonl differs from expected-records.jsonl");

    // Verify expected.json
    const expectedMeta = JSON.parse(readFileSync(join(fixtureDir, "expected.json"), "utf-8"));
    const producedHash = createHash("sha256").update(produced).digest("hex");
    assert.equal(producedHash, expectedMeta.sha256, "SHA-256 mismatch");
    assert.equal(
      produced.trim().split("\n").length,
      expectedMeta.record_count,
      "Record count mismatch",
    );
    const version = spawnSync(litBinary, ["--version"], { encoding: "utf-8" });
    assert.equal(version.status, 0, `lit --version failed: ${version.stderr}`);
    assert.equal(version.stdout.trim(), expectedMeta.liteparse_version, "LiteParse version mismatch");

    // Verify three frozen representative records remain byte-identical
    const contractRecords = readFileSync(resolve(testDir, "fixtures/contract/records.jsonl"), "utf-8")
      .trim().split("\n").map(JSON.parse);
    const producedRecords = produced.trim().split("\n").map(JSON.parse);

    for (const contractRec of contractRecords) {
      const found = producedRecords.find((r) => r.id === contractRec.id);
      assert.ok(found, `Representative record ${contractRec.id} not found`);
      assert.deepEqual(found, contractRec, `Representative record ${contractRec.id} differs`);
    }
  } finally {
    cleanupDir(tmpDir);
  }
});

test("no library module calls process.exit", () => {
  const modules = [
    "admission.mjs",
    "config.mjs",
    "errors.mjs",
    "liteparse-adapter.mjs",
    "pipeline.mjs",
    "publication.mjs",
    "publication-support.mjs",
    "records.mjs",
    "schema-validation.mjs",
    "table-reconstruction.mjs",
  ];

  for (const mod of modules) {
    const content = readFileSync(resolve(testDir, `../${mod}`), "utf-8");
    assert.ok(
      !content.includes("process.exit("),
      `${mod} contains process.exit() — only cli.mjs may map errors to exits`,
    );
  }
});

test("dependency execution uses argument arrays, not shell strings", () => {
  const content = readFileSync(resolve(testDir, "../liteparse-adapter.mjs"), "utf-8");
  // No execSync with string command
  assert.ok(!content.includes("execSync("), "liteparse-adapter uses execSync — use spawnSync with argument arrays");
  // Verify argument arrays are used
  assert.ok(content.includes('["parse"'), "parse should use argument array");
  assert.ok(content.includes('["is-complex"'), "is-complex should use argument array");
});

test("is-complex keeps available, unsupported, and invalid outcomes distinct", () => {
  const filePath = resolve(testDir, "fixtures/happy-path/inputs/product-profile.docx");
  const page = { page: 1, text: "A sufficiently long parsed page for record construction.", textItems: [] };
  const admitted = [{ filePath, relPath: "inputs/product-profile.docx", entry: { label: "public", citable: true } }];
  const config = { fileOps: { existsSync: () => true } };

  const available = buildRecords(admitted, { parse: () => ({ pages: [page] }), isComplex: () => ({ status: "available", results: [] }) }, config);
  assert.deepEqual(available.capabilities.isComplex, { status: "available" });

  const unsupported = buildRecords(admitted, { parse: () => ({ pages: [page] }), isComplex: () => ({ status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" }) }, config);
  assert.deepEqual(unsupported.capabilities.isComplex, { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" });

  const invalid = buildRecords(admitted, { parse: () => ({ pages: [page] }), isComplex: () => ({ status: "invalid", code: "E_CAPABILITY_INVALID" }) }, config);
  assert.deepEqual(invalid.capabilities.isComplex, { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

test("buildRecords retains its three-parameter public boundary", () => {
  assert.equal(buildRecords.length, 3, "buildRecords must accept admitted, adapter, and config");
});

test("liteparse adapter parses trailing output and reports bad is-complex output as invalid", () => {
  const filePath = resolve(testDir, "fixtures/happy-path/inputs/product-profile.docx");
  const config = {
    litBinary: "/absolute/lit",
    fileOps: { existsSync: () => true },
    runProcess: (_binary, args) => args[0] === "parse"
      ? { status: 0, stdout: '{"pages":[]}\ntiming: 12ms' }
      : { status: 0, stdout: "diagnostic before json\nnot-json" },
  };
  const adapter = createLiteparseAdapter(config);
  assert.deepEqual(adapter.parse(filePath), { pages: [] });
  assert.deepEqual(adapter.isComplex(filePath), { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

test("non-zero is-complex execution without valid JSON is explicitly unsupported or invalid", () => {
  const filePath = resolve(testDir, "fixtures/happy-path/inputs/product-profile.docx");
  const cfg = { litBinary: "/absolute/lit", inputsRoot: resolve(testDir, "fixtures/happy-path/inputs"), fileOps: { existsSync: () => true, lstatSync: () => ({ isSymbolicLink: () => false, isDirectory: () => true }), realpathSync: (p) => p } };

  // exit 127 without valid JSON → unsupported
  const exit127 = createLiteparseAdapter({ ...cfg, runProcess: () => ({ status: 127, stderr: "command unavailable" }) });
  assert.deepEqual(exit127.isComplex(filePath), { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" });

  // ENOENT (binary not found) → unsupported
  const enoent = createLiteparseAdapter({ ...cfg, runProcess: () => ({ status: null, error: { code: "ENOENT" } }) });
  assert.deepEqual(enoent.isComplex(filePath), { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" });
});

test("malformed manifests are normalized to E_MANIFEST_INVALID", () => {
  const root = mkdtempSync(join(tmpdir(), "ingest-manifest-"));
  try {
    const inputsRoot = join(root, "inputs");
    mkdirSync(join(inputsRoot, "trials"), { recursive: true });
    mkdirSync(join(inputsRoot, "reference"), { recursive: true });
    writeFileSync(join(inputsRoot, "trials", "sample.docx"), "fixture");
    writeFileSync(join(inputsRoot, "classification-manifest.json"), "{ invalid json");
    assert.throws(() => admitInputs(createConfig({ inputsRoot, kitDir: root })), { code: "E_MANIFEST_INVALID" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI config rejects non-object and non-string path values as E_CONFIG", () => {
  const root = mkdtempSync(join(tmpdir(), "ingest-config-"));
  try {
    for (const value of [null, [], { inputsRoot: null }, { storeRoot: [] }, { litBinary: 7 }]) {
      const configPath = join(root, `${JSON.stringify(value).replaceAll(/[^a-z0-9]/gi, "_")}.json`);
      writeFileSync(configPath, JSON.stringify(value));
      const result = spawnSync(process.execPath, [cliPath, "--config", configPath], { encoding: "utf-8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^\[E_CONFIG\]/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("programmatic binary overrides are absolute and the Stage 2 taxonomy is complete", () => {
  for (const key of ["litBinary", "sofficeBinary", "ghostscriptBinary"]) {
    assert.throws(() => createConfig({ [key]: "relative-binary" }), { code: "E_CONFIG" });
  }
  assert.deepEqual([...ERROR_CODES].sort(), [
    "E_CAPABILITY_INVALID", "E_CAPABILITY_UNSUPPORTED", "E_CONFIG", "E_DEPENDENCY_UNAVAILABLE",
    "E_DUPLICATE_PATH", "E_EMPTY_STORE", "E_INPUT_EMPTY", "E_INPUT_UNSUPPORTED", "E_MANIFEST_ENTRY_MISSING",
    "E_MANIFEST_INVALID", "E_MANIFEST_MISSING", "E_NOT_PUBLIC", "E_PARSE", "E_PATH_ESCAPE",
    "E_PUBLICATION_FAILED", "E_PUBLICATION_LOCKED", "E_RECORD_SCHEMA", "E_ROUND_TRIP", "E_SYMLINK",
  ]);
});

test("all production ingest modules meet the 200-line limit", () => {
  for (const module of ["admission.mjs", "cli.mjs", "config.mjs", "errors.mjs", "liteparse-adapter.mjs", "pipeline.mjs", "publication.mjs", "publication-support.mjs", "records.mjs", "schema-validation.mjs", "table-reconstruction.mjs"]) {
    const lines = readFileSync(resolve(testDir, `../${module}`), "utf-8").split("\n").length - 1;
    assert.ok(lines <= 200, `${module} has ${lines} lines`);
  }
});
