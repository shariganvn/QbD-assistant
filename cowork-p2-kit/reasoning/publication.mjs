import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ReasoningContractError } from "./errors.mjs";

const artifactNames = [
  ["factCards", "fact-cards.json"],
  ["cohort", "cohort.json"],
  ["linearAttestation", "linear-attestation.json"],
  ["evidenceLog", "evidence-log.json"],
  ["decision", "formula-decision.json"],
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function publishArtifacts(artifacts, outputRoot, fileSystem = { mkdirSync, renameSync, rmSync, writeFileSync }) {
  const root = resolve(outputRoot);
  const temporary = [];
  const backups = [];
  const committed = [];
  try {
    fileSystem.mkdirSync(root, { recursive: true });
    for (const [key, name] of artifactNames) {
      const target = resolve(root, name);
      if (!target.startsWith(`${root}/`)) throw new ReasoningContractError("E_PUBLICATION_PATH", "artifact escapes the publication root");
      const temp = resolve(root, `.${name}.${randomUUID()}.tmp`);
      fileSystem.writeFileSync(temp, `${JSON.stringify(canonicalize(artifacts[key]), null, 2)}\n`, { flag: "wx" });
      temporary.push({ temp, target, name });
    }
    for (const entry of temporary) {
      if (existsSync(entry.target)) {
        const backup = resolve(root, `.${entry.name}.${randomUUID()}.bak`);
        fileSystem.renameSync(entry.target, backup);
        backups.push({ target: entry.target, backup });
      }
    }
    for (const entry of temporary) {
      fileSystem.renameSync(entry.temp, entry.target);
      committed.push(entry.target);
    }
    for (const { backup } of backups) fileSystem.rmSync(backup, { force: true });
  } catch (error) {
    for (const target of committed) {
      try { fileSystem.rmSync(target, { force: true }); } catch { /* best effort rollback */ }
    }
    for (const { target, backup } of backups.reverse()) {
      try { fileSystem.renameSync(backup, target); } catch { /* best effort rollback */ }
    }
    for (const { temp } of temporary) {
      try { fileSystem.rmSync(temp, { force: true }); } catch { /* invocation-owned cleanup */ }
    }
    if (error instanceof ReasoningContractError) throw error;
    throw new ReasoningContractError("E_PUBLICATION_WRITE", `cannot publish reasoning artifacts: ${error.message}`, { cause: error });
  }
  return root;
}
