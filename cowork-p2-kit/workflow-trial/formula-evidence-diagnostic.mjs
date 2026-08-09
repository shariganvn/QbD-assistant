import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { canonicalJson } from "./formula-cell-receipt.mjs";
import { validateDataPackage, validateEvidenceEnvelope } from "./real-data-pack.mjs";

const diagnosticSchema = JSON.parse(readFileSync(new URL("./contracts/formula-evidence-diagnostic.schema.v1.json", import.meta.url), "utf8"));
const EXACT_COHORT = ["formula-01", "formula-02", "formula-03"];
const OBSERVED_MEASURES = ["assay", "content_uniformity_av", "dissolution_max", "dissolution_mean", "dissolution_min"];
const SPECIFICATION_MEASURES = ["assay", "content_uniformity_av", "dissolution"];
const SHA256 = /^[a-f0-9]{64}$/;
const sha256Json = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, context) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail("E_DIAGNOSTIC_SCHEMA", `${context} keys must match the contract`);
  }
}

function validateDiagnostic(diagnostic) {
  exactKeys(diagnostic, ["schema_version", "artifact_kind", "decision_status", "winner", "exact_cohort", "candidates", "specifications", "missing_states", "bound_hashes", "evidence_envelope_sha256", "package_sha256"], "formula evidence diagnostic");
  if (diagnostic.schema_version !== diagnosticSchema.properties.schema_version.const
    || diagnostic.artifact_kind !== diagnosticSchema.properties.artifact_kind.const
    || diagnostic.decision_status !== diagnosticSchema.properties.decision_status.const
    || diagnostic.winner !== null) fail("E_DIAGNOSTIC_SCHEMA", "diagnostic must be non-decisional");
  if (JSON.stringify(diagnostic.exact_cohort) !== JSON.stringify(EXACT_COHORT)) fail("E_EXACT_COHORT", "diagnostic cohort is incomplete");
  if (!Array.isArray(diagnostic.candidates) || diagnostic.candidates.length !== EXACT_COHORT.length) fail("E_DIAGNOSTIC_SCHEMA", "diagnostic requires exactly three candidate projections");
  diagnostic.candidates.forEach((candidate, index) => {
    exactKeys(candidate, ["candidate", "observed_results", "composition_context"], "diagnostic candidate");
    if (candidate.candidate !== EXACT_COHORT[index]) fail("E_EXACT_COHORT", "diagnostic candidates must preserve exact cohort order");
    if (!Array.isArray(candidate.observed_results) || candidate.observed_results.length !== OBSERVED_MEASURES.length
      || JSON.stringify(candidate.observed_results.map((entry) => entry.measure).sort()) !== JSON.stringify(OBSERVED_MEASURES)) {
      fail("E_DIAGNOSTIC_SCHEMA", `candidate ${candidate.candidate} observed-result projection is incomplete`);
    }
    if (!Array.isArray(candidate.composition_context) || candidate.composition_context.length !== 1
      || candidate.composition_context[0]?.measure !== "croscarmellose_sodium") {
      fail("E_DIAGNOSTIC_SCHEMA", `candidate ${candidate.candidate} composition projection is incomplete`);
    }
    for (const entry of [...candidate.observed_results, ...candidate.composition_context]) {
      const keys = entry.statistic === undefined
        ? ["evidence_id", "measure", "value", "unit", "record_id", "receipt_id"]
        : ["evidence_id", "measure", "statistic", "value", "unit", "record_id", "receipt_id"];
      exactKeys(entry, keys, "diagnostic evidence projection");
      if (typeof entry.evidence_id !== "string" || typeof entry.record_id !== "string" || typeof entry.receipt_id !== "string"
        || typeof entry.value !== "number" || !Number.isFinite(entry.value) || entry.unit !== "percent") {
        fail("E_DIAGNOSTIC_SCHEMA", `candidate ${candidate.candidate} evidence projection is invalid`);
      }
    }
  });
  if (!Array.isArray(diagnostic.specifications) || diagnostic.specifications.length !== SPECIFICATION_MEASURES.length
    || JSON.stringify(diagnostic.specifications.map((entry) => entry.measure).sort()) !== JSON.stringify(SPECIFICATION_MEASURES)) {
    fail("E_DIAGNOSTIC_SCHEMA", "diagnostic specification projection is incomplete");
  }
  for (const specification of diagnostic.specifications) {
    exactKeys(specification, ["evidence_id", "measure", "operator", "threshold", "lower", "upper", "unit", "basis", "record_id", "receipt_id"], "diagnostic specification projection");
  }
  if (!Array.isArray(diagnostic.missing_states) || diagnostic.missing_states.length !== 0) fail("E_DIAGNOSTIC_SCHEMA", "complete diagnostic must have no missing states");
  exactKeys(diagnostic.bound_hashes, ["source_document_sha256", "document_xml_sha256", "store_records_sha256", "receipt_set_sha256"], "diagnostic bound hashes");
  if (Object.values(diagnostic.bound_hashes).some((value) => !SHA256.test(value))
    || !SHA256.test(diagnostic.evidence_envelope_sha256) || !SHA256.test(diagnostic.package_sha256)) {
    fail("E_DIAGNOSTIC_SCHEMA", "diagnostic binding hashes are invalid");
  }
  for (const token of ["eligible", "passed", "score", "leader", "sensitivity"]) {
    if (JSON.stringify(diagnostic).toLowerCase().includes(token)) fail("E_DIAGNOSTIC_DECISIONAL_FIELD", `diagnostic contains decision token ${token}`);
  }
  return diagnostic;
}

