// Stage B structural validator. Checks the draft JSON's SHAPE against
// schemas/p2-draft-contract.md and schemas/p2-outline.json — it cannot and does not judge whether
// a table was mapped to the correct CTD section, or whether "covered" content is a verbatim copy
// of the source (see draft/checklist.md for that judgment call).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TABLE_WIDTH_DXA } from "../schemas/layout.mjs";

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
const VALID_COLUMN_ALIGN = new Set(["left", "center", "justify"]);
// Keys the renderer actually reads. Anything else in a block is a typo the renderer would silently
// ignore (falling back to default widths/alignment), so it is rejected rather than dropped.
const ALLOWED_BLOCK_KEYS = {
  heading2: new Set(["type", "text"]),
  heading3: new Set(["type", "text"]),
  paragraph: new Set(["type", "text", "italic", "bold"]),
  table: new Set(["type", "headers", "rows", "columnWidths", "columnAlign", "headerless"]),
};
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
  for (const key of Object.keys(block)) {
    if (!ALLOWED_BLOCK_KEYS[block.type].has(key)) {
      fail("E_BLOCK_UNKNOWN_FIELD", `${where} has unknown field "${key}" for a ${block.type} block — the renderer would ignore it`);
    }
  }
  if (block.type === "heading2" || block.type === "heading3" || block.type === "paragraph") {
    if (typeof block.text !== "string" || block.text.trim() === "") {
      fail("E_BLOCK_TEXT", `${where}.text must be a non-empty string`);
    }
    // Only table cells render a newline as a line break; here Word would swallow it and join the
    // text, so reject it instead of producing prose the author did not write.
    if (block.text.includes("\n")) {
      fail("E_BLOCK_TEXT", `${where}.text must not contain a newline — only table cells render line breaks`);
    }
  }
  if (block.type === "table") {
    if (!Array.isArray(block.headers) || block.headers.length === 0) {
      fail("E_TABLE_HEADERS", `${where}.headers must be a non-empty array`);
    }
    if (!block.headers.every((header) => typeof header === "string" && header.trim() !== "")) {
      fail("E_TABLE_HEADERS", `${where}.headers entries must be non-empty strings`);
    }
    if (!Array.isArray(block.rows)) fail("E_TABLE_ROWS", `${where}.rows must be an array`);
    block.rows.forEach((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== block.headers.length) {
        fail("E_TABLE_ROW_WIDTH", `${where}.rows[${rowIndex}] must have ${block.headers.length} cells (one per header)`);
      }
      // Cells must already be strings: the renderer stringifies whatever it gets, so a number
      // would silently render with a decimal point where the source uses a comma.
      row.forEach((cell, cellIndex) => {
        if (typeof cell !== "string") {
          fail("E_TABLE_CELL_TYPE", `${where}.rows[${rowIndex}][${cellIndex}] must be a string, got ${typeof cell}`);
        }
      });
    });
    if (block.columnWidths !== undefined) {
      const widths = block.columnWidths;
      if (!Array.isArray(widths) || widths.length !== block.headers.length) {
        fail("E_TABLE_COLUMN_WIDTHS", `${where}.columnWidths must have ${block.headers.length} entries (one per header)`);
      }
      if (!widths.every((width) => Number.isInteger(width) && width > 0)) {
        fail("E_TABLE_COLUMN_WIDTHS", `${where}.columnWidths entries must be positive integers (DXA units)`);
      }
      const total = widths.reduce((sum, width) => sum + width, 0);
      if (total !== TABLE_WIDTH_DXA) {
        fail("E_TABLE_COLUMN_WIDTHS", `${where}.columnWidths must sum to ${TABLE_WIDTH_DXA}, got ${total}`);
      }
    }
    // A label/value form has no header row to print, but it still has columns: headers stay
    // required because they fix the column count that widths and every row are checked against.
    // The flag only decides whether that row is rendered.
    if (block.headerless !== undefined && typeof block.headerless !== "boolean") {
      fail("E_TABLE_HEADERLESS", `${where}.headerless must be a boolean`);
    }
    if (block.columnAlign !== undefined) {
      const align = block.columnAlign;
      if (!Array.isArray(align) || align.length !== block.headers.length) {
        fail("E_TABLE_COLUMN_ALIGN", `${where}.columnAlign must have ${block.headers.length} entries (one per header)`);
      }
      if (!align.every((value) => VALID_COLUMN_ALIGN.has(value))) {
        fail("E_TABLE_COLUMN_ALIGN", `${where}.columnAlign entries must be one of ${[...VALID_COLUMN_ALIGN].join(", ")}`);
      }
    }
  }
}

