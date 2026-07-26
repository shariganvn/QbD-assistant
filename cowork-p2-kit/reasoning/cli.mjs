#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ReasoningContractError } from "./errors.mjs";
import { validateCohort, validateDecision, validateEvidenceLog, validateFactCards, validateLinearAttestation } from "./contracts.mjs";
import { canonicalBytes, publishArtifacts } from "./publication.mjs";

const filePath = fileURLToPath(import.meta.url);
const defaultPublicationRoot = resolve(dirname(filePath), "../../docs/reports/qbd-p4-reasoning-layer/decision");
const required = ["decision", "cohort", "fact-cards", "linear-attestation", "evidence-log", "store"];

function parseArguments(argv) {
  if (argv[0] !== "publish") throw new ReasoningContractError("E_INPUT_PATH", "Usage: cli.mjs publish --decision <file> --cohort <file> --fact-cards <file> --linear-attestation <file> --evidence-log <file> --store <records.jsonl> --output-root <absolute-directory>");
  const paths = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value || paths[flag.slice(2)] !== undefined) throw new ReasoningContractError("E_INPUT_PATH", "CLI arguments must be unique option/value pairs");
    paths[flag.slice(2)] = value;
  }
  if (!required.every((key) => typeof paths[key] === "string") || typeof paths["output-root"] !== "string") throw new ReasoningContractError("E_INPUT_PATH", "all publication artifacts and --output-root are required");
  if (!isAbsolute(paths["output-root"])) throw new ReasoningContractError("E_PUBLICATION_PATH", "--output-root must be absolute");
  return paths;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new ReasoningContractError("E_INPUT_JSON", `cannot read JSON artifact ${path}: ${error.message}`, { cause: error }); }
}

function readRecords(path) {
  try {
    const bytes = readFileSync(path);
    const records = Object.fromEntries(bytes.toString("utf8").trim().split("\n").filter(Boolean).map((line) => {
      const record = JSON.parse(line);
      return [record.id, record];
    }));
    return { records, sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch (error) { throw new ReasoningContractError("E_STORE_INPUT", `cannot read store records: ${error.message}`, { cause: error }); }
}

function assertBinding(cohort, decision, linearAttestation) {
  const code = "E_REASONING_ARTIFACT_BINDING";

  if (cohort.cohort_id !== decision.cohort_id) {
    throw new ReasoningContractError(code, "cohort and decision disagree on cohort_id");
  }
  if (cohort.linear_attestation_id !== decision.linear_attestation_id) {
    throw new ReasoningContractError(code, "cohort and decision disagree on linear_attestation_id");
  }
  if (cohort.linear_attestation_sha256 !== decision.linear_attestation_sha256) {
    throw new ReasoningContractError(code, "cohort and decision disagree on linear_attestation_sha256");
  }
  if (cohort.cohort_basis !== decision.cohort_basis) {
    throw new ReasoningContractError(code, "cohort and decision disagree on cohort_basis");
  }

  if (cohort.linear_attestation_id !== null) {
    if (cohort.linear_attestation_id !== linearAttestation.attestation_id) {
      throw new ReasoningContractError(code, "cohort linear_attestation_id does not match the supplied attestation");
    }
    const computedHash = createHash("sha256").update(canonicalBytes(linearAttestation)).digest("hex");
    if (cohort.linear_attestation_sha256 !== computedHash) {
      throw new ReasoningContractError(code, "cohort linear_attestation_sha256 does not match canonical hash of supplied attestation");
    }
  }
}

export function createReasoningCli({ publicationRoot = defaultPublicationRoot } = {}) {
  const declaredRoot = resolve(publicationRoot);
  return {
    main(argv) {
      const paths = parseArguments(argv);
      const outputRoot = resolve(paths["output-root"]);
      if (outputRoot !== declaredRoot) throw new ReasoningContractError("E_PUBLICATION_PATH", "publication must use the declared output root");
      const artifacts = {
        decision: validateDecision(readJson(paths.decision)),
        cohort: validateCohort(readJson(paths.cohort)),
        factCards: readJson(paths["fact-cards"]),
        linearAttestation: validateLinearAttestation(readJson(paths["linear-attestation"])),
        evidenceLog: validateEvidenceLog(readJson(paths["evidence-log"])),
      };
      const store = readRecords(paths.store);
      if (store.sha256 !== artifacts.cohort.store_records_sha256) {
        throw new ReasoningContractError("E_STORE_SHA256", "store SHA-256 does not match the cohort pin");
      }
      validateFactCards(artifacts.factCards, { cohort: artifacts.cohort, records: store.records });
      assertBinding(artifacts.cohort, artifacts.decision, artifacts.linearAttestation);
      return publishArtifacts(artifacts, outputRoot);
    },
  };
}

export function main(argv) {
  return createReasoningCli().main(argv);
}

if (resolve(process.argv[1] ?? "") === resolve(filePath)) {
  try {
    const destination = main(process.argv.slice(2));
    process.stdout.write(`Published reasoning artifacts: ${destination}\n`);
  } catch (error) {
    const code = error instanceof ReasoningContractError ? error.code : "E_PUBLICATION_WRITE";
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
