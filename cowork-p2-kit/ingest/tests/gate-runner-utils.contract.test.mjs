import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyChildResult,
  normalizeSnapshots,
  parseGateTimeout,
} from "./gate-runner-utils.mjs";

test("parseGateTimeout accepts only a full positive base-10 safe integer at most 300000", () => {
  assert.equal(parseGateTimeout("300000"), 300000);
  for (const value of [undefined, "", "0", "-1", "+1", "1.5", " 1", "1 ", "123abc", "300001"]) {
    assert.equal(parseGateTimeout(value), null, `must reject ${String(value)}`);
  }
});

test("normalizeSnapshots retains arrays and turns malformed payloads into diagnostics", () => {
  assert.deepEqual(normalizeSnapshots(() => '[{"case":"ok"}]').snapshots, [{ case: "ok" }]);
  const malformed = normalizeSnapshots(() => "{");
  assert.deepEqual(malformed.snapshots, []);
  assert.match(malformed.diagnostic, /malformed snapshots/);
  const wrongShape = normalizeSnapshots(() => "{}");
  assert.deepEqual(wrongShape.snapshots, []);
  assert.match(wrongShape.diagnostic, /expected JSON array/);
});

test("normalizeSnapshots ignores an absent detail file but reports other read errors", () => {
  const absent = normalizeSnapshots(() => {
    const error = new Error("not found");
    error.code = "ENOENT";
    throw error;
  });
  assert.deepEqual(absent, { snapshots: [], diagnostic: "" });
  const failedRead = normalizeSnapshots(() => { throw new Error("permission denied"); });
  assert.deepEqual(failedRead.snapshots, []);
  assert.match(failedRead.diagnostic, /failed to read snapshots/);
});

test("classifyChildResult normalizes every timeout spelling to null exit and non-empty signal", () => {
  for (const result of [
    { status: null, error: { code: "ETIMEDOUT" }, signal: "SIGTERM" },
    { status: null, error: { code: "ETIMEDOUT" } },
    { status: null, signal: "SIGTERM" },
  ]) {
    assert.deepEqual(classifyChildResult(result), { timedOut: true, exitCode: null, signal: "SIGTERM" });
  }
});

test("classifyChildResult keeps non-timeout execution errors as schema-valid failures", () => {
  assert.deepEqual(classifyChildResult({ status: null, error: { code: "EACCES" } }), {
    timedOut: false,
    exitCode: 1,
    signal: null,
  });
});
