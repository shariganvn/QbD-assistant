/** Strict, reusable validation for Step 4 gate evidence and suite manifests. */

export const GATE_EVIDENCE_KEYS = [
  "gate_id", "status", "command", "exit_code",
  "raw_tap_output", "raw_stderr", "timestamp", "run_id",
  "suite_run_id", "assertions_summary", "snapshots",
  "timeout_ms", "duration_ms", "timed_out", "signal",
];

export const ASSERTIONS_SUMMARY_KEYS = ["total", "passed", "failed", "skipped", "todo", "cancelled"];

export const SUITE_MANIFEST_KEYS = [
  "suite_run_id", "status", "started_at", "completed_at",
  "timeout_ms", "duration_ms", "timed_out",
  "next_gate_id", "completed_gate_ids", "failed_gate_id", "exit_code",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) && value.includes("T");
}

function isSafeNonnegInt(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function exactKeys(value, expected, label, errors) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  const missing = sortedExpected.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !sortedExpected.includes(key));
  if (missing.length) errors.push(`${label} missing keys: ${missing.join(", ")}`);
  if (extra.length) errors.push(`${label} extra keys: ${extra.join(", ")}`);
}

function hasOrderedPrefix(completedGateIds, gateIds) {
  return completedGateIds.length <= gateIds.length
    && completedGateIds.every((gateId, index) => gateId === gateIds[index]);
}

