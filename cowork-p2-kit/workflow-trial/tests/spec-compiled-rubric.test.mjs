import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildAuthorizedFormulationRubric,
  compileRubricFromSpec,
} from "../../rubric/compile-rubric-from-spec.mjs";
import { createFdConfirmFlag } from "../../rubric/fd-confirm-flag.mjs";
import {
  compare,
  computeFormulationProposal,
  evaluateSelectionV3,
} from "../../reasoning/decision-engine.mjs";
import { validateSelectionRubricV3 } from "../../reasoning/selection-contracts.mjs";
import { canonicalJson } from "../formula-cell-receipt.mjs";

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

test("G-02 compiles the exact specification operators into the additive v3 rubric", () => {
  const dataPackage = realDataPackage();
  const compiled = compileRubricFromSpec({ dataPackage });
  validateSelectionRubricV3(compiled.rubric);
  const measures = Object.fromEntries(compiled.rubric.measures.map((measure) => [measure.id, measure]));

  assert.deepEqual(compiled.rubric.required_candidate_ids, ["formula-01", "formula-02", "formula-03"]);
  assert.equal(compiled.rubric.minimum_eligible_candidates, 1);
  assert.equal(measures.dissolution_min.hard_gates[0].operator, ">=");
  assert.equal(measures.dissolution_min.hard_gates[0].threshold, 80);
  assert.deepEqual(measures.assay.hard_gates.map((gate) => gate.operator), [">=", "<="]);
  assert.equal(measures.content_uniformity_av.hard_gates[0].operator, "<");
  assert.equal(measures.dissolution_max.hard_gates.length, 0);
  assert.equal(compiled.receipt.fd_confirm_flag.flag_state, "unset");
});

test("G-02 computes one survivor only after the complete cohort, while FD remains inconclusive", () => {
  const dataPackage = realDataPackage();
  const compiled = compileRubricFromSpec({ dataPackage });
  const proposal = computeFormulationProposal({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt });
  const result = evaluateSelectionV3({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt });

  assert.equal(proposal.proposed_survivor, "formula-03");
  assert.deepEqual(proposal.excluded_candidates.map((entry) => entry.candidate), ["formula-01", "formula-02"]);
  assert.equal(result.fd_decision.status, "inconclusive");
  assert.equal(result.fd_decision.winner, null);
  assert.equal(result.fd_decision.fd_action, "E_RUBRIC_APPROVAL_REQUIRED");
  assert.equal(result.selection_evaluation.selection_evaluated, false);
  assert.deepEqual(result.selection_evaluation.matrix_cells, []);
});

test("G-02 rejects one- and two-candidate cohorts before minimum-eligible-candidates can select one", () => {
  const dataPackage = realDataPackage();
  const compiled = compileRubricFromSpec({ dataPackage });
  for (const exactCohort of [["formula-01"], ["formula-01", "formula-02"]]) {
    const partial = structuredClone(dataPackage);
    partial.package.exact_cohort = exactCohort;
    assert.throws(
      () => computeFormulationProposal({ dataPackage: partial, rubric: compiled.rubric, compileReceipt: compiled.receipt }),
      (error) => error.code === "E_PACKAGE_SCHEMA",
    );
  }
});

test("G-02 rejects caller-supplied approval state and preserves the strict CU gate", () => {
  const dataPackage = realDataPackage();
  const compiled = compileRubricFromSpec({ dataPackage });
  assert.throws(
    () => evaluateSelectionV3({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt, approval_state: "test-approved" }),
    (error) => error.code === "E_RUBRIC_APPROVAL_INPUT",
  );
  const cu = compiled.rubric.measures.find((measure) => measure.id === "content_uniformity_av");
  assert.equal(cu.hard_gates[0].operator, "<");
  assert.equal(cu.hard_gates[0].threshold, 15);
  assert.equal(compare(cu.hard_gates[0].operator, 15, cu.hard_gates[0].threshold), false);
});

test("G-02 rejects coordinated rubric and receipt drift from the bound specification", () => {
  const dataPackage = realDataPackage();
  const compiled = compileRubricFromSpec({ dataPackage });
  const driftedRubric = structuredClone(compiled.rubric);
  const cu = driftedRubric.measures.find((measure) => measure.id === "content_uniformity_av");
  cu.hard_gates[0].operator = "<=";
  const driftedReceipt = {
    ...structuredClone(compiled.receipt),
    rubric_sha256: createHash("sha256").update(canonicalJson(driftedRubric)).digest("hex"),
  };

  assert.throws(
    () => computeFormulationProposal({
      dataPackage,
      rubric: driftedRubric,
      compileReceipt: driftedReceipt,
    }),
    (error) => error.code === "E_RUBRIC_SPEC_DRIFT",
  );
});

test("G-02 confirmed lane uses the frozen test-approved plus self-hash seam", () => {
  const dataPackage = realDataPackage();
  const flag = createFdConfirmFlag({
    flag_state: "confirmed",
    confirmed_by: "fd-test-user",
    confirmed_at: "2026-08-08T12:00:00Z",
    note: "test-only confirmation",
  });
  const compiled = compileRubricFromSpec({ dataPackage, fdConfirmFlag: flag });
  const authorized = buildAuthorizedFormulationRubric(compiled.rubric);
  const result = evaluateSelectionV3({ dataPackage, rubric: compiled.rubric, compileReceipt: compiled.receipt, fdConfirmFlag: flag });

  assert.equal(authorized.approval_state, "test-approved");
  assert.equal(compiled.rubric.approval_state, "test-approved");
  assert.equal(compiled.receipt.approval_state, "test-approved");
  assert.equal(compiled.receipt.rubric_sha256, createHash("sha256").update(canonicalJson(compiled.rubric)).digest("hex"));
  assert.deepEqual(result.authorized_rubric, compiled.rubric);
  assert.equal(result.fd_decision.status, "selected");
  assert.equal(result.fd_decision.winner, "formula-03");
  assert.equal(result.fd_decision.rubric_sha256, compiled.receipt.rubric_sha256);
});
