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
import { widthsFor, FIXED_TABLE_WIDTHS, dataStatusLabel } from "../../render/builder.mjs";

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

// --- the P.2 form, as enforced for any product -----------------------------
//
// Row labels, table counts and headings are no longer repeated here. They live in
// schemas/p2-outline.json under `form`, and validateDraft enforces them for whatever draft it is
// given. Copying them into the tests as well would make a third copy that only ever checks this one
// example, and would go stale the moment a different product is drafted. What the tests do instead
// is prove the spec actually bites, and that it bites on shape rather than on this product.

function formTable(draft, sectionId, index = 0) {
  return draft.sections.find((s) => s.id === sectionId).blocks.filter((b) => b.type === "table")[index];
}

test("dropping a row from a form table is rejected", () => {
  const draft = loadExample();
  formTable(draft, "P.2.1.1").rows.splice(3, 1);
  expectFailure(draft, "E_FORM_ROWS");
});

test("adding a table the form does not have is rejected", () => {
  const draft = loadExample();
  draft.sections.find((s) => s.id === "P.2.1.1").blocks.push({ type: "table", headers: ["a", "b"], rows: [["x", "y"]] });
  expectFailure(draft, "E_FORM_TABLE_COUNT");
});

test("adding a heading the form does not have is rejected", () => {
  const draft = loadExample();
  draft.sections.find((s) => s.id === "P.2.1.1").blocks.push({ type: "heading3", text: "Mục thêm" });
  expectFailure(draft, "E_FORM_HEADINGS");
});

test("a label/value form must keep its header row suppressed", () => {
  const draft = loadExample();
  delete formTable(draft, "P.2.1.1").headerless;
  expectFailure(draft, "E_FORM_HEADERLESS");
});

test("renaming a fixed column label is rejected", () => {
  const draft = loadExample();
  formTable(draft, "P.2.4").headers[1] = "Bao bì khác";
  expectFailure(draft, "E_FORM_COLUMNS");
});

test("the risk matrix has to follow the quality attributes the product declares", () => {
  const draft = loadExample();
  // Changing a quality attribute without rescoring the process risk for it is the mistake this
  // rule exists to catch; the matrix takes its rows from P.2.2.1.2 rather than from a fixed list.
  formTable(draft, "P.2.2.1.2").rows[0][0] = "Chỉ tiêu mới";
  expectFailure(draft, "E_FORM_ROWS");
});

test("the form fixes the shape, not the product: labels carrying a product name may change", () => {
  const draft = loadExample();
  formTable(draft, "P.2.2.1.1").headers[1] = "Thuốc gốc XYZ 20 mg";
  assert.doesNotThrow(() => validateDraft(draft));
});

test("the form fixes the shape, not the method: process steps may change with the method", () => {
  const draft = loadExample();
  // Direct compression is this product's method. Wet granulation, fluid-bed granulation, roller
  // compaction, slugging and hot-melt extrusion each bring a different set of unit operations, and
  // the risk matrix has to accept whichever set applies.
  const matrix = formTable(draft, "P.2.3");
  matrix.headers = ["CQA sản phẩm", "Xát hạt ướt", "Sấy", "Dập viên"];
  matrix.rows = matrix.rows.map((row) => [row[0], "[CHƯA CÓ DỮ LIỆU]", "[CHƯA CÓ DỮ LIỆU]", "[CHƯA CÓ DỮ LIỆU]"]);
  formTable(draft, "P.2.3", 1).rows = [
    ["Xát hạt ướt", "[CHƯA CÓ DỮ LIỆU]", "[CHƯA CÓ DỮ LIỆU]"],
    ["Sấy", "[CHƯA CÓ DỮ LIỆU]", "[CHƯA CÓ DỮ LIỆU]"],
    ["Dập viên", "[CHƯA CÓ DỮ LIỆU]", "[CHƯA CÓ DỮ LIỆU]"],
  ];
  assert.doesNotThrow(() => validateDraft(draft));
});

