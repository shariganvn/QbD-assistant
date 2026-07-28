import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { RUN_ID, Step4PublicationError } from "./publication-receipt.mjs";

const reportActions = new Set(["report-opened", "inputs-validated", "decision-evaluated", "publication-staged", "publication-committed", "publication-rejected", "run-finalized"]);
const observedResults = new Set(["pass", "fail", "selected", "inconclusive"]);
const outcomes = new Set(["selected", "inconclusive", "failed"]);
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const sha256 = /^[a-f0-9]{64}$/;
const reportDecisionPath = "docs/reports/qbd-p4-reasoning-layer/decision/formula-decision.json";

function reject(code, message) { throw new Step4PublicationError(code, message); }
function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject("E_EXECUTION_REPORT_CONTENT", "report event must be an object");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) reject("E_EXECUTION_REPORT_CONTENT", "report event keys must match the contract");
}

function validateEvent(event) {
  exactObject(event, ["timestamp", "action", "observed_result", "decision_artifact", "blocker_or_reversible_deviation"]);
  if (typeof event.timestamp !== "string" || !timestamp.test(event.timestamp) || !reportActions.has(event.action) || !observedResults.has(event.observed_result)) reject("E_EXECUTION_REPORT_CONTENT", "report event has invalid operational fields");
  if (event.decision_artifact !== null) {
    exactObject(event.decision_artifact, ["decision_id", "path", "sha256"]);
    if (typeof event.decision_artifact.decision_id !== "string" || event.decision_artifact.decision_id.length === 0 || event.decision_artifact.path !== reportDecisionPath || !sha256.test(event.decision_artifact.sha256)) reject("E_EXECUTION_REPORT_CONTENT", "report decision artifact is invalid");
  }
  if (event.blocker_or_reversible_deviation !== null && (typeof event.blocker_or_reversible_deviation !== "string" || !/^E_[A-Z0-9_]+$/.test(event.blocker_or_reversible_deviation))) reject("E_EXECUTION_REPORT_CONTENT", "report blocker must be a stable E_ code or null");
}

export function createExecutionReport({ project, runId, artifactsHome = resolve(homedir(), ".codex/artifacts"), fileSystem = { mkdirSync, writeFileSync, appendFileSync } }) {
  if (typeof project !== "string" || !RUN_ID.test(project) || typeof runId !== "string" || !RUN_ID.test(runId) || typeof artifactsHome !== "string" || !resolve(artifactsHome).startsWith("/")) reject("E_EXECUTION_REPORT_PATH", "project, runId, and artifactsHome must form an absolute report path");
  const home = resolve(artifactsHome);
  const directory = resolve(home, project, "reasoning-execution-reports");
  const path = resolve(directory, `${runId}.md`);
  if (!directory.startsWith(`${home}/`) || !path.startsWith(`${directory}/`)) reject("E_EXECUTION_REPORT_PATH", "execution report escapes the computed directory");
  let opened = false;
  let finalized = false;
  return {
    open() {
      if (opened) reject("E_EXECUTION_REPORT_CONTENT", "execution report is already open");
      fileSystem.mkdirSync(directory, { recursive: true });
      fileSystem.writeFileSync(path, "# Reasoning execution report\n\nThis is a human-only, untrusted, observational record. It does not affect the formulation decision.\n", { flag: "w" });
      opened = true;
    },
    append(event) {
      if (!opened || finalized) reject("E_EXECUTION_REPORT_CONTENT", "execution report must be open and not finalized before appending");
      validateEvent(event);
      fileSystem.appendFileSync(path, `- ${event.timestamp} | ${event.action} | ${event.observed_result} | decision=${event.decision_artifact === null ? "null" : JSON.stringify(event.decision_artifact)} | blocker=${event.blocker_or_reversible_deviation ?? "null"}\n`);
    },
    finalize(outcome) {
      if (!opened || finalized) reject("E_EXECUTION_REPORT_CONTENT", "execution report must be open and not finalized before finalization");
      if (!outcomes.has(outcome)) reject("E_EXECUTION_REPORT_CONTENT", "report outcome is invalid");
      fileSystem.appendFileSync(path, `- final outcome: ${outcome}\n`);
      finalized = true;
    },
  };
}
