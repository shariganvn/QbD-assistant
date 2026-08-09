import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { canonicalJson } from "./formula-cell-receipt.mjs";
import { buildFormulaEvidenceDiagnostic } from "./formula-evidence-diagnostic.mjs";
import { validateDataPackage, validateEvidenceEnvelope } from "./real-data-pack.mjs";
import { computeFormulationProposal, evaluateSelectionV3 } from "../reasoning/decision-engine.mjs";
import { validateSelectionRubricV3 } from "../reasoning/selection-contracts.mjs";
import { compileRubricFromSpec, validateSpecCompileReceipt } from "../rubric/compile-rubric-from-spec.mjs";

const internalReferenceSchema = JSON.parse(readFileSync(new URL("./contracts/internal-provenance-reference.schema.v1.json", import.meta.url), "utf8"));
const EXACT_COHORT = ["formula-01", "formula-02", "formula-03"];
const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_PUBLICATION_ARTIFACTS = [
  "compiled-rubric.v3.json",
  "engineering-proposal.json",
  "fact-card-evidence-bindings.json",
  "fact-cards.json",
  "formula-cell-receipts.json",
  "formula-decision.json",
  "formula-evidence-diagnostic.json",
  "formulation-data-package.json",
  "formulation-evidence.json",
  "inventory-reconciliation.json",
  "selection-evaluation.json",
  "spec-compile-receipt.json",
  "template-field-map.v1.json",
  "template-cell-receipt.v1.json",
];
const sha256Json = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const sha256Bytes = (value) => createHash("sha256").update(value).digest("hex");

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, context) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail("E_FORMULATION_RATIONALE_SCHEMA", `${context} keys must match the contract`);
  }
}

function referenceForEvidence(entry) {
  return {
    reference_id: `internal:${entry.evidence_id}`,
    evidence_id: entry.evidence_id,
    receipt_id: entry.receipt_id,
    record_id: entry.record_id,
    source_file: entry.source_file,
    page: entry.page,
    char_start: entry.char_start,
    char_end: entry.char_end,
    quote_sha256: entry.quote_sha256,
    cell_receipt_id: entry.receipt_id,
  };
}

function validateReference(reference) {
  exactKeys(reference, ["reference_id", "evidence_id", "receipt_id", "record_id", "source_file", "page", "char_start", "char_end", "quote_sha256", "cell_receipt_id"], "internal provenance reference");
  if (reference.reference_id !== `internal:${reference.evidence_id}` || reference.receipt_id !== reference.cell_receipt_id) fail("E_INTERNAL_PROVENANCE", "internal reference identity is inconsistent");
  for (const field of ["evidence_id", "receipt_id", "record_id", "cell_receipt_id"]) {
    if (typeof reference[field] !== "string" || reference[field].trim() === "") fail("E_INTERNAL_PROVENANCE", `internal reference ${field} is invalid`);
  }
  if (typeof reference.source_file !== "string" || reference.source_file.trim() === "") fail("E_INTERNAL_PROVENANCE", "internal reference source_file is invalid");
  if (!Number.isInteger(reference.page) || reference.page < 1
    || !Number.isInteger(reference.char_start) || reference.char_start < 0
    || !Number.isInteger(reference.char_end) || reference.char_end <= reference.char_start) {
    fail("E_INTERNAL_PROVENANCE", "internal reference page or source range is invalid");
  }
  if (!SHA256.test(reference.quote_sha256)) fail("E_INTERNAL_PROVENANCE", "internal reference quote_sha256 is invalid");
  return reference;
}

