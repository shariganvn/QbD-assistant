// A document can be a reference for FORMAT and still be poison as a source of DATA. This repo now has
// access to a finished P.2 for the same product — same API, same two strengths, same reference medicinal
// product, same dosage form — written by a different company from a different formula. Seven of its
// seven excipients differ from ours; only magnesium stearate is shared. Every number in it was measured
// on a tablet nobody here ever made.
//
// The failure being guarded is not a decision to plagiarise. It is a section that sits empty for months
// beside a section that is full, and one value moving across without anyone deciding anything.
//
// Two rules, because two mistakes are possible. An identifier — a batch number, a supplier, a DMF id —
// can never legitimately be ours, so one occurrence fails. A measured value could coincide, so values
// are grouped by the reference table they came from and several from one table inside one section fails:
// the same block-pattern reasoning that found the first copied results table in this project.
//
// The fixtures below build their own synthetic reference list rather than using the committed one, for
// the same reason the reference document is not committed: a test carrying another company's values
// would be the copy it is testing against. The two tests that do touch the committed file check only
// that it passes on our draft and that it holds nothing but hashes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashToken, normalizeToken } from "../../verify/reference-tokens.mjs";
import {
  TOKEN_FILE,
  draftFailures,
  identityFailures,
  loadReferenceTokens,
} from "../../verify/sample-boundary.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const loadExample = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));

// An invented reference: three values that belong to one imaginary table, and one identifier.
const FAKE_VALUES = ["811.71", "822.72", "833.73", "844.74"];
const FAKE_IDENTITY = "QQ7X42";

function syntheticTokens() {
  const directory = mkdtempSync(join(tmpdir(), "reference-boundary-"));
  const path = join(directory, "tokens.json");
  writeFileSync(path, JSON.stringify({
    hashAlgorithm: "sha256/16",
    minimumGroupMatch: 3,
    identity: [hashToken(FAKE_IDENTITY)],
    groups: [{ label: "invented table", values: FAKE_VALUES.map(hashToken) }],
  }));
  return loadReferenceTokens(path);
}

function draftWithParagraph(text, sectionId = "P.2.2.3.2") {
  const draft = loadExample();
  const section = draft.sections.find((candidate) => candidate.id === sectionId);
  section.blocks.push({ type: "paragraph", text });
  return draft;
}

test("an identifier from the format reference is refused on sight", () => {
  const failures = draftFailures(draftWithParagraph(`Lô ${FAKE_IDENTITY} dùng để so sánh.`), syntheticTokens());
  assert.equal(failures.length, 1);
  assert.match(failures[0], new RegExp(FAKE_IDENTITY));
  assert.match(failures[0], /another company/);
});

test("several measured values from one reference table in one section is a copied block", () => {
  const failures = draftFailures(
    draftWithParagraph(`Kết quả ${FAKE_VALUES[0]} rồi ${FAKE_VALUES[1]} rồi ${FAKE_VALUES[2]}.`),
    syntheticTokens(),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /copied block/);
});

// The tolerance has to be real, not a sentence in a comment. A rule that failed on one shared number
// would fire on coincidences, and a rule that fires on coincidences gets switched off.
test("a single shared value is a coincidence and is allowed", () => {
  const failures = draftFailures(draftWithParagraph(`Một giá trị ${FAKE_VALUES[0]}.`), syntheticTokens());
  assert.deepEqual(failures, []);
});

test("two shared values are still below the block threshold", () => {
  const failures = draftFailures(
    draftWithParagraph(`Hai giá trị ${FAKE_VALUES[0]} và ${FAKE_VALUES[1]}.`),
    syntheticTokens(),
  );
  assert.deepEqual(failures, []);
});

// Retyping a value with the other decimal separator produces the same measurement, so it must hash the
// same. Otherwise swapping a comma for a dot is a documented way past the rule.
test("a value retyped with the other decimal separator is the same value", () => {
  assert.equal(normalizeToken("98,64"), normalizeToken("98.64"));
  assert.equal(hashToken("98,64"), hashToken("98.64"));

  const swapped = FAKE_VALUES.slice(0, 3).map((value) => value.replace(".", ","));
  const failures = draftFailures(draftWithParagraph(`Kết quả ${swapped.join(" và ")}.`), syntheticTokens());
  assert.equal(failures.length, 1);
  assert.match(failures[0], /copied block/);
});

// Values spread across different sections are not a copied block: the unit of copying is a table inside
// a section, and flattening the document would make the threshold mean nothing.
test("values in different sections do not add up to a block", () => {
  const draft = loadExample();
  const ids = ["P.2.2.3.2", "P.2.2.3.3.1", "P.2.5"];
  ids.forEach((id, index) => {
    draft.sections.find((candidate) => candidate.id === id)
      .blocks.push({ type: "paragraph", text: `Giá trị ${FAKE_VALUES[index]}.` });
  });
  assert.deepEqual(draftFailures(draft, syntheticTokens()), []);
});

test("identity is checked on any text, not only on a structured draft", () => {
  const tokens = syntheticTokens();
  assert.deepEqual(identityFailures("không có gì ở đây", tokens, "rendered text"), []);
  assert.equal(identityFailures(`lô ${FAKE_IDENTITY}`, tokens, "rendered text").length, 1);
});

test("the worked example passes the real boundary check", () => {
  assert.deepEqual(draftFailures(loadExample()), []);
});

// The blocklist must never itself become a copy of the other company's dossier. Hashes only, every one
// of them, or the file is doing the thing it exists to prevent.
test("the committed reference list holds hashes and no plaintext", () => {
  const parsed = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
  const hashPattern = /^[0-9a-f]{16}$/;
  assert.ok(parsed.identity.length > 0, "the list would pass everything if it were empty");
  assert.ok(parsed.groups.length > 0);
  for (const hash of parsed.identity) assert.match(hash, hashPattern);
  for (const group of parsed.groups) {
    for (const hash of group.values) assert.match(hash, hashPattern);
  }
});

// The group labels were the leak the first time round: they carried the reference's own captions, and a
// caption naming a trial batch is a batch number — so the file held in plaintext exactly
// what its identity list exists to refuse, and would have tripped its own rule. A label may say which
// table a group came from and nothing else.
test("a group label names a table number and carries no borrowed text", () => {
  const parsed = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
  for (const group of parsed.groups) {
    assert.match(group.label, /^reference table (\d+|at line \d+)$/, `leaky group label: ${group.label}`);
  }
});

// And the file must not trip the rule it defines. Running the check over the blocklist itself is the
// cheapest way to prove no identifier survived anywhere in it, including in a field nobody thought about.
test("the committed reference list does not trip its own identity rule", () => {
  const tokens = loadReferenceTokens();
  assert.deepEqual(identityFailures(readFileSync(TOKEN_FILE, "utf8"), tokens, "the token file"), []);
});
