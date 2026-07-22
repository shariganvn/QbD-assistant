import assert from "node:assert/strict";
import test from "node:test";
import {
  validateGateEvidence,
  validateSuiteManifest,
} from "./gate-evidence-validator.mjs";
import { GATE_IDS } from "./verify-ingest.mjs";

const SUITE_RUN_ID = "11223344-aabb-ccdd-eeff-001122334455";

function validEvidence(overrides = {}) {
  return {
    gate_id: "G-01",
    status: "pass",
    command: ["node", "--test", "some-test.mjs"],
    exit_code: 0,
    raw_tap_output: "# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n",
    raw_stderr: "",
    timestamp: new Date(0).toISOString(),
    run_id: "aabbccdd-1122-3344-5566-778899001122",
    suite_run_id: SUITE_RUN_ID,
    assertions_summary: { total: 1, passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 0 },
    snapshots: [],
    timeout_ms: 300000,
    duration_ms: 1500,
    timed_out: false,
    signal: null,
    ...overrides,
  };
}

function validManifest(overrides = {}) {
  return {
    suite_run_id: SUITE_RUN_ID,
    status: "pass",
    started_at: new Date(0).toISOString(),
    completed_at: new Date(1).toISOString(),
    timeout_ms: 1200000,
    duration_ms: 60000,
    timed_out: false,
    next_gate_id: null,
    completed_gate_ids: [...GATE_IDS],
    failed_gate_id: null,
    exit_code: 0,
    ...overrides,
  };
}

function validateManifest(manifest) {
  return validateSuiteManifest(manifest, { expectedSuiteRunId: SUITE_RUN_ID, gateIds: GATE_IDS });
}

test("valid pass evidence and manifest pass strict validation", () => {
  assert.equal(validateGateEvidence(validEvidence(), "G-01", SUITE_RUN_ID).valid, true);
  assert.equal(validateManifest(validManifest()).valid, true);
});

test("evidence rejects missing raw_stderr, extra keys, bad TAP keys, and unsafe timing", () => {
  const cases = [
    [(() => { const evidence = validEvidence(); delete evidence.raw_stderr; return evidence; })(), "raw_stderr"],
    [validEvidence({ extra_field: true }), "extra keys"],
    [validEvidence({ assertions_summary: { total: 1 } }), "assertions_summary"],
    [validEvidence({ duration_ms: Number.MAX_SAFE_INTEGER + 1 }), "duration_ms"],
    [validEvidence({ timeout_ms: 1.5 }), "timeout_ms"],
  ];
  for (const [evidence, expectedError] of cases) {
    const result = validateGateEvidence(evidence, "G-01", SUITE_RUN_ID);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes(expectedError)), result.errors.join("; "));
  }
});

test("timeout evidence requires fail, null exit, and a non-empty signal", () => {
  const validTimeout = validEvidence({ status: "fail", exit_code: null, timed_out: true, signal: "SIGTERM" });
  assert.equal(validateGateEvidence(validTimeout, "G-01", SUITE_RUN_ID).valid, true);
  for (const evidence of [
    validEvidence({ timed_out: true }),
    validEvidence({ status: "fail", exit_code: null, timed_out: true, signal: null }),
    validEvidence({ status: "fail", exit_code: null, timed_out: false, signal: "SIGTERM" }),
  ]) {
    assert.equal(validateGateEvidence(evidence, "G-01", SUITE_RUN_ID).valid, false);
  }
});

test("pass evidence requires successful TAP, no timeout, and duration within timeout", () => {
  for (const evidence of [
    validEvidence({ raw_tap_output: "" }),
    validEvidence({ assertions_summary: { total: 1, passed: 0, failed: 1, skipped: 0, todo: 0, cancelled: 0 } }),
    validEvidence({ duration_ms: 300001 }),
    validEvidence({ signal: "SIGTERM" }),
  ]) {
    assert.equal(validateGateEvidence(evidence, "G-01", SUITE_RUN_ID).valid, false);
  }
});

test("manifest rejects non-prefix, duplicates, bad final state, and unsafe final fields", () => {
  const cases = [
    validManifest({ completed_gate_ids: ["G-01", "G-03"] }),
    validManifest({ completed_gate_ids: ["G-01", "G-01"] }),
    validManifest({ completed_gate_ids: GATE_IDS.slice(0, -1) }),
    validManifest({ duration_ms: 1200001 }),
    validManifest({ exit_code: Number.MAX_SAFE_INTEGER + 1 }),
  ];
  for (const manifest of cases) assert.equal(validateManifest(manifest).valid, false);
});

test("running and each failure form have exact state semantics", () => {
  const running = validManifest({
    status: "running", completed_at: null, exit_code: null,
    completed_gate_ids: GATE_IDS.slice(0, 4), next_gate_id: "G-05", failed_gate_id: null,
  });
  assert.equal(validateManifest(running).valid, true);

  const preGateTimeout = validManifest({
    status: "fail", timed_out: true, completed_gate_ids: GATE_IDS.slice(0, 4),
    next_gate_id: "G-05", failed_gate_id: null, exit_code: 1,
  });
  assert.equal(validateManifest(preGateTimeout).valid, true);

  const inProgressTimeout = validManifest({
    status: "fail", timed_out: true, completed_gate_ids: GATE_IDS.slice(0, 4),
    next_gate_id: null, failed_gate_id: "G-05", exit_code: 1,
  });
  assert.equal(validateManifest(inProgressTimeout).valid, true);
});