function expectedRationaleClaims(proposedSurvivor, decisionState) {
  const observed = (measure) => EXACT_COHORT.map((candidate) => `observed-result:${measure}:${candidate}`);
  const confirmed = decisionState.status === "selected";
  return [
    {
      claim_id: "fd-state",
      kind: "decision-state",
      text: confirmed
        ? `The trusted FD-confirm flag records ${decisionState.winner} as the confirmed rule outcome; this review-only document remains non-citable and is not dossier publication approval.`
        : "FD decision remains inconclusive because the formulation rubric is still in proposal state; no FD approval was issued.",
      bound_evidence_ids: ["observed-result:dissolution-mean:formula-03"],
    },
    {
      claim_id: "observed-dissolution",
      kind: "observed-evidence",
      text: "The admitted source reports dissolution minimum, mean, and maximum values for all three formulas.",
      bound_evidence_ids: ["dissolution-min", "dissolution-mean", "dissolution-max"].flatMap(observed),
    },
    {
      claim_id: "composition-context",
      kind: "composition-context",
      text: "Croscarmellose sodium context is 1%, 3%, and 5% for formulas 01, 02, and 03 respectively.",
      bound_evidence_ids: EXACT_COHORT.map((candidate) => `composition-context:croscarmellose-sodium:${candidate}`),
    },
    {
      claim_id: "proposed-rule",
      kind: "engineering-proposal",
      text: `Under the proposed dissolution minimum gate and mean-score rule with strict CU<15, ${proposedSurvivor} is surfaced as the proposed survivor; this is NOT FD-approved.`,
      bound_evidence_ids: [
        ...observed("dissolution-min"),
        ...observed("dissolution-mean"),
        ...observed("content-uniformity-av"),
        "specification:dissolution",
        "specification:content-uniformity-av",
      ],
    },
  ];
}

function validatePublicationReceiptBindings(root, publicationReceipt) {
  if (!publicationReceipt || typeof publicationReceipt.artifact_hashes !== "object" || publicationReceipt.artifact_hashes === null) {
    fail("E_RATIONALE_SOURCE_BINDING", "publication receipt has no artifact hash inventory");
  }
  for (const name of REQUIRED_PUBLICATION_ARTIFACTS) {
    if (!Object.prototype.hasOwnProperty.call(publicationReceipt.artifact_hashes, name)
      || !SHA256.test(publicationReceipt.artifact_hashes[name])) {
      fail("E_RATIONALE_SOURCE_BINDING", `publication receipt is missing a valid artifact hash: ${name}`);
    }
  }
  for (const [name, expectedHash] of Object.entries(publicationReceipt.artifact_hashes)) {
    const artifactPath = join(root, name);
    if (!existsSync(artifactPath)) fail("E_RATIONALE_SOURCE_BINDING", `publication artifact is missing: ${name}`);
    const actualHash = sha256Bytes(readFileSync(artifactPath));
    if (actualHash !== expectedHash) fail("E_RATIONALE_SOURCE_BINDING", `publication artifact hash mismatch: ${name}`);
  }
  const receiptBindings = {
    "spec-compile-receipt.json": "compile_receipt_sha256",
    "formula-evidence-diagnostic.json": "diagnostic_sha256",
    "engineering-proposal.json": "engineering_proposal_sha256",
    "formula-decision.json": "fd_decision_sha256",
    "template-field-map.v1.json": "template_field_map_sha256",
    "template-cell-receipt.v1.json": "template_cell_receipt_sha256",
  };
  const packageArtifact = JSON.parse(readFileSync(join(root, "formulation-data-package.json"), "utf8"));
  if (sha256Json(packageArtifact) !== publicationReceipt.package_sha256) {
    fail("E_RATIONALE_SOURCE_BINDING", "publication receipt binding mismatch: package_sha256");
  }
  for (const [name, receiptField] of Object.entries(receiptBindings)) {
    if (!Object.prototype.hasOwnProperty.call(publicationReceipt, receiptField)
      || !Object.prototype.hasOwnProperty.call(publicationReceipt.artifact_hashes, name)
      || !SHA256.test(publicationReceipt[receiptField])) {
      fail("E_RATIONALE_SOURCE_BINDING", `publication receipt is missing a valid binding field: ${receiptField}`);
    }
    if (publicationReceipt[receiptField] !== publicationReceipt.artifact_hashes[name]) {
      fail("E_RATIONALE_SOURCE_BINDING", `publication receipt binding mismatch: ${receiptField}`);
    }
  }
}

function bindingMatches(condition, message) {
  if (!condition) fail("E_RATIONALE_SOURCE_BINDING", message);
}

