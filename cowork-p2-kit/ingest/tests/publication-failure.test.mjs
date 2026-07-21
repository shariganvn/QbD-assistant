import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createConfig } from "../config.mjs";
import { IngestError } from "../errors.mjs";
import { publishRecords } from "../publication.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const schema = resolve(testDir, "../../store/records.schema.json");
const fixture = resolve(testDir, "fixtures/contract/records.jsonl");
const records = readFileSync(fixture, "utf8").trim().split("\n").map(JSON.parse);
const evidence = [];

function hashFiles(root) {
  return Object.fromEntries(readdirSync(root).sort().map((name) => [name, createHash("sha256").update(readFileSync(join(root, name))).digest("hex")]));
}

function setup(name, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), `publication-${name}-`));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  fs.mkdirSync(storeRoot);
  copyFileSync(schema, join(storeRoot, "records.schema.json"));
  writeFileSync(join(storeRoot, "records.jsonl"), "{\"prior\":true}\n");
  return {
    root, storeRoot, artifactRoot,
    config: createConfig({ storeRoot, artifactRoot, kitDir: root, makeRunId: () => "0123456789abcdef0123456789abcdef", ...overrides }),
  };
}

for (const [name, prepare, expected] of [
  ["schema", (config) => ({ records: [{ ...records[0], confidence: "unknown" }], config }), "E_RECORD_SCHEMA"],
  ["round-trip", (config) => ({ records, config: { ...config, verifyPublication: () => { throw new IngestError("E_ROUND_TRIP", "injected"); } } }), "E_ROUND_TRIP"],
  ["rename", (config) => ({ records, config: { ...config, fileOps: { ...config.fileOps, renameSync: () => { const error = new Error("rename failed"); error.code = "EIO"; throw error; } } } }), "E_PUBLICATION_FAILED"],
]) {
  test(`publication ${name} failure preserves store and emits an external diagnostic`, () => {
    const { root, storeRoot, artifactRoot, config } = setup(name);
    try {
      const before = hashFiles(storeRoot);
      const prepared = prepare(config);
      assert.throws(() => publishRecords(prepared.records, prepared.config), { code: expected });
      assert.deepEqual(hashFiles(storeRoot), before);
      evidence.push({ case: name, before, after: hashFiles(storeRoot) });
      assert.deepEqual(readdirSync(storeRoot).filter((name) => name.includes(".tmp") || name.endsWith(".lock")), []);
      const logs = readdirSync(artifactRoot);
      assert.equal(logs.length, 1);
      const log = JSON.parse(readFileSync(join(artifactRoot, logs[0]), "utf8"));
      assert.deepEqual(log.before, before);
      assert.deepEqual(log.after, before);
      assert.equal(typeof log.command, "string");
      assert.equal(typeof log.result.code, "string");
      assert.equal(typeof log.runId, "string");
      assert.equal(typeof log.timestamp, "string");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("publication rejects an artifact root inside the store without mutation", () => {
  const { root, storeRoot } = setup("artifact-root");
  try {
    const config = createConfig({ storeRoot, artifactRoot: join(storeRoot, "artifacts"), kitDir: root });
    const before = hashFiles(storeRoot);
    assert.throws(() => publishRecords(records, config), { code: "E_PATH_ESCAPE" });
    assert.deepEqual(hashFiles(storeRoot), before);
    evidence.push({ case: "artifact-root", before, after: hashFiles(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("lock-metadata write failure removes the lock before reporting failure", () => {
  const { root, storeRoot, artifactRoot, config } = setup("lock-write");
  try {
    const before = hashFiles(storeRoot);
    const broken = {
      ...config,
      fileOps: {
        ...config.fileOps,
        writeFileSync: (target, data) => {
          if (typeof target === "string" && target.endsWith("records.jsonl.lock")) {
            const error = new Error("disk full"); error.code = "ENOSPC"; throw error;
          }
          return config.fileOps.writeFileSync(target, data);
        },
      },
    };
    assert.throws(() => publishRecords(records, broken), { code: "E_PUBLICATION_FAILED" });
    assert.deepEqual(hashFiles(storeRoot), before);
    evidence.push({ case: "lock-metadata", before, after: hashFiles(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test.after(() => {
  if (process.env.GATE_EVIDENCE_PATH) writeFileSync(process.env.GATE_EVIDENCE_PATH, JSON.stringify(evidence));
});
