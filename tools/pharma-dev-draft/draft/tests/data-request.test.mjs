// The data-request list is the half of this document that is still empty, turned into something a person
// can act on. It is read out of the markers rather than kept beside them, so these tests hold it to the
// two properties that makes true: every marker is accounted for exactly once, and filling one real value
// removes exactly its own row.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dataRequestRows, markerCount } from "../../render/data-request.mjs";
import { isGapText } from "../../schemas/markers.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const load = (...parts) => JSON.parse(readFileSync(join(toolRoot, ...parts), "utf8"));
const loadOutline = () => load("schemas", "p2-outline.json");
const loadExample = () => load("draft", "example-draft.json");

const accountedFor = (rows) => rows.reduce((total, row) => total + row[4], 0);

test("every marker in the draft is accounted for by exactly one row", () => {
  const rows = dataRequestRows(loadExample(), loadOutline());
  assert.equal(accountedFor(rows), markerCount(loadExample()));
});

test("every row names the section, the item and what is needed", () => {
  for (const [section, item, , request] of dataRequestRows(loadExample(), loadOutline())) {
    assert.match(section, /^3\.2\.P\.2/);
    assert.ok(item.trim().length > 0, `a row under ${section} names no item`);
    assert.ok(request.trim().length >= 10, `a row under ${section} (${item}) does not say what is needed or where from`);
  }
});

test("a row in a per-strength table says which strength it is about", () => {
  const draft = loadExample();
  const rows = dataRequestRows(draft, loadOutline());
  for (const strength of draft.meta.strengths) {
    assert.ok(rows.some((row) => row[2] === strength), `no row is attributed to ${strength}`);
  }
});

test("filling one real value removes exactly one row", () => {
  // The property that makes the list worth having: nobody has to remember to strike a line out.
  const outline = loadOutline();
  const before = dataRequestRows(loadExample(), outline);

  const draft = loadExample();
  const table = draft.sections.find((section) => section.id === "P.2.2.1.1").blocks.find((block) => block.type === "table");
  const row = table.rows.find((candidate) => isGapText(candidate[1]));
  row[1] = "Viên nén bao phim, lõi trắng";

  const after = dataRequestRows(draft, outline);
  assert.equal(after.length, before.length - 1);
  assert.equal(accountedFor(after), accountedFor(before) - 1);
});

test("a table with no cell filled in asks once, not once per cell", () => {
  // An empty risk matrix asks for a single thing: the assessment that fills it. Thirty-five rows saying
  // "a risk level is missing" would bury the requests that name something specific.
  const outline = loadOutline();
  const draft = loadExample();
  const matrix = draft.sections.find((section) => section.id === "P.2.3.1").blocks.find((block) => block.type === "table");
  const cellCount = matrix.rows.length * (matrix.headers.length - 1);
  assert.ok(cellCount > 5, "this test needs a matrix, not a two-cell table");

  const rows = dataRequestRows(draft, outline).filter((row) => row[0].startsWith("3.2.P.2.3.1 "));
  assert.equal(rows.length, 1);
  assert.equal(rows[0][4], cellCount);
  assert.match(rows[0][1], /Toàn bộ bảng/);
});

test("one filled cell breaks the collapse, so the rest are asked for individually", () => {
  const outline = loadOutline();
  const draft = loadExample();
  const matrix = draft.sections.find((section) => section.id === "P.2.3.1").blocks.find((block) => block.type === "table");
  matrix.rows[0][1] = "Thấp";

  const rows = dataRequestRows(draft, outline).filter((row) => row[0].startsWith("3.2.P.2.3.1 "));
  const cellCount = matrix.rows.length * (matrix.headers.length - 1);
  assert.equal(rows.length, cellCount - 1);
  // And each of them now names its column, or a reader cannot tell which cell is being asked about.
  assert.ok(rows.every((row) => row[1].includes(" × ")), "a matrix cell must name its unit operation");
});

test("the list follows the markers even for a product with different sections filled", () => {
  // No section id is written into the generator: it walks the outline and reads the draft, so a draft
  // with other sections empty produces the list for those instead.
  const outline = loadOutline();
  const draft = loadExample();
  for (const section of draft.sections) {
    if (section.id !== "P.2.6") section.blocks = [{ type: "paragraph", text: "Nội dung đã hoàn chỉnh." }];
  }
  const rows = dataRequestRows(draft, outline);
  assert.equal(accountedFor(rows), markerCount(draft));
  assert.ok(rows.every((row) => row[0].startsWith("3.2.P.2.6")));
});
