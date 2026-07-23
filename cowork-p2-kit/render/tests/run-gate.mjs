import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateGateEvidence } from "./gate-evidence-validator.mjs";

const [gateId, testPath] = process.argv.slice(2);
if (!/^G-P3-0[1-5]$/.test(gateId ?? "") || !testPath) {
  process.stderr.write("Usage: run-gate.mjs G-P3-0N cowork-p2-kit/render/tests/<test>.mjs\n");
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const command = [process.execPath, "--test", testPath];
const timeoutMs = 300000;
const started = Date.now();

// For G-P3-04, pass a unique snapshot file path to the child test
const snapshotFile = gateId === "G-P3-04"
  ? join(repoRoot, `docs/reports/qbd-p3-render-layer/gates/${gateId}-snapshot-${randomUUID()}.json`)
  : undefined;

const result = spawnSync(command[0], command.slice(1), {
  cwd: repoRoot,
  encoding: "utf8",
  timeout: timeoutMs,
  env: {
    ...process.env,
    ...(snapshotFile ? { GATE_SNAPSHOT_FILE: snapshotFile } : {}),
  },
});
const output = result.stdout ?? "";
const summary = Object.fromEntries(
  ["tests", "pass", "fail", "skipped", "todo", "cancelled"].map((name) => {
    const match = output.match(new RegExp(`^#\\s+${name}\\s+(\\d+)`, "m"));
    return [name, match ? Number(match[1]) : 0];
  }),
);
const assertionsSummary = {
  total: summary.tests,
  passed: summary.pass,
  failed: summary.fail,
  skipped: summary.skipped,
  todo: summary.todo,
  cancelled: summary.cancelled,
};
const timedOut = result.error?.code === "ETIMEDOUT";
const evidence = {
  gate_id: gateId,
  status: result.status === 0 && !timedOut && assertionsSummary.total > 0 && assertionsSummary.passed === assertionsSummary.total && assertionsSummary.failed === 0 && assertionsSummary.skipped === 0 && assertionsSummary.todo === 0 && assertionsSummary.cancelled === 0 ? "pass" : "fail",
  command,
  exit_code: timedOut ? null : (Number.isSafeInteger(result.status) ? result.status : 1),
  raw_tap_output: output,
  raw_stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
  timestamp: new Date().toISOString(),
  run_id: randomUUID(),
  suite_run_id: process.env.RENDER_SUITE_RUN_ID ?? randomUUID(),
  assertions_summary: assertionsSummary,
  snapshots: [],
  timeout_ms: timeoutMs,
  duration_ms: Date.now() - started,
  timed_out: timedOut,
  signal: timedOut ? (result.signal ?? "SIGTERM") : null,
};

// For G-P3-04, read the snapshot file if it exists
if (gateId === "G-P3-04" && snapshotFile && existsSync(snapshotFile)) {
  try {
    const snapshotData = JSON.parse(readFileSync(snapshotFile, "utf8"));
    evidence.snapshots = [snapshotData];
  } catch (error) {
    evidence.raw_stderr += `\n[run-gate] Failed to read snapshot file: ${error.message}`;
  } finally {
    rmSync(snapshotFile, { force: true });
  }
}

const validation = validateGateEvidence(evidence, gateId);
if (!validation.valid) {
  evidence.status = "fail";
  evidence.raw_stderr += `\n[run-gate] ${validation.errors.join("; ")}`;
}
const evidencePath = resolve(repoRoot, `docs/reports/qbd-p3-render-layer/gates/${gateId}.json`);
mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(output);
process.stderr.write(evidence.raw_stderr);
process.exitCode = evidence.status === "pass" ? 0 : 1;
