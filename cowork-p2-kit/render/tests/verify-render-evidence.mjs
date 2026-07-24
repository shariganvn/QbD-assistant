import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { validateGateEvidence } from "./gate-evidence-validator.mjs";

export const FINAL_GATE_IDS = ["G-P3-01", "G-P3-02", "G-P3-03", "G-P3-04", "G-P3-05"];

export function validateSuiteEvidence({ gatesDir, suiteRunId }) {
  const errors = [];
  for (const gateId of FINAL_GATE_IDS) {
    const evidencePath = join(gatesDir, `${gateId}.json`);
    if (!existsSync(evidencePath)) {
      errors.push(`missing evidence file: ${gateId}.json`);
      continue;
    }
    let evidence;
    try {
      evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    } catch (error) {
      errors.push(`invalid JSON in ${gateId}.json: ${error.message}`);
      continue;
    }
    const validation = validateGateEvidence(evidence, gateId);
    if (!validation.valid) {
      errors.push(`${gateId} validation failed: ${validation.errors.join("; ")}`);
      continue;
    }
    if (evidence.status !== "pass") {
      errors.push(`${gateId} status is ${evidence.status}, expected pass`);
      continue;
    }
    if (evidence.suite_run_id !== suiteRunId) {
      errors.push(`${gateId} suite_run_id ${evidence.suite_run_id} does not match suite UUID ${suiteRunId}`);
    }
  }
  return errors;
}
