/** Pure normalization helpers shared by the gate runner and contract tests. */

const POSITIVE_TIMEOUT_RE = /^[1-9][0-9]*$/;

export function parseGateTimeout(value) {
  if (typeof value !== "string" || !POSITIVE_TIMEOUT_RE.test(value)) return null;
  const timeoutMs = Number(value);
  return Number.isSafeInteger(timeoutMs) && timeoutMs <= 300_000 ? timeoutMs : null;
}

export function normalizeSnapshots(readDetail) {
  let raw;
  try {
    raw = readDetail();
  } catch (error) {
    if (error?.code === "ENOENT") return { snapshots: [], diagnostic: "" };
    return { snapshots: [], diagnostic: `\n[run-gate] failed to read snapshots: ${error.message}` };
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { snapshots: parsed, diagnostic: "" };
    return {
      snapshots: [],
      diagnostic: `\n[run-gate] malformed snapshots: expected JSON array, got ${typeof parsed}`,
    };
  } catch (error) {
    return { snapshots: [], diagnostic: `\n[run-gate] malformed snapshots: ${error.message}` };
  }
}

export function classifyChildResult(result) {
  const hasSignal = typeof result.signal === "string" && result.signal.length > 0;
  const timedOut = result.error?.code === "ETIMEDOUT" || (result.status === null && hasSignal);
  if (timedOut) {
    return { timedOut: true, exitCode: null, signal: hasSignal ? result.signal : "SIGTERM" };
  }
  return {
    timedOut: false,
    exitCode: Number.isSafeInteger(result.status) ? result.status : 1,
    signal: null,
  };
}
