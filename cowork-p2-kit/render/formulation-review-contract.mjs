import { validateDraft } from "./contract.mjs";
import { PROPOSAL_REASONING_HEADERS } from "./formulation-proposal-reasoning.mjs";
import { ownerKey } from "../template-probe/template-field-contract.mjs";
import { readOwnerTexts, visibleText } from "../template-probe/template-owner-reader.mjs";

export const REVIEW_TITLE = "REVIEW ONLY — NON-CITABLE — NOT FD APPROVED";
export const PROPOSAL_WATERMARK = "ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT";

const REQUIRED_HEADINGS = [
  "P.2.2.1 Formulation selection — review-only evidence",
  "Raw evidence and formula context",
  "Extracted specifications",
  "FD decision state",
  PROPOSAL_WATERMARK,
  "Cơ sở bằng chứng — ngắn gọn, không trích dẫn công khai",
];
const EVIDENCE_HEADERS = ["Formula", "Dissolution min %", "Dissolution mean %", "Assay %", "CU AV"];
const SPECIFICATION_HEADERS = ["Measure", "Operator", "Threshold/range", "Source"];
const PROVENANCE_HEADERS = ["Cơ sở bằng chứng", "Nguồn"];
const semanticPlaceholder = /<[A-Z][A-Z0-9%-]*>/;

function fail(message) {
  const error = new Error(`[E_FORMULATION_DRAFT_CONTRACT] ${message}`);
  error.code = "E_FORMULATION_DRAFT_CONTRACT";
  throw error;
}

function sameArray(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function tableByHeaders(draft, headers) {
  return draft.blocks.find((block) => block.type === "table" && sameArray(block.headers, headers));
}

export function inspectFilledTemplateContent(documentXml, receipt) {
  if (!receipt || receipt.occurrence_count !== 146 || !Array.isArray(receipt.entries) || receipt.entries.length !== 146) {
    return { receipt_complete: false, missing_required_fields: [], unresolved_placeholder: false };
  }
  const owners = readOwnerTexts(documentXml);
  const missingRequiredFields = receipt.entries
    .filter((entry) => entry.metadata?.required && (
      typeof entry.raw_value !== "string"
      || entry.raw_value.length === 0
      || !owners.get(ownerKey(entry.owner))?.text.includes(entry.raw_value)
    ))
    .map((entry) => entry.canonical_field_id);
  return {
    receipt_complete: true,
    missing_required_fields: missingRequiredFields,
    unresolved_placeholder: semanticPlaceholder.test(visibleText(documentXml)),
  };
}

export function validateFormulationReviewDraft(draft) {
  validateDraft(draft);
  if (draft.title !== REVIEW_TITLE || draft.citations.length !== 0) fail("review title or citation policy is invalid");

  let priorIndex = -1;
  for (const text of REQUIRED_HEADINGS) {
    const matches = draft.blocks.map((block, index) => ({ block, index }))
      .filter(({ block }) => (block.type === "heading1" || block.type === "heading2") && block.text === text);
    if (matches.length !== 1 || matches[0].index <= priorIndex) fail(`required section is missing, duplicated, or out of order: ${text}`);
    priorIndex = matches[0].index;
  }

  const marker = draft.blocks.find((block) => block.type === "paragraph" && block.text.startsWith(REVIEW_TITLE));
  if (!marker) fail("review-only marker paragraph is missing");
  const missingState = draft.blocks.find((block) => block.type === "paragraph" && block.text.startsWith("Missing/conflicting data state:"));
  if (!missingState || !missingState.text.includes("withholds the engineering proposal")) fail("missing/conflicting-data state is missing or incomplete");
  const fdState = draft.blocks.find((block) => block.type === "paragraph" && (
    block.text.includes("fd_decision: inconclusive; winner: null; action: E_RUBRIC_APPROVAL_REQUIRED")
    || block.text.includes("fd_decision: selected; winner: formula-03; action: selected")
  ));
  if (!fdState) fail("FD decision state is missing");
  const proposal = draft.blocks.find((block) => block.type === "paragraph" && block.text.startsWith("Proposed survivor under the proposed rule:"));
  if (!proposal || !proposal.text.includes("formula-03 (CT03)") || !proposal.text.includes("FD approved: false")) fail("engineering-proposal block is missing or untruthful");
  if (/CT03[^.\n]*(winner|selected|decision|recommendation)/i.test(proposal.text)) fail("engineering-proposal block uses forbidden decision language");

  const reasoningSummary = draft.blocks.find((block) => block.type === "paragraph" && block.text.startsWith("Tóm tắt reasoning:"));
  if (!reasoningSummary || !reasoningSummary.text.includes("dissolution tối thiểu") || !reasoningSummary.text.includes("chỉ mang tính chẩn đoán")) fail("reasoning summary is missing or incomplete");
  const reasoning = tableByHeaders(draft, PROPOSAL_REASONING_HEADERS);
  if (!reasoning || !sameArray(reasoning.rows.map((row) => row[0]), ["CT01", "CT02", "CT03"])
    || reasoning.rows.some((row) => row.some((cell) => String(cell).trim() === ""))) {
    fail("complete proposed-rule reasoning table is required");
  }
  const reasoningBoundary = draft.blocks.find((block) => block.type === "paragraph" && block.text.startsWith("Giới hạn reasoning:"));
  if (!reasoningBoundary || !reasoningBoundary.text.includes("FD chưa xác nhận")) fail("reasoning boundary is missing");

  const evidence = tableByHeaders(draft, EVIDENCE_HEADERS);
  if (!evidence || !sameArray(evidence.rows.map((row) => row[0]), ["formula-01", "formula-02", "formula-03"])
    || evidence.rows.some((row) => row.some((cell) => cell === "—" || String(cell).trim() === ""))) {
    fail("complete three-formula evidence table is required");
  }
  const specifications = tableByHeaders(draft, SPECIFICATION_HEADERS);
  if (!specifications || !sameArray(specifications.rows.map((row) => row[0]), ["Dissolution", "Assay", "Content uniformity AV"])) {
    fail("complete specification table is required");
  }
  const provenance = tableByHeaders(draft, PROVENANCE_HEADERS);
  if (!provenance || provenance.rows.length !== 2 || provenance.rows.some((row) => (
    row.some((cell) => String(cell).trim() === "")
    || !String(row[1]).includes("P.2.2.1")
    || /sha|record|offset|receipt|hash/i.test(row.join(" "))
  ))) fail("concise evidence-basis table is required");
  return draft;
}
