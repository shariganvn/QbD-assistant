/**
 * capability-discovery.test.mjs — G-08 Capability discovery.
 *
 * Layer 1: Unit-test createLiteparseAdapter.isComplex() with injected runProcess.
 * Layer 2: Aggregate capability rules via buildRecords.
 * Layer 3: Real-child CLI integration test.
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
import { createLiteparseAdapter } from "../liteparse-adapter.mjs";
import { buildRecords } from "../records.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/happy-path");
const repoRoot = resolve(testDir, "../../../");
const cliPath = resolve(testDir, "../cli.mjs");
const litBinary = resolve(repoRoot, "node_modules/.bin/lit");
const productDocx = resolve(fixtureDir, "inputs/product-profile.docx");
const inputsRoot = resolve(fixtureDir, "inputs");

const FAKE_STAT = {
  isSymbolicLink: () => false,
  isDirectory: () => true,
  isFile: () => true,
};

const TRUSTED_FILE_OPS = {
  existsSync: () => true,
  lstatSync: () => FAKE_STAT,
  realpathSync: (p) => p,
  readdirSync: () => [],
};

function makeAdapter(runProcess, overrides = {}) {
  return createLiteparseAdapter({
    litBinary: "/absolute/lit",
    inputsRoot,
    fileOps: TRUSTED_FILE_OPS,
    runProcess,
    ...overrides,
  });
}

function appendSnapshot(data) {
  const evidencePath = process.env.GATE_EVIDENCE_PATH;
  if (!evidencePath) return;
  const existing = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf8")) : [];
  existing.push(data);
  writeFileSync(evidencePath, JSON.stringify(existing, null, 2) + "\n");
}

// ─── Layer 1: Unit tests with injected runProcess ────────────────────

test("valid JSON array with exit 0 is available", () => {
  const result = [{ pageNumber: 1, reasons: ["sparse-text"] }];
  const adapter = makeAdapter(() => ({ status: 0, stdout: JSON.stringify(result) }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "available", results: result });
});

test("valid JSON array with exit 1 is available (complex pages)", () => {
  const result = [{ pageNumber: 1, reasons: ["fullPageImage"] }];
  const adapter = makeAdapter(() => ({ status: 1, stdout: JSON.stringify(result) }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "available", results: result });
});

test("valid JSON array with ENOENT error is available", () => {
  const result = [{ pageNumber: 1, reasons: ["fullPageImage"] }];
  const adapter = makeAdapter(() => ({
    status: null,
    error: { code: "ENOENT" },
    stdout: JSON.stringify(result),
  }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "available", results: result });
});

test("ENOENT without valid JSON is unsupported", () => {
  const adapter = makeAdapter(() => ({ status: null, error: { code: "ENOENT" } }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" });
});

test("exit 127 without valid JSON is unsupported", () => {
  const adapter = makeAdapter(() => ({ status: 127, stderr: "command not found" }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" });
});

test("malformed output is invalid", () => {
  const adapter = makeAdapter(() => ({ status: 0, stdout: "not-json" }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

test("other nonzero exit without valid JSON is invalid", () => {
  const adapter = makeAdapter(() => ({ status: 2, stderr: "error" }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

test("signal termination is invalid", () => {
  const adapter = makeAdapter(() => ({ status: null, signal: "SIGKILL" }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

test("timeout is invalid", () => {
  const adapter = makeAdapter(() => ({ status: null, signal: "SIGTERM" }));
  assert.deepEqual(adapter.isComplex(productDocx), { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

test("input-path trust-validation failure is invalid, never unsupported", () => {
  const adapter = makeAdapter(() => ({ status: 0, stdout: "[]" }), {
    fileOps: { existsSync: () => false },
  });
  assert.deepEqual(adapter.isComplex("/nonexistent/file.docx"), {
    status: "invalid",
    code: "E_CAPABILITY_INVALID",
  });
});

test("required parse failure returns E_PARSE", () => {
  const adapter = makeAdapter(
    (binary, args) => args[0] === "parse"
      ? { status: 1, stderr: "parse error" }
      : { status: 0, stdout: "[]" },
  );
  assert.throws(() => adapter.parse(productDocx), { code: "E_PARSE" });
});

test("invocation recorder observes argument arrays and no ocr subcommand", () => {
  const invocations = [];
  const adapter = makeAdapter((binary, args) => {
    invocations.push({ binary, args: [...args] });
    return args[0] === "parse"
      ? { status: 0, stdout: '{"pages":[]}' }
      : { status: 0, stdout: "[]" };
  });
  adapter.parse(productDocx);
  adapter.isComplex(productDocx);
  for (const inv of invocations) {
    assert.ok(Array.isArray(inv.args), "args must be an array");
    assert.ok(!inv.args.includes("ocr"), "no ocr subcommand should be invoked");
  }
  assert.equal(invocations.length, 2);
  assert.deepEqual(invocations[0].args, ["parse", productDocx, "--format", "json"]);
  assert.deepEqual(invocations[1].args, ["is-complex", productDocx, "--compact"]);
});

// ─── Layer 2: Aggregate capability rules via buildRecords ────────────

test("all unsupported stays unsupported", () => {
  const admitted = [
    { filePath: productDocx, relPath: "inputs/product-profile.docx", entry: { label: "public", citable: true } },
  ];
  const adapter = {
    parse: () => ({ pages: [{ page: 1, text: "A sufficiently long text for record construction purposes.", textItems: [] }] }),
    isComplex: () => ({ status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" }),
  };
  const result = buildRecords(admitted, adapter, { fileOps: { existsSync: () => true } });
  assert.deepEqual(result.capabilities.isComplex, { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" });
});

test("available plus unsupported is available", () => {
  const file1 = resolve(fixtureDir, "inputs/trials/formulation-trial-01.docx");
  const file2 = resolve(fixtureDir, "inputs/trials/formulation-trial-02.docx");
  const admitted = [
    { filePath: file1, relPath: "inputs/trials/formulation-trial-01.docx", entry: { label: "public", citable: true } },
    { filePath: file2, relPath: "inputs/trials/formulation-trial-02.docx", entry: { label: "public", citable: true } },
  ];
  let call = 0;
  const adapter = {
    parse: () => ({ pages: [{ page: 1, text: "A sufficiently long text for record construction purposes.", textItems: [] }] }),
    isComplex: () => call++ === 0
      ? { status: "available", results: [] }
      : { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" },
  };
  const result = buildRecords(admitted, adapter, { fileOps: { existsSync: () => true } });
  assert.deepEqual(result.capabilities.isComplex, { status: "available" });
});

test("any invalid is invalid", () => {
  const file1 = resolve(fixtureDir, "inputs/trials/formulation-trial-01.docx");
  const file2 = resolve(fixtureDir, "inputs/trials/formulation-trial-02.docx");
  const admitted = [
    { filePath: file1, relPath: "inputs/trials/formulation-trial-01.docx", entry: { label: "public", citable: true } },
    { filePath: file2, relPath: "inputs/trials/formulation-trial-02.docx", entry: { label: "public", citable: true } },
  ];
  let call = 0;
  const adapter = {
    parse: () => ({ pages: [{ page: 1, text: "A sufficiently long text for record construction purposes.", textItems: [] }] }),
    isComplex: () => call++ === 0
      ? { status: "available", results: [] }
      : { status: "invalid", code: "E_CAPABILITY_INVALID" },
  };
  const result = buildRecords(admitted, adapter, { fileOps: { existsSync: () => true } });
  assert.deepEqual(result.capabilities.isComplex, { status: "invalid", code: "E_CAPABILITY_INVALID" });
});

// ─── Layer 3: Real-child CLI integration test ────────────────────────

test("real product-profile DOCX precheck emits valid JSON and child CLI reports isComplex available", () => {
  // Precheck: run lit is-complex on the committed DOCX
  const precheck = spawnSync(litBinary, ["is-complex", productDocx, "--compact"], {
    encoding: "utf-8",
    timeout: 60_000,
  });
  // Must emit valid JSON array and exit 1 (complex page)
  assert.notEqual(precheck.status, null, "precheck must have an exit code");
  assert.equal(precheck.status, 1, `precheck exit code: ${precheck.status}`);
  let precheckJson;
  assert.doesNotThrow(() => {
    const open = precheck.stdout.indexOf("[");
    const close = precheck.stdout.lastIndexOf("]");
    assert.ok(open !== -1 && close > open, "precheck must contain a JSON array");
    precheckJson = JSON.parse(precheck.stdout.slice(open, close + 1));
  }, "precheck output must be valid JSON array");
  assert.ok(Array.isArray(precheckJson), "precheck result must be an array");

  // Run child CLI
  const tmpDir = mkdtempSync(join(tmpdir(), "ingest-g08-"));
  const tmpInputs = join(tmpDir, "inputs");
  const tmpStore = join(tmpDir, "store");
  const tmpTessdata = join(tmpDir, "tessdata");
  try {
    cpSync(join(fixtureDir, "inputs"), tmpInputs, { recursive: true });
    mkdirSync(tmpStore, { recursive: true });
    copyFileSync(join(fixtureDir, "records.schema.json"), join(tmpStore, "records.schema.json"));
    mkdirSync(tmpTessdata, { recursive: true });
    writeFileSync(join(tmpTessdata, "eng.traineddata"), "");
    writeFileSync(join(tmpTessdata, "vie.traineddata"), "");

    const configPath = join(tmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      inputsRoot: tmpInputs,
      storeRoot: tmpStore,
      kitDir: tmpDir,
      litBinary,
      sofficeBinary: process.execPath,
      ghostscriptBinary: process.execPath,
      tessdataRoot: tmpTessdata,
    }));

    const result = spawnSync(process.execPath, [cliPath, "--config", configPath], {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    });

    assert.equal(result.status, 0, `CLI exited with ${result.status}: ${result.stderr}`);
    assert.ok(
      result.stdout.includes('"isComplex":{"status":"available"}`') ||
      result.stdout.includes('"isComplex": {"status": "available"}`') ||
      /"isComplex"\s*:\s*\{\s*"status"\s*:\s*"available"/.test(result.stdout),
      `stdout must contain isComplex available: ${result.stdout.slice(0, 500)}`,
    );

    // Append snapshot to GATE_EVIDENCE_PATH if set
    appendSnapshot({
      precheck: { stdout: precheck.stdout, stderr: precheck.stderr, exitCode: precheck.status, json: precheckJson },
      child: { stdout: result.stdout, stderr: result.stderr, exitCode: result.status },
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
