import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { validateEvidenceEnvelope, validateDataPackage } from "../workflow-trial/real-data-pack.mjs";
import { canonicalJson } from "../workflow-trial/formula-cell-receipt.mjs";
import { validateSelectionRubricV3 } from "../reasoning/selection-contracts.mjs";
import { createFdConfirmFlag, validateFdConfirmFlag } from "./fd-confirm-flag.mjs";

const rubricSchema = JSON.parse(readFileSync(new URL("./selection-rubric-v3.schema.json", import.meta.url), "utf8"));
const receiptSchema = JSON.parse(readFileSync(new URL("./spec-compile-receipt.schema.v1.json", import.meta.url), "utf8"));
const EXACT_COHORT = ["formula-01", "formula-02", "formula-03"];
const COMPILER_VERSION = "qbd-p221-spec-compiler/v1";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashJson = (value) => sha256(canonicalJson(value));

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, code, context) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(code, `${context} keys must match the contract`);
  }
}

function spec(evidence, measure) {
  const found = evidence.specifications.find((entry) => entry.measure === measure);
  if (!found) fail("E_RUBRIC_SPEC_INPUT", `missing ${measure} specification evidence`);
  return found;
}

function gate(operator, threshold, specificationEvidenceId) {
  return { operator, threshold, specification_evidence_id: specificationEvidenceId };
}

function measure({ id, sourceMeasure, statistic, critical = true, hardGates, weight, scoreMap }) {
  return {
    id,
    source_measure: sourceMeasure,
    statistic,
    critical,
    direction: "higher-is-better",
    canonical_unit: "percent",
    hard_gates: hardGates,
    score_map: scoreMap,
    weight,
    conflict_tolerance: 0,
  };
}

const zeroWeight = { nominal: 0, min: 0, max: 0 };
const zeroScore = [{ operator: ">=", threshold: 0, points: 0 }];

export function buildFormulationRubric({ evidence, approvalState = "proposal" } = {}) {
  validateEvidenceEnvelope(evidence);
  const dissolution = spec(evidence, "dissolution");
  const assay = spec(evidence, "assay");
  const cu = spec(evidence, "content_uniformity_av");
  if (dissolution.operator !== ">=" || dissolution.unit !== "percent") fail("E_RUBRIC_SPEC_INPUT", "dissolution specification must preserve >= percent semantics");
  if (assay.operator !== "range-inclusive" || assay.unit !== "percent") fail("E_RUBRIC_SPEC_INPUT", "assay specification must preserve inclusive range semantics");
  if (cu.operator !== "<" || cu.unit !== "percent") fail("E_RUBRIC_SPEC_INPUT", "content-uniformity specification must preserve strict < semantics");
  // Dissolution mean scoring rewards release above the Q release gate. The excellence line is
  // anchored to that gate (gate + margin) so the score bands move with the specification instead
  // of assuming a fixed >= 80 gate. Two mutually exclusive bands guarantee scoreV3 matches
  // exactly one rule for any real value, so a lower gate can never produce an overlapping map
  // that would fail the exactly-one-match envelope check downstream.
  const dissolutionExcellenceMargin = 10;
  const dissolutionExcellence = dissolution.threshold + dissolutionExcellenceMargin;
  const rubric = {
    schema_version: 3,
    rubric_id: "qbd-p221-formulation-selection-v3",
    approval_state: approvalState,
    required_candidate_ids: EXACT_COHORT,
    minimum_eligible_candidates: 1,
    selection_mode: "single-survivor-after-complete-cohort",
    measures: [
      measure({
        id: "dissolution_min",
        sourceMeasure: "dissolution_min",
        statistic: "minimum",
        hardGates: [gate(dissolution.operator, dissolution.threshold, dissolution.evidence_id)],
        weight: zeroWeight,
        scoreMap: zeroScore,
      }),
      measure({
        id: "dissolution_mean",
        sourceMeasure: "dissolution_mean",
        statistic: "mean",
        hardGates: [],
        weight: { nominal: 1, min: 1, max: 1 },
        scoreMap: [
          { operator: "<", threshold: dissolutionExcellence, points: 2 },
          { operator: ">=", threshold: dissolutionExcellence, points: 3 },
        ],
      }),
      measure({
        id: "dissolution_max",
        sourceMeasure: "dissolution_max",
        statistic: "maximum",
        critical: false,
        hardGates: [],
        weight: zeroWeight,
        scoreMap: zeroScore,
      }),
      measure({
        id: "assay",
        sourceMeasure: "assay",
        statistic: "raw",
        hardGates: [
          gate(">=", assay.lower, assay.evidence_id),
          gate("<=", assay.upper, assay.evidence_id),
        ],
        weight: zeroWeight,
        scoreMap: zeroScore,
      }),
      measure({
        id: "content_uniformity_av",
        sourceMeasure: "content_uniformity_av",
        statistic: "average",
        hardGates: [gate(cu.operator, cu.threshold, cu.evidence_id)],
        weight: zeroWeight,
        scoreMap: zeroScore,
      }),
    ],
    tie_threshold: 0,
  };
  return validateSelectionRubricV3(rubric);
}

