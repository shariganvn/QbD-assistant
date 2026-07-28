export const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const artifactNames = ["cohort.json", "fact-cards.json", "evidence-log.json", "formula-decision.json", "selection-evaluation.json", "formula-decision.md", "evidence-log.md", "linear-attestation.json"];

export class Step4PublicationError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "Step4PublicationError";
    this.code = code;
  }
}

function exactObject(value, keys, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Step4PublicationError("E_PUBLICATION_RECEIPT", `${context} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Step4PublicationError("E_PUBLICATION_RECEIPT", `${context} keys must match the receipt contract`);
}

export function validatePublicationReceipt(receipt) {
  exactObject(receipt, ["schema_version", "run_id", "input_store_sha256", "artifacts"], "receipt");
  if (receipt.schema_version !== 1 || typeof receipt.run_id !== "string" || !RUN_ID.test(receipt.run_id)
    || typeof receipt.input_store_sha256 !== "string" || !SHA256.test(receipt.input_store_sha256)) {
    throw new Step4PublicationError("E_PUBLICATION_RECEIPT", "receipt envelope is invalid");
  }
  exactObject(receipt.artifacts, artifactNames, "receipt.artifacts");
  for (const name of artifactNames) {
    const value = receipt.artifacts[name];
    if (name === "linear-attestation.json" ? value !== null && !SHA256.test(value) : typeof value !== "string" || !SHA256.test(value)) {
      throw new Step4PublicationError("E_PUBLICATION_RECEIPT", `receipt hash for ${name} is invalid`);
    }
  }
  return receipt;
}

export function createPublicationReceipt({ runId, inputStoreSha256, artifacts }) {
  const receipt = { schema_version: 1, run_id: runId, input_store_sha256: inputStoreSha256, artifacts };
  return validatePublicationReceipt(receipt);
}
