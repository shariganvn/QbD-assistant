import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRationaleSuiteEvidence } from "./verify-rationale-evidence.mjs";

export const GATE_MAP = [
  ["G-RL-01", "cowork-p2-kit/rationale/tests/packet-contract.test.mjs"],
  ["G-RL-02", "cowork-p2-kit/rationale/tests/claim-binding.test.mjs"],
  ["G-RL-03", "cowork-p2-kit/rationale/tests/rationale-markdown.test.mjs"],
  ["G-RL-04", "cowork-p2-kit/rationale/tests/rationale-publication.test.mjs"],
  ["G-RL-05", "cowork-p2-kit/rationale/tests/verify-rationale-contract.test.mjs", "cowork-p2-kit/rationale/tests/e2e-rationale.test.mjs"],
];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function runRationaleSuite({
  gateMap = GATE_MAP,
  root = repoRoot,
  suiteRunId = randomUUID(),
  spawn = spawnSync,
  validateEvidence = validateRationaleSuiteEvidence,
  writeStdout = (value) => process.stdout.write(value),
  writeStderr = (value) => process.stderr.write(value),
} = {}) {
  const missing = gateMap.flatMap(([, ...testPaths]) => testPaths).filter((testPath) => !existsSync(resolve(root, testPath)));
  if (missing.length > 0) {
    writeStderr(`Rationale suite is incomplete: ${missing.join(", ")}\n`);
    return 1;
  }
  for (const [gateId, ...testPaths] of gateMap) {
    const result = spawn(process.execPath, ["cowork-p2-kit/rationale/tests/run-gate.mjs", gateId, ...testPaths], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, RATIONALE_SUITE_RUN_ID: suiteRunId },
    });
    writeStdout(result.stdout ?? "");
    writeStderr(result.stderr ?? "");
    if (result.status !== 0) return result.status ?? 1;
  }
  const errors = validateEvidence({
    gatesDir: resolve(root, "docs/reports/qbd-rationale-report-layer/gates"),
    suiteRunId,
  });
  if (errors.length > 0) {
    for (const error of errors) writeStderr(`[verify-rationale] ${error}\n`);
    writeStderr("[verify-rationale] post-G-RL-05 validation failed\n");
    return 1;
  }
  return 0;
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) process.exitCode = runRationaleSuite();