function validateSelectionEvaluationArtifact(evaluation, fdDecision) {
  exactKeys(evaluation, [
    "schema_version", "evaluation_id", "decision_id", "decision_sha256",
    "rubric_sha256", "matrix_cells", "candidate_reviews", "sensitivity", "outcome_code",
    "selection_evaluated",
  ], "selection evaluation");
  bindingMatches(evaluation.schema_version === "formulation-selection-evaluation/v1", "selection evaluation schema version is invalid");
  bindingMatches(typeof evaluation.evaluation_id === "string" && evaluation.evaluation_id.length > 0, "selection evaluation ID is invalid");
  bindingMatches(typeof evaluation.decision_id === "string" && evaluation.decision_id.length > 0, "selection evaluation decision ID is invalid");
  bindingMatches(SHA256.test(evaluation.decision_sha256), "selection evaluation decision hash is invalid");
  bindingMatches(evaluation.rubric_sha256 === null || SHA256.test(evaluation.rubric_sha256), "selection evaluation rubric hash is invalid");
  const selected = fdDecision.status === "selected";
  bindingMatches(Array.isArray(evaluation.matrix_cells) && (selected ? evaluation.matrix_cells.length > 0 : evaluation.matrix_cells.length === 0), "selection evaluation matrix cells do not match the FD lane");
  bindingMatches(Array.isArray(evaluation.candidate_reviews) && (selected ? evaluation.candidate_reviews.length === 3 : evaluation.candidate_reviews.length === 0), "selection evaluation candidate reviews do not match the FD lane");
  exactKeys(evaluation.sensitivity, ["vectors", "stable_winner"], "selection evaluation sensitivity");
  bindingMatches(Array.isArray(evaluation.sensitivity.vectors) && (selected ? evaluation.sensitivity.vectors.length > 0 : evaluation.sensitivity.vectors.length === 0), "selection evaluation sensitivity does not match the FD lane");
  bindingMatches(evaluation.sensitivity.stable_winner === (selected ? fdDecision.winner : null), "selection evaluation stable winner does not match the FD lane");
  bindingMatches(typeof evaluation.outcome_code === "string" && evaluation.outcome_code.length > 0, "selection evaluation outcome is invalid");
  bindingMatches(evaluation.selection_evaluated === selected, "selection evaluation state does not match the FD lane");
  return evaluation;
}

function validatePackageMemberHashes(dataPackage) {
  validateDataPackage(dataPackage.package);
  validateEvidenceEnvelope(dataPackage.evidence);
  const packageBindings = [
    ["evidence_envelope_sha256", dataPackage.evidence, "formulation evidence"],
    ["fact_cards_sha256", dataPackage.cards, "fact cards"],
    ["fact_card_bindings_sha256", dataPackage.bindings, "fact-card bindings"],
    ["inventory_reconciliation_sha256", dataPackage.reconciliation, "inventory reconciliation"],
  ];
  for (const [field, artifact, label] of packageBindings) {
    bindingMatches(sha256Json(artifact) === dataPackage.package[field], `data package binding mismatch: ${label}`);
  }
  bindingMatches(dataPackage.receiptArtifact?.receipt_set_sha256 === dataPackage.package.bound_hashes.receipt_set_sha256, "data package binding mismatch: receipt set envelope");
  bindingMatches(sha256Json(dataPackage.receipts) === dataPackage.package.bound_hashes.receipt_set_sha256, "data package binding mismatch: receipt set contents");
}

function validateCompiledArtifactBindings({ dataPackage, compiledRubric, compileReceipt, fdDecision }) {
  try {
    validatePackageMemberHashes(dataPackage);
    validateSelectionRubricV3(compiledRubric);
    validateSpecCompileReceipt(compileReceipt);
  } catch (error) {
    fail("E_RATIONALE_SOURCE_BINDING", `compiled formulation artifacts are invalid: ${error.message}`);
  }

  const packageHashes = dataPackage.package.bound_hashes;
  for (const field of ["source_document_sha256", "document_xml_sha256", "store_records_sha256", "receipt_set_sha256"]) {
    bindingMatches(compileReceipt[field] === packageHashes[field], `compile receipt binding mismatch: ${field}`);
  }
  bindingMatches(compileReceipt.evidence_envelope_sha256 === dataPackage.package.evidence_envelope_sha256, "compile receipt binding mismatch: evidence envelope");

  const specifications = dataPackage.evidence.specifications.slice().sort((left, right) => left.evidence_id.localeCompare(right.evidence_id));
  bindingMatches(sha256Json(specifications) === compileReceipt.specification_evidence_sha256, "compile receipt binding mismatch: specification evidence hash");
  bindingMatches(canonicalJson(compileReceipt.specification_evidence_ids) === canonicalJson(specifications.map((entry) => entry.evidence_id)), "compile receipt binding mismatch: specification evidence IDs");
  bindingMatches(sha256Json(compiledRubric) === compileReceipt.rubric_sha256, "compile receipt binding mismatch: rubric hash");
  bindingMatches(compileReceipt.approval_state === compiledRubric.approval_state, "compile receipt binding mismatch: approval state");
  bindingMatches(canonicalJson(compileReceipt.fd_confirm_flag) === canonicalJson(fdDecision.fd_confirm_flag), "compile receipt binding mismatch: fd-confirm flag");
  if (compileReceipt.approval_state === "proposal") {
    bindingMatches(fdDecision.rubric_sha256 === null, "proposal FD decision must not carry a rubric hash");
  } else {
    bindingMatches(fdDecision.rubric_sha256 === compileReceipt.rubric_sha256, "FD decision rubric hash does not match the compiled rubric");
  }

  let expected;
  try {
    expected = compileRubricFromSpec({ dataPackage, fdConfirmFlag: compileReceipt.fd_confirm_flag });
  } catch (error) {
    fail("E_RATIONALE_SOURCE_BINDING", `compiled formulation artifacts cannot be regenerated: ${error.message}`);
  }
  bindingMatches(sha256Json(expected.rubric) === sha256Json(compiledRubric), "compiled rubric does not match the source-derived rubric");
  bindingMatches(sha256Json(expected.receipt) === sha256Json(compileReceipt), "spec compile receipt does not match the source-derived receipt");
}

