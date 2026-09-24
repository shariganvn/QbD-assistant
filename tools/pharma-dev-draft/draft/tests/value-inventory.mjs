#!/usr/bin/env node
// Compares two drafts and reports where every value of the first one ended up in the second. Written
// for a restructuring pass: when content moves between sections, the two ways it goes wrong are losing
// a value and leaving a copy behind in the section it moved out of. A duplicate is the worse of the
// two, because two sections stating the same measurement read to a reviewer as two independent
// findings that happen to agree.
//
// Derived from the two files rather than kept by hand. A hand-written list of what moved where is the
// artefact that goes stale halfway through the move it was meant to check.
//
//   node value-inventory.mjs --before <draft.json> --after <draft.json> [--json <out.json>]
//
// Exits non-zero if a value was lost or duplicated, or if the "after" draft introduced a table cell
// holding something other than a gap marker — a restructuring pass adds no data.

import { readFileSync, writeFileSync } from "node:fs";

import { isGapText } from "../../schemas/markers.mjs";
import { labelColumnCount } from "../../schemas/table-shape.mjs";

// A "value" is something the document asserts: a paragraph's text, or a table cell outside the label
// columns. Row labels, column headers and section headings are structure — the form supplies them, and
// the same label legitimately appears in more than one table.
function valuesOf(draft) {
  const values = new Map();
  const add = (text, where) => {
    const key = String(text).trim();
    if (key === "") return;
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(where);
  };
  for (const section of draft.sections ?? []) {
    for (const block of section.blocks ?? []) {
      if (block.type === "paragraph") add(block.text, section.id);
      if (block.type === "table") {
        const skip = labelColumnCount(block);
        for (const row of block.rows) {
          for (const cell of row.slice(skip)) add(cell, section.id);
        }
      }
    }
  }
  return values;
}

// Values that appear in a table cell, as opposed to in a paragraph. The distinction carries the weight
// of the "adds no data" rule: measurements in this document live in table cells, so a new cell holding
// something other than a marker is a number with no source, while a new paragraph introducing an
// otherwise empty section is framing a reviewer needs.
function tableValuesOf(draft) {
  const cells = new Set();
  for (const section of draft.sections ?? []) {
    for (const block of section.blocks ?? []) {
      if (block.type !== "table") continue;
      const skip = labelColumnCount(block);
      for (const row of block.rows) {
        for (const cell of row.slice(skip)) {
          const key = String(cell).trim();
          if (key !== "") cells.add(key);
        }
      }
    }
  }
  return cells;
}

export function compareDrafts(before, after) {
  const beforeValues = valuesOf(before);
  const afterValues = valuesOf(after);
  const afterTableValues = tableValuesOf(after);

  const lost = [];
  const duplicated = [];
  const moved = [];
  for (const [value, fromSections] of beforeValues) {
    const destinations = afterValues.get(value);
    if (!destinations) {
      lost.push({ value, from: [...new Set(fromSections)] });
      continue;
    }
    const places = [...new Set(destinations)];
    // One occurrence per occurrence it had before. A value the source draft legitimately stated twice
    // is allowed to appear twice; what is rejected is a count that grew during the move.
    if (destinations.length > fromSections.length) {
      duplicated.push({ value, before: fromSections.length, after: destinations.length, in: places });
    }
    const origin = [...new Set(fromSections)];
    if (places.join("|") !== origin.join("|")) moved.push({ value, from: origin, to: places });
  }

  const added = [];
  for (const [value, places] of afterValues) {
    if (beforeValues.has(value)) continue;
    // A marker states that data is missing. A new paragraph is prose framing a section the new form
    // requires — reported so a reviewer reads it, not failed. A new table cell holding anything else is
    // a measurement with no source, which is the one thing this pass must not produce.
    const kind = isGapText(value) ? "marker" : afterTableValues.has(value) ? "DATA" : "prose";
    added.push({ value, in: [...new Set(places)], kind });
  }

  return { lost, duplicated, moved, added };
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const beforePath = argumentValue("--before");
  const afterPath = argumentValue("--after");
  if (!beforePath || !afterPath) {
    process.stderr.write("E_ARGS: usage: value-inventory.mjs --before <draft.json> --after <draft.json> [--json <out.json>]\n");
    process.exitCode = 1;
    return;
  }
  const before = JSON.parse(readFileSync(beforePath, "utf8"));
  const after = JSON.parse(readFileSync(afterPath, "utf8"));
  const report = compareDrafts(before, after);
  const introducedData = report.added.filter((entry) => entry.kind === "DATA");

  const jsonPath = argumentValue("--json");
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  process.stdout.write(`values before: ${valuesOf(before).size}, after: ${valuesOf(after).size}\n`);
  process.stdout.write(`lost: ${report.lost.length}, duplicated: ${report.duplicated.length}, moved: ${report.moved.length}\n`);
  process.stdout.write(`added: ${report.added.length} (marker ${report.added.filter((e) => e.kind === "marker").length}, prose ${report.added.filter((e) => e.kind === "prose").length}, data ${introducedData.length})\n`);
  for (const entry of report.added.filter((e) => e.kind === "prose")) {
    process.stdout.write(`  ADDED PROSE in ${entry.in.join(",")}: ${entry.value.slice(0, 100)}\n`);
  }

  for (const entry of report.lost) process.stdout.write(`  LOST from ${entry.from.join(",")}: ${entry.value.slice(0, 120)}\n`);
  for (const entry of report.duplicated) process.stdout.write(`  DUPLICATED ${entry.before}->${entry.after} in ${entry.in.join(",")}: ${entry.value.slice(0, 120)}\n`);
  for (const entry of introducedData) process.stdout.write(`  ADDED DATA in ${entry.in.join(",")}: ${entry.value.slice(0, 120)}\n`);

  if (report.lost.length || report.duplicated.length || introducedData.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
