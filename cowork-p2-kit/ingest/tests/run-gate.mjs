#!/usr/bin/env node

/**
 * run-gate.mjs — Execute one gate test and write machine-readable evidence.
 *
 * Usage: run-gate.mjs <gate-id> <test-file>
 *
 * Required environment:
 *   INGEST_SUITE_RUN_ID  — UUID for the current suite run
 *   INGEST_GATE_TIMEOUT_MS — base-10 positive safe integer ≤ 300000
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validateGateEvidence } from "./gate-evidence-validator.mjs";
import { classifyChildResult, normalizeSnapshots, parseGateTimeout } from "./gate-runner-utils.mjs";

// ─── Parse arguments ──────────────────────────────────────────────────

const [gateId, testPath] = process.argv.slice(2);
if (!gateId || !testPath) {
  process.stderr.write("Usage: run-gate.mjs <gate-id> <test-file>\n");
  process.exit(1);
}

// ─── Validate environment ─────────────────────────────────────────────

const suiteRunId = process.env.INGEST_SUITE_RUN_ID;
if (!suiteRunId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(suiteRunId)) {
  process.stderr.write("Missing or non-UUID INGEST_SUITE_RUN_ID\n");
  process.exit(1);
}

const timeoutStr = process.env.INGEST_GATE_TIMEOUT_MS;
const timeoutMs = parseGateTimeout(timeoutStr);
if (timeoutMs === null) {
  process.stderr.write("Missing or invalid INGEST_GATE_TIMEOUT_MS (must be base-10 positive safe integer ≤ 300000)\n");
  process.exit(1);
}

// ─── Execute test ─────────────────────────────────────────────────────

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const command = [process.execPath, "--test", testPath];
const runId = randomUUID();
const start = Date.now();

// Always create own temp dir — never accept inherited GATE_EVIDENCE_PATH
const tempDir = mkdtempSync(join(tmpdir(), "ingest-gate-"));
const detailPath = join(tempDir, `${gateId}-${runId}.detail.json`);

try {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env, GATE_EVIDENCE_PATH: detailPath },
  });
  const { snapshots, diagnostic } = normalizeSnapshots(() => readFileSync(detailPath, "utf8"));
  const child = classifyChildResult(result);
  const durationMs = Date.now() - start;

// ─── Parse TAP summary ────────────────────────────────────────────────

function parseTapSummary(stdout) {
  const lines = (stdout ?? "").split("\n");
  const summary = {};
  for (const line of lines) {
    const m = line.trim().match(/^#\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)/);
    if (m) summary[m[1]] = parseInt(m[2], 10);
  }
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    if (typeof summary[key] !== "number") throw new Error(`Missing TAP field: ${key}`);
  }
  return {
    total: summary.tests,
    passed: summary.pass,
    failed: summary.fail,
    skipped: summary.skipped,
    todo: summary.todo,
    cancelled: summary.cancelled,
  };
}

  let assertionsSummary;
  let status;
  try {
    assertionsSummary = parseTapSummary(result.stdout);
    status = child.exitCode === 0
      && assertionsSummary.failed === 0
      && assertionsSummary.skipped === 0
      && assertionsSummary.todo === 0
      && assertionsSummary.cancelled === 0
      && assertionsSummary.passed === assertionsSummary.total
      && assertionsSummary.total > 0
      ? "pass" : "fail";
  } catch {
    assertionsSummary = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0 };
    status = "fail";
  }

  if (child.timedOut || diagnostic) status = "fail";
  const combinedStderr = (result.stderr ?? "") + diagnostic;
  const evidence = {
    gate_id: gateId,
    status,
    command,
    exit_code: child.exitCode,
    raw_tap_output: result.stdout ?? "",
    raw_stderr: combinedStderr,
    timestamp: new Date().toISOString(),
    run_id: runId,
    suite_run_id: suiteRunId,
    assertions_summary: assertionsSummary,
    snapshots,
    timeout_ms: timeoutMs,
    duration_ms: durationMs,
    timed_out: child.timedOut,
    signal: child.signal,
  };

  const validation = validateGateEvidence(evidence, gateId, suiteRunId);
  if (!validation.valid) {
    process.stderr.write(`[run-gate] evidence validation failed: ${validation.errors.join("; ")}\n`);
  }

  const evidencePath = resolve(repoRoot, `docs/reports/qbd-p2-ingest-completion/gates/${gateId}.json`);
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(combinedStderr);
  process.exitCode = status === "pass" ? 0 : 1;
} finally {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
}
