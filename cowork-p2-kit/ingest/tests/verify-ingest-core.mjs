/** Import-safe, dependency-injectable core for the fixed ingest verification suite. */

import { validateGateEvidence, validateSuiteManifest } from "./gate-evidence-validator.mjs";

export const SUITE_DEADLINE_MS = 1_200_000;
export const MAX_GATE_TIMEOUT_MS = 300_000;

function runnerTimedOut(result, deadlineMs, nowMs) {
  return result.error?.code === "ETIMEDOUT"
    || (result.status === null && typeof result.signal === "string" && result.signal.length > 0 && nowMs >= deadlineMs);
}

function nonzeroExit(result) {
  return Number.isSafeInteger(result.status) && result.status >= 0 ? result.status : 1;
}

/**
 * Run G-01..G-10 with injected side effects. This function never calls process.exit.
 * @returns {{ exitCode: number, validationErrors?: string[] }}
 */
export function runIngestSuite({
  suiteRunId,
  now = Date.now,
  isoNow = () => new Date().toISOString(),
  writeManifest,
  runGate,
  readGateEvidence,
  gateMap,
  suiteDeadlineMs = SUITE_DEADLINE_MS,
  maxGateTimeoutMs = MAX_GATE_TIMEOUT_MS,
}) {
  if (!Array.isArray(gateMap) || gateMap.length === 0) {
    throw new Error("runIngestSuite requires a non-empty literal gateMap");
  }
  const gateIds = gateMap.map(([gateId]) => gateId);
  const suiteStartMs = now();
  const startedAt = isoNow();
  const deadlineMs = suiteStartMs + suiteDeadlineMs;
  const completedGateIds = [];

  const elapsed = () => Math.max(0, now() - suiteStartMs);
  const makeManifest = (overrides) => ({
    suite_run_id: suiteRunId,
    status: "running",
    started_at: startedAt,
    completed_at: null,
    timeout_ms: suiteDeadlineMs,
    duration_ms: elapsed(),
    timed_out: false,
    next_gate_id: null,
    completed_gate_ids: [...completedGateIds],
    failed_gate_id: null,
    exit_code: null,
    ...overrides,
  });
  const persist = (overrides) => {
    const manifest = makeManifest(overrides);
    writeManifest(manifest);
    return manifest;
  };
  const fail = ({ timedOut, failedGateId, nextGateId, exitCode = 1, validationErrors }) => {
    persist({
      status: "fail",
      completed_at: isoNow(),
      timed_out: timedOut,
      next_gate_id: nextGateId,
      failed_gate_id: failedGateId,
      exit_code: exitCode,
    });
    return { exitCode, validationErrors };
  };

  persist({ next_gate_id: gateIds[0] });

  for (const [gateId, testFile] of gateMap) {
    const remainingMs = deadlineMs - now();
    if (remainingMs <= 0) {
      return fail({ timedOut: true, failedGateId: null, nextGateId: gateId });
    }
    const timeoutMs = Math.min(remainingMs, maxGateTimeoutMs);
    persist({ next_gate_id: gateId });

    const result = runGate({ gateId, testFile, timeoutMs, suiteRunId });
    const afterGateMs = now();
    if (runnerTimedOut(result, deadlineMs, afterGateMs)) {
      return fail({ timedOut: true, failedGateId: gateId, nextGateId: null });
    }
    if (afterGateMs >= deadlineMs) {
      return fail({ timedOut: true, failedGateId: gateId, nextGateId: null });
    }
    const gateExit = nonzeroExit(result);
    if (gateExit !== 0) {
      return fail({ timedOut: false, failedGateId: gateId, nextGateId: null, exitCode: gateExit });
    }

    let evidence;
    try {
      evidence = readGateEvidence(gateId);
    } catch (error) {
      return fail({
        timedOut: false,
        failedGateId: gateId,
        nextGateId: null,
        validationErrors: [`Gate ${gateId} evidence read error: ${error.message}`],
      });
    }
    const validation = validateGateEvidence(evidence, gateId, suiteRunId);
    if (!validation.valid) {
      return fail({ timedOut: false, failedGateId: gateId, nextGateId: null, validationErrors: validation.errors });
    }
    if (now() >= deadlineMs) {
      return fail({ timedOut: true, failedGateId: gateId, nextGateId: null });
    }
    completedGateIds.push(gateId);
  }

  if (now() >= deadlineMs) {
    completedGateIds.pop();
    return fail({ timedOut: true, failedGateId: "G-10", nextGateId: null });
  }

  const finalManifest = makeManifest({
    status: "pass",
    completed_at: isoNow(),
    timed_out: false,
    next_gate_id: null,
    failed_gate_id: null,
    exit_code: 0,
  });
  const finalValidation = validateSuiteManifest(finalManifest, { expectedSuiteRunId: suiteRunId, gateIds });
  if (now() >= deadlineMs) {
    completedGateIds.pop();
    return fail({ timedOut: true, failedGateId: "G-10", nextGateId: null });
  }
  if (!finalValidation.valid) {
    completedGateIds.pop();
    return fail({ timedOut: false, failedGateId: "G-10", nextGateId: null, validationErrors: finalValidation.errors });
  }
  writeManifest(finalManifest);
  return { exitCode: 0 };
}
