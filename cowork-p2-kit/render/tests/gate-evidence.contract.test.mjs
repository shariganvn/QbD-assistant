import assert from "node:assert/strict";
import test from "node:test";

import { validateGateEvidence } from "./gate-evidence-validator.mjs";

function evidence(overrides = {}) {
  return {
    gate_id: "G-P3-01", status: "pass", command: ["node", "--test", "contract.test.mjs"], exit_code: 0,
    raw_tap_output: "# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n",
    raw_stderr: "", timestamp: new Date(0).toISOString(), run_id: "aabbccdd-1122-3344-5566-778899001122", suite_run_id: "11223344-aabb-ccdd-eeff-001122334455",
    assertions_summary: { total: 1, passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 0 },
    snapshots: [], timeout_ms: 300000, duration_ms: 1, timed_out: false, signal: null, ...overrides,
  };
}

test("render gate evidence accepts only complete successful TAP evidence", () => {
  assert.equal(validateGateEvidence(evidence(), "G-P3-01").valid, true);
  assert.equal(validateGateEvidence(evidence({ raw_tap_output: "" }), "G-P3-01").valid, false);
  assert.equal(validateGateEvidence(evidence({ extra: true }), "G-P3-01").valid, false);
});

test("render gate evidence preserves strict UUID, timestamp, and timeout semantics", () => {
  assert.equal(validateGateEvidence(evidence({ run_id: "run" }), "G-P3-01").valid, false);
  assert.equal(validateGateEvidence(evidence({ timestamp: "not-a-timestamp" }), "G-P3-01").valid, false);
  assert.equal(validateGateEvidence(evidence({ status: "fail", exit_code: null, timed_out: true, signal: "SIGTERM" }), "G-P3-01").valid, true);
  assert.equal(validateGateEvidence(evidence({ status: "fail", exit_code: 1, timed_out: true, signal: "SIGTERM" }), "G-P3-01").valid, false);
});
