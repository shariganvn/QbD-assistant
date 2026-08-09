import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { compileRubricFromSpec } from "../../rubric/compile-rubric-from-spec.mjs";
import { computeFormulationProposal, evaluateSelectionV3 } from "../../reasoning/decision-engine.mjs";
import { validateBindings, validateEvidenceEnvelope } from "../real-data-pack.mjs";
import { canonicalJson, sha256 } from "../formula-cell-receipt.mjs";
import { assertIsolatedConfig, verifyFrozenSource } from "../formulation-spike-run.mjs";
import { buildEngineeringProposal, runFormulationSelection } from "../formulation-selection-run.mjs";
import { buildFormulationReviewDraft } from "../formulation-selection-review-draft.mjs";
import { buildFormulationRationalePackage, validateFormulationRationale } from "../formulation-selection-rationale.mjs";

const evidenceRoot = new URL("../../../docs/reports/qbd-p221-formulation-selection/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, evidenceRoot), "utf8"));

function realDataPackage() {
  return {
    package: read("formulation-data-package.json"),
    evidence: read("formulation-evidence.json"),
    cards: read("fact-cards.json"),
    bindings: read("fact-card-evidence-bindings.json"),
    reconciliation: read("inventory-reconciliation.json"),
    receipts: read("formula-cell-receipts.json").receipts,
  };
}

test("G-05 source hash mismatch and canonical ingest roots fail closed", async () => {
  await assert.rejects(
    () => verifyFrozenSource({ expectedPins: { source_document_sha256: "0".repeat(64), document_xml_sha256: "0".repeat(64) } }),
    (error) => error.code === "E_SOURCE_HASH",
  );
  assert.throws(
    () => assertIsolatedConfig({
      kitDir: "/tmp/qbd-p221-isolated",
      inputsRoot: "cowork-p2-kit/inputs",
      storeRoot: "/tmp/qbd-p221-isolated/store",
    }),
    (error) => error.code === "E_CANONICAL_INGEST",
  );
});

test("G-05 typed evidence and exact cohort negatives retain their specific failures", () => {
  const dataPackage = realDataPackage();
  const specification = dataPackage.evidence.specifications[0];
  const forgedBinding = [
    ...dataPackage.bindings.bindings,
    { card_id: dataPackage.cards.cards[0].id, evidence_id: specification.evidence_id, kind: "observed_result", binding_role: "scoring" },
  ];
  assert.throws(
    () => validateBindings({ bindings: forgedBinding, evidence: dataPackage.evidence, cards: dataPackage.cards, receipts: dataPackage.receipts }),
    (error) => error.code === "E_SPEC_AS_RESULT",
  );

  const compiled = compileRubricFromSpec({ dataPackage });
  const partial = structuredClone(dataPackage);
  partial.package.exact_cohort = ["formula-01"];
  assert.throws(
    () => computeFormulationProposal({ dataPackage: partial, rubric: compiled.rubric, compileReceipt: compiled.receipt }),
    (error) => error.code === "E_PACKAGE_SCHEMA",
  );
});

test("G-05 spec drift, approval override, and proposal-language negatives fail closed", () => {
  const dataPackage = realDataPackage();
  const compiled = compileRubricFromSpec({ dataPackage });
  const driftedReceipt = structuredClone(compiled.receipt);
  driftedReceipt.source_document_sha256 = "a".repeat(64);
  assert.throws(
    () => evaluateSelectionV3({ dataPackage, rubric: compiled.rubric, compileReceipt: driftedReceipt }),
    (error) => error.code === "E_RUBRIC_SPEC_DRIFT",
  );
  assert.throws(
    () => evaluateSelectionV3({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt, approval_state: "test-approved" }),
    (error) => error.code === "E_RUBRIC_APPROVAL_INPUT",
  );

  assert.throws(
    () => buildEngineeringProposal({
      dataPackage,
      rubric: compiled.rubric,
      compileReceipt: compiled.receipt,
      proposalEvaluation: { proposed_survivor: "formula-03", excluded_candidates: [{ candidate: "formula-01", reason: "winner" }] },
    }),
    (error) => error.code === "E_PROPOSAL_LANGUAGE",
  );

  const proposalEvaluation = computeFormulationProposal({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt });
  assert.throws(
    () => buildEngineeringProposal({
      dataPackage,
      rubric: compiled.rubric,
      compileReceipt: compiled.receipt,
      proposalEvaluation: { ...proposalEvaluation, proposed_survivor: "formula-99" },
    }),
    (error) => error.code === "E_PROPOSAL_BINDING",
  );
});

test("G-05 rationale rejects unbound claims and citable drift", () => {
  const phase3 = runFormulationSelection({ outputRoot: mkdtempSync(join(tmpdir(), "qbd-p221-negative-rationale-")) });
  const bundle = buildFormulationRationalePackage({ phase3Root: phase3.outputRoot, runId: phase3.run_id });
  const unbound = structuredClone(bundle.rationale);
  unbound.claims[0].bound_evidence_ids = ["fabricated:evidence"];
  assert.throws(() => validateFormulationRationale(unbound), (error) => error.code === "E_RATIONALE_CLAIM_BINDING");
  const citable = structuredClone(bundle.rationale);
  citable.source_classification.citable = true;
  assert.throws(() => validateFormulationRationale(citable), (error) => error.code === "E_RATIONALE_CLASSIFICATION");
  const malformedProvenance = structuredClone(bundle.rationale);
  malformedProvenance.internal_provenance_references[0].source_file = "";
  assert.throws(() => validateFormulationRationale(malformedProvenance), (error) => error.code === "E_INTERNAL_PROVENANCE");
  const malformedQuoteHash = structuredClone(bundle.rationale);
  malformedQuoteHash.internal_provenance_references[0].quote_sha256 = "not-a-sha256";
  assert.throws(() => validateFormulationRationale(malformedQuoteHash), (error) => error.code === "E_INTERNAL_PROVENANCE");
});

test("dissolution statistics that break min<=mean<=max are refused at the evidence barrier", () => {
  const evidence = structuredClone(realDataPackage().evidence);
  // Corrupt one candidate's mean above its max while keeping the normalized-value
  // hash consistent, so the statistical-consistency barrier — not the hash guard —
  // is what rejects the envelope.
  const meanEntry = evidence.observed_results.find((entry) => entry.candidate === "formula-03" && entry.measure === "dissolution_mean");
  meanEntry.value = meanEntry.value + 500;
  meanEntry.normalized_value_sha256 = sha256(canonicalJson({ value: meanEntry.value, unit: meanEntry.unit }));
  assert.throws(
    () => validateEvidenceEnvelope(evidence),
    (error) => error.code === "E_EVIDENCE_STATISTIC_CONSISTENCY",
  );
});

test("G-05 proposal draft cannot turn a non-FD proposal into an FD-approved document", () => {
  const phase3 = runFormulationSelection({ outputRoot: mkdtempSync(join(tmpdir(), "qbd-p221-negative-draft-")) });
  assert.throws(
    () => buildFormulationReviewDraft({ diagnostic: phase3.diagnostic, engineeringProposal: { ...phase3.engineering_proposal, fd_approved: true }, rationale: { internal_provenance_references: [] } }),
    /E_DRAFT_PROPOSAL/,
  );
});
