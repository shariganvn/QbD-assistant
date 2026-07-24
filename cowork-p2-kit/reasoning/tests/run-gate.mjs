#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateGateEvidence } from "./gate-evidence-validator.mjs";

const [gateId, ...testPaths] = process.argv.slice(2);
if (!/^G-P4-0[1-5]$/.test(gateId ?? "") || testPaths.length === 0) {
  process.stderr.write("Usage: run-gate.mjs G-P4-0[1-5] <test-path> [test-path ...]\n");
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const command = [process.execPath, "--test", "--test-reporter=tap", ...testPaths];
const start = Date.now();
const childEnvironment = { ...process.env };
delete childEnvironment.NODE_TEST_CONTEXT;
const result = spawnSync(command[0], command.slice(1), { cwd: repoRoot, encoding: "utf8", timeout: 300000, env: childEnvironment });
const output = result.stdout ?? "";
const fields = ["tests", "pass", "fail", "skipped", "todo", "cancelled"];
const summary = Object.fromEntries(fields.map((field) => {
  const match = output.match(new RegExp(`^#\\s+${field}\\s+(\\d+)`, "m"));
  return [field, match ? Number(match[1]) : 0];
}));
const assertionsSummary = { total: summary.tests, passed: summary.pass, failed: summary.fail, skipped: summary.skipped, todo: summary.todo, cancelled: summary.cancelled };
const evidence = {
  gate_id: gateId,
  status: result.status === 0 && summary.tests > 0 && summary.pass === summary.tests && summary.fail === 0 && summary.skipped === 0 && summary.todo === 0 && summary.cancelled === 0 ? "pass" : "fail",
  command,
  exit_code: Number.isSafeInteger(result.status) ? result.status : 1,
  raw_tap_output: output,
  raw_stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
  timestamp: new Date().toISOString(),
  run_id: randomUUID(),
  suite_run_id: process.env.REASONING_SUITE_RUN_ID ?? randomUUID(),
  assertions_summary: assertionsSummary,
  timeout_ms: 300000,
  duration_ms: Date.now() - start,
  timed_out: result.error?.code === "ETIMEDOUT",
  signal: result.signal ?? null,
  store_records_sha256: "6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56",
};
const validation = validateGateEvidence(evidence, gateId);
if (!validation.valid) {
  evidence.status = "fail";
  evidence.raw_stderr += `\n[run-gate] ${validation.errors.join("; ")}`;
}
const evidenceDir = resolve(process.env.REASONING_GATE_EVIDENCE_DIR ?? "docs/reports/qbd-p4-reasoning-layer/gates");
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(resolve(evidenceDir, `${gateId}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(output);
process.stderr.write(evidence.raw_stderr);
process.exitCode = evidence.status === "pass" ? 0 : 1;
