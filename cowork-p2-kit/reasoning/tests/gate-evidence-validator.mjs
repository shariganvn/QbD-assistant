const SHA256 = /^[0-9a-f]{64}$/;

export const GATE_EVIDENCE_KEYS = ["gate_id", "status", "command", "exit_code", "raw_tap_output", "raw_stderr", "timestamp", "run_id", "suite_run_id", "assertions_summary", "timeout_ms", "duration_ms", "timed_out", "signal", "store_records_sha256"];

export function validateGateEvidence(evidence, gateId) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { valid: false, errors: ["evidence must be an object"] };
  const keys = Object.keys(evidence).sort();
  if (keys.join("\0") !== [...GATE_EVIDENCE_KEYS].sort().join("\0")) errors.push("evidence keys do not match the canonical schema");
  if (evidence.gate_id !== gateId || !["pass", "fail"].includes(evidence.status)) errors.push("gate identity or status is invalid");
  if (!Array.isArray(evidence.command) || evidence.command.some((part) => typeof part !== "string")) errors.push("command is invalid");
  if (!Number.isSafeInteger(evidence.exit_code) || evidence.exit_code < 0) errors.push("exit code is invalid");
  if (typeof evidence.raw_tap_output !== "string" || typeof evidence.raw_stderr !== "string") errors.push("raw output is invalid");
  if (!evidence.assertions_summary || ["total", "passed", "failed", "skipped", "todo", "cancelled"].some((key) => !Number.isSafeInteger(evidence.assertions_summary[key]))) errors.push("assertions summary is invalid");
  if (typeof evidence.store_records_sha256 !== "string" || !SHA256.test(evidence.store_records_sha256)) errors.push("store hash is invalid");
  return { valid: errors.length === 0, errors };
}