// The P.2 form is the one thing that must not vary between products: a different active substance
// brings different excipients, different quality attributes and different process steps, but the
// department's document keeps the same sections, tables and row labels. Those rules live in
// schemas/p2-outline.json under `form` so they apply to any draft, rather than only to whichever
// example the tests happen to load. See `_formSpec` there for the notation.
const COLUMN_ANY = "*";
const COLUMN_REST = "...";

function firstTableRowLabels(draft, sectionId) {
  const section = draft.sections.find((entry) => entry.id === sectionId);
  const table = section?.blocks?.find((block) => block.type === "table");
  return table ? table.rows.map((row) => row[0]) : undefined;
}

function validateColumns(actual, expected, where) {
  const openEnded = expected[expected.length - 1] === COLUMN_REST;
  const fixed = openEnded ? expected.slice(0, -1) : expected;
  if (openEnded ? actual.length < fixed.length : actual.length !== fixed.length) {
    fail("E_FORM_COLUMNS", `${where} must have ${openEnded ? "at least " : ""}${fixed.length} columns, got ${actual.length}`);
  }
  fixed.forEach((want, index) => {
    const got = actual[index];
    if (want === COLUMN_ANY) {
      // The label carries a product name (the reference product, the trial it belongs to), so the
      // form fixes the position and leaves the wording to the draft.
      if (typeof got !== "string" || got.trim() === "") {
        fail("E_FORM_COLUMNS", `${where} column ${index + 1} must be a non-empty label`);
      }
      return;
    }
    if (got !== want) fail("E_FORM_COLUMNS", `${where} column ${index + 1} must be "${want}", got "${got}"`);
  });
}

// A product may have any number of strengths, and a table that reports per strength carries one
// column group for each. The group SIZE is derived here rather than declared in the outline: the
// house form uses one column per strength in the composition comparison and two (mass and per cent)
// in the final formula, and a number written into the schema would be one more thing to keep in step
// with the table it describes. When `perStrength` is set, `columns` declares only the fixed prefix.
function validateStrengthColumns(table, tableSpec, draft, where) {
  const strengths = draft.meta.strengths;
  const fixedCount = Array.isArray(tableSpec.columns) ? tableSpec.columns.length : 0;
  const remaining = table.headers.length - fixedCount;
  if (remaining <= 0 || remaining % strengths.length !== 0) {
    fail("E_FORM_STRENGTH_COLUMNS", `${where} must carry one equal column group per declared strength: ${remaining} column(s) after the ${fixedCount} fixed one(s) does not divide by ${strengths.length} strength(s)`);
  }
  const groupSize = remaining / strengths.length;
  strengths.forEach((strength, index) => {
    const label = table.headers[fixedCount + index * groupSize];
    // The longest declared strength the label contains must be its own. Plain containment is too
    // weak — "15 mg" contains "5 mg", so transposed groups would pass while every value sat under the
    // wrong heading — and "contains no other strength" is too strong, because it would reject the
    // correct "15 mg" label for exactly the same reason. Longest match separates the two: for a
    // 5 mg / 15 mg pair, and for 2,5 mg / 5 mg, each label resolves to the strength it names.
    const named = strengths
      .filter((candidate) => label.includes(candidate))
      .sort((a, b) => b.length - a.length);
    if (named[0] !== strength) {
      fail("E_FORM_STRENGTH_COLUMNS", `${where} column ${fixedCount + index * groupSize + 1} must name strength "${strength}", got "${label}"${named.length ? ` which names "${named[0]}"` : ""}`);
    }
  });
  return groupSize;
}

function validateRows(table, tableSpec, draft, where) {
  if (tableSpec.rows === "variable") return;
  let expected = tableSpec.rows;
  if (tableSpec.rowsFrom) {
    expected = firstTableRowLabels(draft, tableSpec.rowsFrom);
    if (!expected) {
      fail("E_FORM_ROWS", `${where} takes its row labels from section "${tableSpec.rowsFrom}", which has no table`);
    }
  }
  if (!expected) return;
  const actual = table.rows.map((row) => row[0]);
  if (actual.length !== expected.length || actual.some((label, index) => label !== expected[index])) {
    const source = tableSpec.rowsFrom ? ` (must match section "${tableSpec.rowsFrom}")` : "";
    fail("E_FORM_ROWS", `${where} row labels do not match the P.2 form${source}. Expected: ${expected.join(" | ")}. Got: ${actual.join(" | ")}`);
  }
}

