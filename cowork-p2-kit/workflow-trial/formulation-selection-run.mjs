#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { canonicalJson } from "./formula-cell-receipt.mjs";
import { buildFormulaEvidenceDiagnostic } from "./formula-evidence-diagnostic.mjs";
import { computeFormulationProposal, evaluateSelectionV3 } from "../reasoning/decision-engine.mjs";
import { canonicalBytes } from "../reasoning/publication.mjs";
import { compileRubricFromSpec } from "../rubric/compile-rubric-from-spec.mjs";
import { createFdConfirmFlag, validateFdConfirmFlag } from "../rubric/fd-confirm-flag.mjs";
import { buildFormulationRationalePackage } from "./formulation-selection-rationale.mjs";
import { buildFormulationReviewDraft } from "./formulation-selection-review-draft.mjs";
import { verifyFormulationReviewArtifacts } from "./formulation-review-verifier.mjs";
import { normalizeOoxml } from "../render/normalize-ooxml.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const defaultSourceRoot = resolve(repoRoot, "docs/reports/qbd-p221-formulation-selection");
const DEFAULT_RUN_ID = "qbd-p221-formulation-selection";
const templateBindingRunner = resolve(repoRoot, "cowork-p2-kit/workflow-trial/formulation-template-binding.mjs");
const isolatedWrapper = resolve(repoRoot, "cowork-p2-kit/render/run-isolated-template-review.mjs");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256Json = (value) => sha256(Buffer.from(canonicalJson(value)));

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function readJson(root, name) {
  try { return JSON.parse(readFileSync(join(root, name), "utf8")); }
  catch (error) { fail("E_FORMULATION_SOURCE", `cannot read ${name}: ${error.message}`); }
}

function loadDataPackage(sourceRoot) {
  const receiptArtifact = readJson(sourceRoot, "formula-cell-receipts.json");
  return {
    package: readJson(sourceRoot, "formulation-data-package.json"),
    evidence: readJson(sourceRoot, "formulation-evidence.json"),
    cards: readJson(sourceRoot, "fact-cards.json"),
    bindings: readJson(sourceRoot, "fact-card-evidence-bindings.json"),
    reconciliation: readJson(sourceRoot, "inventory-reconciliation.json"),
    receipts: receiptArtifact.receipts,
    receiptArtifact,
  };
}

function loadTemplateBinding() {
  const result = spawnSync(process.execPath, [templateBindingRunner], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) fail("E_FORMULATION_TEMPLATE", result.stderr || result.stdout || "template binding failed");
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail("E_FORMULATION_TEMPLATE", `template binding output is invalid: ${error.message}`);
  }
}

function validateProposal(proposal) {
  const banned = ["winner", "selected", "decision", "eligible", "recommendation"];
  const serialized = JSON.stringify(proposal).toLowerCase();
  for (const token of banned) if (serialized.includes(token)) fail("E_PROPOSAL_LANGUAGE", `engineering proposal contains forbidden token ${token}`);
  if (proposal.artifact_kind !== "engineering-proposal-not-fd-approved" || proposal.fd_approved !== false) fail("E_PROPOSAL_SCHEMA", "engineering proposal is not explicitly non-FD-approved");
  return proposal;
}

function buildEngineeringProposal({ dataPackage, rubric, compileReceipt, proposalEvaluation }) {
  const proposal = {
    schema_version: "engineering-proposal/v1",
    artifact_kind: "engineering-proposal-not-fd-approved",
    proposed_survivor: proposalEvaluation.proposed_survivor,
    conditional_on: "proposed rule (dissolution min-gate + mean-score, strict CU<15), NOT FD-approved",
    fd_approved: false,
    excluded_candidates: proposalEvaluation.excluded_candidates,
    bound_hashes: dataPackage.package.bound_hashes,
  };
  validateProposal(proposal);
  const expected = computeFormulationProposal({
    dataPackage,
    rubric,
    compileReceipt,
    fdConfirmFlag: compileReceipt.fd_confirm_flag,
  });
  if (canonicalJson(proposalEvaluation) !== canonicalJson(expected)) {
    fail("E_PROPOSAL_BINDING", "engineering proposal evaluation differs from the source-derived rubric evaluation");
  }
  return proposal;
}

