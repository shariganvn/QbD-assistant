// Throwaway end-to-end spike runner.
//
// Goal: wire the five existing stages (template-probe -> ingest -> reasoning ->
// rationale -> render) into ONE run so a template + filled DOCX produce one
// internal DOCX under a temp root, without touching canonical state.
//
// This is a visibility spike, not a hardened acceptance suite. It observes and
// reports (mapping count, decision, DOCX path); it does not assert 3/2/0,
// prove two-run determinism, run forge negatives, or sandbox render. Those
// belong to plans/260805-1335-template-to-docx-end-to-end-trial/.
//
// If a stage genuinely blocks the chain, print the exact stage + error and stop.

import { createHash } from "node:crypto";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { compileTemplateFieldMap } from "../template-probe/template-field-map.mjs";
import {
  extractTemplateCellReceipt,
  MVP_FIELD_IDS,
  selectTemplateFieldMap,
} from "../template-probe/template-record-extractor.mjs";
import {
  writeCanonicalJsonAtomic,
} from "../template-probe/template-field-contract.mjs";
import { createConfig } from "../ingest/config.mjs";
import { runIngest } from "../ingest/pipeline.mjs";
import { buildCohortEvidence } from "../reasoning/cohort-evidence.mjs";
import { evaluateSelection } from "../reasoning/decision-engine.mjs";
import { createReasoningCli } from "../reasoning/cli.mjs";
import { canonicalBytes as canonicalReasoningBytes } from "../reasoning/publication.mjs";
import { createRationaleCli } from "../rationale/cli.mjs";
import { validateRationale } from "../rationale/claim-binding.mjs";
import {
  canonicalBytes as canonicalRationaleBytes,
  sha256 as rationaleSha256,
} from "../rationale/rationale-contracts.mjs";
import { buildDocumentBuffer } from "../render/document-builder.mjs";
import { validateDraft } from "../render/contract.mjs";
import { publishBuffer } from "../render/publication.mjs";

const kitRoot = resolve(import.meta.dirname, "..");
const templatePath = resolve(
  kitRoot,
  "inputs/reference/official-placeholder-template-v3-040826.docx",
);
const mockPath = resolve(
  kitRoot,
  "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx",
);
const mockName = "filled-public-mock-document-030826.docx";
const rubricPath = resolve(
  kitRoot,
  "reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json",
);

// Canonical roots that must stay byte-identical across the run.
const canonicalRoots = {
  inputs: resolve(kitRoot, "inputs"),
  store: resolve(kitRoot, "store"),
  outputs: resolve(kitRoot, "outputs"),
};

function copyRunSources(root) {
  const sourceRoot = join(root, "source");
  mkdirSync(sourceRoot, { recursive: true });
  const sources = {
    template: join(sourceRoot, "official-placeholder-template-v3-040826.docx"),
    mock: join(sourceRoot, mockName),
    rubric: join(sourceRoot, "selection-rubric-test-approved.v2.json"),
  };
  cpSync(templatePath, sources.template);
  cpSync(mockPath, sources.mock);
  cpSync(rubricPath, sources.rubric);
  return sources;
}

function log(stage, message, extra) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[spike:${stage}] ${message}${suffix}`);
}

function hashTree(root) {
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Canonical root must be a real directory: ${root}`);
  }
  const entries = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const stat = lstatSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) {
        entries.push(
          `${path.slice(root.length + 1)}:${createHash("sha256").update(readFileSync(path)).digest("hex")}`,
        );
      } else throw new Error(`Unsupported canonical-root entry: ${path}`);
    }
  }
  walk(root);
  return entries.sort().join("\n");
}

function snapshotCanonical() {
  const snap = {};
  for (const [name, root] of Object.entries(canonicalRoots)) snap[name] = hashTree(root);
  return snap;
}

