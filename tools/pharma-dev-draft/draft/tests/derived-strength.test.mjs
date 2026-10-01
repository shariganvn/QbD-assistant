// A strength worked out by proportion from another has a composition and no measurements. Proportion
// gives a mass; it does not give a dissolution percentage, a hardness, a disintegration time or a
// content-uniformity result. These tests hold the validator to that, because the finished Word file
// gives a reader no way to tell a calculated number from a measured one — the rule is the only thing
// standing between a proportional calculation and a document that reads like evidence.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateDraft } from "../validate-draft.mjs";
import { GAP_PREFIX } from "../../schemas/markers.mjs";
import { STRENGTH_OUTLINE, strengthDraft } from "./fixtures/strength-form.mjs";

const STRENGTHS = ["5 mg", "10 mg"];
const DERIVED = { derivedStrengths: ["5 mg"] };

// The results table in the shared fixture form; its first column holds row labels and each strength
// owns one column after it.
function resultsTable(draft) {
  return draft.sections.find((section) => section.id === "X.3").blocks[0];
}

function expectRejected(draft) {
  assert.throws(() => validateDraft(draft, STRENGTH_OUTLINE), (error) => {
    assert.equal(error.code, "E_DERIVED_STRENGTH_HAS_RESULT");
    return true;
  });
}

test("a derived strength's results table is accepted when every cell is marked", () => {
  assert.doesNotThrow(() => validateDraft(strengthDraft(STRENGTHS, DERIVED), STRENGTH_OUTLINE));
});

test("a measured value filled in for a derived strength is rejected", () => {
  const draft = strengthDraft(STRENGTHS, DERIVED);
  resultsTable(draft).rows[0][1] = "98,64";
  expectRejected(draft);
});

test("the rejection names the row, the column and the strength", () => {
  const draft = strengthDraft(STRENGTHS, DERIVED);
  resultsTable(draft).rows[1][1] = "85,2 N";
  assert.throws(() => validateDraft(draft, STRENGTH_OUTLINE), (error) => {
    assert.match(error.message, /Độ cứng/);
    assert.match(error.message, /column 2/);
    assert.match(error.message, /5 mg/);
    return true;
  });
});

test("a blank cell for a derived strength is rejected too", () => {
  // Silence is not a gap. An empty cell in a document shaped like a dossier reads as "not
  // applicable"; the document has to say the data is missing.
  const draft = strengthDraft(STRENGTHS, DERIVED);
  resultsTable(draft).rows[0][1] = "";
  expectRejected(draft);
});

test("whitespace does not pass as a marker", () => {
  const draft = strengthDraft(STRENGTHS, DERIVED);
  resultsTable(draft).rows[0][1] = "   ";
  expectRejected(draft);
});

test("the studied strength's results are untouched by the rule", () => {
  // The whole point is asymmetry: the strength that was actually made carries its measurements.
  const draft = strengthDraft(STRENGTHS, DERIVED);
  const table = resultsTable(draft);
  table.rows[0][2] = "98,64";
  table.rows[1][2] = "85,2 N";
  assert.doesNotThrow(() => validateDraft(draft, STRENGTH_OUTLINE));
});

test("marking the studied strength's results is still allowed", () => {
  // Data not yet collected for a real batch is an ordinary gap, not a claim about derivation.
  const draft = strengthDraft(STRENGTHS, DERIVED);
  resultsTable(draft).rows[0][2] = `${GAP_PREFIX} – CẦN BỔ SUNG] chưa thử`;
  assert.doesNotThrow(() => validateDraft(draft, STRENGTH_OUTLINE));
});

test("a composition table may carry calculated quantities for a derived strength", () => {
  // X.1 and X.2 are composition tables, not marked measuredOnly: a composition is a declared quantity
  // and proportion can supply it. That is the one thing a derived strength may hold as a number.
  const draft = strengthDraft(STRENGTHS, DERIVED);
  const composition = draft.sections.find((section) => section.id === "X.2").blocks[0];
  assert.ok(composition.rows[0].slice(2).every((cell) => cell === "10,00"));
  assert.doesNotThrow(() => validateDraft(draft, STRENGTH_OUTLINE));
});

test("with no derived strength declared, a results table may be filled throughout", () => {
  const draft = strengthDraft(STRENGTHS);
  for (const row of resultsTable(draft).rows) {
    assert.ok(row.slice(1).every((cell) => cell === "98,64"));
  }
  assert.doesNotThrow(() => validateDraft(draft, STRENGTH_OUTLINE));
});

test("every strength may be derived, and then no result may be stated at all", () => {
  const draft = strengthDraft(STRENGTHS, { derivedStrengths: STRENGTHS });
  assert.doesNotThrow(() => validateDraft(draft, STRENGTH_OUTLINE));
  resultsTable(draft).rows[0][2] = "98,64";
  expectRejected(draft);
});

test("the rule follows the strength count: a third derived strength is checked as well", () => {
  const strengths = ["2,5 mg", "5 mg", "10 mg"];
  const draft = strengthDraft(strengths, { derivedStrengths: ["2,5 mg", "5 mg"] });
  assert.doesNotThrow(() => validateDraft(draft, STRENGTH_OUTLINE));
  resultsTable(draft).rows[0][1] = "72,10";
  expectRejected(draft);
});
