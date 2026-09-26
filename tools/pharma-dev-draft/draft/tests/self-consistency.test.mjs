// Two things the document says about itself, neither of which anything checked until now.
//
// A cross-reference that lands on a container lands on a heading with no content. Eleven of the
// document's references did exactly that — "xem mục P.2.2.1.3" where the tables are in P.2.2.1.3.3 —
// and a reviewer following one arrives nowhere, which in a submission reads as a dead link.
//
// The glossary at the back listed five terms the text had stopped using, because it lived in the
// renderer beside the layout code rather than beside the content it explains.
//
// The tokenising traps are the interesting part and they are tested directly, because the same one
// caught this work twice from opposite sides: a pattern that swallows the sentence-ending period misses
// a reference that ends a sentence, and a pattern that rejects any following period misses it too when
// rewriting. The rule is narrow: reject only a DEEPER number.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateDraft, DraftContractError } from "../validate-draft.mjs";

const OUTLINE = {
  schemaVersion: "1.0",
  sections: [
    { id: "P.2.1", ctdReference: "3.2.P.2.1", headingVi: "Mục cha", container: true },
    { id: "P.2.1.1", ctdReference: "3.2.P.2.1.1", headingVi: "Mục lá thứ nhất" },
    { id: "P.2.1.2", ctdReference: "3.2.P.2.1.2", headingVi: "Mục lá thứ hai" },
  ],
};

const para = (text) => ({ type: "paragraph", text });
const FILLER = { id: "P.2.1.2", status: "covered", blocks: [para("Nội dung đã chốt.")] };

function draftWith(text, meta = {}) {
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén bao phim",
      apiName: "Hoạt chất thử nghiệm",
      sourceFiles: ["fixture.docx"],
      strengths: ["10 mg"],
      draftDate: "2026-09-26",
      preparer: "bộ kiểm quy tắc",
      extractionMethod: "xml-walk",
      ...meta,
    },
    sections: [{ id: "P.2.1.1", status: "covered", blocks: [para(text)] }, FILLER],
  };
}

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DraftContractError, `expected DraftContractError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test("a reference to a leaf passes, in both the bare and the fully qualified form", () => {
  validateDraft(draftWith("Xem mục P.2.1.2 để biết chi tiết."), OUTLINE);
  validateDraft(draftWith("Xem mục 3.2.P.2.1.2 để biết chi tiết."), OUTLINE);
});

test("a reference to a container is refused", () => {
  // The container carries a heading and nothing else, so the reader arrives at an empty heading.
  expectCode("E_XREF_CONTAINER", () => validateDraft(draftWith("Xem mục P.2.1 để biết chi tiết."), OUTLINE));
});

test("a reference to a section that does not exist is refused", () => {
  expectCode("E_XREF_UNKNOWN", () => validateDraft(draftWith("Xem mục P.2.9.9 để biết chi tiết."), OUTLINE));
});

test("a sentence-ending period is not swallowed into the number", () => {
  // This is the trap. "…tại mục 3.2.P.2.1.2." must read as a reference to P.2.1.2 followed by a full
  // stop — not as a reference to a section numbered P.2.1.2. that does not exist.
  validateDraft(draftWith("Thành phần được trình bày tại mục 3.2.P.2.1.2."), OUTLINE);
  expectCode("E_XREF_CONTAINER", () => validateDraft(draftWith("Thành phần được trình bày tại mục 3.2.P.2.1."), OUTLINE));
});

test("the bare form name is not a reference", () => {
  // "biểu mẫu P.2 của phòng" names the department's form. Requiring at least one numeric segment after
  // P.2 is what keeps it out, rather than a list of phrases to ignore.
  validateDraft(draftWith("Hai bảng lấy từ biểu mẫu P.2 của phòng."), OUTLINE);
});

test("a number quoted from another document's numbering is declared, not silently allowed", () => {
  const quoted = "Biểu mẫu gốc đặt mục này ở 3.2.P.2.9.9.9, sâu hơn một cấp so với nhóm chứa nó.";
  expectCode("E_XREF_UNKNOWN", () => validateDraft(draftWith(quoted), OUTLINE));
  validateDraft(draftWith(quoted, { quotedNumbering: ["3.2.P.2.9.9.9"] }), OUTLINE);
});

test("a section of this document may not be declared as quoted numbering", () => {
  // Declaring one of our own sections would pre-build a place to hide a broken link later.
  expectCode("E_META_QUOTED_NUMBERING", () =>
    validateDraft(draftWith("Xem mục P.2.1.2.", { quotedNumbering: ["P.2.1.2"] }), OUTLINE));
});

test("every declared abbreviation must appear in the document", () => {
  const used = [["CT", "Công thức (Formula)"]];
  validateDraft(draftWith("Công thức CT01 và CT02 được so sánh.", { abbreviations: used }), OUTLINE);

  expectCode("E_ABBREVIATION_UNUSED", () =>
    validateDraft(draftWith("Công thức CT01 và CT02 được so sánh.",
      { abbreviations: [...used, ["RMP", "Reference Medicinal Product"]] }), OUTLINE));
});

test("an abbreviation may be followed by digits but not by letters", () => {
  // "CT" is used as CT01, so a digit counts as a use. "EP" must not be satisfied by "EPAR", or the
  // glossary could claim to explain a term the reader never meets on its own.
  validateDraft(draftWith("Công thức CT01.", { abbreviations: [["CT", "Công thức"]] }), OUTLINE);
  expectCode("E_ABBREVIATION_UNUSED", () =>
    validateDraft(draftWith("Báo cáo EPAR không tồn tại.", { abbreviations: [["EP", "Dược điển châu Âu"]] }), OUTLINE));
});

test("a duplicated abbreviation is refused", () => {
  expectCode("E_META_ABBREVIATIONS", () =>
    validateDraft(draftWith("Công thức CT01.", { abbreviations: [["CT", "Công thức"], ["CT", "Lặp lại"]] }), OUTLINE));
});
