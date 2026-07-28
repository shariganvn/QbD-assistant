import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateSuiteEvidence } from "./verify-reasoning-evidence.mjs";

export const GATE_MAP = [
  ["G-P4-01", "cowork-p2-kit/reasoning/tests/contract.test.mjs", "cowork-p2-kit/reasoning/tests/output-preservation.test.mjs", "cowork-p2-kit/reasoning/tests/run-gate-contract.test.mjs"],
  ["G-P4-02", "cowork-p2-kit/reasoning/tests/cohort-evidence.test.mjs"],
  ["G-P4-03", "cowork-p2-kit/reasoning/tests/decision-engine.test.mjs"],
  ["G-P4-04", "cowork-p2-kit/reasoning/tests/skill-artifacts.test.mjs"],
  ["G-P4-05", "cowork-p2-kit/reasoning/tests/e2e-decision.test.mjs"],
];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export function runSuite({
  gateMap = GATE_MAP,
  root = repoRoot,
  suiteRunId = randomUUID(),
  spawn = spawnSync,
  validateEvidence = validateSuiteEvidence,
  writeStdout = (value) => process.stdout.write(value),
  writeStderr = (value) => process.stderr.write(value),
} = {}) {
  const missing = gateMap.flatMap(([, ...testPaths]) => testPaths).filter((testPath) => !existsSync(resolve(root, testPath)));
  if (missing.length > 0) {
    writeStderr(`Phase 4 reasoning suite is incomplete: ${missing.join(", ")}\n`);
    return 1;
  }
  for (const [gateId, ...testPaths] of gateMap) {
    const result = spawn(process.execPath, ["cowork-p2-kit/reasoning/tests/run-gate.mjs", gateId, ...testPaths], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, REASONING_SUITE_RUN_ID: suiteRunId },
    });
    writeStdout(result.stdout ?? "");
    writeStderr(result.stderr ?? "");
    if (result.status !== 0) return result.status ?? 1;
  }
  const postValidationErrors = validateEvidence({
    gatesDir: resolve(root, "docs/reports/qbd-p4-reasoning-layer/gates"),
    suiteRunId,
  });
  if (postValidationErrors.length > 0) {
    for (const error of postValidationErrors) writeStderr(`[verify-reasoning] ${error}\n`);
    writeStderr("[verify-reasoning] post-G-P4-05 validation failed\n");
    return 1;
  }
  return 0;
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  process.exitCode = runSuite();
}
