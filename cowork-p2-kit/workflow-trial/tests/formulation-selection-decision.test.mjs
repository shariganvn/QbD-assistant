import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { validateDiagnostic } from "../formula-evidence-diagnostic.mjs";
import {
  parseArguments,
  runFormulationSelection,
} from "../formulation-selection-run.mjs";

function run() {
  return runFormulationSelection({ outputRoot: mkdtempSync(join(tmpdir(), "qbd-p221-decision-")) });
}

test("G-03 emits raw evidence, inconclusive FD state, and a separate proposal", () => {
  const result = run();
  const diagnostic = result.diagnostic;
  assert.equal(diagnostic.artifact_kind, "non-decisional-evidence-diagnostic");
  assert.equal(diagnostic.decision_status, "not-evaluated");
  assert.equal(diagnostic.winner, null);
  assert.deepEqual(diagnostic.exact_cohort, ["formula-01", "formula-02", "formula-03"]);
  assert.deepEqual(diagnostic.candidates.map((entry) => entry.candidate), ["formula-01", "formula-02", "formula-03"]);
  assert.equal(diagnostic.candidates[2].observed_results.find((entry) => entry.measure === "dissolution_mean").value, 98.64);
  assert.equal(result.fd_decision.status, "inconclusive");
  assert.equal(result.fd_decision.winner, null);
  assert.equal(result.selection_evaluation.selection_evaluated, false);
  assert.equal(result.engineering_proposal.artifact_kind, "engineering-proposal-not-fd-approved");
  assert.equal(result.engineering_proposal.proposed_survivor, "formula-03");
  assert.equal(result.engineering_proposal.fd_approved, false);
  assert.equal(result.fd_decision.engineering_proposal, undefined);
});

test("G-03 proposal language cannot be mistaken for an FD decision", () => {
  const result = run();
  const proposal = JSON.stringify(result.engineering_proposal).toLowerCase();
  for (const token of ["winner", "selected", "decision", "eligible", "recommendation"]) assert.equal(proposal.includes(token), false, token);
  const diagnostic = JSON.stringify(result.diagnostic).toLowerCase();
  for (const token of ["eligible", "passed", "score", "leader", "sensitivity"]) assert.equal(diagnostic.includes(token), false, token);
});

test("G-03 publication receipt binds every same-run artifact", () => {
  const result = run();
  for (const [name, expectedHash] of Object.entries(result.publication_receipt.artifact_hashes)) {
    const actualHash = result.publication_receipt.artifact_hashes[name];
    assert.equal(actualHash, expectedHash);
    assert.ok(readFileSync(join(result.outputRoot, name)).length > 0);
  }
  const receipt = JSON.parse(readFileSync(join(result.outputRoot, "publication-receipt.json"), "utf8"));
  assert.equal(receipt.compile_receipt_sha256, receipt.artifact_hashes["spec-compile-receipt.json"]);
  assert.equal(receipt.diagnostic_sha256, receipt.artifact_hashes["formula-evidence-diagnostic.json"]);
  assert.equal(receipt.engineering_proposal_sha256, receipt.artifact_hashes["engineering-proposal.json"]);
});

test("G-03 runner refuses caller-supplied approval and pin options", () => {
  for (const flag of ["--rubric-state", "--approval-state", "--rubric-pin", "--fd-confirm"]) {
    assert.throws(() => parseArguments([flag, "test-approved"]), (error) => error.code === "E_RUBRIC_APPROVAL_INPUT");
  }
});

test("G-03 fresh proposal runs are byte-identical", () => {
  const first = run();
  const second = run();
  assert.deepEqual(first.publication_receipt.artifact_hashes, second.publication_receipt.artifact_hashes);
  assert.equal(readFileSync(join(first.outputRoot, "formula-evidence-diagnostic.json"), "utf8"), readFileSync(join(second.outputRoot, "formula-evidence-diagnostic.json"), "utf8"));
  assert.equal(readFileSync(join(first.outputRoot, "engineering-proposal.json"), "utf8"), readFileSync(join(second.outputRoot, "engineering-proposal.json"), "utf8"));
});

test("G-03 diagnostic validator rejects incomplete projections and invalid binding hashes", () => {
  const result = run();
  const incomplete = structuredClone(result.diagnostic);
  incomplete.candidates[0].observed_results = [];
  assert.throws(() => validateDiagnostic(incomplete), (error) => error.code === "E_DIAGNOSTIC_SCHEMA");
  const invalidHash = structuredClone(result.diagnostic);
  invalidHash.bound_hashes.receipt_set_sha256 = "not-a-sha256";
  assert.throws(() => validateDiagnostic(invalidHash), (error) => error.code === "E_DIAGNOSTIC_SCHEMA");
});
