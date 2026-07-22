/**
 * determinism.integration.test.mjs — G-09 Determinism with real LiteParse.
 *
 * Runs the full child CLI twice in independently created temporary roots.
 * Both use the absolute repo-local LiteParse binary (no mocks).
 * Asserts byte-identical JSONL, schema validity, round-trip verification,
 * and fixture hash preservation.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, copyFileSync, rmSync, mkdtempSync,
  readdirSync, lstatSync, realpathSync,
} from "node:fs";
import { spawnSync } from "node:child_process";

function defaultRunProcess(executable, args, options = {}) {
  return spawnSync(executable, args, {
    encoding: "utf-8",
    timeout: options.timeout ?? 60_000,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
    ...options,
  });
}
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createLiteparseAdapter } from "../liteparse-adapter.mjs";
import { verifyRoundTrips } from "../records.mjs";
import { validateJsonl } from "../publication-support.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/happy-path");
const repoRoot = resolve(testDir, "../../../");
const cliPath = resolve(testDir, "../cli.mjs");
const litBinary = resolve(repoRoot, "node_modules/.bin/lit");

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

function createRunDir(label) {
  const tmpDir = mkdtempSync(join(tmpdir(), `ingest-g09-${label}-`));
  const inputsDir = join(tmpDir, "inputs");
  const storeDir = join(tmpDir, "store");
  const tessdataDir = join(tmpDir, "tessdata");

  cpSync(join(fixtureDir, "inputs"), inputsDir, { recursive: true });
  mkdirSync(storeDir, { recursive: true });
  copyFileSync(join(fixtureDir, "records.schema.json"), join(storeDir, "records.schema.json"));
  mkdirSync(tessdataDir, { recursive: true });
  writeFileSync(join(tessdataDir, "eng.traineddata"), "");
  writeFileSync(join(tessdataDir, "vie.traineddata"), "");

  const configPath = join(tmpDir, "config.json");
  writeFileSync(configPath, JSON.stringify({
    inputsRoot: inputsDir,
    storeRoot: storeDir,
    kitDir: tmpDir,
    litBinary,
    sofficeBinary: process.execPath,
    ghostscriptBinary: process.execPath,
    tessdataRoot: tessdataDir,
  }));

  return { tmpDir, inputsDir, storeDir, configPath };
}

// ─── Test ─────────────────────────────────────────────────────────────

test("two independent real-LiteParse runs produce byte-identical schema-valid JSONL", () => {
  // Verify lit --version works
  const versionCheck = spawnSync(litBinary, ["--version"], { encoding: "utf-8", timeout: 10_000 });
  assert.equal(versionCheck.status, 0, `lit --version failed: ${versionCheck.stderr}`);

  // Hash committed fixtures before test
  const fixtureFiles = readdirSync(join(fixtureDir, "inputs"), { recursive: true, withFileTypes: false })
    .filter((f) => typeof f === "string")
    .map((f) => join(fixtureDir, "inputs", f));
  const fixturesBefore = {};
  for (const f of fixtureFiles) {
    try { fixturesBefore[f] = hashFile(f); } catch { /* skip directories */ }
  }

  const run1 = createRunDir("run1");
  const run2 = createRunDir("run2");

  try {
    // Run CLI twice
    const result1 = spawnSync(process.execPath, [cliPath, "--config", run1.configPath], {
      encoding: "utf-8", timeout: 180_000, maxBuffer: 50 * 1024 * 1024,
    });
    const result2 = spawnSync(process.execPath, [cliPath, "--config", run2.configPath], {
      encoding: "utf-8", timeout: 180_000, maxBuffer: 50 * 1024 * 1024,
    });

    // Both must exit 0
    assert.equal(result1.status, 0, `Run 1 exited with ${result1.status}: ${result1.stderr}`);
    assert.equal(result2.status, 0, `Run 2 exited with ${result2.status}: ${result2.stderr}`);

    // Read produced JSONL
    const jsonl1 = readFileSync(join(run1.storeDir, "records.jsonl"), "utf-8");
    const jsonl2 = readFileSync(join(run2.storeDir, "records.jsonl"), "utf-8");

    // Non-empty
    assert.ok(jsonl1.trim().length > 0, "Run 1 produced empty records.jsonl");
    assert.ok(jsonl2.trim().length > 0, "Run 2 produced empty records.jsonl");

    // Schema-valid
    const schema = JSON.parse(readFileSync(join(fixtureDir, "records.schema.json"), "utf-8"));
    assert.doesNotThrow(() => validateJsonl(jsonl1, schema), "Run 1 JSONL failed schema validation");
    assert.doesNotThrow(() => validateJsonl(jsonl2, schema), "Run 2 JSONL failed schema validation");

    // Byte-identical SHA-256
    const hash1 = createHash("sha256").update(jsonl1).digest("hex");
    const hash2 = createHash("sha256").update(jsonl2).digest("hex");
    assert.equal(hash1, hash2, `JSONL hashes differ: ${hash1} vs ${hash2}`);

    // Round-trip verification for both runs — each run parses its own JSONL
    for (const [run, jsonl, label] of [[run1, jsonl1, "Run 1"], [run2, jsonl2, "Run 2"]]) {
      const records = jsonl.trim().split("\n").map(JSON.parse).filter((r) => r.provenance.quote);
      const adapter = createLiteparseAdapter({
        litBinary,
        inputsRoot: run.inputsDir,
        fileOps: { existsSync, lstatSync, realpathSync },
        runProcess: defaultRunProcess,
      });
      const { verified, failed } = verifyRoundTrips(records, adapter, { kitDir: run.tmpDir });
      assert.equal(failed, 0, `${label}: ${failed} round-trip failures`);
      assert.ok(verified > 0, `${label}: no records verified`);
    }

    // Fixture hashes unchanged
    for (const [f, expectedHash] of Object.entries(fixturesBefore)) {
      assert.equal(hashFile(f), expectedHash, `Committed fixture ${f} was modified`);
    }
  } finally {
    rmSync(run1.tmpDir, { recursive: true, force: true });
    rmSync(run2.tmpDir, { recursive: true, force: true });
  }
});
