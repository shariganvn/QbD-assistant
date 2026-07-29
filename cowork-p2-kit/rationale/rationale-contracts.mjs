import { createHash } from "node:crypto";

import { RationalePacketError } from "./errors.mjs";

export const RATIONALE_KEYS = ["schema_version", "rationale_id", "packet_id", "packet_sha256", "run_id", "decision_id", "decision_sha256", "cohort_id", "decision_status", "winner", "fd_action", "display_state", "claims"];
export const CLAIM_KEYS = ["claim_id", "kind", "text", "cites"];
export const CLAIM_KINDS = ["fact", "gate", "sensitivity", "exclusion", "decision_state"];
export const NUMERIC_TOKENIZER_VERSION = "1";
export const NUMERIC_TOKEN_REGEX = /(?<![A-Za-z_])(?:\d+(?:\.\d+)?|\.\d+)(?![A-Za-z_])/g;
export const UNIT_TOKENIZER_VERSION = "1";
export const UNIT_TOKEN_REGEX = /%|(?<![A-Za-z])(?:mcg|mg|kg|µg|mL|°C|min|sec|g|L|N)(?![A-Za-z])/g;

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function exactKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function canonicalBytes(value) {
  const canonicalize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(canonicalize);
    if (candidate !== null && typeof candidate === "object") return Object.fromEntries(Object.keys(candidate).sort().map((key) => [key, canonicalize(candidate[key])]));
    return candidate;
  };
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function reject(code, message) {
  throw new RationalePacketError(code, message);
}

function binding(message) {
  reject("E_RATIONALE_CLAIM_BINDING", message);
}

export function validateRationaleEnvelope(rationale, packet) {
  if (!isObject(packet) || !isObject(packet.decision) || !isObject(packet.evaluation) || !isObject(packet.cohort)) binding("a sealed packet is required");
  if (Object.hasOwn(packet, "display_state")) reject("E_RATIONALE_DISPLAY_STATE", "display_state is not a packet field");
  if (!exactKeys(rationale, RATIONALE_KEYS)) binding("rationale keys must exactly match the contract");
  if (rationale.schema_version !== 1 || typeof rationale.rationale_id !== "string" || rationale.rationale_id === "") binding("rationale envelope is invalid");
  if (rationale.display_state !== "internal_only") reject("E_RATIONALE_DISPLAY_STATE", "display_state must be internal_only");
  if (typeof rationale.packet_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(rationale.packet_sha256)
    || rationale.packet_id !== packet.packet_id || rationale.packet_sha256 !== sha256(canonicalBytes(packet)) || rationale.run_id !== packet.run_id
    || rationale.decision_id !== packet.decision.decision_id || rationale.decision_sha256 !== packet.evaluation.decision_sha256) binding("rationale does not bind the sealed packet identity");
  if (rationale.cohort_id !== packet.cohort.cohort_id || rationale.decision_status !== packet.decision.status
    || rationale.winner !== packet.decision.winner || rationale.fd_action !== packet.decision.fd_action) {
    reject("E_RATIONALE_DECISION_ALTERED", "rationale changes the packet decision state");
  }
  if (!Array.isArray(rationale.claims) || rationale.claims.length === 0) binding("rationale claims must be a non-empty array");
  let previousId = null;
  const claimIds = new Set();
  for (const claim of rationale.claims) {
    if (!exactKeys(claim, CLAIM_KEYS) || typeof claim.claim_id !== "string" || claim.claim_id === ""
      || typeof claim.kind !== "string" || !CLAIM_KINDS.includes(claim.kind) || typeof claim.text !== "string"
      || claim.text.trim() === "" || !/[A-Za-z]/.test(claim.text) || !isObject(claim.cites)) binding("rationale claim envelope is invalid");
    if (claimIds.has(claim.claim_id) || (previousId !== null && previousId.localeCompare(claim.claim_id) >= 0)) binding("claim IDs must be unique and sorted");
    claimIds.add(claim.claim_id);
    previousId = claim.claim_id;
  }
  return rationale;
}
