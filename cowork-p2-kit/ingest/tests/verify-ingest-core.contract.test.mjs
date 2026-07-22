import assert from "node:assert/strict";
import test from "node:test";
import { MAX_GATE_TIMEOUT_MS, runIngestSuite, SUITE_DEADLINE_MS } from "./verify-ingest-core.mjs";
import { GATE_MAP, GATE_IDS } from "./verify-ingest.mjs";

const SUITE_RUN_ID = "11223344-aabb-ccdd-eeff-001122334455";

function validEvidence(gateId) {
  return {
    gate_id: gateId,
    status: "pass",
    command: ["node", "--test", `${gateId}.test.mjs`],
    exit_code: 0,
    raw_tap_output: "# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n",
    raw_stderr: "",
    timestamp: new Date(0).toISOString(),
    run_id: "aabbccdd-1122-3344-5566-778899001122",
    suite_run_id: SUITE_RUN_ID,
    assertions_summary: { total: 1, passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 0 },
    snapshots: [],
    timeout_ms: MAX_GATE_TIMEOUT_MS,
    duration_ms: 1,
    timed_out: false,
    signal: null,
  };
}

function runWith(overrides = {}) {
  const manifests = [];
  const result = runIngestSuite({
    suiteRunId: SUITE_RUN_ID,
    gateMap: GATE_MAP,
    now: () => 0,
    isoNow: () => new Date(0).toISOString(),
    writeManifest: (manifest) => manifests.push(manifest),
    runGate: () => ({ status: 0, signal: null, stdout: "", stderr: "" }),
    readGateEvidence: (gateId) => validEvidence(gateId),
    ...overrides,
  });
  return { result, manifests };
}

test("deadline before the first gate starts no child and retains next gate", () => {
  let calls = 0;
  const { result, manifests } = runWith({
    now: (() => { let callsToClock = 0; return () => ++callsToClock === 1 ? 0 : SUITE_DEADLINE_MS; })(),
    runGate: () => { calls += 1; return { status: 0 }; },
  });
  assert.equal(calls, 0);
  assert.equal(result.exitCode, 1);
  const finalManifest = manifests.at(-1);
  assert.equal(finalManifest.status, "fail");
  assert.equal(finalManifest.timed_out, true);
  assert.equal(finalManifest.next_gate_id, "G-01");
  assert.deepEqual(finalManifest.completed_gate_ids, []);
  assert.equal(finalManifest.failed_gate_id, null);
  assert.equal(finalManifest.exit_code, 1);
});

test("runner ETIMEDOUT during a gate produces an in-progress timeout failure without grace", () => {
  const receivedTimeouts = [];
  const { result, manifests } = runWith({
    runGate: (input) => {
      receivedTimeouts.push(input.timeoutMs);
      return { status: null, signal: "SIGTERM", error: { code: "ETIMEDOUT" } };
    },
  });
  assert.deepEqual(receivedTimeouts, [MAX_GATE_TIMEOUT_MS]);
  assert.equal(result.exitCode, 1);
  assert.equal(manifests.at(-1).timed_out, true);
  assert.equal(manifests.at(-1).failed_gate_id, "G-01");
  assert.equal(manifests.at(-1).next_gate_id, null);
});

test("final pass is written only after valid G-10 evidence and before the hard deadline", () => {
  const { result, manifests } = runWith();
  assert.equal(result.exitCode, 0);
  assert.equal(manifests.at(-1).status, "pass");
  assert.deepEqual(manifests.at(-1).completed_gate_ids, GATE_IDS);

  const invalidG10 = runWith({
    readGateEvidence: (gateId) => gateId === "G-10"
      ? { ...validEvidence(gateId), raw_stderr: undefined }
      : validEvidence(gateId),
  });
  assert.equal(invalidG10.result.exitCode, 1);
  assert.equal(invalidG10.manifests.at(-1).status, "fail");
  assert.equal(invalidG10.manifests.at(-1).failed_gate_id, "G-10");
});

test("a deadline reached while validating G-10 cannot emit a pass manifest", () => {
  let nowMs = 0;
  const { result, manifests } = runWith({
    now: () => nowMs,
    readGateEvidence: (gateId) => {
      if (gateId === "G-10") nowMs = SUITE_DEADLINE_MS;
      return validEvidence(gateId);
    },
  });
  assert.equal(result.exitCode, 1);
  assert.equal(manifests.at(-1).status, "fail");
  assert.equal(manifests.at(-1).timed_out, true);
  assert.equal(manifests.at(-1).failed_gate_id, "G-10");
  assert.deepEqual(manifests.at(-1).completed_gate_ids, GATE_IDS.slice(0, -1));
});
