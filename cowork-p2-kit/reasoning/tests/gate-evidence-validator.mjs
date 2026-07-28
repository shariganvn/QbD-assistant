const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GATE_EVIDENCE_KEYS = ["gate_id", "status", "command", "exit_code", "raw_tap_output", "raw_stderr", "timestamp", "run_id", "suite_run_id", "assertions_summary", "timeout_ms", "duration_ms", "timed_out", "signal", "store_records_sha256"];

export function validateGateEvidence(evidence, gateId) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { valid: false, errors: ["evidence must be an object"] };
  const keys = Object.keys(evidence).sort();
  if (keys.join("\0") !== [...GATE_EVIDENCE_KEYS].sort().join("\0")) errors.push("evidence keys do not match the canonical schema");
  if (evidence.gate_id !== gateId || !["pass", "fail"].includes(evidence.status)) errors.push("gate identity or status is invalid");
  if (!Array.isArray(evidence.command) || evidence.command.length === 0 || evidence.command.some((part) => typeof part !== "string" || part === "")) errors.push("command is invalid");
  if (!Number.isSafeInteger(evidence.exit_code) || evidence.exit_code < 0) errors.push("exit code is invalid");
  if (typeof evidence.raw_tap_output !== "string" || typeof evidence.raw_stderr !== "string") errors.push("raw output is invalid");
  if (typeof evidence.timestamp !== "string" || Number.isNaN(Date.parse(evidence.timestamp)) || new Date(evidence.timestamp).toISOString() !== evidence.timestamp) errors.push("timestamp is invalid");
  if (typeof evidence.run_id !== "string" || !UUID.test(evidence.run_id) || typeof evidence.suite_run_id !== "string" || !UUID.test(evidence.suite_run_id)) errors.push("run UUID is invalid");
  const summaryKeys = ["total", "passed", "failed", "skipped", "todo", "cancelled"];
  if (!evidence.assertions_summary || summaryKeys.some((key) => !Number.isSafeInteger(evidence.assertions_summary[key]) || evidence.assertions_summary[key] < 0)) {
    errors.push("assertions summary is invalid");
  } else if (evidence.assertions_summary.total !== evidence.assertions_summary.passed + evidence.assertions_summary.failed + evidence.assertions_summary.skipped + evidence.assertions_summary.todo + evidence.assertions_summary.cancelled) {
    errors.push("assertions summary is inconsistent");
  }
  if (!Number.isSafeInteger(evidence.timeout_ms) || evidence.timeout_ms <= 0 || !Number.isSafeInteger(evidence.duration_ms) || evidence.duration_ms < 0 || typeof evidence.timed_out !== "boolean" || (evidence.signal !== null && typeof evidence.signal !== "string")) errors.push("execution metadata is invalid");
  if (evidence.status === "pass" && (evidence.exit_code !== 0 || evidence.assertions_summary?.total <= 0 || evidence.assertions_summary?.passed !== evidence.assertions_summary?.total || ["failed", "skipped", "todo", "cancelled"].some((key) => evidence.assertions_summary?.[key] !== 0))) errors.push("pass evidence is inconsistent");
  if (typeof evidence.store_records_sha256 !== "string" || !SHA256.test(evidence.store_records_sha256)) errors.push("store hash is invalid");
  return { valid: errors.length === 0, errors };
}
