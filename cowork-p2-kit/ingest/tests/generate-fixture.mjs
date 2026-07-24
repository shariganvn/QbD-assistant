/**
 * generate-fixture.mjs — One-shot script to generate the happy-path fixture.
 * Run once, then delete this file (or keep for regeneration).
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createConfig } from "../config.mjs";
import { runIngest } from "../pipeline.mjs";
import { createLiteparseAdapter } from "../liteparse-adapter.mjs";

const fixtureDir = resolve(import.meta.dirname, "fixtures/happy-path");
const tmpStore = join(fixtureDir, "tmp-store");

// Prepare temp store
if (existsSync(tmpStore)) rmSync(tmpStore, { recursive: true, force: true });
mkdirSync(tmpStore, { recursive: true });
copyFileSync(join(fixtureDir, "records.schema.json"), join(tmpStore, "records.schema.json"));

const config = createConfig({
  inputsRoot: join(fixtureDir, "inputs"),
  storeRoot: tmpStore,
  kitDir: fixtureDir,
});

const result = runIngest(config);

// Read generated records
const recordsPath = join(tmpStore, "records.jsonl");
const recordsContent = readFileSync(recordsPath, "utf-8");

// Write expected-records.jsonl
writeFileSync(join(fixtureDir, "expected-records.jsonl"), recordsContent);

// Get liteparse version
const adapter = createLiteparseAdapter(config);
const version = adapter.getVersion();

// Write expected.json
const sha256 = createHash("sha256").update(recordsContent).digest("hex");
const expected = {
  record_count: result.records.length,
  sha256,
  liteparse_version: version,
};
writeFileSync(join(fixtureDir, "expected.json"), JSON.stringify(expected, null, 2) + "\n");

console.log("Fixture generated:");
console.log(`  Records: ${result.records.length}`);
console.log(`  SHA-256: ${sha256}`);
console.log(`  LiteParse: ${version}`);

// Cleanup tmp store
rmSync(tmpStore, { recursive: true, force: true });
console.log("  Temp store cleaned up.");