function validateDiagnosticAndProposal({ dataPackage, diagnostic, engineeringProposal, compiledRubric, compileReceipt, runId }) {
  let expectedDiagnostic;
  try {
    expectedDiagnostic = buildFormulaEvidenceDiagnostic({ dataPackage });
  } catch (error) {
    fail("E_RATIONALE_SOURCE_BINDING", `diagnostic cannot be regenerated: ${error.message}`);
  }
  bindingMatches(sha256Json(expectedDiagnostic) === sha256Json(diagnostic), "formula evidence diagnostic does not match the source-derived diagnostic");

  exactKeys(engineeringProposal, [
    "schema_version", "artifact_kind", "proposed_survivor", "conditional_on", "fd_approved", "excluded_candidates", "bound_hashes",
  ], "engineering proposal");
  bindingMatches(engineeringProposal.schema_version === "engineering-proposal/v1", "engineering proposal schema version is invalid");
  bindingMatches(engineeringProposal.artifact_kind === "engineering-proposal-not-fd-approved", "engineering proposal artifact kind is invalid");
  bindingMatches(engineeringProposal.fd_approved === false, "engineering proposal must remain non-FD-approved");
  bindingMatches(engineeringProposal.conditional_on === "proposed rule (dissolution min-gate + mean-score, strict CU<15), NOT FD-approved", "engineering proposal condition is invalid");
  bindingMatches(canonicalJson(engineeringProposal.bound_hashes) === canonicalJson(dataPackage.package.bound_hashes), "engineering proposal source hashes do not match the data package");

  let expectedProposal;
  try {
    expectedProposal = computeFormulationProposal({
      dataPackage,
      rubric: compiledRubric,
      compileReceipt,
      fdConfirmFlag: compileReceipt.fd_confirm_flag,
      decisionId: `${runId}-proposal`,
    });
  } catch (error) {
    fail("E_RATIONALE_SOURCE_BINDING", `engineering proposal cannot be regenerated: ${error.message}`);
  }
  bindingMatches(engineeringProposal.proposed_survivor === expectedProposal.proposed_survivor, "engineering proposal survivor does not match the source-derived proposal");
  bindingMatches(canonicalJson(engineeringProposal.excluded_candidates) === canonicalJson(expectedProposal.excluded_candidates), "engineering proposal exclusions do not match the source-derived proposal");
}