function writeJson(root, name, value) {
  const target = join(root, name);
  try {
    writeFileSync(target, canonicalBytes(value), { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      fail("E_FORMULATION_OUTPUT_EXISTS", `refusing to overwrite existing artifact ${name}; clear the output directory before re-running`);
    }
    throw error;
  }
  return target;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--out" || flag === "--source-root" || flag === "--emit") {
      const value = argv[index + 1];
      if (!value) fail("E_FORMULATION_ARGS", `${flag} requires a value`);
      if (flag === "--emit" && value !== "rationale,render") fail("E_FORMULATION_ARGS", "--emit supports only rationale,render");
      options[flag.slice(2).replaceAll("-", "_")] = value;
      index += 1;
    } else if (["--rubric-state", "--approval-state", "--rubric-pin", "--fd-confirm"].includes(flag)) {
      fail("E_RUBRIC_APPROVAL_INPUT", "approval state is controlled by the fd-confirm artifact, not the CLI");
    } else {
      fail("E_FORMULATION_ARGS", `unsupported option: ${flag}`);
    }
  }
  return options;
}

function safeOutputRoot(requested) {
  const root = resolve(requested);
  if (existsSync(root)) {
    const stat = lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("E_FORMULATION_PATH", "output root must be a real directory");
  }
  mkdirSync(root, { recursive: true });
  return root;
}

export function runFormulationSelection({ outputRoot, sourceRoot = defaultSourceRoot, fdConfirmFlag = createFdConfirmFlag(), runId = DEFAULT_RUN_ID } = {}) {
  const root = safeOutputRoot(outputRoot ?? join(repoRoot, "docs/reports/qbd-p221-formulation-selection/proposal-run"));
  const dataPackage = loadDataPackage(resolve(sourceRoot));
  const templateBinding = loadTemplateBinding();
  if (templateBinding.receipt.source_document_sha256 !== dataPackage.package.bound_hashes.source_document_sha256) {
    fail("E_FORMULATION_TEMPLATE", "filled-template receipt is bound to another formulation source");
  }
  validateFdConfirmFlag(fdConfirmFlag);
  const compiled = compileRubricFromSpec({ dataPackage, fdConfirmFlag });
  const diagnostic = buildFormulaEvidenceDiagnostic({ dataPackage });
  const fdResult = evaluateSelectionV3({
    dataPackage,
    rubric: compiled.rubric,
    compileReceipt: compiled.receipt,
    fdConfirmFlag,
    decisionId: `${runId}-fd-decision`,
  });
  const proposalEvaluation = computeFormulationProposal({
    dataPackage,
    rubric: compiled.rubric,
    compileReceipt: compiled.receipt,
    fdConfirmFlag,
    decisionId: `${runId}-proposal`,
  });
  const engineeringProposal = buildEngineeringProposal({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt, proposalEvaluation });
  const artifacts = {
    "formulation-data-package.json": dataPackage.package,
    "formulation-evidence.json": dataPackage.evidence,
    "fact-cards.json": dataPackage.cards,
    "fact-card-evidence-bindings.json": dataPackage.bindings,
    "inventory-reconciliation.json": dataPackage.reconciliation,
    "formula-cell-receipts.json": dataPackage.receiptArtifact,
    "template-field-map.v1.json": templateBinding.fieldMap,
    "template-cell-receipt.v1.json": templateBinding.receipt,
    "compiled-rubric.v3.json": compiled.rubric,
    "spec-compile-receipt.json": compiled.receipt,
    "formula-evidence-diagnostic.json": diagnostic,
    "formula-decision.json": fdResult.fd_decision,
    "selection-evaluation.json": fdResult.selection_evaluation,
    "engineering-proposal.json": engineeringProposal,
  };
  const artifactHashes = {};
  for (const [name, value] of Object.entries(artifacts)) {
    writeJson(root, name, value);
    artifactHashes[name] = sha256(Buffer.from(canonicalBytes(value)));
  }
  const receipt = {
    schema_version: "formulation-selection-publication-receipt/v1",
    run_id: runId,
    artifact_hashes: artifactHashes,
    source_hashes: dataPackage.package.bound_hashes,
    package_sha256: sha256Json(dataPackage.package),
    compile_receipt_sha256: artifactHashes["spec-compile-receipt.json"],
    diagnostic_sha256: artifactHashes["formula-evidence-diagnostic.json"],
    engineering_proposal_sha256: artifactHashes["engineering-proposal.json"],
    fd_decision_sha256: artifactHashes["formula-decision.json"],
    template_sha256: templateBinding.receipt.template_sha256,
    template_field_map_sha256: artifactHashes["template-field-map.v1.json"],
    template_cell_receipt_sha256: artifactHashes["template-cell-receipt.v1.json"],
  };
  writeJson(root, "publication-receipt.json", receipt);
  return {
    outputRoot: root,
    run_id: runId,
    fd_decision: fdResult.fd_decision,
    selection_evaluation: fdResult.selection_evaluation,
    engineering_proposal: engineeringProposal,
    publication_receipt: receipt,
    dataPackage,
    rubric: compiled.rubric,
    compileReceipt: compiled.receipt,
    diagnostic,
    templateBinding,
  };
}

