import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { validateGateEvidence } from "./gate-evidence-validator.mjs";
import { FINAL_GATE_IDS, validateSuiteEvidence } from "./verify-render-evidence.mjs";

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

test("G-P3-04 requires one complete isolation snapshot to pass", () => {
  // Empty snapshots should fail for G-P3-04
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-04", snapshots: [] }), "G-P3-04").valid, false);

  // Non-empty snapshots should pass for G-P3-04
  const validSnapshot = {
    argv: ["/usr/bin/bwrap", "--unshare-net", "node", "render-spike.mjs"],
    argv_hash: "a".repeat(16),
    stdout: "Render spike completed\n",
    stderr: "",
    exit_code: 0,
    versions: { node: "v20.0.0", npm: "10.0.0", bwrap: "0.9.0" },
    output_sha256: "a".repeat(64),
    timestamp: new Date().toISOString(),
  };
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-04", snapshots: [validSnapshot] }), "G-P3-04").valid, true);
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-04", snapshots: [{}] }), "G-P3-04").valid, false);
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-04", snapshots: [validSnapshot, validSnapshot] }), "G-P3-04").valid, false);
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-04", snapshots: [{ ...validSnapshot, output_sha256: "short" }] }), "G-P3-04").valid, false);

  // Empty snapshots is fine for other gates
  assert.equal(validateGateEvidence(evidence({ snapshots: [] }), "G-P3-01").valid, true);
});

test("G-P3-05 requires non-empty snapshots when status is pass", () => {
  // Empty snapshots should fail for G-P3-05 when status is pass
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-05", snapshots: [] }), "G-P3-05").valid, false);

  // Non-empty snapshots with correct structure should pass
  const validDeterminismSnapshot = {
    fixture_sha256: "a".repeat(64),
    render_1_raw_sha256: "b".repeat(64),
    render_2_raw_sha256: "c".repeat(64),
    render_1_manifest_sha256: "d".repeat(64),
    render_2_manifest_sha256: "d".repeat(64),
    render_1_commands: [["-Z1", "/tmp/docx"], ["-p", "/tmp/docx", "\\[Content_Types\\].xml"]],
    render_2_commands: [["-Z1", "/tmp/docx"], ["-p", "/tmp/docx", "\\[Content_Types\\].xml"]],
  };
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-05", snapshots: [validDeterminismSnapshot] }), "G-P3-05").valid, true);
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-05", snapshots: [{ ...validDeterminismSnapshot, render_2_commands: [["-Z1", "/tmp/other.docx"], ["-p", "/tmp/wrong.docx", "\\[Content_Types\\].xml"]] }] }), "G-P3-05").valid, false);
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-05", snapshots: [{ ...validDeterminismSnapshot, render_1_commands: [["-Z1", "/tmp/docx"], ["-p", "/tmp/docx", "word/document.xml"]] }] }), "G-P3-05").valid, false);

  // G-P3-05 with fail status does not require snapshots
  assert.equal(validateGateEvidence(evidence({ gate_id: "G-P3-05", status: "fail", exit_code: 1 }), "G-P3-05").valid, true);
});

function validSnapshot(gateId) {
  if (gateId === "G-P3-04") {
    return [{
      argv: ["/usr/bin/bwrap", "--unshare-net", "node", "render-spike.mjs"],
      argv_hash: "a".repeat(16), stdout: "ok", stderr: "", exit_code: 0,
      versions: { node: "v20", npm: "10", bwrap: "0.9" }, output_sha256: "a".repeat(64), timestamp: new Date().toISOString(),
    }];
  }
  if (gateId === "G-P3-05") {
    return [{
      fixture_sha256: "a".repeat(64), render_1_raw_sha256: "b".repeat(64), render_2_raw_sha256: "c".repeat(64),
      render_1_manifest_sha256: "d".repeat(64), render_2_manifest_sha256: "d".repeat(64),
      render_1_commands: [["-Z1", "/tmp/one.docx"], ["-p", "/tmp/one.docx", "\\[Content_Types\\].xml"]],
      render_2_commands: [["-Z1", "/tmp/two.docx"], ["-p", "/tmp/two.docx", "\\[Content_Types\\].xml"]],
    }];
  }
  return [];
}

function writeSuite(gatesDir, suiteId, overrides = {}) {
  for (const gateId of FINAL_GATE_IDS) {
    const record = evidence({ gate_id: gateId, suite_run_id: suiteId, snapshots: validSnapshot(gateId), ...(overrides[gateId] ?? {}) });
    writeFileSync(join(gatesDir, `${gateId}.json`), `${JSON.stringify(record)}\n`);
  }
}

test("post-G-P3-05 validation rejects missing, malformed, non-pass, and mismatched suite evidence", () => {
  const suiteId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const mismatchedId = "11111111-2222-3333-4444-555555555555";
  const gatesDir = mkdtempSync(join(tmpdir(), "verify-render-evidence-"));
  try {
    writeSuite(gatesDir, suiteId);
    assert.deepEqual(validateSuiteEvidence({ gatesDir, suiteRunId: suiteId }), []);

    rmSync(join(gatesDir, "G-P3-03.json"));
    assert.match(validateSuiteEvidence({ gatesDir, suiteRunId: suiteId }).join("\n"), /missing evidence file: G-P3-03.json/);

    writeSuite(gatesDir, suiteId);
    writeFileSync(join(gatesDir, "G-P3-03.json"), "not json\n");
    assert.match(validateSuiteEvidence({ gatesDir, suiteRunId: suiteId }).join("\n"), /invalid JSON in G-P3-03.json/);

    writeSuite(gatesDir, suiteId, { "G-P3-03": { status: "fail", exit_code: 1, assertions_summary: { total: 1, passed: 0, failed: 1, skipped: 0, todo: 0, cancelled: 0 } } });
    assert.match(validateSuiteEvidence({ gatesDir, suiteRunId: suiteId }).join("\n"), /status is fail, expected pass/);

    writeSuite(gatesDir, suiteId, { "G-P3-05": { suite_run_id: mismatchedId } });
    assert.match(validateSuiteEvidence({ gatesDir, suiteRunId: suiteId }).join("\n"), /does not match suite UUID/);
  } finally {
    rmSync(gatesDir, { recursive: true, force: true });
  }
});
