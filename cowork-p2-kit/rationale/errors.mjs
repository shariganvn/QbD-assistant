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
  "E_PACKET_ENVELOPE",
  "E_PACKET_WRITE",
]);
