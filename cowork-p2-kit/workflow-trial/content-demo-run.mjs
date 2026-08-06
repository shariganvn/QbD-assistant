#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import JSZip from "jszip";

import { compileTemplateFieldMap } from "../template-probe/template-field-map.mjs";
import {
  extractTemplateCellReceipt,
  selectTemplateFieldMap,
} from "../template-probe/template-record-extractor.mjs";
import { writeCanonicalJsonAtomic } from "../template-probe/template-field-contract.mjs";
import { createConfig } from "../ingest/config.mjs";
import { runIngest } from "../ingest/pipeline.mjs";
import { buildCohortEvidence } from "../reasoning/cohort-evidence.mjs";
import { evaluateSelection } from "../reasoning/decision-engine.mjs";
import { createReasoningCli } from "../reasoning/cli.mjs";
import { canonicalBytes as canonicalReasoningBytes } from "../reasoning/publication.mjs";
import { createRationaleCli } from "../rationale/cli.mjs";
import { canonicalBytes as canonicalRationaleBytes } from "../rationale/rationale-contracts.mjs";
import { buildRationalePacket } from "../rationale/packet.mjs";
import { normalizeOoxml } from "../render/normalize-ooxml.mjs";
import {
  buildCitationEnvelopes,
  buildComparatorCards,
  buildComparatorRecords,
  buildDemoCandidateMap,
  buildDemoProfiles,
  buildExactReceiptJoin,
  buildRealCandidateCards,
  COMPARATOR_CANDIDATE,
  REAL_CANDIDATE,
  REAL_SOURCE_FILE,
  storeBytes,
} from "./demo-data-pack.mjs";
import { buildDemoRationale } from "./demo-rationale.mjs";
import { buildContentDraft } from "./rationale-to-content-draft.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const kitRoot = resolve(repoRoot, "cowork-p2-kit");
const templatePath = resolve(kitRoot, "inputs/reference/official-placeholder-template-v3-040826.docx");
const mockPath = resolve(kitRoot, "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx");
const rubricPath = resolve(kitRoot, "reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json");
const defaultArtifactParent = resolve(repoRoot, "artifacts/template-docx-content-demo");
const defaultReportRoot = resolve(repoRoot, "plans/260805-1815-template-docx-content-demo/reports");
const isolatedWrapper = resolve(kitRoot, "render/run-isolated-spike.mjs");
const mockName = "filled-public-mock-document-030826.docx";
const runId = "template-docx-content-demo";

const canonicalRoots = {
  inputs: resolve(kitRoot, "inputs"),
  store: resolve(kitRoot, "store"),
  outputs: resolve(kitRoot, "outputs"),
};

function fail(code, message) {
  const error = new Error("[" + code + "] " + message);
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertRealDirectory(path, label) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    fail("E_DEMO_PATH", label + " is not accessible: " + error.message);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail("E_DEMO_PATH", label + " must be a real directory");
}

function ensureSafeArtifactRoot(path) {
  const resolved = resolve(path);
  const relativeToArtifactParent = relative(defaultArtifactParent, resolved);
  if (!relativeToArtifactParent || relativeToArtifactParent.startsWith(".." + "/") || relativeToArtifactParent === "..") {
    fail("E_DEMO_PATH", "artifact root must stay below artifacts/template-docx-content-demo");
  }
  const relativeToRepo = relative(repoRoot, resolved);
  if (!relativeToRepo || relativeToRepo.startsWith(".." + "/") || relativeToRepo === "..") {
    fail("E_DEMO_PATH", "artifact root must stay below the repository artifact parent");
  }
  const segments = relativeToRepo.split("/");
  let current = repoRoot;
  for (const segment of segments) {
    current = join(current, segment);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) fail("E_DEMO_PATH", "artifact path cannot contain symlinks: " + current);
      if (!stat.isDirectory()) fail("E_DEMO_PATH", "artifact path must contain directories: " + current);
    } else {
      mkdirSync(current);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail("E_DEMO_PATH", "artifact path was not created as a real directory: " + current);
    }
  }
  return resolved;
}

function freshDefaultArtifactRoot() {
  const stamp = Date.now().toString(36);
  let suffix = 0;
  while (true) {
    const name = "run-" + stamp + (suffix === 0 ? "" : "-" + suffix);
    const candidate = join(defaultArtifactParent, name);
    if (!existsSync(candidate)) return candidate;
    suffix += 1;
  }
}

function hashTree(root) {
  assertRealDirectory(root, "canonical root");
  const entries = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const stat = lstatSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) entries.push(relative(root, path) + ":" + sha256(readFileSync(path)));
      else fail("E_DEMO_CANONICAL_ENTRY", "unsupported canonical-root entry: " + path);
    }
  }
  walk(root);
  return entries.sort().join("\n");
}

