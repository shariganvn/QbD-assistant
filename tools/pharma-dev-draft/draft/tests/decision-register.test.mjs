// A document held up by two different things has to report both. Until this register existed, the one
// generated list was built from gap markers alone, so it counted what nobody had measured yet and
// silently dropped every conflict already written down in prose — a finished-product impurity limit
// naming no impurity while the substance certificate named three, two pharmacopoeia versions cited in
// one dossier. The reader was told data was the only thing missing.
//
// These tests hold the line between the two kinds. The danger of a second marker is that it becomes a
// way around the first: a cell that should say "no batch exists to measure this" saying instead
// "somebody should decide" reads as progress and is not.

import { test } from "node:test";
import assert from "node:assert/strict";

import { dataStatusLabel } from "../../render/builder.mjs";
import { decisionCount, decisionRows, printableDecisionRows } from "../../render/decision-register.mjs";
import { DECISION_PREFIX, GAP_PREFIX, isDecisionText, isGapText, isMarkedText } from "../../schemas/markers.mjs";
import { validateDraft, DraftContractError } from "../validate-draft.mjs";
import { STRENGTH_OUTLINE, strengthDraft } from "./fixtures/strength-form.mjs";

const GAP = `${GAP_PREFIX} – CẦN BỔ SUNG] chờ nguồn`;
const decision = (body) => `${DECISION_PREFIX} – CHƯA CHỐT] ${body}`;
const OWNERS = ["FD", "QA"];

const OUTLINE = {
  schemaVersion: "1.0",
  sections: [
    { id: "X.1", ctdReference: "3.2.X.1", headingVi: "Mục có bảng" },
    { id: "X.2", ctdReference: "3.2.X.2", headingVi: "Mục có đoạn văn" },
  ],
};

// The outline has two leaves and a draft must cover both, so a case that only cares about one gets a
// settled filler for the other rather than an incomplete draft the validator would reject for an
// unrelated reason.
const FILLER = { id: "X.2", status: "covered", blocks: [{ type: "paragraph", text: "Nội dung đã chốt." }] };

function draftWith(sections, meta = {}) {
  const ids = new Set(sections.map((section) => section.id));
  const padded = [...sections, ...[FILLER, { ...FILLER, id: "X.1" }].filter((entry) => !ids.has(entry.id))]
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén bao phim",
      apiName: "Hoạt chất thử nghiệm",
      strengths: ["10 mg"],
      sourceFiles: ["fixture.docx"],
      draftDate: "2026-09-26",
      preparer: "bộ kiểm quy tắc",
      extractionMethod: "xml-walk",
      decisionOwners: OWNERS,
      ...meta,
    },
    sections: padded,
  };
}

