import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildCohortEvidence } from "../cohort-evidence.mjs";
import { evaluateSelection } from "../decision-engine.mjs";
import { assertRegeneratedMarkdown } from "../markdown.mjs";
import { createReasoningCli } from "../cli.mjs";
import { canonicalBytes, validatePublishedDecisionPackage } from "../publication.mjs";
import { validateSuiteEvidence } from "./verify-reasoning-evidence.mjs";
import { GATE_MAP, runSuite } from "./verify-reasoning.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const storePath = resolve(testDir, "fixtures/store/records.jsonl");
const internalStorePath = resolve(testDir, "fixtures/store/selected-internal-package.jsonl");
const negativesStorePath = resolve(testDir, "fixtures/store/extraction-quality-negatives.jsonl");
const attestationPath = resolve(testDir, "fixtures/contract/step-2-linear-attestation.json");
const attestationPinPath = resolve(testDir, "fixtures/contract/step-2-linear-attestation-pin.json");
const rubricPath = resolve(testDir, "fixtures/rubric/selection-rubric-test-approved.v2.json");
const rubricPinPath = resolve(testDir, "fixtures/rubric/selection-rubric-test-pin.json");
const decisionRoot = resolve(repoRoot, "docs/reports/qbd-p4-reasoning-layer/decision");
const gateEvidencePath = resolve(repoRoot, "docs/reports/qbd-p4-reasoning-layer/gates/G-P4-01.json");
const BASELINE_STORE_SHA256 = "6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56";
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
const packageMembers = ["cohort.json", "fact-cards.json", "evidence-log.json", "formula-decision.json", "selection-evaluation.json", "formula-decision.md", "evidence-log.md", "publication-receipt.json", "linear-attestation.json"];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readStore(path) {
  const bytes = readFileSync(path);
  return { bytes, records: bytes.toString("utf8").trim().split("\n").map((line) => JSON.parse(line)), sha256: sha256(bytes) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, code, error?.stack ?? String(error));
    return true;
  });
}

function resultRecord(records, candidate) {
  const file = Object.entries(candidateMap).find(([, mapped]) => mapped === candidate)?.[0];
  const record = records.find((entry) => entry.provenance.file === file && entry.content.includes("Dissolution mean") && entry.content.includes("Assay (HPLC)"));
  assert.ok(record, `missing results record for ${candidate}`);
  return record;
}

function metricCard(record, candidate, metric) {
  const patterns = {
    release_30m: /Dissolution mean\s+-\s+(\d+(?:\.\d+)?)%/,
    assay: /Assay \(HPLC\).*?(\d+(?:\.\d+)?)%/s,
  };
  const match = record.content.match(patterns[metric]);
  assert.ok(match, `missing ${metric} value for ${candidate}`);
  const value = Number(match[1]);
  return {
    id: `FC-${candidate.replace("-", "")}-${metric}`,
    record_id: record.id,
    candidate,
    measure: metric,
    raw_text: `${value} %`,
    normalized_value: value,
    unit: "%",
    quote: record.content,
    char_start: 0,
    char_end: record.content.length,
    provenance: { file: record.provenance.file },
  };
}

function buildDecisionArtifacts({ store, attestation = null, attestationPin = null, cohortId }) {
  const initial = buildCohortEvidence({
    records: store.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: ["F-01", "F-02", "F-03"],
    cohortId,
    storeRecordsSha256: store.sha256,
    linearAttestation: attestation,
    linearAttestationPin: attestationPin,
  });
  const factCards = {
    schema_version: 1,
    cards: initial.cohort.candidates.flatMap((candidate) => {
      const record = resultRecord(store.records, candidate);
      return [metricCard(record, candidate, "release_30m"), metricCard(record, candidate, "assay")];
    }),
  };
  const { cohort, evidenceLog } = buildCohortEvidence({
    records: store.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: ["F-01", "F-02", "F-03"],
    cohortId,
    storeRecordsSha256: store.sha256,
    factCards,
    linearAttestation: attestation,
    linearAttestationPin: attestationPin,
  });
  const result = evaluateSelection({
    cohort,
    evidenceLog,
    factCards,
    rubric: readJson(rubricPath),
    rubricPin: readJson(rubricPinPath).selection_rubric_sha256,
    recordRoles: Object.fromEntries(evidenceLog.entries.map((entry) => [entry.record_id, entry.quote.startsWith("Results\n") ? "results" : "context"])),
    decisionId: `decision-${cohortId}`,
  });
  return { cohort, evidenceLog, factCards, ...result };
}

