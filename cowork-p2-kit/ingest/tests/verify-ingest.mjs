#!/usr/bin/env node

/** Import-safe CLI for the Step 4 verification suite. */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runIngestSuite } from "./verify-ingest-core.mjs";

// Literal ten-gate mapping: G-01 asserts these exact ordered tuples.
export const GATE_MAP = [
  ["G-01", "cowork-p2-kit/ingest/tests/repository-boundary.test.mjs"],
  ["G-02", "cowork-p2-kit/ingest/tests/record-contract.test.mjs"],
  ["G-03", "cowork-p2-kit/ingest/tests/pipeline.test.mjs"],
  ["G-04", "cowork-p2-kit/ingest/tests/publication-failure.test.mjs"],
  ["G-05", "cowork-p2-kit/ingest/tests/publication-concurrency.test.mjs"],
  ["G-06", "cowork-p2-kit/ingest/tests/file-boundaries.test.mjs"],
  ["G-07", "cowork-p2-kit/ingest/tests/admission-negative.test.mjs"],
  ["G-08", "cowork-p2-kit/ingest/tests/capability-discovery.test.mjs"],
  ["G-09", "cowork-p2-kit/ingest/tests/determinism.integration.test.mjs"],
  ["G-10", "cowork-p2-kit/ingest/tests/complete-ingest-verification.test.mjs"],
];

export const GATE_IDS = GATE_MAP.map(([gateId]) => gateId);

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const gatesDir = resolve(repoRoot, "docs/reports/qbd-p2-ingest-completion/gates");
  const runnerPath = resolve(repoRoot, "cowork-p2-kit/ingest/tests/run-gate.mjs");
  mkdirSync(gatesDir, { recursive: true });

  const result = runIngestSuite({
    suiteRunId: randomUUID(),
    gateMap: GATE_MAP,
    writeManifest: (manifest) => {
      writeFileSync(resolve(gatesDir, "suite.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    },
    runGate: ({ gateId, testFile, timeoutMs, suiteRunId }) => spawnSync(process.execPath, [runnerPath, gateId, testFile], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: timeoutMs,
      env: {
        ...process.env,
        INGEST_SUITE_RUN_ID: suiteRunId,
        INGEST_GATE_TIMEOUT_MS: String(timeoutMs),
      },
    }),
    readGateEvidence: (gateId) => JSON.parse(readFileSync(resolve(gatesDir, `${gateId}.json`), "utf-8")),
  });

  if (result.validationErrors?.length) process.stderr.write(`${result.validationErrors.join("; ")}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