function snapshotCanonicalRoots() {
  return Object.fromEntries(Object.entries(canonicalRoots).map(([name, root]) => [name, hashTree(root)]));
}

function snapshotDirtyTrackedFiles() {
  const status = execFileSync("git", ["status", "--porcelain=v1"], { cwd: repoRoot, encoding: "utf8" });
  const snapshot = {};
  for (const line of status.split("\n").filter(Boolean)) {
    if (line.startsWith("??")) continue;
    const path = line.slice(3).trim();
    if (!path) continue;
    const absolute = resolve(repoRoot, path);
    snapshot[path] = existsSync(absolute) ? sha256(readFileSync(absolute)) : null;
  }
  return snapshot;
}

function assertUnchanged(before, after, label) {
  if (JSON.stringify(before) !== JSON.stringify(after)) fail("E_DEMO_MUTATION", label + " changed protected state");
}

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

async function runTemplateStage(root, sources) {
  const fullMap = await compileTemplateFieldMap(sources.template);
  const selectedMap = selectTemplateFieldMap(fullMap);
  const selectedMapPath = join(root, "template-probe/template-field-map.selected.v1.json");
  writeCanonicalJsonAtomic(selectedMap, selectedMapPath, "E_SELECTED_MAP_WRITE");
  const receiptPath = join(root, "template-probe/template-cell-receipt.v1.json");
  const receipt = await extractTemplateCellReceipt(selectedMap, sources.mock, {
    ownerFieldMap: fullMap,
    templateSourcePath: sources.template,
    outputPath: receiptPath,
  });
  return { selectedMap, receipt };
}

function runIngestStage(root, sources) {
  const inputsRoot = join(root, "inputs");
  const storeRoot = join(root, "store");
  mkdirSync(join(inputsRoot, "trials", "placeholder-probe"), { recursive: true });
  mkdirSync(join(inputsRoot, "reference"), { recursive: true });
  mkdirSync(storeRoot, { recursive: true });
  cpSync(sources.mock, join(inputsRoot, "trials", "placeholder-probe", mockName));
  cpSync(resolve(canonicalRoots.store, "records.schema.json"), join(storeRoot, "records.schema.json"));
  writeFileSync(join(inputsRoot, "classification-manifest.json"), JSON.stringify({
    ["inputs/trials/placeholder-probe/" + mockName]: { label: "public", citable: false, ocr_language: "vie" },
  }, null, 2) + "\n");
  return runIngest(createConfig({ kitDir: root, inputsRoot, storeRoot }));
}

function augmentStore(root, ingest) {
  const comparatorRecords = buildComparatorRecords();
  const records = [...ingest.records, ...comparatorRecords].sort((left, right) => left.id.localeCompare(right.id));
  const bytes = storeBytes(records);
  writeFileSync(join(root, "store/records.jsonl"), bytes);
  return { records, bytes, sha256: sha256(bytes), comparatorRecords };
}

function writeReasoningInputs(root, artifacts) {
  const inputRoot = join(root, "reasoning-inputs");
  mkdirSync(inputRoot, { recursive: true });
  const paths = {};
  for (const [name, artifact] of Object.entries(artifacts)) {
    const path = join(inputRoot, name + ".json");
    writeFileSync(path, canonicalReasoningBytes(artifact));
    paths[name] = path;
  }
  return paths;
}

