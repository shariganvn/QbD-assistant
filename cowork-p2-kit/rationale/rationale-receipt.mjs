import { RationalePacketError } from "./errors.mjs";
import { exactKeys, isObject } from "./rationale-contracts.mjs";

export const RATIONALE_RECEIPT_ARTIFACTS = ["rationale-packet.json", "rationale.json", "rationale.md"];
export const RATIONALE_RECEIPT_KEYS = ["schema_version", "run_id", "packet_sha256", "source_publication_receipt_sha256", "artifacts"];

const SHA256 = /^[0-9a-f]{64}$/;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function reject(message) {
  throw new RationalePacketError("E_RATIONALE_PUBLICATION_RECEIPT", message);
}

export function validateRationalePublicationReceipt(receipt) {
  if (!exactKeys(receipt, RATIONALE_RECEIPT_KEYS) || receipt.schema_version !== 1
    || typeof receipt.run_id !== "string" || !RUN_ID.test(receipt.run_id)
    || typeof receipt.packet_sha256 !== "string" || !SHA256.test(receipt.packet_sha256)
    || typeof receipt.source_publication_receipt_sha256 !== "string" || !SHA256.test(receipt.source_publication_receipt_sha256)
    || !isObject(receipt.artifacts) || !exactKeys(receipt.artifacts, RATIONALE_RECEIPT_ARTIFACTS)) {
    reject("rationale publication receipt has an invalid envelope");
  }
  for (const name of RATIONALE_RECEIPT_ARTIFACTS) {
    if (typeof receipt.artifacts[name] !== "string" || !SHA256.test(receipt.artifacts[name])) reject(`rationale receipt has an invalid hash for ${name}`);
  }
  return receipt;
}

export function createRationalePublicationReceipt({ runId, packetSha256, sourcePublicationReceiptSha256, artifacts }) {
  return validateRationalePublicationReceipt({
    schema_version: 1,
    run_id: runId,
    packet_sha256: packetSha256,
    source_publication_receipt_sha256: sourcePublicationReceiptSha256,
    artifacts,
  });
}