function emitIsolatedRender({ draftPath, fieldMapPath, templateReceiptPath, outputRoot }) {
  const stagingParent = join(repoRoot, "artifacts");
  mkdirSync(stagingParent, { recursive: true });
  const stagingRoot = mkdtempSync(join(stagingParent, ".qbd-p221-review-"));
  const stagedDraftPath = join(stagingRoot, "review-draft.json");
  const stagedFieldMapPath = join(stagingRoot, "template-field-map.v1.json");
  const stagedTemplateReceiptPath = join(stagingRoot, "template-cell-receipt.v1.json");
  const isolatedOutput = mkdtempSync(join(tmpdir(), "isolated-output-qbd-p221-"));
  const isolatedReport = mkdtempSync(join(tmpdir(), "isolated-report-qbd-p221-"));
  cpSync(draftPath, stagedDraftPath);
  cpSync(fieldMapPath, stagedFieldMapPath);
  cpSync(templateReceiptPath, stagedTemplateReceiptPath);
  try {
    const result = spawnSync(process.execPath, [
      isolatedWrapper,
      "--draft", stagedDraftPath,
      "--field-map", stagedFieldMapPath,
      "--receipt", stagedTemplateReceiptPath,
      "--output-root", isolatedOutput,
      "--report-root", isolatedReport,
    ], { cwd: repoRoot, encoding: "utf8", timeout: 120_000 });
    if (result.status !== 0) fail("E_FORMULATION_RENDER", result.stderr || result.stdout || "isolated render failed");
    let snapshot;
    try { snapshot = JSON.parse(result.stdout); } catch (error) { fail("E_FORMULATION_RENDER", `isolated render receipt is invalid: ${error.message}`); }
    if (snapshot.exit_code !== 0 || !snapshot.argv.includes("--unshare-net")) fail("E_FORMULATION_RENDER", "render was not proven no-network");
    const sourceDocx = join(isolatedOutput, "p2.2.1-review.docx");
    if (!existsSync(sourceDocx)) fail("E_FORMULATION_RENDER", "isolated template render did not produce p2.2.1-review.docx");
    const outputDocx = join(outputRoot, "p2.2.1-review.docx");
    cpSync(sourceDocx, outputDocx, { force: false, errorOnExist: true });
    return { outputDocx, snapshot };
  } finally {
    rmSync(isolatedOutput, { recursive: true, force: true });
    rmSync(isolatedReport, { recursive: true, force: true });
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function emitFormulationReview({ phase3Result, runId = DEFAULT_RUN_ID } = {}) {
  if (!phase3Result?.outputRoot) fail("E_FORMULATION_REVIEW", "a completed Phase 3 result is required");
  const bundle = buildFormulationRationalePackage({ phase3Root: phase3Result.outputRoot, runId });
  writeJson(phase3Result.outputRoot, "rationale-package.json", bundle.packet);
  writeJson(phase3Result.outputRoot, "rationale.json", bundle.rationale);
  const draft = buildFormulationReviewDraft({ diagnostic: bundle.diagnostic, engineeringProposal: bundle.engineeringProposal, rationale: bundle.rationale });
  const draftPath = writeJson(phase3Result.outputRoot, "review-draft.json", draft);
  const render = emitIsolatedRender({
    draftPath,
    fieldMapPath: join(phase3Result.outputRoot, "template-field-map.v1.json"),
    templateReceiptPath: join(phase3Result.outputRoot, "template-cell-receipt.v1.json"),
    outputRoot: phase3Result.outputRoot,
  });
  const normalized = normalizeOoxml(render.outputDocx);
  const rationaleReceipt = {
    schema_version: "formulation-rationale-receipt/v1",
    run_id: runId,
    source_publication_receipt_sha256: bundle.packet.source_publication_receipt_sha256,
    packet_sha256: sha256(Buffer.from(canonicalBytes(bundle.packet))),
    rationale_sha256: sha256(Buffer.from(canonicalBytes(bundle.rationale))),
    draft_sha256: sha256(Buffer.from(canonicalBytes(draft))),
    template_cell_receipt_sha256: phase3Result.publication_receipt.template_cell_receipt_sha256,
  };
  const renderReceipt = {
    schema_version: "formulation-render-receipt/v1",
    run_id: runId,
    source_publication_receipt_sha256: bundle.packet.source_publication_receipt_sha256,
    rationale_receipt_sha256: sha256(Buffer.from(canonicalBytes(rationaleReceipt))),
    docx_sha256: sha256(readFileSync(render.outputDocx)),
    normalized_ooxml_sha256: normalized.manifest_sha256,
    citations_count: draft.citations.length,
    classification: bundle.rationale.source_classification,
    template_sha256: phase3Result.publication_receipt.template_sha256,
    template_field_map_sha256: phase3Result.publication_receipt.template_field_map_sha256,
    template_cell_receipt_sha256: phase3Result.publication_receipt.template_cell_receipt_sha256,
    isolated_render: {
      argv_hash: render.snapshot.argv_hash,
      unshare_net: render.snapshot.argv.includes("--unshare-net"),
      exit_code: render.snapshot.exit_code,
      versions: render.snapshot.versions,
    },
  };
  writeJson(phase3Result.outputRoot, "rationale-receipt.json", rationaleReceipt);
  writeJson(phase3Result.outputRoot, "render-receipt.json", renderReceipt);
  const verification = verifyFormulationReviewArtifacts({ outputRoot: phase3Result.outputRoot, runId });
  writeJson(phase3Result.outputRoot, "review-verification.json", verification);
  return { ...bundle, draft, rationaleReceipt, renderReceipt, outputDocx: render.outputDocx, normalized, verification };
}

export { buildEngineeringProposal, parseArguments, DEFAULT_RUN_ID };

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = runFormulationSelection({
      outputRoot: options.out,
      sourceRoot: options.source_root ?? defaultSourceRoot,
    });
    const review = options.emit ? emitFormulationReview({ phase3Result: result }) : null;
    process.stdout.write(`${JSON.stringify({ output: result.outputRoot, fd_decision: result.fd_decision, engineering_proposal: result.engineering_proposal, review: review ? { output: review.outputDocx, normalized_ooxml_sha256: review.renderReceipt.normalized_ooxml_sha256 } : null }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code ?? "E_FORMULATION_RUN"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
