import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { GATE_EVIDENCE_KEYS, validateGateEvidence } from "./gate-evidence-validator.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const runnerPath = resolve(testDir, "run-gate.mjs");

function evidence(overrides = {}) {
  return {
    gate_id: "G-RL-01", status: "pass", command: [process.execPath, "--test", "fixture.test.mjs"], exit_code: 0,
    raw_tap_output: "# tests 1\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\n# cancelled 0\n", raw_stderr: "",
    timestamp: "2026-07-29T00:00:00.000Z", run_id: "11111111-1111-4111-8111-111111111111", suite_run_id: "22222222-2222-4222-8222-222222222222",
    assertions_summary: { total: 1, passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 0 }, timeout_ms: 300000, duration_ms: 1, timed_out: false, signal: null,
    store_records_sha256: "6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56", ...overrides,
  };
}

test("G-RL-01 local gate runner has the isolated rationale contract", () => {
  const source = readFileSync(runnerPath, "utf8");
  assert.match(source, /\^G-RL-0\[1-5\]\$/);
  assert.match(source, /RATIONALE_SUITE_RUN_ID/);
  assert.match(source, /RATIONALE_GATE_EVIDENCE_DIR/);
  assert.match(source, /qbd-rationale-report-layer\/gates/);
  assert.doesNotMatch(source, /REASONING_SUITE_RUN_ID|qbd-p4-reasoning-layer/);
  assert.equal(GATE_EVIDENCE_KEYS.length, 15);
  assert.deepEqual(validateGateEvidence(evidence(), "G-RL-01"), { valid: true, errors: [] });
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P4-01" }), "G-RL-01").valid, false);
  assert.equal(validateGateEvidence({ ...evidence(), extra: true }, "G-RL-01").valid, false);
});