function assertCanonicalUnchanged(before, label) {
  const after = snapshotCanonical();
  for (const name of Object.keys(canonicalRoots)) {
    if (before[name] !== after[name]) {
      throw new Error(`Canonical root "${name}" changed after ${label}`);
    }
  }
  log("guard", `canonical inputs/store/outputs unchanged after ${label}`);
}

// --- Stage 1: template-probe (field map + receipt from the same two sources) ---
async function runTemplateStage(root, sources) {
  const fullMap = await compileTemplateFieldMap(sources.template);
  const selectedMap = selectTemplateFieldMap(fullMap);
  const selectedMapPath = join(root, "template-probe", "template-field-map.selected.v1.json");
  writeCanonicalJsonAtomic(selectedMap, selectedMapPath, "E_SELECTED_MAP_WRITE");
  const receiptPath = join(root, "template-probe", "template-cell-receipt.v1.json");
  const receipt = await extractTemplateCellReceipt(selectedMap, sources.mock, {
    ownerFieldMap: fullMap,
    templateSourcePath: sources.template,
    outputPath: receiptPath,
  });
  const mapped = receipt.entries.filter((e) => e.cell_round_trip?.status === "pass").length;
  log("template", `receipt built: ${receipt.occurrence_count} occurrences, ${mapped} round-trip pass`, {
    fields: MVP_FIELD_IDS,
    record_projection: receipt.record_projection?.status,
  });
  return { selectedMap, receipt };
}

// --- Stage 2: ingest (records + store from the copied filled DOCX) ---
function runIngestStage(root, sources) {
  // inputs/ and store/ sit directly under the run root (= kitDir) so the ingest
  // manifest key resolves to "inputs/trials/<name>", matching admitInputs.
  const inputsRoot = join(root, "inputs");
  const storeRoot = join(root, "store");
  mkdirSync(join(inputsRoot, "trials"), { recursive: true });
  mkdirSync(join(inputsRoot, "reference"), { recursive: true });
  mkdirSync(storeRoot, { recursive: true });

  // Copy the filled mock into an isolated trials/ dir (fresh bytes, no links).
  cpSync(sources.mock, join(inputsRoot, "trials", mockName));
  // Copy the record schema the ingest store needs.
  cpSync(resolve(canonicalRoots.store, "records.schema.json"), join(storeRoot, "records.schema.json"));
  // Minimal classification manifest: the mock is public but non-citable.
  writeFileSync(
    join(inputsRoot, "classification-manifest.json"),
    JSON.stringify(
      { [`inputs/trials/${mockName}`]: { label: "public", citable: false, ocr_language: "vie" } },
      null,
      2,
    ),
  );

  const result = runIngest(createConfig({ kitDir: root, inputsRoot, storeRoot }));
  log("ingest", `records produced: ${result.records.length}`, {
    storeHash: result.storeHash?.slice(0, 12),
    capabilities: result.capabilities,
  });
  return result;
}

function createTruthfulFactCard({ records, evidenceLog, candidate, sourceFile }) {
  const admitted = new Set(evidenceLog.entries.map((entry) => entry.record_id));
  const numberAndUnit = /(?<![\d.,])(\d+)\s*(%|mcg|mg|kg|µg|mL|sec|min|g|L|N|°C)(?![A-Za-z])/g;
  for (const record of records) {
    if (!admitted.has(record.id) || record.provenance?.file !== sourceFile || typeof record.content !== "string") continue;
    for (const match of record.content.matchAll(numberAndUnit)) {
      const normalizedValue = Number(match[1]);
      if (!Number.isFinite(normalizedValue)) continue;
      return {
        id: "FC-SPIKE-CONTEXT-001",
        record_id: record.id,
        candidate,
        measure: "spike_context",
        raw_text: match[0],
        normalized_value: normalizedValue,
        unit: match[2],
        quote: record.content,
        char_start: 0,
        char_end: record.content.length,
        provenance: { file: sourceFile },
      };
    }
  }
  throw new Error("No admitted record contains a truthful integer number-and-unit span for the required fact card");
}

