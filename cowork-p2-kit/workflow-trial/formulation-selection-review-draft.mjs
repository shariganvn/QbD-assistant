import {
  PROPOSAL_WATERMARK,
  REVIEW_TITLE,
  validateFormulationReviewDraft,
} from "../render/formulation-review-contract.mjs";

export { REVIEW_TITLE, PROPOSAL_WATERMARK };

function format(value) {
  return value === null || value === undefined ? "—" : String(value);
}

export function buildFormulationReviewDraft({ diagnostic, engineeringProposal, rationale }) {
  if (diagnostic.decision_status !== "not-evaluated" || diagnostic.winner !== null) throw new Error("[E_DRAFT_DIAGNOSTIC] draft requires a raw non-decisional diagnostic");
  const survivor = engineeringProposal.proposed_survivor;
  if (engineeringProposal.fd_approved !== false || typeof survivor !== "string" || survivor === "") throw new Error("[E_DRAFT_PROPOSAL] draft requires a non-FD-approved engineering proposal naming a survivor");
  const confirmed = rationale.decision_state?.status === "selected";
  const specs = Object.fromEntries(diagnostic.specifications.map((specification) => [specification.measure, specification]));
  const evidenceRows = diagnostic.candidates.map((candidate) => {
    const values = Object.fromEntries(candidate.observed_results.map((entry) => [entry.measure, entry.value]));
    const composition = candidate.composition_context.find((entry) => entry.measure === "croscarmellose_sodium");
    return [
      candidate.candidate,
      format(values.dissolution_min),
      format(values.dissolution_mean),
      format(values.dissolution_max),
      format(values.assay),
      format(values.content_uniformity_av),
      format(composition?.value),
    ];
  });
  const draft = {
    title: REVIEW_TITLE,
    citations: [],
    blocks: [
      { type: "heading1", text: "P.2.2.1 Formulation selection — review-only evidence" },
      { type: "paragraph", text: "REVIEW ONLY — NON-CITABLE — NOT FD APPROVED. This document describes source-bound engineering evidence and does not create a dossier decision." },
      { type: "heading2", text: "Raw evidence and formula context" },
      { type: "table", headers: ["Formula", "Dissolution min %", "Dissolution mean %", "Dissolution max %", "Assay %", "CU AV", "Croscarmellose sodium %"], rows: evidenceRows },
      { type: "heading2", text: "Extracted specifications" },
      {
        type: "table",
        headers: ["Measure", "Operator", "Threshold/range", "Source evidence"],
        rows: [
          ["Dissolution", format(specs.dissolution.operator), format(specs.dissolution.threshold), specs.dissolution.evidence_id],
          ["Assay", "90–110", "inclusive", specs.assay.evidence_id],
          ["Content uniformity AV", format(specs.content_uniformity_av.operator), format(specs.content_uniformity_av.threshold), specs.content_uniformity_av.evidence_id],
        ],
      },
      { type: "heading2", text: "FD decision state" },
      {
        type: "paragraph",
        text: confirmed
          ? `fd_decision: selected; winner: ${rationale.decision_state.winner}; action: selected. The trusted fd-confirm flag records the rule outcome; this review-only document is not dossier publication approval.`
          : "fd_decision: inconclusive; winner: null; action: E_RUBRIC_APPROVAL_REQUIRED. The proposal lane has no FD confirmation.",
      },
      { type: "paragraph", text: "Missing/conflicting data state: none in the admitted package. Any missing or conflicting source binding withholds the engineering proposal." },
      { type: "heading2", text: PROPOSAL_WATERMARK },
      { type: "paragraph", text: `Proposed survivor under the proposed rule: ${survivor} (${survivor.replace("formula-", "CT")}). FD approved: false. This conditional engineering proposal is not an FD-approved outcome.` },
      { type: "heading2", text: "Internal provenance references — non-citable" },
      {
        type: "table",
        headers: ["Reference ID", "Evidence ID", "Source file", "Record", "Page", "Offsets", "Quote SHA-256", "Cell receipt"],
        rows: rationale.internal_provenance_references.map((reference) => [
          reference.reference_id,
          reference.evidence_id,
          reference.source_file,
          reference.record_id,
          String(reference.page),
          `${reference.char_start}–${reference.char_end}`,
          reference.quote_sha256,
          reference.cell_receipt_id,
        ]),
      },
    ],
  };
  return validateFormulationReviewDraft(draft);
}