test("a draft for an entirely different product validates on the same form", () => {
  const draft = loadExample();
  // Nothing about this product survives: another active substance, other excipients, other quality
  // attributes, another reference product. Only the P.2 form stays, which is the point.
  draft.meta.productName = "Metformin hydrochloride 500 mg viên nén bao phim";
  draft.meta.apiName = "Metformin hydrochloride";
  const excipients = formTable(draft, "P.2.1.2");
  excipients.rows = [["1.", "Hypromellose", "—", "—", "Tá dược dính"]];
  const attributes = formTable(draft, "P.2.2.1.2");
  attributes.rows = [["Độ hòa tan (45 phút)", "≥ 75% (Q)"], ["Định lượng", "95–105%"]];
  const matrix = formTable(draft, "P.2.3");
  matrix.headers = ["CQA sản phẩm", "Xát hạt ướt", "Dập viên"];
  matrix.rows = attributes.rows.map((row) => [row[0], "Thấp", "Cao"]);
  formTable(draft, "P.2.3", 1).rows = [
    ["Xát hạt ướt", "Lượng dung môi", "Kinh nghiệm sản xuất"],
    ["Dập viên", "Lực dập", "Kinh nghiệm sản xuất"],
  ];
  formTable(draft, "P.2.2.1.1").headers[1] = "Glucophage® 500 mg";
  formTable(draft, "P.2.2.1.1", 1).headers[1] = "Glucophage® 500 mg (Lô …)";
  assert.doesNotThrow(() => validateDraft(draft));
});

// --- content intent the form spec cannot express ---------------------------

test("the criticality discussion does not upgrade P.2.2.1.2 into an approved QTPP/CQA table", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.2.1.2");
  // The section reasons about which attributes are critical, which is a different claim from
  // presenting an approved QTPP/CQA table. The opening disclaimer is what keeps the two apart, so
  // it has to survive every later pass that adds reasoning here.
  assert.ok(
    section.blocks.some((b) => b.type === "paragraph" && b.text.includes("KHÔNG phải bảng QTPP/CQA chính thức")),
    "the section must keep stating that it is not an approved QTPP/CQA table",
  );
  assert.ok(
    section.blocks.some((b) => b.type === "paragraph" && b.text.startsWith("[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG] Chưa đánh giá tính trọng yếu")),
    "the section must name the attributes whose criticality is still unassessed",
  );
});

test("no value is invented where no reference product has been characterised", () => {
  const draft = loadExample();
  for (const index of [0, 1]) {
    for (const row of formTable(draft, "P.2.2.1.1", index).rows) {
      assert.ok(row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} must still be marked as awaiting data`);
    }
  }
  for (const index of [0, 1]) {
    for (const row of formTable(draft, "P.2.4", index).rows) {
      assert.ok(row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} must still be awaiting a decision`);
    }
  }
  for (const row of formTable(draft, "P.2.3").rows) {
    for (const cell of row.slice(1)) {
      assert.ok(cell.includes("[CHƯA CÓ DỮ LIỆU"), "no risk level has been assessed yet");
    }
  }
});

test("P.2.5 states the limits it applies and marks only the results as missing", () => {
  const draft = loadExample();
  // The department's form commits to routine testing, so the limits and the schedule are real
  // content taken from it. Only the measurements are outstanding — marking the limits as missing
  // too would hide the fact that a route has already been chosen.
  for (const row of formTable(draft, "P.2.5").rows) {
    assert.ok(!row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} limit comes from the form`);
    assert.ok(row[2].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} result is not measured yet`);
  }
  for (const row of formTable(draft, "P.2.5", 1).rows) {
    assert.ok(!row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} schedule comes from the form`);
  }
});

test("headerless drops the printed header row but not the column contract", () => {
  const draft = loadExample();
  const table = excipientTable(draft);
  table.headerless = "yes";
  expectFailure(draft, "E_TABLE_HEADERLESS");

  const valid = loadExample();
  // Headers are what every row is measured against, so suppressing the printed row must not let a
  // row carry the wrong number of cells.
  formTable(valid, "P.2.1.1").rows.push(["chỉ một ô"]);
  expectFailure(valid, "E_TABLE_ROW_WIDTH");
});

test("the gap register separates a built-out form from one that holds data", () => {
  const draft = loadExample();
  const referenceProduct = draft.sections.find((s) => s.id === "P.2.2.1.1");
  assert.equal(dataStatusLabel(referenceProduct), "Đã dựng khung, chưa có dữ liệu");
  assert.equal(dataStatusLabel(draft.sections.find((s) => s.id === "P.2.1.1")), "Có dữ liệu (một phần hoặc đầy đủ)");
  // Checked against a bare section rather than a real one: every section in the example now has at
  // least a form built out, so pinning this to whichever section happened to be empty would break
  // again the next time one is filled in.
  assert.equal(dataStatusLabel({ id: "X", status: "gap", gapReason: "chưa có nguồn" }), "Không có dữ liệu");

  // Filling in one real value has to flip the label on its own; a section cannot keep claiming to
  // be an empty form once it is not one.
  referenceProduct.blocks.find((b) => b.type === "table").rows[1][1] = "Viên nén bao phim";
  assert.equal(dataStatusLabel(referenceProduct), "Có dữ liệu (một phần hoặc đầy đủ)");
});
