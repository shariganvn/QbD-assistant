// Stage B structural validator. Checks the draft JSON's SHAPE against
// schemas/p2-draft-contract.md and schemas/p2-outline.json — it cannot and does not judge whether
// a table was mapped to the correct CTD section, or whether "covered" content is a verbatim copy
// of the source (see draft/checklist.md for that judgment call).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TABLE_WIDTH_DXA } from "../schemas/layout.mjs";
import { isDecisionText, isGapText, markerText } from "../schemas/markers.mjs";
import { barSeries, flowSteps, processStages } from "../render/figures/figure-source.mjs";

const draftDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(draftDir, "..");

export class DraftContractError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "DraftContractError";
    this.code = code;
  }
}

const VALID_BLOCK_TYPES = new Set(["heading2", "heading3", "paragraph", "table", "figure", "image"]);
const VALID_FIGURE_KINDS = new Set(["flow", "bars", "process"]);
const VALID_FIGURE_AXES = new Set(["columns", "rows"]);
// Supplied figures live in one directory under the tool. A draft naming an arbitrary path would let a
// rendered dossier pull in a file nobody reviewed.
const IMAGE_ROOT = "assets/";
const VALID_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const VALID_COLUMN_ALIGN = new Set(["left", "center", "justify"]);
// Keys the renderer actually reads. Anything else in a block is a typo the renderer would silently
// ignore (falling back to default widths/alignment), so it is rejected rather than dropped.
const ALLOWED_BLOCK_KEYS = {
  heading2: new Set(["type", "text"]),
  heading3: new Set(["type", "text"]),
  paragraph: new Set(["type", "text", "italic", "bold"]),
  table: new Set(["type", "id", "headers", "rows", "columnWidths", "columnAlign", "headerless"]),
  figure: new Set(["type", "kind", "fromTable", "fromAxis", "fromRow", "threshold", "thresholdLabel", "axisLabel", "caption"]),
  image: new Set(["type", "path", "caption", "widthPt"]),
};
const REQUIRED_META_FIELDS = ["productName", "apiName", "draftDate", "preparer", "extractionMethod"];

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
  if (block.type === "figure") {
    if (!VALID_FIGURE_KINDS.has(block.kind)) {
      fail("E_FIGURE_SHAPE", `${where}.kind must be one of ${[...VALID_FIGURE_KINDS].join(", ")}, got: ${block.kind}`);
    }
    // A name, not a number. The index this replaced was positional, so a table moved or inserted ahead
    // of a figure silently redirected it; a name does not move when the table does. The old form is
    // refused rather than accepted alongside — one field with two spellings is one field that will
    // disagree with itself.
    if (typeof block.fromTable !== "string" || block.fromTable.trim() === "") {
      fail("E_FIGURE_SHAPE", `${where}.fromTable must name the id of a table in the same section${typeof block.fromTable === "number" ? " — a table index no longer resolves, give the table an id and name it here" : ""}`);
    }
    if (typeof block.caption !== "string" || block.caption.trim() === "") {
      fail("E_FIGURE_SHAPE", `${where}.caption must be a non-empty string — a figure with no caption states nothing about what it shows`);
    }
    if (block.kind === "flow" && block.fromAxis !== undefined && !VALID_FIGURE_AXES.has(block.fromAxis)) {
      fail("E_FIGURE_SHAPE", `${where}.fromAxis must be one of ${[...VALID_FIGURE_AXES].join(", ")}`);
    }
    if (block.kind === "bars" && (typeof block.fromRow !== "string" || block.fromRow.trim() === "")) {
      fail("E_FIGURE_SHAPE", `${where}.fromRow must name the table row the chart plots`);
    }
  }
  if (block.type === "image") {
    if (typeof block.path !== "string" || !block.path.startsWith(IMAGE_ROOT) || block.path.includes("..")) {
      fail("E_IMAGE_PATH", `${where}.path must be a path under "${IMAGE_ROOT}" with no parent-directory segment, got: ${block.path}`);
    }
    if (!VALID_IMAGE_EXTENSIONS.some((extension) => block.path.toLowerCase().endsWith(extension))) {
      fail("E_IMAGE_PATH", `${where}.path must end in one of ${VALID_IMAGE_EXTENSIONS.join(", ")}`);
    }
    if (typeof block.caption !== "string" || block.caption.trim() === "") {
      fail("E_IMAGE_SHAPE", `${where}.caption must be a non-empty string`);
    }
    if (!existsSync(join(toolRoot, block.path))) {
      fail("E_IMAGE_MISSING", `${where}.path "${block.path}" does not exist — rendering would drop the figure silently`);
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

// A strength with no experimental source of its own can carry a calculated quantity and nothing more.
// Proportion gives a mass; it does not give a dissolution percentage, a hardness, a disintegration
// time or a content-uniformity result. Any table the form marks `measuredOnly` therefore has to show
// a gap in that strength's columns, because nobody reading the finished document can tell a
// calculated number from a measured one, and a blank cell reads as "not applicable" rather than as
// "not known". Enforced here, upstream of the renderer, so such a document cannot be produced at all.
function validateMeasuredOnly(table, groupSpan, draft, where) {
  const derived = draft.meta.derivedStrengths ?? [];
  if (derived.length === 0) return;
  const rowLabel = (row) => row[0] ?? "";
  for (const strength of derived) {
    const span = groupSpan(strength);
    if (!span) continue;
    for (const row of table.rows) {
      for (let column = span.start; column < span.start + span.size; column++) {
        const cell = row[column];
        if (isDecisionText(cell)) {
          fail("E_DERIVED_STRENGTH_HAS_RESULT", `${where} row "${rowLabel(row)}" column ${column + 1} carries a decision marker for strength "${strength}": nobody can decide this cell, because the strength has no batch to measure. It must be marked as awaiting data`);
        }
        if (!isGapText(cell)) {
          fail("E_DERIVED_STRENGTH_HAS_RESULT", `${where} row "${rowLabel(row)}" column ${column + 1} reports a measured value for strength "${strength}", which has no experimental source — it must be marked as awaiting data, not left blank and not filled in`);
        }
      }
    }
  }
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
      const groupSize = validateStrengthColumns(table, tableSpec, draft, where);
      if (tableSpec.measuredOnly) {
        const fixedCount = Array.isArray(tableSpec.columns) ? tableSpec.columns.length : 0;
        const spanFor = (strength) => {
          const index = draft.meta.strengths.indexOf(strength);
          return index < 0 ? undefined : { start: fixedCount + index * groupSize, size: groupSize };
        };
        validateMeasuredOnly(table, spanFor, draft, where);
      }
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
// Every place a marker can live, each with the path an error message needs. Derived by walking the
// draft rather than listed, so a block type that gains a text field is covered without a second edit.
function everyText(draft) {
  const texts = [];
  for (const section of draft.sections ?? []) {
    if (typeof section?.id !== "string") continue;
    if (typeof section.gapReason === "string") {
      texts.push([`sections[${section.id}].gapReason`, section.gapReason]);
    }
    (section.blocks ?? []).forEach((block, index) => {
      if (typeof block?.text === "string") {
        texts.push([`sections[${section.id}].blocks[${index}].text`, block.text]);
      }
      if (typeof block?.caption === "string") {
        texts.push([`sections[${section.id}].blocks[${index}].caption`, block.caption]);
      }
      if (block?.type !== "table") return;
      (block.rows ?? []).forEach((row, rowIndex) => {
        (row ?? []).forEach((cell, column) => {
          if (typeof cell === "string") {
            texts.push([`sections[${section.id}].blocks[${index}].rows[${rowIndex}][${column}]`, cell]);
          }
        });
      });
    });
  }
  return texts;
}

// The two marker kinds go to two different people and into two different registers, so a spot must
// be one or the other. A decision also has to say what is to be decided and who decides it: an
// unowned decision is a complaint, and the register exists to hand somebody a task.
function validateMarkerKinds(draft) {
  const texts = everyText(draft);

  for (const [where, text] of texts) {
    if (isGapText(text) && isDecisionText(text)) {
      fail("E_MARKER_AMBIGUOUS", `${where} carries a gap marker and a decision marker at once: it would be listed in both registers, and a reader cannot tell whether it waits for data or for somebody to choose`);
    }
  }

  const decisions = texts.filter(([, text]) => isDecisionText(text));
  if (decisions.length === 0) return;

  const owners = draft.meta.decisionOwners;
  if (!Array.isArray(owners) || owners.length === 0) {
    fail("E_META_DECISION_OWNERS", `draft holds ${decisions.length} decision marker(s), so draft.meta.decisionOwners must name who can settle them`);
  }

  for (const [where, text] of decisions) {
    const body = markerText(text);
    if (body === "") {
      fail("E_DECISION_MARKER_SHAPE", `${where}: a decision marker must say what has to be decided — an empty one records that something is unresolved without saying what`);
    }
    if (!owners.some((owner) => body.includes(owner))) {
      fail("E_DECISION_MARKER_SHAPE", `${where}: a decision marker must name who decides, from meta.decisionOwners (${owners.join(", ")}) — a decision with no owner is not a task anybody picks up`);
    }
  }
}

// A reference the reader can follow. The document is full of "xem mục P.2.x", and a reference that
// lands on a container lands on a heading with no content — which a reviewer reads as a dead link in a
// submission. Two tokenising traps are handled by the shape of the pattern rather than by patching
// afterwards: it requires at least one numeric segment, so the bare form name "biểu mẫu P.2" is not a
// reference, and each segment requires a digit after the dot, so a sentence-ending period is not
// swallowed into the number.
const INTERNAL_REFERENCE = /(?:3\.2\.)?P\.2(?:\.\d+)+/g;

function validateCrossReferences(draft, outline) {
  const leafIds = new Set(outline.sections.filter((section) => !section.container).map((section) => section.id));
  const containerIds = new Set(outline.sections.filter((section) => section.container).map((section) => section.id));
  const quoted = new Set(draft.meta.quotedNumbering ?? []);

  // Declaring one of our own sections as "quoted from elsewhere" would build a place to hide a broken
  // link before anyone breaks one.
  for (const entry of quoted) {
    const bare = entry.replace(/^3\.2\./, "");
    if (leafIds.has(bare) || containerIds.has(bare)) {
      fail("E_META_QUOTED_NUMBERING", `draft.meta.quotedNumbering declares "${entry}", which is a section of this document — quotedNumbering is for numbers taken from another document's numbering, so declaring our own would let a real broken reference pass`);
    }
  }

  for (const [where, text] of everyText(draft)) {
    for (const match of text.matchAll(INTERNAL_REFERENCE)) {
      const reference = match[0].replace(/^3\.2\./, "");
      if (leafIds.has(reference) || quoted.has(reference) || quoted.has(match[0])) continue;
      if (containerIds.has(reference)) {
        fail("E_XREF_CONTAINER", `${where} points at "${match[0]}", which is a container: it carries a heading and no content, so a reader following the reference arrives nowhere. Name the child section that holds what is meant`);
      }
      fail("E_XREF_UNKNOWN", `${where} points at "${match[0]}", which is not a section of this document. If the number is quoted from another document's numbering, declare it in meta.quotedNumbering`);
    }
  }
}

// A glossary that lists a term the document never uses is a small untruth in the one place a reader
// goes to resolve an unfamiliar one. Only this direction is checked: the reverse — every capitalised
// token must be glossed — would flag Vietnamese words written in capitals and fragments of URLs, and a
// check that cries wolf is a check people learn to ignore.
function validateAbbreviationsAreUsed(draft) {
  const declared = draft.meta.abbreviations ?? [];
  if (declared.length === 0) return;
  // Headers and row labels count here, unlike in the value inventory: a term is explained for the
  // reader wherever it appears, and several live only in table labels.
  const corpus = everyText(draft).map(([, text]) => text)
    .concat(draft.sections.flatMap((section) => (section.blocks ?? [])
      .filter((block) => block.type === "table")
      .flatMap((block) => block.headers ?? [])))
    .join(" ");
  for (const [term] of declared) {
    // A digit may follow — "CT" is used as CT01 — but a letter may not, or "EP" would match "EPAR".
    const used = new RegExp(`(?<![A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`).test(corpus);
    if (!used) {
      fail("E_ABBREVIATION_UNUSED", `draft.meta.abbreviations declares "${term}", which appears nowhere in the document — a glossary entry for a term the text does not use sends the reader looking for something that is not there`);
    }
  }
}

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
  // Which experimental sources the document draws on. A list, not a string, because the count is data:
  // the worked example began with one trial file and gained a second, and a document that states its
  // provenance in one field ends up stating it as "a.docx; b.docx" where nothing can check it.
  if (!Array.isArray(draft.meta.sourceFiles) || draft.meta.sourceFiles.length === 0) {
    fail("E_META_SOURCE_FILES", "draft.meta.sourceFiles must be a non-empty array of the experimental source filenames");
  }
  if (!draft.meta.sourceFiles.every((file) => typeof file === "string" && file.trim() !== "")) {
    fail("E_META_SOURCE_FILES", "draft.meta.sourceFiles entries must be non-empty strings");
  }
  if (new Set(draft.meta.sourceFiles).size !== draft.meta.sourceFiles.length) {
    fail("E_META_SOURCE_FILES", "draft.meta.sourceFiles must not name the same file twice");
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
  // Anything a section states that did not come out of an experimental source must be named here, so the
  // rendered cover page declares every source the document draws on rather than only the trial file.
  if (draft.meta.referenceSources !== undefined) {
    if (!Array.isArray(draft.meta.referenceSources) || draft.meta.referenceSources.length === 0) {
      fail("E_META_REFERENCE_SOURCES", "draft.meta.referenceSources must be a non-empty array when present");
    }
    if (!draft.meta.referenceSources.every((source) => typeof source === "string" && source.trim() !== "")) {
      fail("E_META_REFERENCE_SOURCES", "draft.meta.referenceSources entries must be non-empty strings");
    }
  }

  // Who can settle an open decision. Declared here, not built into the checker, so the rule holds for
  // a department that names its roles differently. Required only when the draft actually holds a
  // decision marker — see validateMarkerKinds.
  if (draft.meta.decisionOwners !== undefined) {
    if (!Array.isArray(draft.meta.decisionOwners) || draft.meta.decisionOwners.length === 0) {
      fail("E_META_DECISION_OWNERS", "draft.meta.decisionOwners must be a non-empty array when present");
    }
    if (!draft.meta.decisionOwners.every((owner) => typeof owner === "string" && owner.trim() !== "")) {
      fail("E_META_DECISION_OWNERS", "draft.meta.decisionOwners entries must be non-empty strings");
    }
  }

  // Numbers this document quotes from another document's numbering rather than referring to its own
  // sections — the department's worked example numbers two different subsections the same, and the
  // dossier has to be able to say so. Declared here so the exception is data, not a list in the checker.
  // A number that IS one of our sections must not be declared: that would pre-build a place to hide a
  // broken link later.
  if (draft.meta.quotedNumbering !== undefined) {
    if (!Array.isArray(draft.meta.quotedNumbering) || draft.meta.quotedNumbering.length === 0) {
      fail("E_META_QUOTED_NUMBERING", "draft.meta.quotedNumbering must be a non-empty array when present");
    }
    if (!draft.meta.quotedNumbering.every((entry) => typeof entry === "string" && entry.trim() !== "")) {
      fail("E_META_QUOTED_NUMBERING", "draft.meta.quotedNumbering entries must be non-empty strings");
    }
  }

  // The reader aid at the back of the document. It lives here rather than in the renderer because it
  // describes this document's content, and a glossary kept beside the layout code goes stale against
  // the text it explains — five of its ten entries named terms this document had stopped using.
  if (draft.meta.abbreviations !== undefined) {
    if (!Array.isArray(draft.meta.abbreviations) || draft.meta.abbreviations.length === 0) {
      fail("E_META_ABBREVIATIONS", "draft.meta.abbreviations must be a non-empty array when present");
    }
    const terms = [];
    for (const entry of draft.meta.abbreviations) {
      if (!Array.isArray(entry) || entry.length !== 2 || !entry.every((part) => typeof part === "string" && part.trim() !== "")) {
        fail("E_META_ABBREVIATIONS", "each draft.meta.abbreviations entry must be a [term, explanation] pair of non-empty strings");
      }
      terms.push(entry[0]);
    }
    if (new Set(terms).size !== terms.length) {
      fail("E_META_ABBREVIATIONS", "draft.meta.abbreviations must not declare the same term twice");
    }
  }

  if (!Array.isArray(draft.sections)) fail("E_SECTIONS_SHAPE", "draft.sections must be an array");

  // A container carries a heading and nothing else, so the draft holds no entry for it and the
  // completeness check covers leaves only.
  const containerIds = new Set(outline.sections.filter((section) => section.container).map((section) => section.id));
  const leafIds = outline.sections.filter((section) => !section.container).map((section) => section.id);
  const outlineIds = outline.sections.map((section) => section.id);
  const seenIds = new Set();

  for (const section of draft.sections) {
    if (typeof section?.id !== "string") fail("E_SECTION_ID", "every section must have a string id");
    if (!outlineIds.includes(section.id)) {
      fail("E_SECTION_UNKNOWN_ID", `section id "${section.id}" is not in schemas/p2-outline.json`);
    }
    if (containerIds.has(section.id)) {
      fail("E_SECTION_CONTAINER_HAS_ENTRY", `section "${section.id}" is a container: it carries a heading only, so its content belongs to its child sections`);
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
      // A figure names a table and a row rather than carrying numbers, so whether it can be drawn at
      // all is decided here: the table has to exist, and a chart's row has to hold measurements
      // rather than gap markers. Left to the renderer this surfaces as a broken run or, worse, as an
      // empty chart that reads like a measured zero.
      section.blocks.forEach((block, index) => {
        if (block.type !== "figure") return;
        try {
          if (block.kind === "flow") flowSteps(section, block);
          else if (block.kind === "process") processStages(section, block);
          else barSeries(section, block);
        } catch (error) {
          fail("E_FIGURE_SOURCE", `sections[${section.id}].blocks[${index}]: ${error.message}`);
        }
      });
      // Block headings render relative to their section, so heading3 sits two levels in and needs a
      // heading2 above it. Without one the section's own heading tree skips a level, and Word's
      // navigation pane shows a broken branch however right the numbering text reads.
      // Only tables a figure points at need an id, so the id is optional — but two tables answering to
      // the same name would make the reference ambiguous, and the resolver would take whichever came
      // first, which is the failure this whole change removes.
      const tableIds = (section.blocks ?? [])
        .filter((block) => block.type === "table" && block.id !== undefined)
        .map((block) => block.id);
      for (const id of tableIds) {
        if (typeof id !== "string" || id.trim() === "") {
          fail("E_TABLE_ID", `section "${section.id}" has a table whose id is not a non-empty string`);
        }
      }
      if (new Set(tableIds).size !== tableIds.length) {
        fail("E_TABLE_ID_DUPLICATE", `section "${section.id}" has two tables with the same id — a figure naming it could not say which one it means`);
      }

      let sawHeading2 = false;
      section.blocks.forEach((block, index) => {
        if (block.type === "heading2") sawHeading2 = true;
        if (block.type === "heading3" && !sawHeading2) {
          fail("E_BLOCK_HEADING_SKIP", `sections[${section.id}].blocks[${index}] is a heading3 with no heading2 above it in the same section — it would skip a heading level`);
        }
      });
    } else {
      fail("E_SECTION_STATUS", `section "${section.id}".status must be "covered" or "gap", got: ${section.status}`);
    }
  }

  validateMarkerKinds(draft);
  validateCrossReferences(draft, outline);
  validateAbbreviationsAreUsed(draft);

  const missingIds = leafIds.filter((id) => !seenIds.has(id));
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
