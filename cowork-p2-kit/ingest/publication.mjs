/** Atomic, single-writer publication with failure-safe cleanup. */

import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { IngestError } from "./errors.mjs";
import { canonicalRoot, inside, snapshot, validateJsonl, validRunId } from "./publication-support.mjs";

const LOCK_AGE_MS = 5 * 60 * 1000;

function locked(message, details) {
  return new IngestError("E_PUBLICATION_LOCKED", message, { details });
}

function readLock(lockPath, config, strict = false) {
  try {
    const lock = JSON.parse(config.fileOps.readFileSync(lockPath, "utf-8"));
    const created = Date.parse(lock.createdAt);
    if (!Number.isInteger(lock.pid) || lock.pid <= 0 || !validRunId(lock.runId) || Number.isNaN(created)) return null;
    return { ...lock, created };
  } catch (cause) {
    if (strict && cause?.code) throw cause;
    return null;
  }
}

function ensureArtifactRoot(root, fileOps) {
  const absolute = resolve(root);
  let ancestor = absolute;
  while (!fileOps.existsSync(ancestor)) ancestor = dirname(ancestor);
  canonicalRoot(ancestor, fileOps, false);
  if (ancestor !== absolute) fileOps.mkdirSync(absolute, { recursive: true });
  return canonicalRoot(absolute, fileOps, false);
}

function acquireLock(lockPath, runId, config) {
  const { fileOps, clock, pidIsAlive } = config;
  function create() {
    let descriptor;
    let opened = false;
    try {
      descriptor = fileOps.openSync(lockPath, "wx");
      opened = true;
      fileOps.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: clock(), runId }) + "\n");
      fileOps.closeSync(descriptor);
      descriptor = undefined;
    } catch (cause) {
      try { if (descriptor !== undefined) fileOps.closeSync(descriptor); } catch { /* best effort */ }
      try { if (opened && fileOps.existsSync(lockPath)) fileOps.unlinkSync(lockPath); } catch { /* best effort */ }
      throw cause;
    }
  }
  try { create(); return; } catch (cause) {
    if (cause?.code !== "EEXIST") throw cause;
  }
  const previous = readLock(lockPath, config);
  if (!previous) throw locked("Publication lock is malformed or indeterminate", { lockPath });
  let alive;
  try { alive = pidIsAlive(previous.pid); } catch { throw locked("Publication lock owner is indeterminate", { lockPath }); }
  if (alive || Date.parse(clock()) - previous.created < LOCK_AGE_MS) {
    throw locked("Publication is already running", { lockPath, ownerPid: previous.pid });
  }
  const reclaimed = `${lockPath}.${runId}.reclaim`;
  let replacementCreated = false;
  try {
    fileOps.renameSync(lockPath, reclaimed);
    create();
    replacementCreated = true;
    fileOps.unlinkSync(reclaimed);
  } catch (cause) {
    try {
      if (replacementCreated && fileOps.existsSync(lockPath)) fileOps.unlinkSync(lockPath);
      if (fileOps.existsSync(reclaimed) && !fileOps.existsSync(lockPath)) fileOps.renameSync(reclaimed, lockPath);
      else if (fileOps.existsSync(reclaimed) && fileOps.existsSync(lockPath)) fileOps.unlinkSync(reclaimed);
    } catch { /* fail closed; never remove a competing lock */ }
    throw locked("Unable to safely reclaim publication lock", { lockPath, cause: cause?.code });
  }
}

function writeFailureLog(config, runId, before, error) {
  try {
    const storeRoot = canonicalRoot(config.storeRoot, config.fileOps, false);
    const artifactRoot = canonicalRoot(config.artifactRoot, config.fileOps, true);
    if (inside(storeRoot, artifactRoot)) return;
    const payload = {
      command: "publishRecords", result: { code: error.code ?? "E_PUBLICATION_FAILED", message: error.message },
      before, after: snapshot(storeRoot, config.fileOps), runId, timestamp: config.clock(),
    };
    config.fileOps.writeFileSync(join(artifactRoot, `publication-${runId}.json`), `${JSON.stringify(payload)}\n`);
  } catch { /* logging never masks the publication failure */ }
}

function releaseOwnedLock(lockPath, runId, config) {
  const privatePath = `${lockPath}.${runId}.release`;
  config.fileOps.renameSync(lockPath, privatePath);
  let privateLock;
  try { privateLock = readLock(privatePath, config, true); } catch {
    config.fileOps.unlinkSync(privatePath);
    return;
  }
  if (privateLock?.runId === runId) {
    config.fileOps.unlinkSync(privatePath);
    return;
  }
  try {
    config.fileOps.linkSync(privatePath, lockPath);
    config.fileOps.unlinkSync(privatePath);
  } catch { /* preserve an untrusted replacement if it cannot be restored safely */ }
}

/** Publish records after full-contract validation, then atomically replace records.jsonl. */
export function publishRecords(records, config) {
  const { fileOps, schemaPath, makeRunId } = config;
  const runId = makeRunId();
  if (!validRunId(runId)) throw new IngestError("E_CONFIG", "makeRunId must return a crypto-random 128-bit identifier");
  const storeRoot = canonicalRoot(config.storeRoot, fileOps, true);
  const requestedArtifactRoot = resolve(config.artifactRoot);
  if (inside(storeRoot, requestedArtifactRoot)) throw new IngestError("E_PATH_ESCAPE", "Artifact root must be outside store root");
  const artifactRoot = ensureArtifactRoot(requestedArtifactRoot, fileOps);
  if (inside(storeRoot, artifactRoot)) throw new IngestError("E_PATH_ESCAPE", "Artifact root must be outside store root");
  if (!inside(storeRoot, schemaPath) || !fileOps.existsSync(schemaPath)) {
    throw new IngestError("E_RECORD_SCHEMA", `Schema not found within store root: ${schemaPath}`);
  }
  const recordsPath = join(storeRoot, "records.jsonl");
  const tempPath = join(storeRoot, `records.jsonl.${runId}.tmp`);
  const lockPath = join(storeRoot, "records.jsonl.lock");
  const before = snapshot(storeRoot, fileOps);
  let ownsLock = false;
  let failure;
  try {
    acquireLock(lockPath, runId, config);
    ownsLock = true;
    const schema = JSON.parse(fileOps.readFileSync(schemaPath, "utf-8"));
    const jsonl = records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
    validateJsonl(jsonl, schema);
    const descriptor = fileOps.openSync(tempPath, "wx");
    try { fileOps.writeFileSync(descriptor, jsonl); } finally { fileOps.closeSync(descriptor); }
    const written = fileOps.readFileSync(tempPath, "utf-8");
    validateJsonl(written, schema);
    config.verifyPublication?.(records);
    const storeHash = createHash("sha256").update(written).digest("hex");
    fileOps.renameSync(tempPath, recordsPath);
    return { storeHash, recordCount: records.length, storePath: recordsPath, runId };
  } catch (cause) {
    failure = cause instanceof IngestError ? cause : new IngestError("E_PUBLICATION_FAILED", `Failed to publish records: ${cause.message}`, { cause });
  } finally {
    try { if (fileOps.existsSync(tempPath)) fileOps.unlinkSync(tempPath); } catch { /* own temp only */ }
    try { if (ownsLock && fileOps.existsSync(lockPath)) releaseOwnedLock(lockPath, runId, config); } catch { /* own lock only */ }
  }
  if (failure.code !== "E_PUBLICATION_LOCKED") writeFailureLog(config, runId, before, failure);
  throw failure;
}
