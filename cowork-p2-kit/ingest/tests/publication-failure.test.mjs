import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
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
  const entries = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) entries.push([relative(root, path), createHash("sha256").update(readFileSync(path)).digest("hex")]);
    }
  }
  visit(root);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function setup(name, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), `publication-${name}-`));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  fs.mkdirSync(storeRoot);
  copyFileSync(schema, join(storeRoot, "records.schema.json"));
  writeFileSync(join(storeRoot, "records.jsonl"), "{\"prior\":true}\n");
  mkdirSync(join(storeRoot, "preserved"));
  writeFileSync(join(storeRoot, "preserved", "nested.txt"), "must-not-change\n");
  return {
    root, storeRoot, artifactRoot,
    config: createConfig({ storeRoot, artifactRoot, kitDir: root, makeRunId: () => "0123456789abcdef0123456789abcdef", ...overrides }),
  };
}

for (const [name, prepare, expected] of [
  ["schema", (config) => ({ records: [{ ...records[0], confidence: "unknown" }], config }), "E_RECORD_SCHEMA"],
  ["round-trip", (config) => ({ records, config: { ...config, verifyPublication: () => { throw new IngestError("E_ROUND_TRIP", "injected"); } } }), "E_ROUND_TRIP"],
  ["rename", (config) => ({ records, config: { ...config, fileOps: { ...config.fileOps, renameSync: (from, to) => {
    if (from.includes(".tmp") && to.endsWith("records.jsonl")) { const error = new Error("rename failed"); error.code = "EIO"; throw error; }
    return config.fileOps.renameSync(from, to);
  } } } }), "E_PUBLICATION_FAILED"],
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
    const beforeEntries = readdirSync(storeRoot).sort();
    assert.throws(() => publishRecords(records, config), { code: "E_PATH_ESCAPE" });
    assert.deepEqual(hashFiles(storeRoot), before);
    assert.deepEqual(readdirSync(storeRoot).sort(), beforeEntries);
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
    assert.deepEqual(readdirSync(storeRoot).filter((name) => name.includes(".tmp") || name.endsWith(".lock")), []);
    assert.equal(readdirSync(artifactRoot).length, 1);
    evidence.push({ case: "lock-metadata", before, after: hashFiles(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publication does not introduce a failure after a successful rename", () => {
  const { root, storeRoot, artifactRoot, config } = setup("post-rename-read");
  try {
    let renamed = false;
    const recordsPath = join(storeRoot, "records.jsonl");
    const guarded = {
      ...config,
      fileOps: {
        ...config.fileOps,
        renameSync: (from, to) => {
          const result = config.fileOps.renameSync(from, to);
          if (to === recordsPath) renamed = true;
          return result;
        },
        readFileSync: (path, ...args) => {
          if (renamed && path === recordsPath) {
            const error = new Error("post-rename read failed"); error.code = "EIO"; throw error;
          }
          return config.fileOps.readFileSync(path, ...args);
        },
      },
    };
    assert.doesNotThrow(() => publishRecords(records, guarded));
    assert.equal(readFileSync(recordsPath, "utf8"), records.map((record) => JSON.stringify(record)).join("\n") + "\n");
    assert.deepEqual(readdirSync(storeRoot).filter((name) => name.includes(".tmp") || name.endsWith(".lock")), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publication cleanup retains a lock replaced by another writer", () => {
  const { root, storeRoot, artifactRoot, config } = setup("lock-replaced");
  try {
    const lockPath = join(storeRoot, "records.jsonl.lock");
    const recordsPath = join(storeRoot, "records.jsonl");
    const competingLock = { pid: process.pid, createdAt: new Date().toISOString(), runId: "fedcba9876543210fedcba9876543210" };
    const raced = {
      ...config,
      fileOps: {
        ...config.fileOps,
        renameSync: (from, to) => {
          const result = config.fileOps.renameSync(from, to);
          if (to === recordsPath) writeFileSync(lockPath, `${JSON.stringify(competingLock)}\n`);
          return result;
        },
      },
    };
    assert.doesNotThrow(() => publishRecords(records, raced));
    assert.deepEqual(JSON.parse(readFileSync(lockPath, "utf8")), competingLock);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publication cleanup does not unlink a lock created after ownership verification", () => {
  const { root, storeRoot, artifactRoot, config } = setup("late-lock-replaced");
  try {
    const lockPath = join(storeRoot, "records.jsonl.lock");
    const runId = "0123456789abcdef0123456789abcdef";
    const privatePath = `${lockPath}.${runId}.release`;
    const competingLock = { pid: process.pid, createdAt: new Date().toISOString(), runId: "1234567890abcdef1234567890abcdef" };
    let replacementInstalled = false;
    const raced = {
      ...config,
      fileOps: {
        ...config.fileOps,
        readFileSync: (path, ...args) => {
          const contents = config.fileOps.readFileSync(path, ...args);
          if (path === privatePath && !replacementInstalled) {
            writeFileSync(lockPath, `${JSON.stringify(competingLock)}\n`);
            replacementInstalled = true;
          }
          return contents;
        },
      },
    };
    assert.doesNotThrow(() => publishRecords(records, raced));
    assert.equal(replacementInstalled, true);
    assert.deepEqual(JSON.parse(readFileSync(lockPath, "utf8")), competingLock);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publication cleanup removes its private lock when ownership inspection fails", () => {
  const { root, storeRoot, config } = setup("release-read-failure");
  try {
    const runId = "0123456789abcdef0123456789abcdef";
    const privatePath = join(storeRoot, `records.jsonl.lock.${runId}.release`);
    const broken = {
      ...config,
      fileOps: {
        ...config.fileOps,
        readFileSync: (path, ...args) => {
          if (path === privatePath) { const error = new Error("release read failed"); error.code = "EIO"; throw error; }
          return config.fileOps.readFileSync(path, ...args);
        },
      },
    };
    assert.doesNotThrow(() => publishRecords(records, broken));
    assert.deepEqual(readdirSync(storeRoot).filter((name) => name.endsWith(".lock") || name.includes(".release")), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test.after(() => {
  if (process.env.GATE_EVIDENCE_PATH) writeFileSync(process.env.GATE_EVIDENCE_PATH, JSON.stringify(evidence));
});