function writeReasoningInputs(root, artifacts) {
  const inputRoot = join(root, "reasoning-inputs");
  mkdirSync(inputRoot, { recursive: true });
  const paths = {};
  for (const [name, artifact] of Object.entries(artifacts)) {
    const path = join(inputRoot, `${name}.json`);
    writeFileSync(path, canonicalReasoningBytes(artifact));
    paths[name] = path;
  }
  return paths;
}

// --- Stage 3: reasoning (candidate-bound evidence, deliberate early exit) ---
function runReasoningStage(root, ingest, sources) {
  const sourceFile = ingest.records.find((record) => typeof record.provenance?.file === "string")?.provenance.file;
  if (!sourceFile) throw new Error("Ingest returned no record provenance file for the spike candidate map");

  const candidate = "spike-candidate";
  const candidateMap = { [sourceFile]: candidate };
  const candidateProfiles = {
    [candidate]: {
      api: "SYNTHETIC-api",
      strength: "SYNTHETIC-strength",
      dosage_form: "SYNTHETIC-dosage-form",
      product_target: "SYNTHETIC-product-target",
      trial_context: "SYNTHETIC-trial-context",
    },
  };
  const common = {
    records: ingest.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: [candidate],
    cohortId: "spike-template-docx-cohort",
    storeRecordsSha256: ingest.storeHash,
  };
  const initial = buildCohortEvidence(common);
  const factCards = {
    schema_version: 1,
    cards: [createTruthfulFactCard({
      records: ingest.records,
      evidenceLog: initial.evidenceLog,
      candidate,
      sourceFile,
    })],
  };
  const { cohort, evidenceLog } = buildCohortEvidence({ ...common, factCards });

  // Use the committed test-approved rubric without its pin. This exits before
  // matrix/scoring while retaining a causal-evidence path that rationale seals.
  const rubric = JSON.parse(readFileSync(sources.rubric, "utf8"));
  const result = evaluateSelection({
    cohort,
    evidenceLog,
    factCards,
    rubric,
    rubricPin: null,
    recordRoles: Object.fromEntries(evidenceLog.entries.map((entry) => [entry.record_id, "context"])),
    decisionId: "spike-template-docx-decision",
  });
  if (result.decision.status !== "inconclusive" || result.decision.fd_action !== "E_RUBRIC_PIN_REQUIRED") {
    throw new Error(`Spike must stop inconclusive before scoring, received ${result.decision.status}/${result.decision.fd_action}`);
  }

  const artifactPaths = writeReasoningInputs(root, {
    cohort,
    "fact-cards": factCards,
    "evidence-log": evidenceLog,
    decision: result.decision,
    evaluation: result.evaluation,
  });
  const packageRoot = join(root, "reasoning-package");
  const storePath = join(root, "store", "records.jsonl");
  createReasoningCli({ publicationRoot: packageRoot }).main([
    "publish-package",
    "--decision", artifactPaths.decision,
    "--evaluation", artifactPaths.evaluation,
    "--cohort", artifactPaths.cohort,
    "--fact-cards", artifactPaths["fact-cards"],
    "--evidence-log", artifactPaths["evidence-log"],
    "--store", storePath,
    "--run-id", "spike-template-docx",
    "--output-root", packageRoot,
  ]);

  log("reasoning", `decision: ${result.decision.status}/${result.decision.fd_action}`, {
    candidate,
    fact_card_id: factCards.cards[0].id,
    fact_card_record_id: factCards.cards[0].record_id,
  });
  return { packageRoot, storePath };
}