const table = (headers, rows) => ({ type: "table", headers, rows });
const paragraph = (text) => ({ type: "paragraph", text });

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DraftContractError, `expected DraftContractError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test("the two kinds are told apart by their own labels, and every marker counts as unsettled", () => {
  assert.ok(isGapText(GAP) && !isDecisionText(GAP));
  assert.ok(isDecisionText(decision("FD chốt")) && !isGapText(decision("FD chốt")));
  assert.ok(isMarkedText(GAP) && isMarkedText(decision("FD chốt")));
  assert.ok(!isMarkedText("98,64"));
});

test("one spot cannot be both kinds at once", () => {
  // It would be listed in both registers, and a reader could not tell what it waits for.
  const both = `${GAP_PREFIX} – CẦN BỔ SUNG] ${DECISION_PREFIX} – CHƯA CHỐT] FD chốt`;
  expectCode("E_MARKER_AMBIGUOUS", () =>
    validateDraft(draftWith([{ id: "X.1", status: "covered", blocks: [paragraph(both)] }]), OUTLINE));
});

test("a decision marker must name who decides, from the roles the draft declares", () => {
  const nameless = decision("cần xem lại chỗ này trước khi nộp");
  expectCode("E_DECISION_MARKER_SHAPE", () =>
    validateDraft(draftWith([{ id: "X.1", status: "covered", blocks: [paragraph(nameless)] }]), OUTLINE));

  // The same sentence passes once a declared role is named, and the role list is data: a draft that
  // calls the role something else is not wrong, it just has to declare it.
  validateDraft(draftWith([{ id: "X.1", status: "covered", blocks: [paragraph(decision("FD chốt việc này"))] }]), OUTLINE);
  validateDraft(
    draftWith(
      [{ id: "X.1", status: "covered", blocks: [paragraph(decision("Phòng Đăng ký chốt việc này"))] }],
      { decisionOwners: ["Phòng Đăng ký"] },
    ),
    OUTLINE,
  );
});

test("a decision marker must say what has to be decided", () => {
  expectCode("E_DECISION_MARKER_SHAPE", () =>
    validateDraft(draftWith([{ id: "X.1", status: "covered", blocks: [paragraph(`${DECISION_PREFIX}]`)] }]), OUTLINE));
});

test("a draft holding a decision marker must declare who can settle one", () => {
  expectCode("E_META_DECISION_OWNERS", () =>
    validateDraft(
      draftWith([{ id: "X.1", status: "covered", blocks: [paragraph(decision("FD chốt"))] }], { decisionOwners: undefined }),
      OUTLINE,
    ));

  // A draft with no decisions is not made to declare the field — a requirement nothing uses is a
  // requirement that goes stale.
  validateDraft(
    draftWith([{ id: "X.1", status: "covered", blocks: [paragraph(GAP)] }], { decisionOwners: undefined }),
    OUTLINE,
  );
});

test("a decision marker cannot stand in for a gap in a derived strength's column", () => {
  // This is the way around the whole strength rule: the cell belongs to a strength with no batch, so
  // there is nothing to decide and no measurement to report. It must say it awaits data.
  const draft = strengthDraft(["5 mg", "10 mg"], { derivedStrengths: ["5 mg"] });
  const results = draft.sections.find((section) => section.id === "X.3");
  results.blocks[0].rows[0][1] = decision("FD chốt có làm lô 5 mg hay không");
  draft.meta.decisionOwners = OWNERS;
  expectCode("E_DERIVED_STRENGTH_HAS_RESULT", () => validateDraft(draft, STRENGTH_OUTLINE));
});

test("the register names the section, the item and the owner, and carries no copy of the text", () => {
  const draft = draftWith([
    {
      id: "X.1",
      status: "covered",
      blocks: [table(
        ["Chỉ tiêu", "Giới hạn"],
        [["Tạp chất liên quan", decision("QA chốt danh mục tạp theo chuyên luận nào")], ["Độ rã", "≤ 15 phút"]],
      )],
    },
    { id: "X.2", status: "covered", blocks: [paragraph(decision("FD và QA cùng chốt phiên bản dược điển"))] },
  ]);
  validateDraft(draft, OUTLINE);

  const rows = printableDecisionRows(draft, OUTLINE);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], [
    "3.2.X.1 Mục có bảng",
    "Tạp chất liên quan",
    "QA",
    "QA chốt danh mục tạp theo chuyên luận nào",
  ]);
  // Both roles named in one sentence come out in declaration order, not in the order the sentence
  // happens to mention them, so the register sorts the same way every time.
  assert.deepEqual(rows[1].slice(0, 3), ["3.2.X.2 Mục có đoạn văn", "Mục có đoạn văn", "FD · QA"]);
});

test("every decision marker reaches the register exactly once, and the counts reconcile", () => {
  const draft = draftWith([
    {
      id: "X.1",
      status: "covered",
      blocks: [table(
        ["Chỉ tiêu", "5 mg", "10 mg"],
        [["Thiết kế viên", decision("FD chốt thiết kế viên 5 mg"), "khắc số 10"], ["Độ rã", GAP, "4'18\""]],
      )],
    },
    { id: "X.2", status: "covered", blocks: [paragraph(decision("QA chốt phiên bản dược điển")), paragraph(GAP)] },
  ]);
  validateDraft(draft, OUTLINE);

  const rows = decisionRows(draft, OUTLINE);
  assert.equal(rows.reduce((total, row) => total + row[4], 0), decisionCount(draft));
  assert.equal(decisionCount(draft), 2);
  // The gap markers stay in the other register. One marker never appears in both lists.
  assert.ok(rows.every((row) => !isGapText(row[3])));
});

test("a section whose only content is an open decision does not report as holding data", () => {
  // The same failure the gap register was fixed for twice: a row saying "Có dữ liệu" about a section
  // that holds no settled statement is a false claim in a document shaped like a submission.
  const onlyDecision = { id: "X.1", status: "covered", blocks: [paragraph(decision("FD chốt việc này"))] };
  assert.equal(dataStatusLabel(onlyDecision), "Không có dữ liệu");

  const skeleton = {
    id: "X.1",
    status: "covered",
    blocks: [table(["Chỉ tiêu", "Kết quả"], [["Độ rã", decision("QA chốt tiêu chuẩn")], ["Độ hòa tan", GAP]])],
  };
  assert.equal(dataStatusLabel(skeleton), "Đã dựng khung, chưa có dữ liệu");

  const withData = {
    id: "X.1",
    status: "covered",
    blocks: [table(["Chỉ tiêu", "Kết quả"], [["Độ rã", "4'18\""], ["Độ hòa tan", decision("QA chốt tiêu chuẩn")]])],
  };
  assert.equal(dataStatusLabel(withData), "Có dữ liệu (một phần hoặc đầy đủ)");
});
