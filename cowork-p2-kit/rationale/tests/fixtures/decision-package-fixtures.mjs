import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCohortEvidence } from "../../../reasoning/cohort-evidence.mjs";
import { evaluateSelection } from "../../../reasoning/decision-engine.mjs";
import { createReasoningCli } from "../../../reasoning/cli.mjs";
import { canonicalBytes } from "../../../reasoning/publication.mjs";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(fixtureDir, "../../../..");
const storePath = resolve(projectRoot, "cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl");
const rubricPath = resolve(projectRoot, "cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json");
const rubricPinPath = resolve(projectRoot, "cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-pin.json");
const attestationPath = resolve(projectRoot, "cowork-p2-kit/reasoning/tests/fixtures/contract/step-2-linear-attestation.json");
const attestationPinPath = resolve(projectRoot, "cowork-p2-kit/reasoning/tests/fixtures/contract/step-2-linear-attestation-pin.json");

export const SOURCE_STORE_SHA256 = "6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56";

const candidateMap = {
  "inputs/trials/formulation-trial-01.docx": "F-01",
  "inputs/trials/formulation-trial-02.docx": "F-02",
  "inputs/trials/formulation-trial-03.docx": "F-03",
};
const candidateProfiles = {
  "F-01": { api: "bisoprolol fumarate", strength: "5 mg", dosage_form: "film-coated tablet", product_target: "immediate release", trial_context: "comparative trial" },
  "F-02": { api: "bisoprolol fumarate", strength: "5 mg", dosage_form: "film-coated tablet", product_target: "immediate release", trial_context: "comparative trial" },
  "F-03": { api: "bisoprolol fumarate", strength: "10 mg", dosage_form: "film-coated tablet", product_target: "immediate release", trial_context: "comparative trial" },
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function readStore() {
  const bytes = readFileSync(storePath);
  const store = { bytes, records: bytes.toString("utf8").trim().split("\n").map((line) => JSON.parse(line)), sha256: sha256(bytes) };
  if (store.sha256 !== SOURCE_STORE_SHA256) throw new Error("source store no longer matches its pinned SHA-256");
  return store;
}

function resultRecord(records, candidate) {
  const file = Object.entries(candidateMap).find(([, mapped]) => mapped === candidate)?.[0];
  return records.find((record) => record.provenance.file === file && record.content.includes("Dissolution mean") && record.content.includes("Assay (HPLC)"));
}

function metricCard(record, candidate, metric) {
  const patterns = { release_30m: /Dissolution mean\s+-\s+(\d+(?:\.\d+)?)%/, assay: /Assay \(HPLC\).*?(\d+(?:\.\d+)?)%/s };
  const match = record?.content.match(patterns[metric]);
  if (!match) throw new Error(`missing ${metric} result for ${candidate}`);
  const value = Number(match[1]);
  return {
    id: `FC-${candidate.replace("-", "")}-${metric}`, record_id: record.id, candidate, measure: metric,
    raw_text: `${value} %`, normalized_value: value, unit: "%", quote: record.content,
    char_start: 0, char_end: record.content.length, provenance: { file: record.provenance.file },
  };
}

function buildArtifacts({ store, cohortId, rubricPin, attestation = null, attestationPin = null }) {
  const initial = buildCohortEvidence({ records: store.records, candidateMap, candidateProfiles, rankingCandidates: ["F-01", "F-02", "F-03"], cohortId, storeRecordsSha256: store.sha256, linearAttestation: attestation, linearAttestationPin: attestationPin });
  const factCards = {
    schema_version: 1,
    cards: initial.cohort.candidates.flatMap((candidate) => {
      const record = resultRecord(store.records, candidate);
      return [metricCard(record, candidate, "release_30m"), metricCard(record, candidate, "assay")];
    }),
  };
  const { cohort, evidenceLog } = buildCohortEvidence({ records: store.records, candidateMap, candidateProfiles, rankingCandidates: ["F-01", "F-02", "F-03"], cohortId, storeRecordsSha256: store.sha256, factCards, linearAttestation: attestation, linearAttestationPin: attestationPin });
  const result = evaluateSelection({
    cohort, evidenceLog, factCards, rubric: readJson(rubricPath), rubricPin,
    recordRoles: Object.fromEntries(evidenceLog.entries.map((entry) => [entry.record_id, entry.quote.startsWith("Results\n") ? "results" : "context"])),
    decisionId: `decision-${cohortId}`,
  });
  return { cohort, evidenceLog, factCards, ...result, attestation };
}

function publishBranch({ outputRoot, branch, runId, artifacts, store }) {
  const inputRoot = mkdtempSync(join(tmpdir(), `rationale-${branch}-inputs-`));
  try {
    const paths = {};
    for (const [key, value] of Object.entries(artifacts)) {
      if (!["cohort", "evidenceLog", "factCards", "decision", "evaluation"].includes(key)) continue;
      paths[key] = join(inputRoot, `${key}.json`);
      writeFileSync(paths[key], canonicalBytes(value));
    }
    paths.store = join(inputRoot, "records.jsonl");
    writeFileSync(paths.store, store.bytes);
    if (artifacts.attestation !== null) {
      paths.attestation = join(inputRoot, "linear-attestation.json");
      writeFileSync(paths.attestation, canonicalBytes(artifacts.attestation));
    }
    const root = resolve(outputRoot, branch);
    mkdirSync(root, { recursive: true });
    const argv = ["publish-package", "--decision", paths.decision, "--evaluation", paths.evaluation, "--cohort", paths.cohort, "--fact-cards", paths.factCards, "--evidence-log", paths.evidenceLog, "--store", paths.store, "--run-id", runId, "--output-root", root];
    if (paths.attestation) argv.push("--linear-attestation", paths.attestation);
    createReasoningCli({ publicationRoot: root }).main(argv);
    return sha256(readFileSync(join(root, "publication-receipt.json")));
  } finally {
    rmSync(inputRoot, { recursive: true, force: true });
  }
}

export function buildDecisionPackages({ outputRoot }) {
  const store = readStore();
  const selectedPin = readJson(rubricPinPath).selection_rubric_sha256;
  const attestation = readJson(attestationPath);
  const attestationPin = readJson(attestationPinPath).linear_attestation_sha256;
  const packages = {
    selected: buildArtifacts({ store, cohortId: "rationale-selected", rubricPin: selectedPin }),
    inconclusive: buildArtifacts({ store, cohortId: "rationale-inconclusive", rubricPin: null }),
    attested: buildArtifacts({ store, cohortId: "rationale-attested", rubricPin: selectedPin, attestation, attestationPin }),
  };
  const receipt_sha256 = Object.fromEntries(Object.entries(packages).map(([branch, artifacts]) => [branch, publishBranch({ outputRoot, branch, runId: `rationale-${branch}`, artifacts, store })]));
  return { store_sha256: store.sha256, receipt_sha256 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputRoot = resolve(fixtureDir, "decision-package");
  process.stdout.write(`${JSON.stringify(buildDecisionPackages({ outputRoot }), null, 2)}\n`);
}