export function validateGateEvidence(evidence, expectedGateId, expectedSuiteRunId) {
  const errors = [];
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    return { valid: false, errors: ["evidence is not an object"] };
  }

  exactKeys(evidence, GATE_EVIDENCE_KEYS, "evidence", errors);
  if (evidence.gate_id !== expectedGateId) errors.push(`gate_id: expected "${expectedGateId}", got "${evidence.gate_id}"`);
  if (!['pass', 'fail'].includes(evidence.status)) errors.push("status: must be pass or fail");
  if (!Array.isArray(evidence.command) || !evidence.command.every((part) => typeof part === "string")) errors.push("command: must be array of strings");
  if (typeof evidence.raw_tap_output !== "string") errors.push("raw_tap_output: must be a string");
  if (typeof evidence.raw_stderr !== "string") errors.push("raw_stderr: must be a string");
  if (!isIsoTimestamp(evidence.timestamp)) errors.push("timestamp: must be ISO timestamp");
  if (!isUuid(evidence.run_id)) errors.push("run_id: must be a UUID");
  if (!isUuid(evidence.suite_run_id)) errors.push("suite_run_id: must be a UUID");
  if (expectedSuiteRunId && evidence.suite_run_id !== expectedSuiteRunId) errors.push(`suite_run_id: expected "${expectedSuiteRunId}"`);
  if (!Array.isArray(evidence.snapshots)) errors.push("snapshots: must be an array");
  if (!isSafeNonnegInt(evidence.timeout_ms) || evidence.timeout_ms === 0) errors.push("timeout_ms: must be a positive safe integer");
  if (!isSafeNonnegInt(evidence.duration_ms)) errors.push("duration_ms: must be a non-negative safe integer");
  if (typeof evidence.timed_out !== "boolean") errors.push("timed_out: must be a boolean");

  if (typeof evidence.assertions_summary !== "object" || evidence.assertions_summary === null || Array.isArray(evidence.assertions_summary)) {
    errors.push("assertions_summary: must be an object");
  } else {
    exactKeys(evidence.assertions_summary, ASSERTIONS_SUMMARY_KEYS, "assertions_summary", errors);
    for (const key of ASSERTIONS_SUMMARY_KEYS) {
      if (!isSafeNonnegInt(evidence.assertions_summary[key])) errors.push(`assertions_summary.${key}: must be a non-negative safe integer`);
    }
  }

  const hasSignal = typeof evidence.signal === "string" && evidence.signal.length > 0;
  if (evidence.signal !== null && !hasSignal) errors.push("signal: must be null or a non-empty string");
  if (Number.isSafeInteger(evidence.exit_code)) {
    if (evidence.exit_code < 0) errors.push("exit_code: must be a non-negative safe integer");
    if (evidence.timed_out) errors.push("timed_out evidence requires exit_code null");
    if (evidence.signal !== null) errors.push("completed child evidence requires signal null");
  } else if (evidence.exit_code === null) {
    if (!evidence.timed_out || !hasSignal) errors.push("null exit_code requires timed_out true and non-empty signal");
  } else {
    errors.push("exit_code: must be a safe integer or timeout null");
  }

  if (evidence.timed_out && evidence.status !== "fail") errors.push("timed_out evidence must have status fail");
  if (evidence.status === "pass") {
    if (evidence.exit_code !== 0 || evidence.timed_out || evidence.signal !== null) errors.push("pass evidence must have exit_code 0 without timeout or signal");
    if (evidence.duration_ms > evidence.timeout_ms) errors.push("pass evidence duration_ms must not exceed timeout_ms");
    const summary = evidence.assertions_summary;
    if (!summary || summary.total === 0 || summary.passed !== summary.total || summary.failed !== 0 || summary.skipped !== 0 || summary.todo !== 0 || summary.cancelled !== 0) {
      errors.push("pass evidence TAP summary must be complete and successful");
    }
    if (typeof evidence.raw_tap_output !== "string" || evidence.raw_tap_output.length === 0) {
      errors.push("pass evidence raw_tap_output must be non-empty");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSuiteManifest(manifest, { expectedSuiteRunId, gateIds } = {}) {
  const errors = [];
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return { valid: false, errors: ["manifest is not an object"] };
  }
  if (!Array.isArray(gateIds) || gateIds.length === 0 || new Set(gateIds).size !== gateIds.length) {
    return { valid: false, errors: ["gateIds option must be a non-empty duplicate-free array"] };
  }

  exactKeys(manifest, SUITE_MANIFEST_KEYS, "manifest", errors);
  if (!isUuid(manifest.suite_run_id)) errors.push("suite_run_id: must be a UUID");
  if (expectedSuiteRunId && manifest.suite_run_id !== expectedSuiteRunId) errors.push(`suite_run_id: expected "${expectedSuiteRunId}"`);
  if (!['running', 'pass', 'fail'].includes(manifest.status)) errors.push("status: must be running, pass, or fail");
  if (!isIsoTimestamp(manifest.started_at)) errors.push("started_at: must be ISO timestamp");
  if (!isSafeNonnegInt(manifest.timeout_ms) || manifest.timeout_ms === 0) errors.push("timeout_ms: must be a positive safe integer");
  if (!isSafeNonnegInt(manifest.duration_ms)) errors.push("duration_ms: must be a non-negative safe integer");
  if (typeof manifest.timed_out !== "boolean") errors.push("timed_out: must be a boolean");
  if (!Array.isArray(manifest.completed_gate_ids) || !hasOrderedPrefix(manifest.completed_gate_ids ?? [], gateIds)) {
    errors.push("completed_gate_ids: must be an ordered duplicate-free mapped prefix");
  }

  const completedIds = Array.isArray(manifest.completed_gate_ids) ? manifest.completed_gate_ids : [];
  const completedCount = completedIds.length;
  const expectedNextGateId = gateIds[completedCount] ?? null;
  const knownGate = (value) => value === null || gateIds.includes(value);
  if (!knownGate(manifest.next_gate_id)) errors.push("next_gate_id: must be null or a mapped gate ID");
  if (!knownGate(manifest.failed_gate_id)) errors.push("failed_gate_id: must be null or a mapped gate ID");

  if (manifest.status === "running") {
    if (manifest.completed_at !== null) errors.push("running manifest completed_at must be null");
    if (manifest.exit_code !== null) errors.push("running manifest exit_code must be null");
    if (manifest.timed_out !== false) errors.push("running manifest timed_out must be false");
    if (manifest.failed_gate_id !== null) errors.push("running manifest failed_gate_id must be null");
    if (manifest.next_gate_id !== expectedNextGateId) errors.push("running manifest next_gate_id must be next mapped gate");
  } else if (manifest.status === "pass") {
    if (!isIsoTimestamp(manifest.completed_at)) errors.push("pass manifest completed_at must be ISO timestamp");
    if (manifest.timed_out !== false) errors.push("pass manifest timed_out must be false");
    if (completedIds.length !== gateIds.length) errors.push("pass manifest must complete every mapped gate");
    if (manifest.next_gate_id !== null || manifest.failed_gate_id !== null) errors.push("pass manifest must not name next or failed gate");
    if (manifest.exit_code !== 0) errors.push("pass manifest exit_code must be 0");
    if (manifest.duration_ms > manifest.timeout_ms) errors.push("pass manifest duration_ms must not exceed timeout_ms");
  } else {
    if (!isIsoTimestamp(manifest.completed_at)) errors.push("fail manifest completed_at must be ISO timestamp");
    if (!Number.isSafeInteger(manifest.exit_code) || manifest.exit_code <= 0) errors.push("fail manifest exit_code must be a nonzero safe integer");
    if (manifest.timed_out && manifest.failed_gate_id === null) {
      if (manifest.next_gate_id !== expectedNextGateId) errors.push("pre-gate timeout must retain next_gate_id");
    } else {
      if (manifest.next_gate_id !== null) errors.push("in-progress or generic failure must have next_gate_id null");
      if (manifest.failed_gate_id !== expectedNextGateId) errors.push("failure must name the next mapped gate as failed");
    }
  }

  return { valid: errors.length === 0, errors };
}
