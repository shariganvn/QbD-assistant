#!/usr/bin/env node

/** Execute one gate test and retain machine-readable evidence. */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [gate, testPath] = process.argv.slice(2);
if (!gate || !testPath) throw new Error("Usage: run-gate.mjs <G-id> <test-path>");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const command = [process.execPath, "--test", testPath];
const runId = randomUUID();
const detailPath = resolve(repoRoot, `artifacts/qbd-p2-ingest-completion/gates/.${gate}-${runId}.detail.json`);
const result = spawnSync(command[0], command.slice(1), { cwd: repoRoot, encoding: "utf8", env: { ...process.env, GATE_EVIDENCE_PATH: detailPath } });
const snapshots = existsSync(detailPath) ? JSON.parse(readFileSync(detailPath, "utf8")) : [];
if (existsSync(detailPath)) unlinkSync(detailPath);
const evidence = {
  gate,
  command,
  result: { exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr },
  before_after_hashes: snapshots,
  runId,
  timestamp: new Date().toISOString(),
};
const evidencePath = resolve(repoRoot, `artifacts/qbd-p2-ingest-completion/gates/${gate}.json`);
mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exitCode = result.status ?? 1;
