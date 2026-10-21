// The data-request annex is a work order: requests grouped by the experiment that closes them. These
// tests hold the grouping to the same standard as the list it regroups — every marker is accounted for
// exactly once, filling a value removes exactly one line — and hold the sections the format-reference
// work added to the promise that they carry a marker and no data.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { measurementTokens } from "../validate-draft.mjs";
import { markerCount } from "../../render/data-request.mjs";
import { UNGROUPED, printableWorkOrder, workOrderGroups } from "../../render/work-order.mjs";
import { isGapText, isMarkedText } from "../../schemas/markers.mjs";
import { labelColumnCount } from "../../schemas/table-shape.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
const loadExample = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));
const sum = (groups) => groups.reduce((total, group) => total + group.cells, 0);

test("every leaf section of the outline names the experiment its markers belong to", () => {
  for (const section of outline.sections.filter((entry) => !entry.container)) {
    const experiment = section.form?.workOrder?.experiment;
    assert.ok(typeof experiment === "string" && experiment.trim() !== "", `${section.id} names no experiment`);
  }
});

test("a container names none, since it holds no marker", () => {
  for (const section of outline.sections.filter((entry) => entry.container)) {
    assert.equal(section.form, undefined, `${section.id} is a container`);
  }
});

test("the groups account for every marker in the draft exactly once", () => {
  const draft = loadExample();
  assert.equal(sum(workOrderGroups(draft, outline)), markerCount(draft));
});

test("nothing lands in the ungrouped bucket in the committed draft", () => {
  assert.ok(!workOrderGroups(loadExample(), outline).some((group) => group.experiment === UNGROUPED));
});

test("groups come out in the order their first section appears in the outline", () => {
  const groups = workOrderGroups(loadExample(), outline).map((group) => group.experiment);
  const firstSeen = [];
  for (const section of outline.sections) {
    const experiment = section.form?.workOrder?.experiment;
    if (experiment && groups.includes(experiment) && !firstSeen.includes(experiment)) firstSeen.push(experiment);
  }
  assert.deepEqual(groups, firstSeen);
});

test("a section the outline does not map falls into a visible bucket, not silently into another group", () => {
  const unmapped = JSON.parse(JSON.stringify(outline));
  delete unmapped.sections.find((s) => s.id === "P.2.2.3.4.1").form.workOrder;
  const groups = workOrderGroups(loadExample(), unmapped);
  const bucket = groups.find((group) => group.experiment === UNGROUPED);
  assert.ok(bucket && bucket.rows.every((row) => row.sectionId === "P.2.2.3.4.1"));
});

test("the breakability experiment gathers the shared design and both strengths", () => {
  const group = workOrderGroups(loadExample(), outline).find((entry) => entry.experiment === "Phép thử tách vạch");
  assert.deepEqual([...new Set(group.rows.map((row) => row.sectionId))].sort(), ["P.2.2.3.4", "P.2.2.3.4.1", "P.2.2.3.4.2"]);
  assert.deepEqual([...group.strengths].sort(), ["10 mg", "5 mg"]);
});

test("a request goes to the default owner unless its own text names another department", () => {
  const draft = loadExample();
  const group = workOrderGroups(draft, outline).find((entry) => entry.experiment === "Phép thử tách vạch");
  assert.ok(group.rows.every((row) => row.owner === outline.dataOwner));
  const section = draft.sections.find((s) => s.id === "P.2.2.3.4.1");
  section.blocks[0].text += " Phiếu kiểm nghiệm do QA cấp.";
  const changed = workOrderGroups(draft, outline).find((entry) => entry.experiment === "Phép thử tách vạch");
  assert.ok(changed.rows.some((row) => row.sectionId === "P.2.2.3.4.1" && row.owner === "QA"));
});

test("filling one value removes exactly one line from the work order", () => {
  const draft = loadExample();
  const before = workOrderGroups(draft, outline).flatMap((group) => group.rows).length;
  const table = draft.sections.find((s) => s.id === "P.2.2.1.1").blocks.find((b) => b.type === "table");
  const row = table.rows.find((candidate) => candidate.slice(1).some(isGapText));
  const column = row.findIndex((cell, index) => index > 0 && isGapText(cell));
  row[column] = "đã đo";
  const after = workOrderGroups(draft, outline).flatMap((group) => group.rows).length;
  assert.equal(after, before - 1);
});

test("the printed order has a summary line for each group and as many tables", () => {
  const printed = printableWorkOrder(loadExample(), outline);
  assert.equal(printed.summary.length, printed.tables.length);
  printed.tables.forEach((table, index) => {
    assert.equal(table.experiment, printed.summary[index][0]);
    assert.equal(String(table.rows.length), printed.summary[index][1]);
    assert.ok(table.rows.every((row) => row.length === 5));
  });
});

// --- the sections this work added carry a marker and no data ----------------------------------------------

// The sections that did not exist before the reference dossier was compared, other than the two that
// only gave an id to content already in the document (the two trials).
const ADDED = [
  "P.2.1.1.3", "P.2.1.1.4", "P.2.1.2.3",
  "P.2.2.3.3.2", "P.2.2.3.3.3", "P.2.2.3.4", "P.2.2.3.4.1", "P.2.2.3.4.2",
  "P.2.3.2", "P.2.3.2.1", "P.2.3.2.2", "P.2.3.2.3", "P.2.3.2.4", "P.2.3.2.5",
  "P.2.3.3.1", "P.2.3.3.2",
];
const POINTER = /^\s*(?:3\.2\.)?P\.2(?:\.\d+)+\s*$/;

test("every added section holds at least one marker", () => {
  const draft = loadExample();
  for (const id of ADDED) {
    const text = JSON.stringify(draft.sections.find((s) => s.id === id).blocks);
    assert.ok(isMarkedText(text), `${id} holds no marker`);
  }
});

test("no added section holds a measurement: no value cell but a marker or a pointer, no number with a unit", () => {
  const draft = loadExample();
  for (const id of ADDED) {
    for (const block of draft.sections.find((s) => s.id === id).blocks) {
      if (block.type === "paragraph") {
        assert.deepEqual(measurementTokens(block.text, draft.meta.strengths), [], `${id} states what reads as a measurement`);
      }
      if (block.type !== "table") continue;
      const skip = labelColumnCount(block);
      for (const row of block.rows) {
        for (const cell of row.slice(skip)) {
          assert.ok(isMarkedText(cell) || POINTER.test(cell), `${id} holds "${cell}" in a value cell`);
        }
      }
    }
  }
});
