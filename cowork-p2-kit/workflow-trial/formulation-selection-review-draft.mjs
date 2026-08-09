import {
  PROPOSAL_WATERMARK,
  REVIEW_TITLE,
  validateFormulationReviewDraft,
} from "../render/formulation-review-contract.mjs";
import {
  buildProposalReasoning,
  PROPOSAL_REASONING_HEADERS,
} from "../render/formulation-proposal-reasoning.mjs";

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
  const sourceDocument = rationale.internal_provenance_references[0]?.source_file?.split("/").at(-1)
    ?? "filled-public-mock-document-030826.docx";
  const evidenceRows = diagnostic.candidates.map((candidate) => {
    const values = Object.fromEntries(candidate.observed_results.map((entry) => [entry.measure, entry.value]));
    return [
      candidate.candidate,
      format(values.dissolution_min),
      format(values.dissolution_mean),
      format(values.assay),
      format(values.content_uniformity_av),
    ];
  });
  const specificationRows = [
    ["Dissolution", format(specs.dissolution.operator), format(specs.dissolution.threshold), `${sourceDocument} — P.2.2.1 specification table`],
    ["Assay", "90–110", "inclusive", `${sourceDocument} — P.2.2.1 specification table`],
    ["Content uniformity AV", format(specs.content_uniformity_av.operator), format(specs.content_uniformity_av.threshold), `${sourceDocument} — P.2.2.1 specification table`],
  ];
  const reasoning = buildProposalReasoning({
    evidenceRows,
    specificationRows,
    proposedSurvivor: survivor,
  });
  const conciseProvenanceRows = [
    ["Kết quả quan sát: dissolution, assay, CU AV", `${sourceDocument} — P.2.2.1 results table`],
    ["Tiêu chí dùng cho đề xuất", `${sourceDocument} — P.2.2.1 specification table`],
  ];
  const draft = {
    title: REVIEW_TITLE,
    citations: [],
    blocks: [
      { type: "heading1", text: "P.2.2.1 Formulation selection — review-only evidence" },
      { type: "paragraph", text: "REVIEW ONLY — NON-CITABLE — NOT FD APPROVED. This document describes source-bound engineering evidence and does not create a dossier decision." },
      { type: "heading2", text: "Raw evidence and formula context" },
      { type: "table", headers: ["Formula", "Dissolution min %", "Dissolution mean %", "Assay %", "CU AV"], rows: evidenceRows },
      { type: "heading2", text: "Extracted specifications" },
      {
        type: "table",
        headers: ["Measure", "Operator", "Threshold/range", "Source"],
        rows: specificationRows,
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
      { type: "paragraph", text: `Tóm tắt reasoning: ${reasoning.summary}` },
      { type: "table", headers: PROPOSAL_REASONING_HEADERS, rows: reasoning.rows },
      { type: "paragraph", text: reasoning.boundary },
      { type: "heading2", text: "Cơ sở bằng chứng — ngắn gọn, không trích dẫn công khai" },
      { type: "table", headers: ["Cơ sở bằng chứng", "Nguồn"], rows: conciseProvenanceRows },
    ],
  };
  return validateFormulationReviewDraft(draft);
}
