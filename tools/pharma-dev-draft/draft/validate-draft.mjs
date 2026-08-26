// Stage B structural validator. Checks the draft JSON's SHAPE against
// schemas/p2-draft-contract.md and schemas/p2-outline.json — it cannot and does not judge whether
// a table was mapped to the correct CTD section, or whether "covered" content is a verbatim copy
// of the source (see draft/checklist.md for that judgment call).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const draftDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(draftDir, "..");

export class DraftContractError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "DraftContractError";
    this.code = code;
  }
}

const VALID_BLOCK_TYPES = new Set(["heading2", "heading3", "paragraph", "table"]);
const REQUIRED_META_FIELDS = ["productName", "apiName", "sourceFile", "draftDate", "preparer", "extractionMethod"];

function loadOutline() {
  const raw = readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8");
  return JSON.parse(raw);
}

function fail(code, message) {
  throw new DraftContractError(code, message);
}

function validateBlock(block, sectionId, index) {
  const where = `sections[${sectionId}].blocks[${index}]`;
  if (typeof block !== "object" || block === null) fail("E_BLOCK_SHAPE", `${where} must be an object`);
  if (!VALID_BLOCK_TYPES.has(block.type)) {
    fail("E_BLOCK_TYPE", `${where}.type must be one of ${[...VALID_BLOCK_TYPES].join(", ")}, got: ${block.type}`);
  }
  if (block.type === "heading2" || block.type === "heading3" || block.type === "paragraph") {
    if (typeof block.text !== "string" || block.text.trim() === "") {
      fail("E_BLOCK_TEXT", `${where}.text must be a non-empty string`);
    }
  }
  if (block.type === "table") {
    if (!Array.isArray(block.headers) || block.headers.length === 0) {
      fail("E_TABLE_HEADERS", `${where}.headers must be a non-empty array`);
    }
    if (!Array.isArray(block.rows)) fail("E_TABLE_ROWS", `${where}.rows must be an array`);
    block.rows.forEach((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== block.headers.length) {
        fail("E_TABLE_ROW_WIDTH", `${where}.rows[${rowIndex}] must have ${block.headers.length} cells (one per header)`);
      }
    });
  }
}

export function validateDraft(draft) {
  if (typeof draft !== "object" || draft === null) fail("E_DRAFT_SHAPE", "draft must be an object");
  if (draft.schemaVersion !== "1.0") fail("E_SCHEMA_VERSION", `unsupported schemaVersion: ${draft.schemaVersion}`);

  if (typeof draft.meta !== "object" || draft.meta === null) fail("E_META_SHAPE", "draft.meta must be an object");
  for (const field of REQUIRED_META_FIELDS) {
    if (typeof draft.meta[field] !== "string" || draft.meta[field].trim() === "") {
      fail("E_META_FIELD", `draft.meta.${field} must be a non-empty string`);
    }
  }
  if (!["xml-walk", "liteparse"].includes(draft.meta.extractionMethod)) {
    fail("E_META_FIELD", `draft.meta.extractionMethod must be "xml-walk" or "liteparse"`);
  }

  if (!Array.isArray(draft.sections)) fail("E_SECTIONS_SHAPE", "draft.sections must be an array");

  const outline = loadOutline();
  const outlineIds = outline.sections.map((section) => section.id);
  const seenIds = new Set();

  for (const section of draft.sections) {
    if (typeof section?.id !== "string") fail("E_SECTION_ID", "every section must have a string id");
    if (!outlineIds.includes(section.id)) {
      fail("E_SECTION_UNKNOWN_ID", `section id "${section.id}" is not in schemas/p2-outline.json`);
    }
    if (seenIds.has(section.id)) fail("E_SECTION_DUPLICATE_ID", `section id "${section.id}" appears more than once`);
    seenIds.add(section.id);

    if (section.status === "gap") {
      if (typeof section.gapReason !== "string" || section.gapReason.trim() === "") {
        fail("E_GAP_REASON", `section "${section.id}" has status "gap" but no gapReason`);
      }
      if (section.blocks !== undefined && section.blocks.length > 0) {
        fail("E_GAP_HAS_BLOCKS", `section "${section.id}" has status "gap" but also has blocks`);
      }
    } else if (section.status === "covered") {
      if (section.gapReason !== undefined) {
        fail("E_COVERED_HAS_GAP_REASON", `section "${section.id}" has status "covered" but also has gapReason`);
      }
      if (!Array.isArray(section.blocks) || section.blocks.length === 0) {
        fail("E_COVERED_NO_BLOCKS", `section "${section.id}" has status "covered" but no blocks`);
      }
      section.blocks.forEach((block, index) => validateBlock(block, section.id, index));
    } else {
      fail("E_SECTION_STATUS", `section "${section.id}".status must be "covered" or "gap", got: ${section.status}`);
    }
  }

  const missingIds = outlineIds.filter((id) => !seenIds.has(id));
  if (missingIds.length > 0) {
    fail("E_SECTIONS_MISSING", `draft is missing required sections: ${missingIds.join(", ")}`);
  }

  return draft;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write("E_ARGS: usage: validate-draft.mjs <draft.json>\n");
    process.exitCode = 1;
    return;
  }
  const raw = readFileSync(inputPath, "utf8");
  const draft = JSON.parse(raw);
  validateDraft(draft);
  process.stdout.write(`OK: ${inputPath} — ${draft.sections.length} sections, all valid.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const code = error instanceof DraftContractError ? error.code : "E_UNKNOWN";
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