function validateRationaleSourceArtifacts({ dataPackage, compiledRubric, compileReceipt, diagnostic, engineeringProposal, selectionEvaluation, fdDecision, runId }) {
  validateCompiledArtifactBindings({ dataPackage, compiledRubric, compileReceipt, fdDecision });
  validateDiagnosticAndProposal({ dataPackage, diagnostic, engineeringProposal, compiledRubric, compileReceipt, runId });
  validateSelectionEvaluationArtifact(selectionEvaluation, fdDecision);
  const { decision_sha256: declaredDecisionHash, ...decisionWithoutHash } = fdDecision;
  bindingMatches(SHA256.test(declaredDecisionHash) && sha256Json(decisionWithoutHash) === declaredDecisionHash, "FD decision hash does not match the formula-decision artifact");
  bindingMatches(fdDecision.decision_id === `${runId}-fd-decision`, "FD decision ID does not match the publication run");
  bindingMatches(selectionEvaluation.evaluation_id === `formulation-evaluation-${fdDecision.decision_id}`, "selection evaluation ID does not match the FD decision");
  bindingMatches(selectionEvaluation.decision_id === fdDecision.decision_id, "selection evaluation decision ID does not match the FD decision");
  bindingMatches(selectionEvaluation.decision_sha256 === fdDecision.decision_sha256, "selection evaluation decision hash does not match the FD decision");
  bindingMatches(selectionEvaluation.rubric_sha256 === fdDecision.rubric_sha256, "selection evaluation rubric hash does not match the FD decision");
  bindingMatches(selectionEvaluation.outcome_code === fdDecision.fd_action, "selection evaluation outcome does not match the FD decision");
  let expectedFdResult;
  try {
    expectedFdResult = evaluateSelectionV3({
      dataPackage,
      rubric: compiledRubric,
      compileReceipt,
      fdConfirmFlag: compileReceipt.fd_confirm_flag,
      decisionId: `${runId}-fd-decision`,
    });
  } catch (error) {
    fail("E_RATIONALE_SOURCE_BINDING", `FD decision cannot be regenerated: ${error.message}`);
  }
  bindingMatches(canonicalJson(expectedFdResult.fd_decision) === canonicalJson(fdDecision), "FD decision differs from the source-derived evaluation");
  bindingMatches(canonicalJson(expectedFdResult.selection_evaluation) === canonicalJson(selectionEvaluation), "selection evaluation differs from the source-derived evaluation");
}

export function validateFormulationRationale(rationale) {
  exactKeys(rationale, ["schema_version", "artifact_kind", "run_id", "decision_state", "engineering_proposal", "claims", "internal_provenance_references", "source_classification", "citations", "bound_hashes"], "formulation rationale");
  if (rationale.schema_version !== "formulation-selection-rationale/v1" || rationale.artifact_kind !== "review-only-rationale") fail("E_FORMULATION_RATIONALE_SCHEMA", "rationale artifact kind is invalid");
  const proposalState = rationale.decision_state.status === "inconclusive"
    && rationale.decision_state.winner === null
    && rationale.decision_state.fd_action === "E_RUBRIC_APPROVAL_REQUIRED";
  const confirmedState = rationale.decision_state.status === "selected"
    && rationale.decision_state.winner === "formula-03"
    && rationale.decision_state.fd_action === "selected";
  if (!proposalState && !confirmedState) fail("E_RATIONALE_DECISION_STATE", "rationale decision state does not match a supported FD lane");
  if (rationale.engineering_proposal.fd_approved !== false) fail("E_PROPOSAL_SCHEMA", "rationale proposal must remain non-FD-approved");
  if (rationale.source_classification.label !== "public" || rationale.source_classification.citable !== false) fail("E_RATIONALE_CLASSIFICATION", "source classification must remain public and non-citable");
  if (!Array.isArray(rationale.citations) || rationale.citations.length !== 0) fail("E_RATIONALE_CITATION_POLICY", "non-citable source cannot become a public citation");
  if (!Array.isArray(rationale.internal_provenance_references) || rationale.internal_provenance_references.length === 0) fail("E_INTERNAL_PROVENANCE", "internal provenance references are required");
  const referenceIds = new Set();
  for (const reference of rationale.internal_provenance_references) {
    const evidenceId = validateReference(reference).evidence_id;
    if (referenceIds.has(evidenceId)) fail("E_INTERNAL_PROVENANCE", `duplicate internal reference for ${evidenceId}`);
    referenceIds.add(evidenceId);
  }
  for (const claim of rationale.claims) {
    exactKeys(claim, ["claim_id", "kind", "text", "bound_evidence_ids"], "rationale claim");
    if (!Array.isArray(claim.bound_evidence_ids) || claim.bound_evidence_ids.length === 0
      || claim.bound_evidence_ids.some((id) => !referenceIds.has(id))) {
      fail("E_RATIONALE_CLAIM_BINDING", `claim ${claim.claim_id} is not source-bound`);
    }
  }
  const expectedClaims = expectedRationaleClaims(rationale.engineering_proposal.proposed_survivor, rationale.decision_state);
  if (canonicalJson(rationale.claims) !== canonicalJson(expectedClaims)) {
    fail("E_RATIONALE_CLAIM_CONTRACT", "rationale claims differ from the source-bound P.2.2.1 claim contract");
  }
  const proposalText = JSON.stringify(rationale.engineering_proposal).toLowerCase();
  for (const token of ["winner", "selected", "decision", "eligible", "recommendation"]) if (proposalText.includes(token)) fail("E_PROPOSAL_LANGUAGE", `proposal contains forbidden token ${token}`);
  return rationale;
}