export function buildAuthorizedFormulationRubric(rubric) {
  validateSelectionRubricV3(rubric);
  return validateSelectionRubricV3({ ...rubric, approval_state: "test-approved" });
}

export function validateSpecCompileReceipt(receipt) {
  const code = "E_RUBRIC_SPEC_RECEIPT";
  exactKeys(receipt, [
    "schema_version", "receipt_id", "compiler_version", "source_document_sha256", "document_xml_sha256",
    "store_records_sha256", "receipt_set_sha256", "evidence_envelope_sha256", "specification_evidence_ids",
    "specification_evidence_sha256", "rubric_sha256", "fd_confirm_flag", "approval_state",
  ], code, "spec compile receipt");
  if (receipt.schema_version !== receiptSchema.properties.schema_version.const) fail(code, "spec compile receipt schema version is invalid");
  for (const field of ["source_document_sha256", "document_xml_sha256", "store_records_sha256", "receipt_set_sha256", "evidence_envelope_sha256", "specification_evidence_sha256", "rubric_sha256"]) {
    if (!/^[a-f0-9]{64}$/.test(receipt[field])) fail(code, `${field} must be a SHA-256 hex string`);
  }
  if (!Array.isArray(receipt.specification_evidence_ids) || receipt.specification_evidence_ids.length !== 3) fail(code, "specification evidence IDs must contain three entries");
  if (receipt.approval_state !== "proposal" && receipt.approval_state !== "test-approved") fail(code, "spec compile receipt approval state is invalid");
  validateFdConfirmFlag(receipt.fd_confirm_flag);
  return receipt;
}

export function compileRubricFromSpec({ dataPackage, fdConfirmFlag = createFdConfirmFlag() } = {}) {
  const packageArtifacts = dataPackage?.package ? dataPackage : { package: dataPackage };
  const pkg = packageArtifacts.package;
  const evidence = packageArtifacts.evidence;
  validateDataPackage(pkg);
  validateEvidenceEnvelope(evidence);
  const flag = validateFdConfirmFlag(fdConfirmFlag);
  const rubric = buildFormulationRubric({
    evidence,
    approvalState: flag.flag_state === "confirmed" ? "test-approved" : "proposal",
  });
  const specificationEvidence = evidence.specifications.slice().sort((left, right) => left.evidence_id.localeCompare(right.evidence_id));
  const receipt = validateSpecCompileReceipt({
    schema_version: "spec-compile-receipt/v1",
    receipt_id: `spec-compile-${hashJson(rubric).slice(0, 24)}`,
    compiler_version: COMPILER_VERSION,
    source_document_sha256: pkg.bound_hashes.source_document_sha256,
    document_xml_sha256: pkg.bound_hashes.document_xml_sha256,
    store_records_sha256: pkg.bound_hashes.store_records_sha256,
    receipt_set_sha256: pkg.bound_hashes.receipt_set_sha256,
    evidence_envelope_sha256: pkg.evidence_envelope_sha256,
    specification_evidence_ids: specificationEvidence.map((entry) => entry.evidence_id),
    specification_evidence_sha256: hashJson(specificationEvidence),
    rubric_sha256: hashJson(rubric),
    fd_confirm_flag: flag,
    approval_state: rubric.approval_state,
  });
  return { rubric, receipt, rubric_sha256: receipt.rubric_sha256 };
}

export { COMPILER_VERSION };
