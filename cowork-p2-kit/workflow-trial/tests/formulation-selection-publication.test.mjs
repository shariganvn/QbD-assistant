import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalBytes } from "../../reasoning/publication.mjs";
import { createFdConfirmFlag } from "../../rubric/fd-confirm-flag.mjs";
import { canonicalJson } from "../formula-cell-receipt.mjs";
import { buildFormulationRationalePackage } from "../formulation-selection-rationale.mjs";
import { emitFormulationReview, runFormulationSelection } from "../formulation-selection-run.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function refreshPublicationReceipt(root, artifactName, receiptField = null) {
  const artifactBytes = readFileSync(join(root, artifactName));
  const receiptPath = join(root, "publication-receipt.json");
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  receipt.artifact_hashes[artifactName] = sha256(artifactBytes);
  if (receiptField) receipt[receiptField] = receipt.artifact_hashes[artifactName];
  writeFileSync(receiptPath, canonicalBytes(receipt));
}

test("G-05 rationale publication rejects a cross-run artifact substitution", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-publication-"));
  const firstRoot = join(root, "first");
  const secondRoot = join(root, "second");
  try {
    const first = runFormulationSelection({ outputRoot: firstRoot, runId: "g05-first" });
    const second = runFormulationSelection({ outputRoot: secondRoot, runId: "g05-second" });
    cpSync(join(second.outputRoot, "formula-decision.json"), join(first.outputRoot, "formula-decision.json"));
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: first.outputRoot, runId: "g05-first" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-03 confirmed lane publishes and renders the source-compiled authorized rubric", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g03-confirmed-publication-"));
  try {
    const runId = "g03-confirmed-publication";
    const flag = createFdConfirmFlag({
      flag_state: "confirmed",
      confirmed_by: "fd-test-user",
      confirmed_at: "2026-08-09T12:00:00Z",
      note: "confirmed-lane publication binding test",
    });
    const phase3 = runFormulationSelection({ outputRoot: root, runId, fdConfirmFlag: flag });
    const rubric = JSON.parse(readFileSync(join(root, "compiled-rubric.v3.json"), "utf8"));
    const compileReceipt = JSON.parse(readFileSync(join(root, "spec-compile-receipt.json"), "utf8"));
    assert.equal(rubric.approval_state, "test-approved");
    assert.equal(compileReceipt.rubric_sha256, phase3.fd_decision.rubric_sha256);
    const bundle = buildFormulationRationalePackage({ phase3Root: root, runId });
    assert.equal(bundle.rationale.decision_state.status, "selected");
    const review = emitFormulationReview({ phase3Result: phase3, runId });
    assert.equal(review.verification.p221_sections_complete, true);
    assert.ok(review.draft.blocks.some((block) => block.text?.includes("fd_decision: selected; winner: formula-03")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a coordinated cross-run decision and evaluation pair", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-coordinated-pair-"));
  const firstRoot = join(root, "first");
  const secondRoot = join(root, "second");
  try {
    const first = runFormulationSelection({ outputRoot: firstRoot, runId: "g05-pair-first" });
    const second = runFormulationSelection({ outputRoot: secondRoot, runId: "g05-pair-second" });
    for (const name of ["formula-decision.json", "selection-evaluation.json"]) {
      cpSync(join(second.outputRoot, name), join(first.outputRoot, name));
      refreshPublicationReceipt(first.outputRoot, name, name === "formula-decision.json" ? "fd_decision_sha256" : null);
    }
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: first.outputRoot, runId: "g05-pair-first" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a run identity substitution", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-run-id-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-source" });
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-substituted" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects missing artifact or receipt binding entries", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-missing-binding-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-missing-binding" });
    const receiptPath = join(phase3.outputRoot, "publication-receipt.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    delete receipt.artifact_hashes["spec-compile-receipt.json"];
    delete receipt.compile_receipt_sha256;
    writeFileSync(receiptPath, canonicalBytes(receipt));
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-missing-binding" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a mutated diagnostic after its publication hash is refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-diagnostic-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-diagnostic" });
    const diagnosticPath = join(phase3.outputRoot, "formula-evidence-diagnostic.json");
    const diagnostic = JSON.parse(readFileSync(diagnosticPath, "utf8"));
    diagnostic.candidates[2].observed_results[0].value += 1;
    writeFileSync(diagnosticPath, canonicalBytes(diagnostic));
    refreshPublicationReceipt(phase3.outputRoot, "formula-evidence-diagnostic.json", "diagnostic_sha256");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-diagnostic" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a mutated engineering proposal after its publication hash is refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-proposal-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-proposal" });
    const proposalPath = join(phase3.outputRoot, "engineering-proposal.json");
    const proposal = JSON.parse(readFileSync(proposalPath, "utf8"));
    proposal.excluded_candidates[0].failed_gates[0].value += 1;
    writeFileSync(proposalPath, canonicalBytes(proposal));
    refreshPublicationReceipt(phase3.outputRoot, "engineering-proposal.json", "engineering_proposal_sha256");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-proposal" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a replaced receipt set after its publication hash is refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-receipt-set-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-receipt-set" });
    const receiptsPath = join(phase3.outputRoot, "formula-cell-receipts.json");
    const receiptArtifact = JSON.parse(readFileSync(receiptsPath, "utf8"));
    receiptArtifact.receipts = [];
    writeFileSync(receiptsPath, canonicalBytes(receiptArtifact));
    refreshPublicationReceipt(phase3.outputRoot, "formula-cell-receipts.json");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-receipt-set" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a swapped selection evaluation even when its receipt hash is refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-selection-evaluation-"));
  const firstRoot = join(root, "first");
  const secondRoot = join(root, "second");
  try {
    const first = runFormulationSelection({ outputRoot: firstRoot, runId: "g05-selection-first" });
    const second = runFormulationSelection({ outputRoot: secondRoot, runId: "g05-selection-second" });
    cpSync(join(second.outputRoot, "selection-evaluation.json"), join(first.outputRoot, "selection-evaluation.json"));
    refreshPublicationReceipt(first.outputRoot, "selection-evaluation.json");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: first.outputRoot, runId: "g05-selection-first" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a swapped compile receipt even when its receipt hash is refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-compile-receipt-"));
  const firstRoot = join(root, "first");
  const secondRoot = join(root, "second");
  try {
    const first = runFormulationSelection({ outputRoot: firstRoot, runId: "g05-compile-first" });
    const second = runFormulationSelection({
      outputRoot: secondRoot,
      runId: "g05-compile-second",
      fdConfirmFlag: createFdConfirmFlag({
        flag_state: "confirmed",
        confirmed_by: "g05-test-user",
        confirmed_at: "2026-08-08T12:00:00Z",
        note: "receipt substitution test",
      }),
    });
    cpSync(join(second.outputRoot, "spec-compile-receipt.json"), join(first.outputRoot, "spec-compile-receipt.json"));
    refreshPublicationReceipt(first.outputRoot, "spec-compile-receipt.json", "compile_receipt_sha256");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: first.outputRoot, runId: "g05-compile-first" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a changed compiled rubric even when its receipt hash is refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-compiled-rubric-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-rubric" });
    const rubricPath = join(phase3.outputRoot, "compiled-rubric.v3.json");
    const rubric = JSON.parse(readFileSync(rubricPath, "utf8"));
    rubric.tie_threshold = 1;
    writeFileSync(rubricPath, canonicalBytes(rubric));
    refreshPublicationReceipt(phase3.outputRoot, "compiled-rubric.v3.json");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-rubric" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication rejects a self-consistent non-null rubric hash in the proposal FD decision", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-decision-rubric-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-decision-rubric" });
    const decisionPath = join(phase3.outputRoot, "formula-decision.json");
    const evaluationPath = join(phase3.outputRoot, "selection-evaluation.json");
    const decision = JSON.parse(readFileSync(decisionPath, "utf8"));
    const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8"));
    const compileReceipt = JSON.parse(readFileSync(join(phase3.outputRoot, "spec-compile-receipt.json"), "utf8"));
    decision.rubric_sha256 = compileReceipt.rubric_sha256;
    const { decision_sha256: ignored, ...unsignedDecision } = decision;
    decision.decision_sha256 = sha256(Buffer.from(canonicalJson(unsignedDecision)));
    evaluation.rubric_sha256 = decision.rubric_sha256;
    evaluation.decision_sha256 = decision.decision_sha256;
    writeFileSync(decisionPath, canonicalBytes(decision));
    writeFileSync(evaluationPath, canonicalBytes(evaluation));
    refreshPublicationReceipt(phase3.outputRoot, "formula-decision.json", "fd_decision_sha256");
    refreshPublicationReceipt(phase3.outputRoot, "selection-evaluation.json");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-decision-rubric" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 rationale publication recomputes the formula-decision hash", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-decision-hash-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-decision-hash" });
    const decisionPath = join(phase3.outputRoot, "formula-decision.json");
    const evaluationPath = join(phase3.outputRoot, "selection-evaluation.json");
    const decision = JSON.parse(readFileSync(decisionPath, "utf8"));
    const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8"));
    decision.decision_sha256 = "0".repeat(64);
    evaluation.decision_sha256 = decision.decision_sha256;
    writeFileSync(decisionPath, canonicalBytes(decision));
    writeFileSync(evaluationPath, canonicalBytes(evaluation));
    refreshPublicationReceipt(phase3.outputRoot, "formula-decision.json", "fd_decision_sha256");
    refreshPublicationReceipt(phase3.outputRoot, "selection-evaluation.json");
    assert.throws(
      () => buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: "g05-decision-hash" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
