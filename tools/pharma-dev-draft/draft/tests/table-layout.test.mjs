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

test("P.2.1.1 stays one headerless properties form, whatever new drug substance sources arrive", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.1.1");
  const tables = section.blocks.filter((b) => b.type === "table");
  // Five passes each added their own table or heading here until the section held nine blocks. The
  // department's form is one table; everything a source says that has no row belongs in the
  // citation paragraphs below it, not in another block.
  assert.equal(tables.length, 1, "the drug substance section should hold exactly one table");
  assert.equal(section.blocks.filter((b) => b.type.startsWith("heading")).length, 0);
  assert.equal(tables[0].headerless, true, "the form is a label/value table with no header strip");
  assert.deepEqual(tables[0].rows.map((r) => r[0]), [
    "Tên chung quốc tế (INN)",
    "Tên IUPAC",
    "Số đăng ký CAS",
    "Công thức cấu tạo",
    "Công thức phân tử",
    "Khối lượng phân tử",
    "Cảm quan",
    "Độ tan",
    "Phân bố cỡ hạt",
    "Điểm chảy",
    "pKa",
    "Log P",
    "Độ ổn định hóa học",
    "– Phân hủy do nhiệt",
    "– Phân hủy do ẩm",
    "– Phân hủy do peroxid",
    "– Phân hủy do acid/base",
    "– Phân hủy do ánh sáng",
  ]);
});

test("headerless drops the printed header row but not the column contract", () => {
  const draft = loadExample();
  const table = excipientTable(draft);
  table.headerless = "yes";
  expectFailure(draft, "E_TABLE_HEADERLESS");

  const valid = loadExample();
  const form = valid.sections.find((s) => s.id === "P.2.1.1").blocks.find((b) => b.type === "table");
  // Headers are what every row is measured against, so suppressing the printed row must not let a
  // row carry the wrong number of cells.
  form.rows.push(["chỉ một ô"]);
  expectFailure(valid, "E_TABLE_ROW_WIDTH");
});

test("P.2.2.1.1 carries the reference-product form with every value still awaiting data", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.2.1.1");
  const tables = section.blocks.filter((b) => b.type === "table");
  assert.equal(tables.length, 2, "the house form for this section is two tables");
  assert.deepEqual(tables[1].rows.map((r) => r[0]), [
    "Nhà sản xuất",
    "Số đăng ký",
    "Hạn dùng",
    "Điều kiện bảo quản",
    "Quy cách đóng gói",
    "Cảm quan",
    "Khối lượng trung bình",
    "Kích thước viên",
    "Độ cứng",
    "Thời gian rã",
    "Định lượng",
    "Tạp chất liên quan",
    "Đồng đều hàm lượng",
    "Hàm lượng chất bảo quản",
    "Tương đương độ hòa tan — điều kiện thử",
    "Tương đương độ hòa tan — hồ sơ theo thời gian",
  ]);
  // No reference product has been characterised yet, so any value cell holding a figure would be
  // invented rather than measured.
  for (const table of tables) {
    for (const row of table.rows) {
      assert.ok(row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} must still be marked as awaiting data`);
    }
  }
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

test("the P.2.3 risk matrix assesses exactly the product's own quality attributes", () => {
  const draft = loadExample();
  const section = draft.sections.find((s) => s.id === "P.2.3");
  const tables = section.blocks.filter((b) => b.type === "table");
  assert.equal(tables.length, 2, "the house form is a risk matrix plus a justification table");

  const [matrix, justification] = tables;
  // Process steps depend on the manufacturing method — direct compression, wet granulation, roller
  // compaction and the rest each have their own — so the step names are product data and are
  // deliberately not pinned here. What must hold for any method is that the matrix scores every
  // quality attribute the product itself declares, and no others.
  const declaredCqas = draft.sections.find((s) => s.id === "P.2.2.1.2")
    .blocks.find((b) => b.type === "table").rows.map((r) => r[0]);
  assert.deepEqual(matrix.rows.map((r) => r[0]), declaredCqas);
  assert.ok(matrix.headers.length >= 2, "the matrix needs at least one process step column");
  assert.equal(justification.rows.length, matrix.headers.length - 1, "one justification row per step");

  for (const row of matrix.rows) {
    for (const cell of row.slice(1)) {
      assert.ok(cell.includes("[CHƯA CÓ DỮ LIỆU"), "no risk level has been assessed yet");
    }
  }
});

test("P.2.4 carries the packaging form with nothing chosen yet", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.4");
  const tables = section.blocks.filter((b) => b.type === "table");
  assert.equal(tables.length, 2, "primary and secondary packaging are separate tables");
  assert.deepEqual(tables[0].rows.map((r) => r[0]), [
    "Vật liệu", "Mô tả", "Khả năng bảo vệ", "Tính tương hợp", "Kiểm soát chất lượng", "Dữ liệu độ ổn định",
  ]);
  assert.deepEqual(tables[1].rows.map((r) => r[0]), ["Mô tả", "Chức năng"]);
  for (const table of tables) {
    for (const row of table.rows) {
      assert.ok(row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} must still be awaiting a decision`);
    }
  }
});

test("P.2.5 states the limits it applies and marks only the results as missing", () => {
  const section = loadExample().sections.find((s) => s.id === "P.2.5");
  const [limits, frequency] = section.blocks.filter((b) => b.type === "table");
  // The department's form commits to routine testing, so the limits and the schedule are real
  // content taken from it. Only the measurements are outstanding — marking the limits as missing
  // too would hide the fact that a route has already been chosen.
  for (const row of limits.rows) {
    assert.ok(!row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} limit comes from the form`);
    assert.ok(row[2].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} result is not measured yet`);
  }
  for (const row of frequency.rows) {
    assert.ok(!row[1].includes("[CHƯA CÓ DỮ LIỆU"), `${row[0]} schedule comes from the form`);
  }
});
