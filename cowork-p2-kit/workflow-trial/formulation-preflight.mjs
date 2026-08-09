#!/usr/bin/env node

import { createHash } from "node:crypto";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const SHA256 = /^[a-f0-9]{64}$/;

export const FROZEN_FIXTURES = Object.freeze({
  template: Object.freeze({
    name: "official template",
    relativePath: "cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx",
    sha256: "c492532054d9ba04d2dbd5c3d03706c423534cce5329d2657b2588760e0087e0",
  }),
  filledMock: Object.freeze({
    name: "filled public mock",
    relativePath: "cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx",
    sha256: "01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f",
  }),
});

export const REQUIRED_NODE_MAJOR = 22;
export const REQUIRED_UNZIP = "/usr/bin/unzip";

function failure(code, message) {
  return { ok: false, code, message };
}

export function parseNodeMajor(version) {
  const match = /^(\d+)(?:\.|$)/.exec(String(version));
  return match ? Number(match[1]) : null;
}

export function checkNodeVersion(version, requiredMajor = REQUIRED_NODE_MAJOR) {
  const major = parseNodeMajor(version);
  return major === requiredMajor
    ? { ok: true, name: "Node.js", message: `Node.js ${version}` }
    : failure("E_NODE_VERSION", `Node.js ${version} is unsupported; Node ${requiredMajor}.x is required`);
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function checkFileHash({ filePath, expectedSha256, label }) {
  if (!SHA256.test(expectedSha256)) return failure("E_FORMULATION_PIN", `${label} has an invalid SHA-256 pin`);
  try {
    const actualSha256 = sha256File(filePath);
    return actualSha256 === expectedSha256
      ? { ok: true, name: label, message: `${label} hash verified` }
      : failure("E_FORMULATION_HASH_MISMATCH", `${label} hash mismatch; expected ${expectedSha256}, got ${actualSha256}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      return failure("E_FORMULATION_FIXTURE_MISSING", `missing ${label} at ${filePath}; restore the frozen DOCX fixture from the approved fixture distribution (do not regenerate it)`);
    }
    return failure("E_FORMULATION_FIXTURE_READ", `cannot read ${label} at ${filePath}: ${error.message}`);
  }
}

export function findExecutable(command, pathEnv = process.env["PATH"] ?? "") {
  for (const directory of pathEnv.split(":").filter(Boolean)) {
    const candidate = join(directory, command);
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch {
      // Continue through PATH entries that do not contain an executable.
    }
  }
  return null;
}

export function checkExecutable(filePath, code, label) {
  try {
    if (!statSync(filePath).isFile()) return failure(code, `${label} is not a regular executable file: ${filePath}`);
    accessSync(filePath, constants.X_OK);
    return { ok: true, name: label, message: `${label} available at ${filePath}` };
  } catch {
    return failure(code, `${label} is required at ${filePath}`);
  }
}

export function runFormulationPreflight({
  root = repoRoot,
  nodeVersion = process.versions.node,
  pathEnv = process.env["PATH"] ?? "",
  unzipPath = REQUIRED_UNZIP,
} = {}) {
  const checks = [checkNodeVersion(nodeVersion)];
  for (const fixture of Object.values(FROZEN_FIXTURES)) {
    checks.push(checkFileHash({
      filePath: join(root, fixture.relativePath),
      expectedSha256: fixture.sha256,
      label: fixture.name,
    }));
  }
  checks.push(checkExecutable(unzipPath, "E_UNZIP_MISSING", "/usr/bin/unzip"));
  const bwrap = findExecutable("bwrap", pathEnv);
  checks.push(bwrap
    ? { ok: true, name: "bwrap", message: `bwrap available at ${bwrap}` }
    : failure("E_BWRAP_MISSING", "bwrap is required in PATH; install bubblewrap and retry"));
  return { ok: checks.every((check) => check.ok), checks, errors: checks.filter((check) => !check.ok) };
}

function printResult(result) {
  process.stdout.write(`Formulation preflight: ${result.ok ? "PASS" : "FAIL"}\n`);
  for (const check of result.ok ? result.checks : result.errors) {
    process.stdout.write(`${result.ok ? "OK" : check.code}: ${check.message}\n`);
  }
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  const result = runFormulationPreflight();
  printResult(result);
  if (!result.ok) process.exitCode = 1;
}
