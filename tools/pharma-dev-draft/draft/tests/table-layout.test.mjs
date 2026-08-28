// Covers the layout contract between a draft's table blocks and the renderer: explicit column
// widths must add up to the same budget the renderer uses, the default width split must too, and
// a block field the renderer would ignore must be rejected rather than silently dropped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateDraft } from "../validate-draft.mjs";
import { TABLE_WIDTH_DXA } from "../../schemas/layout.mjs";
import { widthsFor, FIXED_TABLE_WIDTHS } from "../../render/builder.mjs";

const draftDir = dirname(fileURLToPath(import.meta.url));
const examplePath = join(draftDir, "..", "example-draft.json");

function loadExample() {
  return JSON.parse(readFileSync(examplePath, "utf8"));
}

// Returns the P.2.1.2 excipient table — the one block in the example that declares explicit layout.
function excipientTable(draft) {
  const section = draft.sections.find((s) => s.id === "P.2.1.2");
  return section.blocks.find((b) => b.type === "table" && b.columnWidths);
}

function expectFailure(draft, code) {
  assert.throws(() => validateDraft(draft), (error) => {
    assert.equal(error.code, code);
    return true;
  });
}

test("the committed example draft validates", () => {
  assert.doesNotThrow(() => validateDraft(loadExample()));
});

test("columnWidths must sum to the renderer's table width", () => {
  const draft = loadExample();
  const table = excipientTable(draft);
  table.columnWidths = [...table.columnWidths];
  table.columnWidths[0] -= 1;
  expectFailure(draft, "E_TABLE_COLUMN_WIDTHS");
});

test("columnWidths must have one entry per header", () => {
  const draft = loadExample();
  excipientTable(draft).columnWidths = [TABLE_WIDTH_DXA];
  expectFailure(draft, "E_TABLE_COLUMN_WIDTHS");
});

test("columnAlign rejects an alignment the renderer cannot map", () => {
  const draft = loadExample();
  const table = excipientTable(draft);
  table.columnAlign = table.headers.map(() => "right");
  expectFailure(draft, "E_TABLE_COLUMN_ALIGN");
});

test("a misspelled layout field is rejected, not silently ignored", () => {
  const draft = loadExample();
  const table = excipientTable(draft);
  table.columnwidths = table.columnWidths;
  delete table.columnWidths;
  expectFailure(draft, "E_BLOCK_UNKNOWN_FIELD");
});

test("a non-string cell is rejected so comma-decimals cannot be lost", () => {
  const draft = loadExample();
  excipientTable(draft).rows[0][0] = 1;
  expectFailure(draft, "E_TABLE_CELL_TYPE");
});

test("a newline outside a table cell is rejected", () => {
  const draft = loadExample();
  const section = draft.sections.find((s) => s.id === "P.2.1.2");
  section.blocks.find((b) => b.type === "paragraph").text = "dòng một\ndòng hai";
  expectFailure(draft, "E_BLOCK_TEXT");
});

test("referenceSources entries must be non-empty strings", () => {
  const draft = loadExample();
  draft.meta.referenceSources = [""];
  expectFailure(draft, "E_META_REFERENCE_SOURCES");
});

test("default column widths fill the table exactly for any column count", () => {
  for (let columns = 1; columns <= 8; columns++) {
    const widths = widthsFor(columns);
    assert.equal(widths.length, columns, `widthsFor(${columns}) returned ${widths.length} widths`);
    assert.ok(widths.every((w) => Number.isInteger(w) && w > 0), `widthsFor(${columns}) produced a non-positive width`);
    assert.equal(widths.reduce((sum, w) => sum + w, 0), TABLE_WIDTH_DXA, `widthsFor(${columns}) does not fill the table`);
  }
});

test("the renderer's own hardcoded table widths fill the table exactly", () => {
  for (const [name, widths] of Object.entries(FIXED_TABLE_WIDTHS)) {
    assert.equal(widths.reduce((sum, w) => sum + w, 0), TABLE_WIDTH_DXA, `${name} widths do not fill the table`);
  }
});

test("justify is an accepted column alignment", () => {
  const draft = loadExample();
  const table = excipientTable(draft);
  table.columnAlign = table.headers.map(() => "justify");
  assert.doesNotThrow(() => validateDraft(draft));
});

test("P.2.1.2 keeps one excipient table under the two numbered sub-headings", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.1.2");
  const tables = section.blocks.filter((b) => b.type === "table");
  const subHeadings = section.blocks.filter((b) => b.type === "heading3");
  // One table only: the excipient information belongs in a single table, not split back into the
  // quantitative-composition plus information-table pair the section used to carry.
  assert.equal(tables.length, 1, "the excipient section should hold exactly one table");
  assert.deepEqual(tables[0].headers, ["STT", "Tên tá dược", "Đặc tính lý hóa", "Ứng dụng", "Chức năng"]);
  // Properties and drug-substance compatibility are separate numbered items in the department's
  // reference document, and Q8(R2) states the compatibility requirement in its own clause, so the
  // section carries exactly those two sub-headings and no heading2 that would outrank them.
  assert.deepEqual(subHeadings.map((b) => b.text), [
    "3.2.P.2.1.2.1. Đặc tính lý hóa (Physicochemical properties)",
    "3.2.P.2.1.2.2. Nghiên cứu tương hợp dược chất – tá dược (Excipient compatibility)",
  ]);
  assert.equal(section.blocks.filter((b) => b.type === "heading2").length, 0);
});

test("the criticality discussion does not upgrade P.2.2.1.2 into an approved QTPP/CQA table", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.2.1.2");
  const headings = section.blocks.filter((b) => b.type === "heading3").map((b) => b.text);
  assert.ok(
    headings.includes("Xác định yếu tố trọng yếu và biện luận kiểm soát"),
    "the section must carry the criticality and control-strategy discussion",
  );
  // The section reasons about which attributes are critical, which is a different claim from
  // presenting an approved QTPP/CQA table. The opening disclaimer is what keeps the two apart, so
  // it has to survive every later pass that adds reasoning here.
  assert.ok(
    section.blocks.some((b) => b.type === "paragraph" && b.text.includes("KHÔNG phải bảng QTPP/CQA chính thức")),
    "the section must keep stating that it is not an approved QTPP/CQA table",
  );
  // Only the disintegrant level was actually varied, so everything else stays an open question
  // rather than an unsupported criticality claim.
  assert.ok(
    section.blocks.some((b) => b.type === "paragraph" && b.text.startsWith("[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG] Chưa đánh giá tính trọng yếu")),
    "the section must name the attributes whose criticality is still unassessed",
  );
});