function runReasoningStage(root, ingest, template) {
  const candidateMap = buildDemoCandidateMap();
  const candidateProfiles = buildDemoProfiles();
  const initial = buildCohortEvidence({
    records: ingest.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: [REAL_CANDIDATE, COMPARATOR_CANDIDATE],
    cohortId: "template-docx-content-demo-cohort",
    storeRecordsSha256: ingest.sha256,
  });
  const factCards = {
    schema_version: 1,
    cards: [
      ...buildRealCandidateCards({ records: ingest.records, evidenceLog: initial.evidenceLog }),
      ...buildComparatorCards({ records: ingest.records, evidenceLog: initial.evidenceLog }),
    ],
  };
  const { cohort, evidenceLog } = buildCohortEvidence({
    records: ingest.records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: [REAL_CANDIDATE, COMPARATOR_CANDIDATE],
    cohortId: "template-docx-content-demo-cohort",
    storeRecordsSha256: ingest.sha256,
    factCards,
  });
  const rubric = JSON.parse(readFileSync(rubricPath, "utf8"));
  const rubricPin = sha256(canonicalReasoningBytes(rubric));
  const result = evaluateSelection({
    cohort,
    evidenceLog,
    factCards,
    rubric,
    rubricPin,
    recordRoles: Object.fromEntries(evidenceLog.entries.map((entry) => [
      entry.record_id,
      factCards.cards.some((card) => card.record_id === entry.record_id) ? "results" : "context",
    ])),
    decisionId: "template-docx-content-demo-decision",
  });
  if (result.decision.status !== "selected") fail("E_DEMO_DECISION", "demo decision did not reach selected: " + result.decision.fd_action);
  const join = buildExactReceiptJoin({
    receipt: template.receipt,
    records: ingest.records,
    sourceFile: REAL_SOURCE_FILE,
    storeRecordsSha256: ingest.sha256,
  });
  const citations = buildCitationEnvelopes(join);
  const artifactPaths = writeReasoningInputs(root, {
    cohort,
    "fact-cards": factCards,
    "evidence-log": evidenceLog,
    decision: result.decision,
    evaluation: result.evaluation,
  });
  const packageRoot = joinPath(root, "reasoning-package");
  const storePath = joinPath(root, "store/records.jsonl");
  createReasoningCli({ publicationRoot: packageRoot }).main([
    "publish-package",
    "--decision", artifactPaths.decision,
    "--evaluation", artifactPaths.evaluation,
    "--cohort", artifactPaths.cohort,
    "--fact-cards", artifactPaths["fact-cards"],
    "--evidence-log", artifactPaths["evidence-log"],
    "--store", storePath,
    "--run-id", runId,
    "--output-root", packageRoot,
  ]);
  return {
    packageRoot,
    storePath,
    rubric,
    rubricPin,
    cohort,
    evidenceLog,
    factCards,
    decision: result.decision,
    evaluation: result.evaluation,
    join,
    citations,
  };
}

function joinPath(root, child) {
  return join(root, child);
}

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
  const rationale = buildDemoRationale(packet);
  const rationalePath = join(root, "rationale-input.json");
  writeFileSync(rationalePath, canonicalRationaleBytes(rationale));
  cli.main([
    "publish-rationale",
    "--packet", packetPath,
    "--rationale", rationalePath,
    "--output-root", packageRoot,
  ]);
  return {
    packageRoot,
    packet,
    rationale: JSON.parse(readFileSync(join(packageRoot, "rationale.json"), "utf8")),
  };
}

function writeDraft(artifactRoot, draft) {
  mkdirSync(artifactRoot, { recursive: true });
  const draftPath = join(artifactRoot, "draft.json");
  writeFileSync(draftPath, JSON.stringify(draft, null, 2) + "\n");
  return draftPath;
}

function runSandboxedRender(draftPath, artifactRoot) {
  const outputRoot = mkdtempSync(join(tmpdir(), "isolated-output-template-docx-"));
  const reportRoot = mkdtempSync(join(tmpdir(), "isolated-report-template-docx-"));
  try {
    const result = spawnSync(process.execPath, [
      isolatedWrapper,
      "--draft", draftPath,
      "--output-root", outputRoot,
      "--report-root", reportRoot,
    ], { cwd: repoRoot, encoding: "utf8", timeout: 120_000 });
    if (result.status !== 0) fail("E_DEMO_SANDBOX", "Bubblewrap render failed: " + (result.stderr || result.stdout || "unknown error"));
    let snapshot;
    try {
      snapshot = JSON.parse(result.stdout);
    } catch (error) {
      fail("E_DEMO_SANDBOX", "Bubblewrap wrapper did not return a JSON receipt: " + error.message);
    }
    if (snapshot.exit_code !== 0 || !snapshot.argv.includes("--unshare-net")) {
      fail("E_DEMO_SANDBOX", "render receipt does not prove a successful no-network sandbox");
    }
    const sourceDocx = join(outputRoot, "p2-draft.docx");
    if (!existsSync(sourceDocx)) fail("E_DEMO_RENDER_OUTPUT", "sandbox did not produce p2-draft.docx");
    const outputPath = join(artifactRoot, "p2-draft.docx");
    cpSync(sourceDocx, outputPath);
    writeFileSync(join(artifactRoot, "isolated-snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
    return { outputPath, snapshot };
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(reportRoot, { recursive: true, force: true });
  }
}

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

async function inspectRenderedDocx(outputPath, draft) {
  const zip = await JSZip.loadAsync(readFileSync(outputPath));
  const document = zip.file("word/document.xml");
  if (!document) fail("E_DEMO_DOCX", "rendered DOCX is missing word/document.xml");
  const xml = await document.async("string");
  const textRuns = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1]));
  const firstText = textRuns.find((text) => text.trim() !== "") ?? "";
  const orderedText = textRuns.join("\n");
  const watermarkIndex = textRuns.indexOf(draft.title);
  const tocIndex = textRuns.indexOf("Mục lục");
  if (firstText !== draft.title || watermarkIndex < 0 || tocIndex < 0 || watermarkIndex >= tocIndex) {
    fail("E_DEMO_WATERMARK", "synthetic watermark is not the first text before Mục lục");
  }
  if (!orderedText.includes("P.2.2.1 Formulation selection")
    || !orderedText.includes("Sources and provenance")
    || orderedText.includes("⏳ Chờ dữ liệu")) {
    fail("E_DEMO_DOCX_CONTENT", "rendered DOCX is missing required demo content or contains wait-data text");
  }
  for (const citation of draft.citations) {
    const occurrences = orderedText.split(citation.evidenceId).length - 1;
    if (occurrences !== 1) {
      fail("E_DEMO_CITATIONS", "rendered Sources section does not contain exactly one entry for " + citation.evidenceId);
    }
  }
  return { textRuns, orderedText };
}

