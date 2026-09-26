// A figure names its table. It used to count to it, and the index was positional, so a table moved or
// inserted ahead of a figure silently redirected it. That happened three times in two rounds, and each
// time it was caught by a check aimed at something else: the process diagram's column count, the
// chart's row name. The flow kind has neither — it reads column headings straight into unit operation
// names — so a misdirected flow figure would have drawn a different manufacturing process into a
// registration dossier with nothing to complain about.
//
// The test that matters here is the shuffle: reorder a section's tables and require every figure to
// resolve to the same table it did before. Under the old form that check fails by construction, which
// is what makes it evidence that the failure is now impossible rather than merely watched for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { barSeries, flowSteps, processStages, tableAt, FigureSourceError } from "../../render/figures/figure-source.mjs";
import { validateDraft, DraftContractError } from "../validate-draft.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const loadExample = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));

const table = (id, headers, rows) => ({ type: "table", id, headers, rows });
const section = (...blocks) => ({ id: "X.1", status: "covered", blocks });

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DraftContractError || error instanceof FigureSourceError, `got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test("a figure resolves to its table by name", () => {
  const first = table("ma-tran", ["CQA", "Trộn", "Dập viên"], [["Độ rã", "Cao", "Thấp"]]);
  const second = table("ket-qua", ["Chỉ tiêu", "CT01"], [["Độ hòa tan", "98,64"]]);
  const holder = section(first, second);
  assert.equal(tableAt(holder, "ket-qua"), second);
  assert.equal(tableAt(holder, "ma-tran"), first);
});

test("reordering a section's tables does not change what any figure draws", () => {
  // The whole point. Under the old positional form every one of these assertions flips.
  const draft = loadExample();
  for (const entry of draft.sections) {
    const figures = (entry.blocks ?? []).filter((block) => block.type === "figure");
    if (figures.length === 0) continue;

    const before = figures.map((figure) => tableAt(entry, figure.fromTable));
    // Reverse the order of the section's tables, leaving every other block where it is.
    const tables = entry.blocks.filter((block) => block.type === "table").reverse();
    let next = 0;
    entry.blocks = entry.blocks.map((block) => (block.type === "table" ? tables[next++] : block));

    const after = figures.map((figure) => tableAt(entry, figure.fromTable));
    before.forEach((table, index) => {
      assert.equal(after[index], table, `figure ${index} of ${entry.id} followed its table`);
    });
  }
});

test("a flow figure survives the shuffle too, and it is the kind with no other check", () => {
  // A chart would have been caught by its row name and a process diagram by its column count. A flow
  // reads column headings straight into unit operation names, so nothing else would have noticed.
  const draft = loadExample();
  const risk = draft.sections.find((entry) => entry.id === "P.2.3.1");
  const figure = risk.blocks.find((block) => block.type === "figure");
  const steps = flowSteps(risk, figure);

  const decoy = table("bang-khac", ["CQA", "Xát hạt ướt", "Sấy"], [["Độ rã", "Cao", "Cao"]]);
  risk.blocks.unshift(decoy);
  assert.deepEqual(flowSteps(risk, figure), steps, "the flow still draws the operations it named");
  assert.notDeepEqual(steps, decoy.headers.slice(1), "and the decoy would have been a different process");
});

test("a figure naming a table that is not there is refused, and the message lists the real names", () => {
  const holder = section(table("ma-tran", ["CQA", "Trộn"], [["Độ rã", "Cao"]]));
  assert.throws(() => tableAt(holder, "sai-chinh-ta"), (error) => {
    assert.equal(error.code, "E_FIGURE_SOURCE");
    assert.match(error.message, /ma-tran/, "names the ids that do exist");
    return true;
  });
});

test("a table index no longer resolves, and the refusal says what to do instead", () => {
  const draft = loadExample();
  const figure = draft.sections
    .flatMap((entry) => entry.blocks ?? [])
    .find((block) => block.type === "figure");
  figure.fromTable = 0;
  assert.throws(() => validateDraft(draft), (error) => {
    assert.equal(error.code, "E_FIGURE_SHAPE");
    assert.match(error.message, /give the table an id/);
    return true;
  });
});

test("an unnamed table cannot be reached by accident", () => {
  // Leaving fromTable out once matched a table with no id at all, which is the old failure wearing a
  // different hat: the figure would draw from whichever table happened to be unnamed.
  const holder = section({ type: "table", headers: ["Chỉ tiêu", "CT01"], rows: [["Độ rã", "4'18\""]] });
  expectCode("E_FIGURE_SOURCE", () => barSeries(holder, { fromRow: "Độ rã" }));
  expectCode("E_FIGURE_SOURCE", () => flowSteps(holder, {}));
  expectCode("E_FIGURE_SOURCE", () => processStages(holder, {}));
});

test("two tables in one section may not answer to the same name", () => {
  const draft = loadExample();
  const entry = draft.sections.find((candidate) => candidate.id === "P.2.2.1.3.3");
  const tables = entry.blocks.filter((block) => block.type === "table");
  tables[1].id = tables.find((candidate) => candidate.id)?.id;
  expectCode("E_TABLE_ID_DUPLICATE", () => validateDraft(draft));
});

test("a table needs no id until a figure names it", () => {
  // Requiring one everywhere would be a rule nothing uses, and a rule nothing uses goes stale.
  const draft = loadExample();
  const entry = draft.sections.find((candidate) => candidate.id === "P.2.1.2.1");
  assert.ok(entry.blocks.some((block) => block.type === "table" && block.id === undefined));
  validateDraft(draft);
});
