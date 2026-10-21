// The gap register is the one place the document summarises its own readiness, so a wrong row there is
// a false statement about the whole section. Three states, all derived from what a section actually
// holds rather than declared on it: filling one real value has to move the row on its own, because a
// field someone has to remember to update is a field that will disagree with the content.

import { test } from "node:test";
import assert from "node:assert/strict";

import { dataStatusLabel } from "../../render/builder.mjs";
import { GAP_PREFIX } from "../../schemas/markers.mjs";

const MARKER = `${GAP_PREFIX} – CẦN BỔ SUNG] chờ nguồn`;
const HAS_DATA = "Có dữ liệu (một phần hoặc đầy đủ)";
const SKELETON = "Đã dựng khung, chưa có dữ liệu";
const NOTHING = "Không có dữ liệu";

const table = (headers, rows) => ({ type: "table", headers, rows });
const paragraph = (text) => ({ type: "paragraph", text });
const covered = (...blocks) => ({ id: "X", status: "covered", blocks });

test("a gap section reports no data", () => {
  assert.equal(dataStatusLabel({ id: "X", status: "gap", gapReason: "chưa có nguồn" }), NOTHING);
});

test("a built-out form holding only markers reports as a skeleton, not as data", () => {
  const section = covered(table(["Chỉ tiêu", "Kết quả"], [["Độ hòa tan", MARKER], ["Độ rã", MARKER]]));
  assert.equal(dataStatusLabel(section), SKELETON);
});

test("one real value moves the row off skeleton with no other edit", () => {
  const section = covered(table(["Chỉ tiêu", "Kết quả"], [["Độ hòa tan", "98,64"], ["Độ rã", MARKER]]));
  assert.equal(dataStatusLabel(section), HAS_DATA);
});

test("a leading ordinal column does not count as data", () => {
  // The row number is structure, filled in by definition. Counting it would report a form holding
  // nothing at all as holding data — the failure the three states exist to prevent.
  const section = covered(table(
    ["STT", "Tên thành phần", "Khối lượng"],
    [["1", "Hoạt chất", MARKER], ["2", "Tá dược", MARKER]],
  ));
  assert.equal(dataStatusLabel(section), SKELETON);
});

test("a section stating only that data is missing reports no data", () => {
  // No table to judge by, so the paragraphs decide. Without this a section whose whole content is "this
  // is missing" would be summarised as holding data.
  assert.equal(dataStatusLabel(covered(paragraph(MARKER))), NOTHING);
});

test("a section with real prose and a marker still reports data", () => {
  const section = covered(
    paragraph("Tiêu chuẩn đã áp dụng: không ít hơn 80% hòa tan trong 30 phút."),
    paragraph(MARKER),
  );
  assert.equal(dataStatusLabel(section), HAS_DATA);
});

test("a built-out form outranks a marker-only lead-in", () => {
  // Both empty states are true of this section; the skeleton is the more useful thing to tell a reader,
  // because it says the form is ready for the values rather than that the section is untouched.
  const section = covered(
    paragraph(MARKER),
    table(["Chỉ tiêu", "Kết quả"], [["Độ hòa tan", MARKER]]),
  );
  assert.equal(dataStatusLabel(section), SKELETON);
});
