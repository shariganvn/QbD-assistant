// The build logic must not know which product it is drafting. A different active substance brings
// different excipients, different quality attributes and — depending on the method — a different set
// of unit operations; none of that may be pinned in a module. Format belongs in the outline, data
// belongs in the draft, and neither belongs in the code.
//
// This runs as a test rather than as a grep because grep compares bytes: in a byte-oriented locale a
// bracket expression holding a Vietnamese letter is split into its UTF-8 bytes and silently stops
// matching, so a scan written that way reports clean while the term is sitting in the file. Matching
// in JavaScript compares characters, and running inside the suite means the check cannot be skipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(testDir, "..", "..");

// Names that exist only inside a section's content, so no meta field announces them. This list is
// scan configuration, not build logic: nothing here is read while drafting or rendering, and adding
// a product to it changes no behaviour. Keep it to proper nouns and codes — a generic word such as
// "viên nén" describes a dosage form, which the form may legitimately name.
const CONTENT_TERMS = [
  "croscarmellose", "primellose", "cellactose", "povidone", "magnesi stearat",
  "concor", "opadry",
  "dập thẳng", "xát hạt", "tầng sôi", "cán ép", "đóng tán", "ép đùn",
];

function moduleFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "output") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...moduleFiles(path));
    else if (entry.name.endsWith(".mjs")) found.push(path);
  }
  return found;
}

// A test file is allowed to build a draft for some other product — that is how the neutrality of the
// form is demonstrated. Everything else must come up clean.
function isFixtureFile(path) {
  return path.includes(join("draft", "tests"));
}

// Comments are addressed to whoever maintains the module, on the same footing as a section's
// description in the outline: they may name a product or a strength to illustrate a rule — the
// longest-match rule for strength labels is only explicable with two concrete strengths — and naming
// one constrains nothing. What must stay neutral is the logic, so the scan reads the code alone.
function codeWithoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");
}

function termsFromDraft() {
  const draft = JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));
  const fromMeta = [draft.meta.apiName, draft.meta.productName]
    .join(" ")
    .split(/[\s,;()]+/)
    // Short tokens are units and connectives ("mg", "và"); long ones are the names that identify a
    // product. Deriving them from meta means the scan follows the worked example rather than having
    // to be updated alongside it.
    .filter((word) => word.length >= 5);
  // Which strengths a product has is the newest place a value could get pinned into the shape: a rule
  // written for "the two strengths" passes every two-strength fixture. Scanning for the declared
  // strengths themselves keeps that out of the form and out of the modules.
  const strengths = draft.meta.strengths ?? [];
  return [...new Set([...fromMeta, ...strengths, ...CONTENT_TERMS])].map((term) => term.toLowerCase());
}

test("no product name reaches a module", () => {
  const terms = termsFromDraft();
  const offenders = [];
  for (const path of moduleFiles(toolRoot)) {
    if (isFixtureFile(path)) continue;
    const text = codeWithoutComments(readFileSync(path, "utf8")).toLowerCase();
    for (const term of terms) {
      if (text.includes(term)) offenders.push(`${path.slice(toolRoot.length + 1)}: "${term}"`);
    }
  }
  assert.deepEqual(offenders, [], `product-specific literals found in build logic:\n${offenders.join("\n")}`);
});

// The part of the outline a draft is held to: ids, CTD numbers, headings and the `form` block. A
// section's `description` is prose addressed to whoever authors the draft, and it may name products
// or methods as examples — the P.2.3 description lists candidate manufacturing methods precisely to
// say the step set is not fixed. Prose guidance constrains nobody; the enforced surface does, so that
// is what has to stay neutral.
function enforcedOutlineSurface() {
  const outline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
  const enforced = outline.sections.map(({ description, ...rest }) => rest);
  return JSON.stringify(enforced).toLowerCase();
}

test("no product name reaches the enforced part of the outline", () => {
  // A term landing here means one product has been pinned into the shape every other product must
  // also take — the exact defect the tenth review pass found, where the format was loose and one
  // product's data was rigid.
  const terms = termsFromDraft();
  const surface = enforcedOutlineSurface();
  const offenders = terms.filter((term) => surface.includes(term));
  assert.deepEqual(offenders, [], `product-specific literals found in the enforced outline: ${offenders.join(", ")}`);
});