function createMinimalRationale(packet) {
  return validateRationale({
    schema_version: 1,
    rationale_id: "spike-template-docx-rationale",
    packet_id: packet.packet_id,
    packet_sha256: rationaleSha256(canonicalRationaleBytes(packet)),
    run_id: packet.run_id,
    decision_id: packet.decision.decision_id,
    decision_sha256: packet.evaluation.decision_sha256,
    cohort_id: packet.cohort.cohort_id,
    decision_status: packet.decision.status,
    winner: packet.decision.winner,
    fd_action: packet.decision.fd_action,
    display_state: "internal_only",
    claims: [{
      claim_id: "claim-01",
      kind: "decision_state",
      text: packet.decision.fd_action,
      cites: {
        decision_state_fields: ["fd_action"],
        causal_evidence_refs: packet.causal_evidence.refs,
      },
    }],
  }, packet);
}

// --- Stage 4: rationale (sealed packet, internal-only explanation) ---
function runRationaleStage(root, reasoning) {
  const packageRoot = join(root, "rationale-package");
  const cli = createRationaleCli({ publicationRoot: packageRoot });
  const packetPath = cli.main([
    "seal-packet",
    "--source-package", reasoning.packageRoot,
    "--store", reasoning.storePath,
    "--output-root", packageRoot,
  ]);
  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  const rationalePath = join(root, "rationale-input.json");
  writeFileSync(rationalePath, canonicalRationaleBytes(createMinimalRationale(packet)));
  cli.main([
    "publish-rationale",
    "--packet", packetPath,
    "--rationale", rationalePath,
    "--output-root", packageRoot,
  ]);
  log("rationale", "sealed and published internal-only rationale");
  return {
    packageRoot,
    rationale: JSON.parse(readFileSync(join(packageRoot, "rationale.json"), "utf8")),
  };
}

// --- Stage 5: render (internal DOCX with no citations) ---
async function runRenderStage(root, rationale) {
  const decisionClaim = rationale.claims.find((claim) => claim.kind === "decision_state");
  if (!decisionClaim || decisionClaim.text !== rationale.fd_action) {
    throw new Error("Published rationale has no packet-bound decision-state claim for render");
  }
  const draft = validateDraft({
    title: "Internal template DOCX spike",
    citations: [],
    blocks: [
      { type: "heading1", text: "Internal spike output" },
      { type: "chờ_dữ_liệu", text: decisionClaim.text },
    ],
  });
  const buffer = await buildDocumentBuffer(draft);
  const outputPath = publishBuffer(buffer, {
    outputRoot: join(root, "render-output"),
    createOutputRoot: true,
  });
  if (readFileSync(outputPath).length !== buffer.length) throw new Error("Published DOCX bytes do not match the rendered buffer");
  log("render", `internal DOCX: ${outputPath}`, { bytes: buffer.length, citations: draft.citations.length });
  return outputPath;
}

async function main() {
  const before = snapshotCanonical();
  const root = mkdtempSync(join(tmpdir(), "spike-e2e-"));
  log("setup", `run root: ${root}`);
  let ok = false;
  try {
    const sources = copyRunSources(root);
    const template = await runTemplateStage(root, sources);
    assertCanonicalUnchanged(before, "template stage");

    const ingest = runIngestStage(root, sources);
    assertCanonicalUnchanged(before, "ingest stage");

    log("upstream", "UPSTREAM COMPLETE — receipt + records ready", {
      occurrences: template.receipt.occurrence_count,
      records: ingest.records.length,
    });

    const reasoning = runReasoningStage(root, ingest, sources);
    assertCanonicalUnchanged(before, "reasoning stage");

    const rationale = runRationaleStage(root, reasoning);
    assertCanonicalUnchanged(before, "rationale stage");

    const outputPath = await runRenderStage(root, rationale.rationale);
    assertCanonicalUnchanged(before, "render stage");

    log("complete", `all five stages completed; internal DOCX path: ${outputPath}`);
    ok = true;
  } catch (error) {
    log("error", `stage failed: ${error?.code ?? ""} ${error?.message ?? error}`);
    log("error", `temp root retained for inspection: ${root}`);
    process.exitCode = 1;
    return;
  } finally {
    if (ok) log("cleanup", `temp root retained for inspection; remove manually when finished: ${root}`);
  }
}

await main();