export async function runContentDemo({ artifactRoot = null, reportRoot = defaultReportRoot } = {}) {
  const requestedArtifactRoot = artifactRoot ?? freshDefaultArtifactRoot();
  const canonicalBefore = snapshotCanonicalRoots();
  const dirtyBefore = snapshotDirtyTrackedFiles();
  const resolvedArtifactRoot = ensureSafeArtifactRoot(requestedArtifactRoot);
  const root = mkdtempSync(join(tmpdir(), "template-docx-content-demo-"));
  try {
    const sources = copyRunSources(root);
    const template = await runTemplateStage(root, sources);
    const ingestResult = runIngestStage(root, sources);
    const augmentedStore = augmentStore(root, ingestResult);
    const reasoning = runReasoningStage(root, { records: augmentedStore.records, sha256: augmentedStore.sha256 }, template);
    const rationale = runRationaleStage(root, reasoning);
    const draft = buildContentDraft({
      packet: rationale.packet,
      rationale: rationale.rationale,
      citations: reasoning.citations,
    });
    const draftPath = writeDraft(resolvedArtifactRoot, draft);
    const render = runSandboxedRender(draftPath, resolvedArtifactRoot);
    const rendered = await inspectRenderedDocx(render.outputPath, draft);
    const normalized = normalizeOoxml(render.outputPath);
    const canonicalAfter = snapshotCanonicalRoots();
    const dirtyAfter = snapshotDirtyTrackedFiles();
    assertUnchanged(canonicalBefore, canonicalAfter, "canonical roots");
    assertUnchanged(dirtyBefore, dirtyAfter, "pre-existing dirty tracked files");
    const report = {
      status: "pass",
      run_id: runId,
      output: render.outputPath,
      output_sha256: sha256(readFileSync(render.outputPath)),
      output_bytes: statSync(render.outputPath).size,
      normalized_ooxml_sha256: normalized.manifest_sha256,
      normalized_ooxml_manifest: normalized.manifest,
      sandbox: {
        argv_hash: render.snapshot.argv_hash,
        unshare_net: render.snapshot.argv.includes("--unshare-net"),
        exit_code: render.snapshot.exit_code,
        versions: render.snapshot.versions,
      },
      receipt_join: reasoning.join.counts,
      citation_count: reasoning.citations.length,
      record_count: augmentedStore.records.length,
      decision: {
        status: reasoning.decision.status,
        winner: reasoning.decision.winner,
        comparator_marker: COMPARATOR_CANDIDATE,
      },
      rendered_first_text: rendered.textRuns[0],
      canonical_unchanged: true,
      dirty_tracked_files_unchanged: true,
    };
    if (reportRoot !== null) {
      mkdirSync(resolve(reportRoot), { recursive: true });
      writeFileSync(join(resolve(reportRoot), "content-demo-run.json"), JSON.stringify(report, null, 2) + "\n");
    }
    return {
      ...report,
      draft,
      packet: rationale.packet,
      rationale: rationale.rationale,
      normalized,
      join: reasoning.join,
      citations: reasoning.citations,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--artifact-root" || flag === "--report-root") {
      const value = argv[index + 1];
      if (!value) fail("E_DEMO_ARGS", flag + " requires a path");
      options[flag.slice(2).replace("-", "") === "artifactroot" ? "artifactRoot" : "reportRoot"] = value;
      index += 1;
    } else {
      fail("E_DEMO_ARGS", "unknown argument: " + flag);
    }
  }
  return options;
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const report = await runContentDemo(parseArguments(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({
      status: report.status,
      output: report.output,
      output_sha256: report.output_sha256,
      normalized_ooxml_sha256: report.normalized_ooxml_sha256,
      receipt_join: report.receipt_join,
      sandbox: report.sandbox,
    }, null, 2) + "\n");
  } catch (error) {
    process.stderr.write((error.code ?? "E_DEMO_RUN") + ": " + error.message + "\n");
    process.exitCode = 1;
  }
}
