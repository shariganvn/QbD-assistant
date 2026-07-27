// Step 3 error codes — isolated from the frozen errors.mjs boundary.
// Exports a ReasoningContractError that accepts both base and step-3 codes.

import { ERROR_CODES as BASE_CODES } from "./errors.mjs";

const STEP3_CODES = new Set([
  "E_FD_REVIEW_UNCITED_RESULTS",
  "E_INSUFFICIENT_ELIGIBLE_CANDIDATES",
  "E_NORMALIZED_VALUE_MISMATCH",
  "E_RUBRIC_APPROVAL_REQUIRED",
  "E_RUBRIC_PIN_MISMATCH",
  "E_RUBRIC_PIN_REQUIRED",
  "E_TIE_OR_SENSITIVITY_UNSTABLE",
  "E_UNIT_NORMALIZATION_REQUIRED",
]);

const ALL_CODES = new Set([...BASE_CODES, ...STEP3_CODES]);

export class ReasoningContractError extends Error {
  constructor(code, message, options) {
    if (!ALL_CODES.has(code)) throw new Error(`Unknown reasoning error code: ${code}`);
    super(message, options);
    this.name = "ReasoningContractError";
    this.code = code;
  }

  format() {
    return `[${this.code}] ${this.message}`;
  }
}

export { STEP3_CODES };
