// Two statements about the document itself, which have to stay apart: how the text was assembled, and
// who takes responsibility for it. The first is provenance and belongs in the scope notice; the second
// is a signature and belongs to a person.
//
// They did not stay apart. The field was called `preparer`, which reads as "the person who prepared
// this", so it was printed into a table row carrying a "Chữ ký" column — naming a tool as the drafter
// and stamping a date beside it, in a document whose whole purpose is to be auditable. Nothing in the
// suite noticed, because every other rule here is about measurements and this is a statement about
// responsibility.
//
// The rules below are positional on purpose. A check that looked for AI-sounding strings would pass a
// draft whose field held an invented person's name, which is the same false statement with better
// camouflage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SIGNOFF_HEADING, provenanceSentence, signoffRows } from "../../render/builder.mjs";
import { validateDraft, DraftContractError } from "../validate-draft.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const loadExample = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));

const SIGNATURE_BLANK = "________________";

test("every role in the sign-off table is left blank for a person to sign", () => {
  const rows = signoffRows();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row[0]), ["Soạn thảo", "Rà soát FD", "Phê duyệt QA/PO"]);
  for (const [role, name, date, signature] of rows) {
    assert.equal(name, SIGNATURE_BLANK, `${role} has no name filled in`);
    assert.equal(date, SIGNATURE_BLANK, `${role} has no date filled in`);
    assert.equal(signature, "", `${role} has nothing in the signature cell`);
  }
});

test("the sign-off table is not given the draft's meta at all, so it cannot leak into it", () => {
  // This is the rule, not a side effect: a table with a signature column that reads no field of the
  // file cannot claim someone accepted responsibility. Passing meta in would make the old failure
  // reachable again, one edit at a time.
  assert.equal(signoffRows.length, 0, "signoffRows takes no arguments");
  const drafted = JSON.stringify(signoffRows());
  for (const value of Object.values(loadExample().meta).flat()) {
    if (typeof value !== "string" || value.length < 4) continue;
    assert.ok(!drafted.includes(value), `no meta value reaches the sign-off table (${value})`);
  }
});

test("a person's name in the field is kept off the signature lines just the same", () => {
  // The camouflaged version of the same false statement. Nothing about the rule may depend on the
  // string looking like a tool.
  const meta = { ...loadExample().meta, assembledBy: "Nguyễn Văn A" };
  assert.ok(!JSON.stringify(signoffRows()).includes("Nguyễn Văn A"));
  assert.match(provenanceSentence(meta), /Nguyễn Văn A/, "it is still stated as provenance, not hidden");
});

test("the provenance sentence says what assembled the draft, how, and when", () => {
  const meta = loadExample().meta;
  const sentence = provenanceSentence(meta);
  assert.match(sentence, new RegExp(meta.assembledBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sentence, new RegExp(meta.extractionMethod));
  assert.match(sentence, new RegExp(meta.draftDate));
  // It must not repeat the sign-off heading verbatim: the verifier counts that heading to find where
  // the signature table starts, and a second copy of the phrase inside a sentence would make the
  // position check read the wrong boundary.
  assert.ok(!sentence.includes(SIGNOFF_HEADING), "the sentence does not repeat the sign-off heading");
});

test("the assembled-by date is stated once, by draftDate, and not repeated inside the field", () => {
  // Two places holding the same date are two places that disagree at the next edit — and the one that
  // went stale here was the one nobody re-read.
  const meta = loadExample().meta;
  assert.ok(!meta.assembledBy.includes(meta.draftDate), "assembledBy does not carry its own date");
  assert.match(meta.draftDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("a draft with no assembledBy is refused at Stage B", () => {
  const draft = loadExample();
  delete draft.meta.assembledBy;
  assert.throws(() => validateDraft(draft), (error) => {
    assert.ok(error instanceof DraftContractError);
    assert.equal(error.code, "E_META_FIELD");
    assert.match(error.message, /assembledBy/);
    return true;
  });
});

test("the old field name no longer satisfies the contract", () => {
  // Keeping both names working would keep the name that caused this, and a field with two spellings is
  // a field that ends up holding two different things.
  const draft = loadExample();
  draft.meta.preparer = draft.meta.assembledBy;
  delete draft.meta.assembledBy;
  assert.throws(() => validateDraft(draft), (error) => error.code === "E_META_FIELD");
});
