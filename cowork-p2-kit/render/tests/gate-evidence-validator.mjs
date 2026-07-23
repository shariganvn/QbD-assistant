export const GATE_EVIDENCE_KEYS = [
  "gate_id", "status", "command", "exit_code", "raw_tap_output", "raw_stderr", "timestamp",
  "run_id", "suite_run_id", "assertions_summary", "snapshots", "timeout_ms", "duration_ms",
  "timed_out", "signal",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function validateGateEvidence(evidence, gateId) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { valid: false, errors: ["evidence must be an object"] };
  const keys = Object.keys(evidence).sort();
  if (keys.join("\0") !== [...GATE_EVIDENCE_KEYS].sort().join("\0")) errors.push("evidence keys do not match the canonical schema");
  if (evidence.gate_id !== gateId) errors.push("gate_id does not match");
  if (!['pass', 'fail'].includes(evidence.status)) errors.push("status is invalid");
  if (!Array.isArray(evidence.command) || evidence.command.some((part) => typeof part !== "string")) errors.push("command must be a string array");
  if (evidence.exit_code !== null && (!Number.isSafeInteger(evidence.exit_code) || evidence.exit_code < 0)) errors.push("exit_code is invalid");
  if (typeof evidence.raw_tap_output !== "string" || typeof evidence.raw_stderr !== "string") errors.push("raw output fields must be strings");
  if (typeof evidence.timestamp !== "string" || !ISO_UTC.test(evidence.timestamp) || Number.isNaN(Date.parse(evidence.timestamp))) errors.push("timestamp is invalid");
  if (typeof evidence.run_id !== "string" || !UUID.test(evidence.run_id) || typeof evidence.suite_run_id !== "string" || !UUID.test(evidence.suite_run_id)) errors.push("run IDs are invalid");
  if (!Array.isArray(evidence.snapshots)) errors.push("snapshots must be an array");
  if (!Number.isSafeInteger(evidence.timeout_ms) || evidence.timeout_ms <= 0) errors.push("timeout_ms is invalid");
  if (!Number.isSafeInteger(evidence.duration_ms) || evidence.duration_ms < 0) errors.push("duration_ms is invalid");
  const hasSignal = typeof evidence.signal === "string" && evidence.signal.length > 0;
  if (typeof evidence.timed_out !== "boolean" || (evidence.signal !== null && !hasSignal)) errors.push("timed_out or signal is invalid");
  const summary = evidence.assertions_summary;
  if (!summary || typeof summary !== "object" || ["total", "passed", "failed", "skipped", "todo", "cancelled"].some((key) => !Number.isSafeInteger(summary[key]) || summary[key] < 0)) errors.push("assertions_summary is invalid");
  if (evidence.timed_out && (evidence.status !== "fail" || evidence.exit_code !== null || !hasSignal)) errors.push("timeout evidence must be failed with null exit_code and signal");
  if (!evidence.timed_out && (evidence.exit_code === null || evidence.signal !== null)) errors.push("completed evidence requires exit_code and null signal");
  if (evidence.status === "pass" && (!summary || evidence.exit_code !== 0 || evidence.timed_out || evidence.signal !== null || summary.total === 0 || summary.passed !== summary.total || summary.failed !== 0 || summary.skipped !== 0 || summary.todo !== 0 || summary.cancelled !== 0 || evidence.raw_tap_output === "")) errors.push("pass evidence is incomplete or unsuccessful");
  return { valid: errors.length === 0, errors };
}
