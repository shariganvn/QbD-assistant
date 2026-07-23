import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GATE_MAP = [
  ["G-P3-01", "cowork-p2-kit/render/tests/contract.test.mjs"],
  ["G-P3-02", "cowork-p2-kit/render/tests/output-preservation.test.mjs"],
  ["G-P3-03", "cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs"],
  ["G-P3-04", "cowork-p2-kit/render/tests/isolated-network.test.mjs"],
  ["G-P3-05", "cowork-p2-kit/render/tests/determinism.test.mjs"],
];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const suiteRunId = randomUUID();
const missing = GATE_MAP.filter(([, testPath]) => !existsSync(resolve(repoRoot, testPath)));
if (missing.length) {
  process.stderr.write(`Phase 3 render suite is incomplete: ${missing.map(([gateId]) => gateId).join(", ")}\n`);
  process.exit(1);
}
for (const [gateId, testPath] of GATE_MAP) {
  const result = spawnSync(process.execPath, ["cowork-p2-kit/render/tests/run-gate.mjs", gateId, testPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, RENDER_SUITE_RUN_ID: suiteRunId },
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