function writeInputs(temp, artifacts, store, attestation = null) {
  const paths = {};
  for (const [key, value] of Object.entries(artifacts)) {
    if (!["cohort", "evidenceLog", "factCards", "decision", "evaluation"].includes(key)) continue;
    const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    paths[key] = join(temp, `${name}.json`);
    writeFileSync(paths[key], canonicalBytes(value));
  }
  paths.store = join(temp, "records.jsonl");
  writeFileSync(paths.store, store.bytes);
  if (attestation !== null) {
    paths.attestation = join(temp, "linear-attestation.json");
    writeFileSync(paths.attestation, canonicalBytes(attestation));
  }
  return paths;
}

function publishAtDecisionRoot(temp, artifacts, store, attestation = null) {
  const paths = writeInputs(temp, artifacts, store, attestation);
  const args = [
    "publish-package", "--decision", paths.decision, "--evaluation", paths.evaluation,
    "--cohort", paths.cohort, "--fact-cards", paths.factCards, "--evidence-log", paths.evidenceLog,
    "--store", paths.store, "--run-id", "g-p4-05-e2e", "--output-root", decisionRoot,
  ];
  if (paths.attestation) args.push("--linear-attestation", paths.attestation);
  assert.equal(createReasoningCli({ publicationRoot: decisionRoot }).main(args), decisionRoot);
}

function withEmptyDecisionRoot(action) {
  const keepPath = join(decisionRoot, ".gitkeep");
  assert.deepEqual(readdirSync(decisionRoot).sort(), [".gitkeep"], "G-P4-05 may only manage the empty, git-retained decision root");
  const keepBytes = readFileSync(keepPath);
  rmSync(keepPath);
  try {
    action();
  } finally {
    for (const name of packageMembers) rmSync(join(decisionRoot, name), { force: true });
    writeFileSync(keepPath, keepBytes);
  }
}

function canonicalEvidence(gateId, suiteRunId) {
  return {
    gate_id: gateId,
    status: "pass",
    command: [process.execPath, "--test", "fixture.test.mjs"],
    exit_code: 0,
    raw_tap_output: "# tests 1\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\n# cancelled 0\n",
    raw_stderr: "",
    timestamp: "2026-07-28T00:00:00.000Z",
    run_id: "11111111-1111-4111-8111-111111111111",
    suite_run_id: suiteRunId,
    assertions_summary: { total: 1, passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 0 },
    timeout_ms: 300000,
    duration_ms: 1,
    timed_out: false,
    signal: null,
    store_records_sha256: BASELINE_STORE_SHA256,
  };
}