function validateSectionForm(section, spec, draft) {
  if (Array.isArray(spec.headings)) {
    const actual = section.blocks.filter((block) => block.type.startsWith("heading")).map((block) => block.text);
    if (actual.length !== spec.headings.length || actual.some((text, index) => text !== spec.headings[index])) {
      fail("E_FORM_HEADINGS", `section "${section.id}" headings do not match the P.2 form. Expected: ${spec.headings.join(" | ") || "(none)"}. Got: ${actual.join(" | ") || "(none)"}`);
    }
  }
  if (!Array.isArray(spec.tables)) return;
  const tables = section.blocks.filter((block) => block.type === "table");
  if (tables.length !== spec.tables.length) {
    fail("E_FORM_TABLE_COUNT", `section "${section.id}" must have ${spec.tables.length} table(s) per the P.2 form, got ${tables.length}`);
  }
  spec.tables.forEach((tableSpec, index) => {
    const table = tables[index];
    const where = `section "${section.id}" table ${index + 1}`;
    if (tableSpec.perStrength) {
      // The two make opposite claims about the trailing columns — one says "any number, any name",
      // the other "exactly one group per strength" — so a table declaring both has no defined shape.
      if (Array.isArray(tableSpec.columns) && tableSpec.columns.includes(COLUMN_REST)) {
        fail("E_FORM_COLUMNS", `${where} declares both perStrength and an open-ended column list`);
      }
      if (Array.isArray(tableSpec.columns)) {
        validateColumns(table.headers.slice(0, tableSpec.columns.length), tableSpec.columns, where);
      }
      validateStrengthColumns(table, tableSpec, draft, where);
    } else if (Array.isArray(tableSpec.columns)) {
      validateColumns(table.headers, tableSpec.columns, where);
    }
    if (Boolean(table.headerless) !== Boolean(tableSpec.headerless)) {
      fail("E_FORM_HEADERLESS", `${where} must ${tableSpec.headerless ? "be" : "not be"} headerless`);
    }
    validateRows(table, tableSpec, draft, where);
  });
}

// `outline` is injectable so a test can prove a form rule on a purpose-built form rather than only on
// whichever shape the department's current outline happens to have. The CLI and the renderer pass
// nothing and get the real one, so there is no second source of truth in normal use.
export function validateDraft(draft, outline = loadOutline()) {
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
  // Which strengths the document covers is data, so it is declared here rather than inferred from the
  // product name. There is no upper bound: a two-strength product and a five-strength one take the
  // same form.
  if (!Array.isArray(draft.meta.strengths) || draft.meta.strengths.length === 0) {
    fail("E_META_STRENGTHS", "draft.meta.strengths must be a non-empty array");
  }
  if (!draft.meta.strengths.every((strength) => typeof strength === "string" && strength.trim() !== "")) {
    fail("E_META_STRENGTHS", "draft.meta.strengths entries must be non-empty strings");
  }
  if (new Set(draft.meta.strengths).size !== draft.meta.strengths.length) {
    fail("E_META_STRENGTHS", "draft.meta.strengths must not repeat a strength");
  }
  // A strength listed here has no experimental source of its own — its composition comes from a
  // proportional calculation. What that costs it is enforced where the tables are checked.
  if (draft.meta.derivedStrengths !== undefined) {
    if (!Array.isArray(draft.meta.derivedStrengths)) {
      fail("E_META_STRENGTHS", "draft.meta.derivedStrengths must be an array when present");
    }
    const unknown = draft.meta.derivedStrengths.filter((strength) => !draft.meta.strengths.includes(strength));
    if (unknown.length > 0) {
      fail("E_META_STRENGTHS", `draft.meta.derivedStrengths names strength(s) absent from meta.strengths: ${unknown.join(", ")}`);
    }
  }
  // Anything a section states that did not come out of sourceFile must be named here, so the
  // rendered cover page declares every source the document draws on rather than only the trial file.
  if (draft.meta.referenceSources !== undefined) {
    if (!Array.isArray(draft.meta.referenceSources) || draft.meta.referenceSources.length === 0) {
      fail("E_META_REFERENCE_SOURCES", "draft.meta.referenceSources must be a non-empty array when present");
    }
    if (!draft.meta.referenceSources.every((source) => typeof source === "string" && source.trim() !== "")) {
      fail("E_META_REFERENCE_SOURCES", "draft.meta.referenceSources entries must be non-empty strings");
    }
  }

  if (!Array.isArray(draft.sections)) fail("E_SECTIONS_SHAPE", "draft.sections must be an array");

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
      const spec = outline.sections.find((entry) => entry.id === section.id)?.form;
      if (spec) validateSectionForm(section, spec, draft);
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
