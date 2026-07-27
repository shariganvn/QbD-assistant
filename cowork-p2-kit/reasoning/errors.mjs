const ERROR_CODES = new Set([
  "E_COHORT_CANDIDATE_MAP", "E_COHORT_ENVELOPE", "E_COHORT_PROFILE_MISMATCH",
  "E_COHORT_STRENGTH_MISMATCH", "E_DECISION_ENVELOPE", "E_EVIDENCE_LOG_ENVELOPE",
  "E_EVIDENCE_LOW_CONFIDENCE", "E_EVIDENCE_NEEDS_OCR",
  "E_FACT_CANDIDATE_BINDING", "E_FACT_QUOTE_LENGTH", "E_FACT_QUOTE_OFFSET",
  "E_FACT_QUOTE_VALUE_UNIT", "E_INPUT_JSON", "E_INPUT_PATH", "E_LINEAR_ATTESTATION_INCOMPLETE",
  "E_LINEAR_ATTESTATION_ENVELOPE", "E_PUBLICATION_PATH", "E_PUBLICATION_WRITE",
  "E_REASONING_ARTIFACT_BINDING", "E_RUBRIC_ENVELOPE", "E_STORE_INPUT", "E_STORE_SHA256",
]);

export class ReasoningContractError extends Error {
  constructor(code, message, options) {
    if (!ERROR_CODES.has(code)) throw new Error(`Unknown reasoning error code: ${code}`);
    super(message, options);
    this.name = "ReasoningContractError";
    this.code = code;
  }

  format() {
    return `[${this.code}] ${this.message}`;
  }
}

export { ERROR_CODES };