test("G-P4-05 evidence validator rejects missing, non-pass, noncanonical, and mismatched-suite evidence", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-suite-evidence-"));
  try {
    const suiteRunId = "00000000-0000-4000-8000-000000000000";
    for (const gateId of ["G-P4-01", "G-P4-02", "G-P4-03", "G-P4-04", "G-P4-05"]) {
      writeFileSync(join(temp, `${gateId}.json`), canonicalBytes(canonicalEvidence(gateId, suiteRunId)));
    }
    assert.deepEqual(validateSuiteEvidence({ gatesDir: temp, suiteRunId }), []);
    writeFileSync(join(temp, "G-P4-05.json"), canonicalBytes({ ...canonicalEvidence("G-P4-05", suiteRunId), store_records_sha256: "a".repeat(64) }));
    assert.match(validateSuiteEvidence({ gatesDir: temp, suiteRunId }).join("\n"), /does not match the committed Step 0 store snapshot/);
    writeFileSync(join(temp, "G-P4-05.json"), canonicalBytes(canonicalEvidence("G-P4-05", suiteRunId)));
    rmSync(join(temp, "G-P4-05.json"));
    assert.match(validateSuiteEvidence({ gatesDir: temp, suiteRunId }).join("\n"), /missing evidence file: G-P4-05\.json/);
    writeFileSync(join(temp, "G-P4-05.json"), canonicalBytes({ ...canonicalEvidence("G-P4-05", suiteRunId), status: "fail" }));
    assert.match(validateSuiteEvidence({ gatesDir: temp, suiteRunId }).join("\n"), /status is fail/);
    writeFileSync(join(temp, "G-P4-05.json"), canonicalBytes({ ...canonicalEvidence("G-P4-05", suiteRunId), surplus: true }));
    assert.match(validateSuiteEvidence({ gatesDir: temp, suiteRunId }).join("\n"), /canonical schema/);
    writeFileSync(join(temp, "G-P4-05.json"), canonicalBytes({ ...canonicalEvidence("G-P4-05", suiteRunId), timestamp: 7, assertions_summary: { total: -1, passed: 99, failed: -4, skipped: 0, todo: 0, cancelled: 0 } }));
    assert.match(validateSuiteEvidence({ gatesDir: temp, suiteRunId }).join("\n"), /timestamp is invalid/);
    writeFileSync(join(temp, "G-P4-05.json"), canonicalBytes(canonicalEvidence("G-P4-05", "00000000-0000-4000-8000-000000000001")));
    assert.match(validateSuiteEvidence({ gatesDir: temp, suiteRunId }).join("\n"), /does not match suite UUID/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("G-P4-05 runner preserves declared order, one suite UUID, and first-failure short circuit", () => {
  assert.deepEqual(GATE_MAP.map(([gateId]) => gateId), ["G-P4-01", "G-P4-02", "G-P4-03", "G-P4-04", "G-P4-05"]);
  const calls = [];
  const gateMap = GATE_MAP.slice(0, 3).map(([gateId]) => [gateId, "cowork-p2-kit/reasoning/tests/e2e-decision.test.mjs"]);
  const common = { gateMap, root: repoRoot, suiteRunId: "00000000-0000-4000-8000-000000000002", writeStdout: () => {}, writeStderr: () => {} };
  assert.equal(runSuite({
    ...common,
    spawn: (_command, args, options) => {
      calls.push({ gateId: args[1], suiteRunId: options.env.REASONING_SUITE_RUN_ID });
      return { status: args[1] === "G-P4-02" ? 1 : 0, stdout: "", stderr: "" };
    },
    validateEvidence: () => { throw new Error("post-validation must not run after a gate failure"); },
  }), 1);
  assert.deepEqual(calls.map(({ gateId }) => gateId), ["G-P4-01", "G-P4-02"]);
  assert.deepEqual(calls.map(({ suiteRunId }) => suiteRunId), [common.suiteRunId, common.suiteRunId]);
  assert.equal(runSuite({ ...common, spawn: () => ({ status: 0, stdout: "", stderr: "" }), validateEvidence: ({ suiteRunId }) => suiteRunId === common.suiteRunId ? [] : ["suite ID was not propagated"] }), 0);
});

test("G-P4-05 publishes then revalidates the committed-store package at the declared decision root", () => {
  const store = readStore(storePath);
  const attestation = readJson(attestationPath);
  const attestationPin = readJson(attestationPinPath).linear_attestation_sha256;
  assert.equal(store.sha256, BASELINE_STORE_SHA256);
  assert.equal(readJson(gateEvidencePath).store_records_sha256, BASELINE_STORE_SHA256);

  withEmptyDecisionRoot(() => {
    const temp = mkdtempSync(join(tmpdir(), "reasoning-e2e-decision-"));
    try {
      const nonAttested = buildDecisionArtifacts({ store, cohortId: "e2e-5mg" });
      assert.deepEqual(nonAttested.cohort.candidates, ["F-01", "F-02"]);
      assert.ok(nonAttested.evidenceLog.exclusions.some((entry) => entry.candidate === "F-03" && entry.reason === "E_COHORT_STRENGTH_MISMATCH"));
      assert.equal(nonAttested.decision.winner, "F-01");
      publishAtDecisionRoot(temp, nonAttested, store);
      assert.doesNotThrow(() => validatePublishedDecisionPackage(decisionRoot, { store: { bytes: store.bytes } }));

      const attested = buildDecisionArtifacts({ store, attestation, attestationPin, cohortId: "e2e-attested" });
      assert.deepEqual(attested.cohort.candidates, ["F-01", "F-02", "F-03"]);
      assert.equal(attested.decision.linear_attestation_id, attestation.attestation_id);
      assert.equal(attested.decision.linear_attestation_sha256, attestationPin);
      publishAtDecisionRoot(temp, attested, store, attestation);
      assert.doesNotThrow(() => validatePublishedDecisionPackage(decisionRoot, { store: { bytes: store.bytes } }));
      assert.doesNotThrow(() => assertRegeneratedMarkdown(decisionRoot));
      const markdown = readFileSync(join(decisionRoot, "formula-decision.md"), "utf8");
      assert.match(markdown, new RegExp(attestation.attestation_id));
      assert.match(markdown, new RegExp(attestationPin));

      const decisionPath = join(decisionRoot, "formula-decision.json");
      writeFileSync(decisionPath, `${readFileSync(decisionPath, "utf8")} `);
      expectCode(() => validatePublishedDecisionPackage(decisionRoot, { store: { bytes: store.bytes } }), "E_PUBLICATION_RECEIPT");
      publishAtDecisionRoot(temp, attested, store, attestation);
      rmSync(join(decisionRoot, "publication-receipt.json"));
      expectCode(() => validatePublishedDecisionPackage(decisionRoot, { store: { bytes: store.bytes } }), "E_PUBLICATION_MISSING_FILE");
      publishAtDecisionRoot(temp, attested, store, attestation);
      rmSync(join(decisionRoot, "linear-attestation.json"));
      expectCode(() => validatePublishedDecisionPackage(decisionRoot, { store: { bytes: store.bytes } }), "E_PUBLICATION_RECEIPT");
      publishAtDecisionRoot(temp, attested, store, attestation);
      writeFileSync(join(decisionRoot, "execution-report.md"), "untrusted, non-package content\n");
      expectCode(() => validatePublishedDecisionPackage(decisionRoot, { store: { bytes: store.bytes } }), "E_PUBLICATION_SURPLUS_FILE");
      rmSync(join(decisionRoot, "execution-report.md"));
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

test("G-P4-05 admits selected internal records but retains candidate, quote, and extraction controls", () => {
  const selectedStore = readStore(internalStorePath);
  const selected = buildCohortEvidence({
    records: selectedStore.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: ["F-01", "F-02", "F-03"],
    cohortId: "e2e-selected-internal",
    storeRecordsSha256: selectedStore.sha256,
  });
  for (const id of ["synthetic-label-internal", "synthetic-label-internal-derived", "synthetic-not-citable"]) {
    assert.ok(selected.evidenceLog.entries.some((entry) => entry.record_id === id), `${id} must remain admitted`);
  }
  const negativesStore = readStore(negativesStorePath);
  const negatives = buildCohortEvidence({
    records: negativesStore.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: ["F-01", "F-02", "F-03"],
    cohortId: "e2e-extraction-controls",
    storeRecordsSha256: negativesStore.sha256,
  });
  assert.ok(negatives.evidenceLog.exclusions.some((entry) => entry.reason === "E_EVIDENCE_LOW_CONFIDENCE"));
  assert.ok(negatives.evidenceLog.exclusions.some((entry) => entry.reason === "E_EVIDENCE_NEEDS_OCR"));
});
