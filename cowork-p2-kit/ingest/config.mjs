/**
 * config.mjs — Resolved roots, binaries, and injected collaborators.
 *
 * createConfig(overrides) returns absolute resolved paths.
 * Tests may override any root; the programmatic API is the only injection surface.
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
  renameSync, unlinkSync, copyFileSync, lstatSync, readlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { isAbsolute } from "node:path";
import { IngestError } from "./errors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KIT_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(KIT_DIR, "..");

const SUPPORTED_EXTENSIONS = new Set([".docx", ".pdf"]);

const DEFAULT_FILE_OPS = {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
  copyFileSync,
  lstatSync,
  readlinkSync,
};

function defaultClock() {
  return new Date().toISOString();
}

function defaultRunProcess(executable, args, options = {}) {
  return spawnSync(executable, args, {
    encoding: "utf-8",
    timeout: options.timeout ?? 60_000,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
    ...options,
  });
}

function defaultPidIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function defaultMakeRunId() {
  return randomUUID();
}

function absolutePathOverride(overrides, key, fallback) {
  const value = overrides[key] ?? fallback;
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new IngestError("E_CONFIG", `Config "${key}" must be an absolute path`, {
      details: { key, value },
    });
  }
  return value;
}

/**
 * @param {object} [overrides]
 * @param {string} [overrides.inputsRoot]
 * @param {string} [overrides.storeRoot]
 * @param {string} [overrides.artifactRoot]
 * @param {string} [overrides.litBinary]
 * @param {string} [overrides.sofficeBinary]
 * @param {string} [overrides.ghostscriptBinary]
 * @param {string} [overrides.tessdataRoot]
 * @param {Function} [overrides.clock]
 * @param {Function} [overrides.runProcess]
 * @param {object} [overrides.fileOps]
 * @param {Function} [overrides.pidIsAlive]
 * @param {Function} [overrides.makeRunId]
 */
export function createConfig(overrides = {}) {
  if (overrides === null || Array.isArray(overrides) || typeof overrides !== "object") {
    throw new IngestError("E_CONFIG", "Programmatic config overrides must be an object");
  }
  const kitDir = absolutePathOverride(overrides, "kitDir", KIT_DIR);
  const inputsRoot = absolutePathOverride(overrides, "inputsRoot", join(kitDir, "inputs"));
  const storeRoot = absolutePathOverride(overrides, "storeRoot", join(kitDir, "store"));
  const artifactRoot = absolutePathOverride(overrides, "artifactRoot", join(storeRoot, "artifacts"));

  return {
    inputsRoot,
    trialsRoot: join(inputsRoot, "trials"),
    referenceRoot: join(inputsRoot, "reference"),
    manifestPath: join(inputsRoot, "classification-manifest.json"),
    storeRoot,
    schemaPath: join(storeRoot, "records.schema.json"),
    artifactRoot,
    litBinary: absolutePathOverride(overrides, "litBinary", resolve(REPO_ROOT, "node_modules/.bin/lit")),
    sofficeBinary: absolutePathOverride(overrides, "sofficeBinary", "/usr/bin/soffice"),
    ghostscriptBinary: absolutePathOverride(overrides, "ghostscriptBinary", "/usr/bin/gs"),
    tessdataRoot: absolutePathOverride(overrides, "tessdataRoot", "/usr/share/tesseract-ocr/5/tessdata"),
    clock: overrides.clock ?? defaultClock,
    runProcess: overrides.runProcess ?? defaultRunProcess,
    fileOps: overrides.fileOps ?? DEFAULT_FILE_OPS,
    pidIsAlive: overrides.pidIsAlive ?? defaultPidIsAlive,
    makeRunId: overrides.makeRunId ?? defaultMakeRunId,
    supportedExtensions: SUPPORTED_EXTENSIONS,
    repoRoot: REPO_ROOT,
    kitDir,
  };
}

export { KIT_DIR, REPO_ROOT, SUPPORTED_EXTENSIONS };
