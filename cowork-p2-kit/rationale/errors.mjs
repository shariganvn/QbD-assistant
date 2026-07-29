export class RationalePacketError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "RationalePacketError";
    this.code = code;
  }
}

export const PACKET_ERROR_CODES = Object.freeze([
  "E_PACKET_PATH",
  "E_PACKET_SOURCE_INVALID",
  "E_PACKET_BINDING",
  "E_PACKET_CAUSAL_UNMAPPABLE",
  "E_PACKET_ENVELOPE",
  "E_PACKET_WRITE",
]);

export const RATIONALE_ERROR_CODES = Object.freeze([
  "E_RATIONALE_CLAIM_BINDING",
  "E_RATIONALE_EVIDENCE_OUTSIDE_PACKET",
  "E_RATIONALE_INVENTED_VALUE",
  "E_RATIONALE_DECISION_ALTERED",
  "E_RATIONALE_INCONCLUSIVE_EXPLANATION",
  "E_RATIONALE_DISPLAY_STATE",
]);
