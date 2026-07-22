/** G-10: strictly verify G-01..G-09 evidence and the current running manifest. */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateGateEvidence, validateSuiteManifest } from "./gate-evidence-validator.mjs";
import { GATE_IDS } from "./verify-ingest.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../../");
const gatesDir = resolve(repoRoot, "docs/reports/qbd-p2-ingest-completion/gates");
const PRIOR_GATE_IDS = GATE_IDS.slice(0, -1);

function readJson(path, message) {
  assert.ok(existsSync(path), message);
  let parsed;
  assert.doesNotThrow(() => { parsed = JSON.parse(readFileSync(path, "utf-8")); }, `${message}: invalid JSON`);
  return parsed;
}

test("G-01 through G-09 evidence is exact, current-suite, and successful", () => {
  const suiteRunId = process.env.INGEST_SUITE_RUN_ID;
  assert.ok(suiteRunId, "INGEST_SUITE_RUN_ID must be set");

  for (const gateId of PRIOR_GATE_IDS) {
    const evidence = readJson(resolve(gatesDir, `${gateId}.json`), `Evidence file missing: ${gateId}.json`);
    const validation = validateGateEvidence(evidence, gateId, suiteRunId);
    assert.equal(validation.valid, true, `${gateId}: ${validation.errors.join("; ")}`);
    assert.equal(evidence.status, "pass", `${gateId}: status must be pass`);
    assert.equal(evidence.exit_code, 0, `${gateId}: exit_code must be 0`);
  }
});

test("suite.json is the exact running manifest while G-10 executes", () => {
  const suiteRunId = process.env.INGEST_SUITE_RUN_ID;
  assert.ok(suiteRunId, "INGEST_SUITE_RUN_ID must be set");
  const suite = readJson(resolve(gatesDir, "suite.json"), "suite.json must exist");
  const validation = validateSuiteManifest(suite, { expectedSuiteRunId: suiteRunId, gateIds: GATE_IDS });
  assert.equal(validation.valid, true, `suite.json: ${validation.errors.join("; ")}`);
  assert.equal(suite.status, "running");
  assert.deepEqual(suite.completed_gate_ids, PRIOR_GATE_IDS);
  assert.equal(suite.next_gate_id, "G-10");
});
