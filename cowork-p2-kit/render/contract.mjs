import { readFileSync } from "node:fs";

const approvedHostsPath = new URL("./approved-hosts.json", import.meta.url);
const approvedHosts = JSON.parse(readFileSync(approvedHostsPath, "utf8"));

export const APPROVED_HOSTS = new Set(approvedHosts);

export class RenderContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RenderContractError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new RenderContractError(code, message);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function requireExactKeys(value, allowedKeys, code, context) {
  if (!isPlainObject(value)) reject(code, `${context} must be an object`);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowedKeys.includes(key))) {
    reject(code, `${context} has an unknown key`);
  }
}

function requireNonEmptyString(value, code, context) {
  if (typeof value !== "string" || value.trim() === "") {
    reject(code, `${context} must be a non-empty string`);
  }
}

function validateSource(source) {
  requireNonEmptyString(source, "E_CITATION_ENVELOPE", "citation.source");
  if (source.startsWith("/") || source.includes("\\") || source.includes(":")) {
    reject("E_CITATION_ENVELOPE", "citation.source must be a normalized relative POSIX path");
  }
  const segments = source.split("/");
  if (segments.some((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === "" || decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\");
    } catch {
      return true;
    }
  })) {
    reject("E_CITATION_ENVELOPE", "citation.source must not contain empty or dot segments");
  }
}

function validateEvidenceLink(link) {
  if (link === undefined || link === null) return;
  if (typeof link !== "string" || link.trim() === "") {
    reject("E_EVIDENCE_LINK_POLICY", "citation.evidenceLink must be null or an approved HTTPS URL");
  }

  let url;
  try {
    url = new URL(link);
  } catch {
    reject("E_EVIDENCE_LINK_POLICY", "citation.evidenceLink must be an absolute URL");
  }

  const authority = link.match(/^https:\/\/([^/?#]*)/i)?.[1] ?? "";
  const hostAuthority = authority.slice(authority.lastIndexOf("@") + 1);

  if (
    url.protocol !== "https:"
    || url.username !== ""
    || url.password !== ""
    || url.port !== ""
    || hostAuthority.includes(":")
    || !APPROVED_HOSTS.has(url.hostname.toLowerCase())
  ) {
    reject("E_EVIDENCE_LINK_POLICY", "citation.evidenceLink violates the approved-host policy");
  }
}

function validateCitation(citation, evidenceIds, index) {
  const context = `citations[${index}]`;
  requireExactKeys(
    citation,
    ["evidenceId", "source", "location", "excerpt", "classification", "evidenceLink"],
    "E_CITATION_ENVELOPE",
    context,
  );
  for (const field of ["evidenceId", "source", "location", "excerpt"]) {
    requireNonEmptyString(citation[field], "E_CITATION_ENVELOPE", `${context}.${field}`);
  }
  if (evidenceIds.has(citation.evidenceId)) {
    reject("E_CITATION_ENVELOPE", `duplicate evidenceId: ${citation.evidenceId}`);
  }
  evidenceIds.add(citation.evidenceId);
  validateSource(citation.source);

  requireExactKeys(citation.classification, ["label", "citable"], "E_CITATION_ENVELOPE", `${context}.classification`);
  if (citation.classification.label !== "public" || typeof citation.classification.citable !== "boolean") {
    reject("E_CITATION_ENVELOPE", `${context}.classification must be public with a boolean citable value`);
  }
  if (citation.classification.citable !== true) {
    reject("E_CITATION_UNCITABLE", `${context} is not citable`);
  }
  validateEvidenceLink(citation.evidenceLink);
}

function validateParagraph(block, citationCount, index) {
  const context = `blocks[${index}]`;
  requireExactKeys(block, ["type", "text", "segments"], "E_DRAFT_BLOCK", context);
  const hasText = Object.hasOwn(block, "text");
  const hasSegments = Object.hasOwn(block, "segments");
  if (hasText === hasSegments) reject("E_DRAFT_BLOCK", `${context} must have exactly one of text or segments`);
  if (hasText) return requireNonEmptyString(block.text, "E_DRAFT_BLOCK", `${context}.text`);
  if (!Array.isArray(block.segments) || block.segments.length === 0) {
    reject("E_DRAFT_BLOCK", `${context}.segments must be a non-empty array`);
  }
  block.segments.forEach((segment, segmentIndex) => {
    const segmentContext = `${context}.segments[${segmentIndex}]`;
    requireExactKeys(segment, ["text", "citation"], "E_DRAFT_BLOCK", segmentContext);
    const hasSegmentText = Object.hasOwn(segment, "text");
    const hasCitation = Object.hasOwn(segment, "citation");
    if (hasSegmentText === hasCitation) {
      reject("E_DRAFT_BLOCK", `${segmentContext} must have exactly one of text or citation`);
    }
    if (hasSegmentText) return requireNonEmptyString(segment.text, "E_DRAFT_BLOCK", `${segmentContext}.text`);
    if (!Number.isInteger(segment.citation) || segment.citation < 0 || segment.citation >= citationCount) {
      reject("E_CITATION_UNRESOLVED", `${segmentContext}.citation does not resolve`);
    }
  });
}

function validateTable(block, index) {
  const context = `blocks[${index}]`;
  requireExactKeys(block, ["type", "headers", "rows"], "E_DRAFT_BLOCK", context);
  if (!Array.isArray(block.headers) || block.headers.length === 0) {
    reject("E_DRAFT_BLOCK", `${context}.headers must be a non-empty array`);
  }
  block.headers.forEach((header, headerIndex) => requireNonEmptyString(header, "E_DRAFT_BLOCK", `${context}.headers[${headerIndex}]`));
  if (!Array.isArray(block.rows) || block.rows.length === 0) {
    reject("E_DRAFT_BLOCK", `${context}.rows must be a non-empty array`);
  }
  block.rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== block.headers.length) {
      reject("E_DRAFT_BLOCK", `${context}.rows[${rowIndex}] must match header count`);
    }
    row.forEach((cell, cellIndex) => requireNonEmptyString(cell, "E_DRAFT_BLOCK", `${context}.rows[${rowIndex}][${cellIndex}]`));
  });
}

function validateBlock(block, citationCount, index) {
  if (!isPlainObject(block) || typeof block.type !== "string") {
    reject("E_DRAFT_BLOCK", `blocks[${index}] must have a supported type`);
  }
  switch (block.type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "chờ_dữ_liệu":
      requireExactKeys(block, ["type", "text"], "E_DRAFT_BLOCK", `blocks[${index}]`);
      return requireNonEmptyString(block.text, "E_DRAFT_BLOCK", `blocks[${index}].text`);
    case "paragraph":
      return validateParagraph(block, citationCount, index);
    case "table":
      return validateTable(block, index);
    default:
      return reject("E_DRAFT_BLOCK", `blocks[${index}].type is unsupported`);
  }
}

export function validateDraft(draft) {
  requireExactKeys(draft, ["title", "citations", "blocks"], "E_DRAFT_BLOCK", "draft");
  if (Object.hasOwn(draft, "title") && typeof draft.title !== "string") {
    reject("E_DRAFT_BLOCK", "draft.title must be a string when supplied");
  }
  if (!Array.isArray(draft.citations) || !Array.isArray(draft.blocks)) {
    reject("E_DRAFT_BLOCK", "draft.citations and draft.blocks must be arrays");
  }
  const evidenceIds = new Set();
  draft.citations.forEach((citation, index) => validateCitation(citation, evidenceIds, index));
  draft.blocks.forEach((block, index) => validateBlock(block, draft.citations.length, index));
  return draft;
}