export function buildFormulationRationale({ dataPackage, diagnostic, fdDecision, engineeringProposal, publicationReceipt, publicationReceiptSha256, runId }) {
  const allEvidence = [
    ...dataPackage.evidence.observed_results,
    ...dataPackage.evidence.specifications,
    ...dataPackage.evidence.composition_context,
  ];
  const references = allEvidence.map(referenceForEvidence);
  const decisionState = {
    status: fdDecision.status,
    winner: fdDecision.winner,
    fd_action: fdDecision.fd_action,
    decision_sha256: fdDecision.decision_sha256,
  };
  const rationale = {
    schema_version: "formulation-selection-rationale/v1",
    artifact_kind: "review-only-rationale",
    run_id: runId,
    decision_state: decisionState,
    engineering_proposal: engineeringProposal,
    claims: expectedRationaleClaims(engineeringProposal.proposed_survivor, decisionState),
    internal_provenance_references: references,
    source_classification: { label: "public", citable: false },
    citations: [],
    bound_hashes: {
      ...dataPackage.package.bound_hashes,
      package_sha256: sha256Json(dataPackage.package),
      publication_receipt_sha256: publicationReceiptSha256 ?? sha256Json(publicationReceipt),
      diagnostic_sha256: sha256Json(diagnostic),
      engineering_proposal_sha256: sha256Json(engineeringProposal),
      template_sha256: publicationReceipt.template_sha256,
      template_field_map_sha256: publicationReceipt.template_field_map_sha256,
      template_cell_receipt_sha256: publicationReceipt.template_cell_receipt_sha256,
    },
  };
  return validateFormulationRationale(rationale);
}

export function buildFormulationRationalePackage({ phase3Root, runId }) {
  const root = resolve(phase3Root);
  const publicationReceiptBytes = readFileSync(join(root, "publication-receipt.json"));
  const publicationReceipt = JSON.parse(publicationReceiptBytes.toString("utf8"));
  if (publicationReceipt.run_id !== runId) fail("E_RATIONALE_SOURCE_BINDING", "rationale run_id does not match the source publication receipt");
  validatePublicationReceiptBindings(root, publicationReceipt);
  const read = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));
  const dataPackage = {
    package: read("formulation-data-package.json"),
    evidence: read("formulation-evidence.json"),
    cards: read("fact-cards.json"),
    bindings: read("fact-card-evidence-bindings.json"),
    reconciliation: read("inventory-reconciliation.json"),
    receipts: JSON.parse(readFileSync(join(root, "formula-cell-receipts.json"), "utf8")).receipts,
  };
  dataPackage.receiptArtifact = read("formula-cell-receipts.json");
  const compiledRubric = read("compiled-rubric.v3.json");
  const compileReceipt = read("spec-compile-receipt.json");
  const diagnostic = read("formula-evidence-diagnostic.json");
  const fdDecision = read("formula-decision.json");
  const selectionEvaluation = read("selection-evaluation.json");
  const engineeringProposal = read("engineering-proposal.json");
  validateRationaleSourceArtifacts({ dataPackage, compiledRubric, compileReceipt, diagnostic, engineeringProposal, selectionEvaluation, fdDecision, runId });
  const publicationReceiptSha256 = createHash("sha256").update(publicationReceiptBytes).digest("hex");
  const rationale = buildFormulationRationale({ dataPackage, diagnostic, fdDecision, engineeringProposal, publicationReceipt, publicationReceiptSha256, runId });
  const packet = {
    schema_version: "formulation-rationale-package/v1",
    packet_id: `formulation-rationale-${runId}`,
    run_id: runId,
    source_publication_receipt_sha256: publicationReceiptSha256,
    source_artifact_hashes: publicationReceipt.artifact_hashes,
    diagnostic,
    fd_decision: fdDecision,
    engineering_proposal: engineeringProposal,
    data_package: dataPackage.package,
    rationale,
  };
  return { packet, rationale, dataPackage, diagnostic, fdDecision, engineeringProposal, publicationReceipt };
}
