import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { createConfig } from "../config.mjs";
import { publishRecords } from "../publication.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const schema = resolve(testDir, "../../store/records.schema.json");
const records = readFileSync(resolve(testDir, "fixtures/contract/records.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const evidence = [];

function hashes(root) {
  return Object.fromEntries(readdirSync(root).sort().map((file) => [file, createHash("sha256").update(readFileSync(join(root, file))).digest("hex")]));
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "publication-lock-"));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  mkdirSync(storeRoot);
  return { root, storeRoot, artifactRoot };
}

test("a fresh live lock is rejected immediately and cannot be removed by another writer", () => {
  const { root, storeRoot, artifactRoot } = setup();
  try {
    copyFileSync(schema, join(storeRoot, "records.schema.json"));
    writeFileSync(join(storeRoot, "records.jsonl"), "{\"prior\":true}\n");
    const lock = { pid: process.pid, createdAt: new Date().toISOString(), runId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
    writeFileSync(join(storeRoot, "records.jsonl.lock"), `${JSON.stringify(lock)}\n`);
    const config = createConfig({ storeRoot, artifactRoot, kitDir: root });
    const before = hashes(storeRoot);
    assert.throws(() => publishRecords(records, config), { code: "E_PUBLICATION_LOCKED" });
    assert.deepEqual(JSON.parse(readFileSync(join(storeRoot, "records.jsonl.lock"), "utf8")), lock);
    assert.deepEqual(readdirSync(storeRoot).filter((name) => name.includes(".tmp")), []);
    evidence.push({ case: "live-lock", before, after: hashes(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a second synchronized writer exits locked while the first owns a unique temp file", async () => {
  const root = mkdtempSync(join(tmpdir(), "publication-two-writers-"));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  const recordsPath = join(root, "records.json");
  const scriptPath = join(root, "writer.mjs");
  try {
    mkdirSync(storeRoot);
    copyFileSync(schema, join(storeRoot, "records.schema.json"));
    writeFileSync(recordsPath, JSON.stringify(records));
    writeFileSync(scriptPath, `
      import { readFileSync } from "node:fs";
      import { createConfig } from ${JSON.stringify(pathToFileURL(resolve(testDir, "../config.mjs")).href)};
      import { publishRecords } from ${JSON.stringify(pathToFileURL(resolve(testDir, "../publication.mjs")).href)};
      const [storeRoot, artifactRoot, recordsPath, hold] = process.argv.slice(2);
      const config = createConfig({ storeRoot, artifactRoot, kitDir: ${JSON.stringify(root)} });
      if (hold === "hold") config.verifyPublication = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 900);
      try { publishRecords(JSON.parse(readFileSync(recordsPath)), config); }
      catch (error) { console.error(error.code); process.exitCode = 1; }
    `);
    const first = spawn(process.execPath, [scriptPath, storeRoot, artifactRoot, recordsPath, "hold"], { stdio: "pipe" });
    const deadline = Date.now() + 2_000;
    while (!existsSync(join(storeRoot, "records.jsonl.lock")) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(existsSync(join(storeRoot, "records.jsonl.lock")), "first writer never acquired the lock");
    while (!readdirSync(storeRoot).some((file) => file.includes(".tmp")) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const firstTemp = readdirSync(storeRoot).find((file) => file.includes(".tmp"));
    assert.ok(firstTemp, "first writer never created its private temp file");
    const started = Date.now();
    const before = hashes(storeRoot);
    const second = spawnSync(process.execPath, [scriptPath, storeRoot, artifactRoot, recordsPath], { encoding: "utf8" });
    assert.equal(second.status, 1);
    assert.match(second.stderr, /E_PUBLICATION_LOCKED/);
    assert.ok(Date.now() - started < 600, "second writer waited instead of returning immediately");
    assert.deepEqual(hashes(storeRoot), before, "locked writer changed the active writer's files");
    assert.ok(readdirSync(storeRoot).includes(firstTemp), "locked writer removed the active writer's temp file");
    const [exitCode] = await once(first, "close");
    assert.equal(exitCode, 0);
    assert.deepEqual(readdirSync(storeRoot).filter((file) => file.endsWith(".lock") || file.includes(".tmp")), []);
    evidence.push({ case: "two-writers", before, after: hashes(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("only an old lock whose owner is absent is reclaimed", () => {
  const root = mkdtempSync(join(tmpdir(), "publication-stale-"));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  try {
    mkdirSync(storeRoot);
    copyFileSync(schema, join(storeRoot, "records.schema.json"));
    writeFileSync(join(storeRoot, "records.jsonl.lock"), JSON.stringify({ pid: 999999, createdAt: new Date(Date.now() - 300001).toISOString(), runId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }));
    const before = hashes(storeRoot);
    const result = publishRecords(records, createConfig({ storeRoot, artifactRoot, kitDir: root, pidIsAlive: () => false }));
    assert.equal(result.recordCount, records.length);
    assert.deepEqual(readdirSync(storeRoot).filter((name) => name.endsWith(".lock") || name.includes(".tmp")), []);
    evidence.push({ case: "stale-reclaim", before, after: hashes(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an old lock with a live owner fails closed without store mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "publication-old-live-"));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  try {
    mkdirSync(storeRoot);
    copyFileSync(schema, join(storeRoot, "records.schema.json"));
    writeFileSync(join(storeRoot, "records.jsonl"), "{\"prior\":true}\n");
    writeFileSync(join(storeRoot, "records.jsonl.lock"), JSON.stringify({ pid: 999999, createdAt: new Date(Date.now() - 300001).toISOString(), runId: "abababababababababababababababab" }));
    const before = hashes(storeRoot);
    const config = createConfig({ storeRoot, artifactRoot, kitDir: root, pidIsAlive: () => true });
    assert.throws(() => publishRecords(records, config), { code: "E_PUBLICATION_LOCKED" });
    assert.deepEqual(hashes(storeRoot), before);
    evidence.push({ case: "old-live-lock", before, after: hashes(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("failed stale-lock replacement restores the exact prior lock", () => {
  const root = mkdtempSync(join(tmpdir(), "publication-stale-rollback-"));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  try {
    mkdirSync(storeRoot);
    copyFileSync(schema, join(storeRoot, "records.schema.json"));
    const priorLock = JSON.stringify({ pid: 999999, createdAt: new Date(Date.now() - 300001).toISOString(), runId: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" });
    writeFileSync(join(storeRoot, "records.jsonl.lock"), priorLock);
    const base = createConfig({ storeRoot, artifactRoot, kitDir: root, pidIsAlive: () => false });
    const config = {
      ...base,
      fileOps: {
        ...base.fileOps,
        writeFileSync: (target, data) => {
          if (typeof target === "string" && target.endsWith("records.jsonl.lock")) {
            const error = new Error("disk full"); error.code = "ENOSPC"; throw error;
          }
          return base.fileOps.writeFileSync(target, data);
        },
      },
    };
    const before = hashes(storeRoot);
    assert.throws(() => publishRecords(records, config), { code: "E_PUBLICATION_LOCKED" });
    assert.deepEqual(hashes(storeRoot), before);
    assert.equal(readFileSync(join(storeRoot, "records.jsonl.lock"), "utf8"), priorLock);
    evidence.push({ case: "stale-replacement-rollback", before, after: hashes(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("reclaim collision removes only its private reclaim file, never the competing lock", () => {
  const root = mkdtempSync(join(tmpdir(), "publication-reclaim-race-"));
  const storeRoot = join(root, "store");
  const artifactRoot = join(root, "artifacts");
  const runId = "ffffffffffffffffffffffffffffffff";
  try {
    mkdirSync(storeRoot);
    copyFileSync(schema, join(storeRoot, "records.schema.json"));
    writeFileSync(join(storeRoot, "records.jsonl.lock"), JSON.stringify({ pid: 999999, createdAt: new Date(Date.now() - 300001).toISOString(), runId: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" }));
    const base = createConfig({ storeRoot, artifactRoot, kitDir: root, pidIsAlive: () => false, makeRunId: () => runId });
    const competitor = JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString(), runId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
    const config = {
      ...base,
      fileOps: {
        ...base.fileOps,
        renameSync: (from, to) => {
          base.fileOps.renameSync(from, to);
          if (from.endsWith("records.jsonl.lock") && to.endsWith(".reclaim")) base.fileOps.writeFileSync(from, competitor);
        },
      },
    };
    assert.throws(() => publishRecords(records, config), { code: "E_PUBLICATION_LOCKED" });
    assert.equal(readFileSync(join(storeRoot, "records.jsonl.lock"), "utf8"), competitor);
    assert.equal(readdirSync(storeRoot).some((file) => file.endsWith(".reclaim")), false);
    evidence.push({ case: "reclaim-collision", before: {}, after: hashes(storeRoot) });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const [name, lock, pidIsAlive] of [
  ["malformed", "not-json", () => false],
  ["fresh absent owner", JSON.stringify({ pid: 999999, createdAt: new Date().toISOString(), runId: "cccccccccccccccccccccccccccccccc" }), () => false],
  ["indeterminate owner", JSON.stringify({ pid: 999999, createdAt: new Date(Date.now() - 300001).toISOString(), runId: "dddddddddddddddddddddddddddddddd" }), () => { throw new Error("probe failed"); }],
]) {
  test(`${name} lock fails closed without store mutation`, () => {
    const root = mkdtempSync(join(tmpdir(), "publication-locked-"));
    const storeRoot = join(root, "store");
    const artifactRoot = join(root, "artifacts");
    try {
      mkdirSync(storeRoot);
      copyFileSync(schema, join(storeRoot, "records.schema.json"));
      writeFileSync(join(storeRoot, "records.jsonl"), "{\"prior\":true}\n");
      writeFileSync(join(storeRoot, "records.jsonl.lock"), lock);
      const before = hashes(storeRoot);
      assert.throws(() => publishRecords(records, createConfig({ storeRoot, artifactRoot, kitDir: root, pidIsAlive })), { code: "E_PUBLICATION_LOCKED" });
      assert.equal(readFileSync(join(storeRoot, "records.jsonl"), "utf8"), "{\"prior\":true}\n");
      assert.deepEqual(readdirSync(storeRoot).filter((file) => file.includes(".tmp")), []);
      evidence.push({ case: name, before, after: hashes(storeRoot) });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test.after(() => {
  if (process.env.GATE_EVIDENCE_PATH) writeFileSync(process.env.GATE_EVIDENCE_PATH, JSON.stringify(evidence));
});
