import assert from "node:assert/strict";
import test from "node:test";

import { GATE_MAP, runRationaleSuite } from "./verify-rationale.mjs";

const repoRoot = new URL("../../..", import.meta.url).pathname;

test("G-RL-05 runner uses the declared gate order, a shared suite ID, and first-failure stop", () => {
  assert.deepEqual(GATE_MAP.map(([gateId]) => gateId), ["G-RL-01", "G-RL-02", "G-RL-03", "G-RL-04", "G-RL-05"]);
  const calls = [];
  const suiteRunId = "00000000-0000-4000-8000-000000000005";
  const gateMap = GATE_MAP.slice(0, 3).map(([gateId]) => [gateId, "package.json"]);
  const common = { gateMap, root: repoRoot, suiteRunId, writeStdout: () => {}, writeStderr: () => {} };
  assert.equal(runRationaleSuite({
    ...common,
    spawn: (_command, args, options) => {
      calls.push({ gateId: args[1], suiteRunId: options.env.RATIONALE_SUITE_RUN_ID });
      return { status: args[1] === "G-RL-02" ? 1 : 0, stdout: "", stderr: "" };
    },
    validateEvidence: () => { throw new Error("post-validation must not run after gate failure"); },
  }), 1);
  assert.deepEqual(calls.map(({ gateId }) => gateId), ["G-RL-01", "G-RL-02"]);
  assert.deepEqual(calls.map((call) => call.suiteRunId), [suiteRunId, suiteRunId]);
  assert.equal(runRationaleSuite({ ...common, spawn: () => ({ status: 0, stdout: "", stderr: "" }), validateEvidence: ({ suiteRunId: actual }) => actual === suiteRunId ? [] : ["suite ID did not propagate"] }), 0);
});

test("G-RL-05 runner rejects a missing test and failed post-suite evidence validation", () => {
  const errors = [];
  assert.equal(runRationaleSuite({
    gateMap: [["G-RL-01", "missing-rationale-test.mjs"]],
    root: repoRoot,
    spawn: () => { throw new Error("a missing test must stop before spawn"); },
    validateEvidence: () => [],
    writeStdout: () => {},
    writeStderr: (value) => errors.push(value),
  }), 1);
  assert.match(errors.join(""), /Rationale suite is incomplete/);
  const postErrors = [];
  assert.equal(runRationaleSuite({
    gateMap: [["G-RL-01", "package.json"]],
    root: repoRoot,
    spawn: () => ({ status: 0, stdout: "", stderr: "" }),
    validateEvidence: () => ["G-RL-05 status is fail"],
    writeStdout: () => {},
    writeStderr: (value) => postErrors.push(value),
  }), 1);
  assert.match(postErrors.join(""), /post-G-RL-05 validation failed/);
});