function observedProjection(entry) {
  return {
    evidence_id: entry.evidence_id,
    measure: entry.measure,
    statistic: entry.statistic,
    value: entry.value,
    unit: entry.unit,
    record_id: entry.record_id,
    receipt_id: entry.receipt_id,
  };
}

function compositionProjection(entry) {
  return {
    evidence_id: entry.evidence_id,
    measure: entry.measure,
    value: entry.value,
    unit: entry.unit,
    record_id: entry.record_id,
    receipt_id: entry.receipt_id,
  };
}

export function buildFormulaEvidenceDiagnostic({ dataPackage } = {}) {
  const pkg = dataPackage?.package ?? dataPackage;
  const evidence = dataPackage?.evidence;
  validateDataPackage(pkg);
  validateEvidenceEnvelope(evidence);
  if (JSON.stringify(pkg.exact_cohort) !== JSON.stringify(EXACT_COHORT)) fail("E_EXACT_COHORT", "diagnostic requires the complete formula cohort");
  const candidates = EXACT_COHORT.map((candidate) => ({
    candidate,
    observed_results: evidence.observed_results.filter((entry) => entry.candidate === candidate).map(observedProjection),
    composition_context: evidence.composition_context.filter((entry) => entry.candidate === candidate).map(compositionProjection),
  }));
  const diagnostic = {
    schema_version: "formula-evidence-diagnostic/v1",
    artifact_kind: "non-decisional-evidence-diagnostic",
    decision_status: "not-evaluated",
    winner: null,
    exact_cohort: EXACT_COHORT,
    candidates,
    specifications: evidence.specifications.map((entry) => ({
      evidence_id: entry.evidence_id,
      measure: entry.measure,
      operator: entry.operator,
      threshold: entry.threshold ?? null,
      lower: entry.lower ?? null,
      upper: entry.upper ?? null,
      unit: entry.unit,
      basis: entry.basis,
      record_id: entry.record_id,
      receipt_id: entry.receipt_id,
    })),
    missing_states: [],
    bound_hashes: pkg.bound_hashes,
    evidence_envelope_sha256: pkg.evidence_envelope_sha256,
    package_sha256: sha256Json(pkg),
  };
  return validateDiagnostic(diagnostic);
}

export { validateDiagnostic };
