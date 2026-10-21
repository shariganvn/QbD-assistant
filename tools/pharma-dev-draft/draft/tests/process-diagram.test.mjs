// A manufacturing process is the one thing in this document that a reader reconstructs from a picture
// rather than from numbers, so the picture has to be right about a different kind of fact: not "how
// much" but "what enters where". The chain diagram already in use draws unit operations in a row,
// which says nothing about the components added at each one — and for a direct-compression process
// with three blending steps, that is the whole content.
//
// The rules below exist because a diagram that is wrong in these particular ways still looks like a
// diagram. A missing stage reads as a shorter process. An input drawn on the wrong stage reads as a
// different formulation order. Neither announces itself the way a missing number does.

import { test } from "node:test";
import assert from "node:assert/strict";

import { processStages, FigureSourceError } from "../../render/figures/figure-source.mjs";
import { processStageSvg } from "../../render/figures/process-flow.mjs";
import { GAP_PREFIX } from "../../schemas/markers.mjs";

const GAP = `${GAP_PREFIX} – CẦN BỔ SUNG] chờ nguồn`;

const TABLE_ID = "quy-trinh";
const processTable = (rows) => ({
  type: "table",
  id: TABLE_ID,
  headers: ["Bước", "Thành phần đưa vào (đã rây)", "Công đoạn"],
  rows,
});

const sectionWith = (table) => ({ id: "X.1", status: "covered", blocks: [table] });

const FOUR_STEPS = [
  ["1", "Hoạt chất · Tá dược độn A · Tá dược độn B", "Trộn đồng nhất 1"],
  ["2", "Tá dược rã", "Trộn đồng nhất 2"],
  ["3", "Tá dược trơn", "Trộn hoàn tất"],
  ["4", "—", "Dập viên"],
];

function expectSourceError(match, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof FigureSourceError, `expected FigureSourceError, got ${error}`);
    assert.equal(error.code, "E_FIGURE_SOURCE");
    assert.match(error.message, match);
    return true;
  });
}

test("the stages are read out of the table, and the block carries no step of its own", () => {
  const stages = processStages(sectionWith(processTable(FOUR_STEPS)), { fromTable: TABLE_ID });
  assert.deepEqual(stages.map((stage) => stage.operation),
    ["Trộn đồng nhất 1", "Trộn đồng nhất 2", "Trộn hoàn tất", "Dập viên"]);
  assert.equal(stages[0].input, "Hoạt chất · Tá dược độn A · Tá dược độn B");
  // Correcting the table corrects the diagram, with no second edit anywhere.
  const corrected = FOUR_STEPS.map((row) => [...row]);
  corrected[1][1] = "Tá dược rã khác";
  assert.equal(processStages(sectionWith(processTable(corrected)), { fromTable: TABLE_ID })[1].input, "Tá dược rã khác");
});

test("an em dash means the step adds nothing, and draws no input branch", () => {
  // A blank cell would read as "not applicable" — the failure the markers exist to prevent — so the
  // draft has to say which it means, and only the em dash means "deliberately nothing".
  const stages = processStages(sectionWith(processTable(FOUR_STEPS)), { fromTable: TABLE_ID });
  assert.equal(stages[3].input, "");

  const { svg } = processStageSvg(stages);
  // Three input boxes for four stages: the compression step has none.
  assert.equal(svg.split("<rect").length - 1, 4 + 3);
});

test("a step with no unit operation is refused rather than drawn short", () => {
  const missing = FOUR_STEPS.map((row) => [...row]);
  missing[2][2] = "";
  expectSourceError(/no unit operation/, () => processStages(sectionWith(processTable(missing)), { fromTable: TABLE_ID }));

  const marked = FOUR_STEPS.map((row) => [...row]);
  marked[2][2] = GAP;
  expectSourceError(/no unit operation/, () => processStages(sectionWith(processTable(marked)), { fromTable: TABLE_ID }));
});

test("a gap marker where the components belong is refused, and says to write an em dash instead", () => {
  const marked = FOUR_STEPS.map((row) => [...row]);
  marked[3][1] = GAP;
  expectSourceError(/write "—" if the step adds nothing/,
    () => processStages(sectionWith(processTable(marked)), { fromTable: TABLE_ID }));
});

test("the table shape is required outright, not guessed at", () => {
  // labelColumnCount models "ordinals plus one label column", which puts the components column on the
  // label side and the operation on the value side. Both matter here, so the shape is demanded instead.
  // A fourth column appended later would otherwise be drawn as the operation.
  const widened = {
    type: "table",
    id: TABLE_ID,
    headers: ["Bước", "Thành phần đưa vào", "Công đoạn", "Ghi chú"],
    rows: FOUR_STEPS.map((row) => [...row, "—"]),
  };
  expectSourceError(/exactly three/, () => processStages(sectionWith(widened), { fromTable: TABLE_ID }));

  expectSourceError(/no rows/, () => processStages(sectionWith(processTable([])), { fromTable: TABLE_ID }));
});

test("every stage reaches the drawing, in the table's order", () => {
  const { svg } = processStageSvg(processStages(sectionWith(processTable(FOUR_STEPS)), { fromTable: TABLE_ID }));
  const positions = ["Trộn đồng nhất 1", "Trộn đồng nhất 2", "Trộn hoàn tất", "Dập viên"]
    .map((operation) => svg.indexOf(operation));
  assert.ok(positions.every((position) => position !== -1), "every operation is drawn");
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "drawn in the table's order");
});

test("a component list is split one per line rather than wrapped as prose", () => {
  // Five excipients wrapped across three lines is a paragraph in a box, and the reader has to parse
  // the separators back out of it.
  const { svg } = processStageSvg(processStages(sectionWith(processTable(FOUR_STEPS)), { fromTable: TABLE_ID }));
  for (const component of ["Hoạt chất", "Tá dược độn A", "Tá dược độn B"]) {
    assert.match(svg, new RegExp(`<tspan[^>]*>${component}</tspan>`), `${component} on its own line`);
  }
});
