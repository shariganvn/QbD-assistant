// A product may have any number of strengths, and a table that reports per strength carries one
// column group for each. These tests exercise the rule on a purpose-built form rather than on the
// department's current outline, so what is proven is the rule itself: the same checks hold whatever
// shape the outline takes later, and for however many strengths a product declares.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateDraft } from "../validate-draft.mjs";
import { STRENGTH_OUTLINE as OUTLINE, strengthDraft as draftFor } from "./fixtures/strength-form.mjs";

function expectFailure(draft, code) {
  assert.throws(() => validateDraft(draft, OUTLINE), (error) => {
    assert.equal(error.code, code);
    return true;
  });
}

test("a two-strength draft validates on both group sizes", () => {
  assert.doesNotThrow(() => validateDraft(draftFor(["5 mg", "10 mg"]), OUTLINE));
});

test("three strengths validate unchanged: the count is data, not a built-in assumption", () => {
  // The reason this test exists: a rule written for "the two strengths" reads as correct and passes
  // every two-strength fixture. Only a third strength shows whether the count was really derived.
  assert.doesNotThrow(() => validateDraft(draftFor(["2,5 mg", "5 mg", "10 mg"]), OUTLINE));
});

test("one strength validates: a single-strength product takes the same form", () => {
  assert.doesNotThrow(() => validateDraft(draftFor(["10 mg"]), OUTLINE));
});

test("a table missing a strength's column group is rejected", () => {
  const draft = draftFor(["5 mg", "10 mg"]);
  const table = draft.sections[0].blocks[0];
  table.headers = ["Thành phần", "10 mg"];
  table.rows = [["Hoạt chất", "10,00"]];
  expectFailure(draft, "E_FORM_STRENGTH_COLUMNS");
});

test("an unequal column split across strengths is rejected", () => {
  const draft = draftFor(["5 mg", "10 mg"]);
  const table = draft.sections[1].blocks[0];
  table.headers = ["STT", "Tên thành phần", "5 mg (mg)", "5 mg (%)", "10 mg (mg)"];
  table.rows = [["1", "Hoạt chất", "10,00", "10,0", "20,00"]];
  expectFailure(draft, "E_FORM_STRENGTH_COLUMNS");
});

test("a column group that does not name its strength is rejected", () => {
  const draft = draftFor(["5 mg", "10 mg"], { groupLabels: ["Hàm lượng thấp", "Hàm lượng cao"] });
  expectFailure(draft, "E_FORM_STRENGTH_COLUMNS");
});

test("transposed column groups are rejected even when one label contains the other", () => {
  // 5 mg and 15 mg: the string "15 mg" contains "5 mg", so a containment test alone would accept the
  // groups in the wrong order and file every value under the wrong strength.
  const draft = draftFor(["5 mg", "15 mg"], { groupLabels: ["15 mg", "5 mg"] });
  expectFailure(draft, "E_FORM_STRENGTH_COLUMNS");
});

test("strengths in the right order validate even when one label contains the other", () => {
  assert.doesNotThrow(() => validateDraft(draftFor(["5 mg", "15 mg"]), OUTLINE));
});

test("meta.strengths must be present and well formed", () => {
  for (const strengths of [undefined, [], ["10 mg", "10 mg"], ["  "]]) {
    const draft = draftFor(["5 mg", "10 mg"]);
    draft.meta.strengths = strengths;
    expectFailure(draft, "E_META_STRENGTHS");
  }
});

test("meta.derivedStrengths must name a declared strength", () => {
  const draft = draftFor(["5 mg", "10 mg"]);
  draft.meta.derivedStrengths = ["2,5 mg"];
  expectFailure(draft, "E_META_STRENGTHS");
});

test("meta.derivedStrengths accepts a subset of the declared strengths", () => {
  const draft = draftFor(["5 mg", "10 mg"]);
  draft.meta.derivedStrengths = ["5 mg"];
  assert.doesNotThrow(() => validateDraft(draft, OUTLINE));
});

test("perStrength and an open-ended column list cannot both be declared", () => {
  // They make opposite claims about the trailing columns — any number and any name, versus exactly
  // one group per strength — so a table declaring both has no defined shape to check against.
  const outline = structuredClone(OUTLINE);
  outline.sections[0].form.tables[0].columns = ["Thành phần", "..."];
  assert.throws(() => validateDraft(draftFor(["5 mg", "10 mg"]), outline), (error) => {
    assert.equal(error.code, "E_FORM_COLUMNS");
    return true;
  });
});
