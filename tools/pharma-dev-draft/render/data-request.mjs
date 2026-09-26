// Turns the draft's gap markers into a list somebody can act on. The empty half of this document is
// the part that decides whether it is useful: a marker that only says "missing" leaves a reader to
// work out who to ask, while one that says what is needed and where it comes from is a task.
//
// Every row is read out of a marker. There is deliberately no table here mapping a CTD section to a
// place data lives: such a table would be a second source of truth, and the first time a marker moved
// section the two would disagree. Where the data comes from is written in the marker itself — the way
// the reference-product section has done it since that section was framed — and this module reads it
// back. Filling one real value therefore removes exactly its own row, with no other edit.

import { isGapText, markerText } from "../schemas/markers.mjs";
import { labelColumnCount } from "../schemas/table-shape.mjs";

const NO_STRENGTH = "—";


// Which strength a column reports on, for a table the form marks perStrength. The group size is derived
// the same way the validator derives it, from the column count rather than from a declaration.
function strengthForColumn(table, tableSpec, strengths, column) {
  if (!tableSpec?.perStrength) return NO_STRENGTH;
  const fixedCount = Array.isArray(tableSpec.columns) ? tableSpec.columns.length : 0;
  if (column < fixedCount) return NO_STRENGTH;
  const groupSize = (table.headers.length - fixedCount) / strengths.length;
  if (!Number.isInteger(groupSize) || groupSize <= 0) return NO_STRENGTH;
  return strengths[Math.floor((column - fixedCount) / groupSize)] ?? NO_STRENGTH;
}

// The item a marker is about: a table row is named by its label columns, a paragraph by its section.
function rowLabel(table, row) {
  return row.slice(0, labelColumnCount(table)).map((cell) => String(cell).trim()).filter(Boolean).join(" — ");
}

// A cell in a table with several value columns needs its column named too, or a risk matrix yields one
// indistinguishable row per unit operation and the reader cannot tell which cell is being asked about.
// Left off when the column is a strength group, since the strength has its own column in the list.
function itemLabel(table, row, column, strength) {
  const label = rowLabel(table, row);
  const valueColumns = table.headers.length - labelColumnCount(table);
  if (valueColumns < 2 || strength !== NO_STRENGTH) return label;
  const header = String(table.headers[column] ?? "").trim();
  return header ? `${label} × ${header}` : label;
}

// A table whose every value cell is a bare marker is one request, not one per cell: an empty 7×5 risk
// matrix asks for a single thing — the assessment that fills it. Writing the source into all thirty-five
// cells would satisfy a list by making the table in the document unreadable, which is the wrong way
// round. Collapsed rows still account for every marker; the count is carried so a check can add them up.
function isFullyBare(table) {
  const cells = table.rows.flatMap((row) => row.slice(labelColumnCount(table)));
  return cells.length > 1 && cells.every((cell) => isGapText(cell) && markerText(cell) === "");
}

// Rows carry a trailing marker count used only for the accounting check; the printed table drops it.
export function printableRequestRows(draft, outline) {
  return dataRequestRows(draft, outline).map((row) => row.slice(0, 4));
}

export function dataRequestRows(draft, outline) {
  const strengths = draft.meta.strengths ?? [];
  const sectionsById = new Map(draft.sections.map((section) => [section.id, section]));
  const rows = [];

  for (const outlineSection of outline.sections) {
    if (outlineSection.container) continue;
    const section = sectionsById.get(outlineSection.id);
    const where = `${outlineSection.ctdReference} ${outlineSection.headingVi}`;

    if (!section || section.status === "gap") {
      if (section?.gapReason) rows.push([where, outlineSection.headingVi, NO_STRENGTH, markerText(section.gapReason), 1]);
      continue;
    }

    const tableSpecs = outlineSection.form?.tables ?? [];
    let tableIndex = 0;
    for (const block of section.blocks ?? []) {
      if (block.type === "paragraph") {
        if (isGapText(block.text)) rows.push([where, outlineSection.headingVi, NO_STRENGTH, markerText(block.text), 1]);
        continue;
      }
      if (block.type !== "table") continue;
      const tableSpec = tableSpecs[tableIndex];
      tableIndex += 1;
      if (isFullyBare(block)) {
        const skip = labelColumnCount(block);
        const cellCount = block.rows.length * (block.headers.length - skip);
        const columns = block.headers.slice(skip).join(", ");
        rows.push([
          where,
          `Toàn bộ bảng: ${block.headers.slice(0, skip).join(" ")} × ${columns}`,
          NO_STRENGTH,
          `Chưa ô nào được điền. Cần bộ dữ liệu điền trọn bảng (${block.rows.length} dòng × ${block.headers.length - skip} cột); nguồn nêu ở phần nội dung của mục.`,
          cellCount,
        ]);
        continue;
      }
      for (const row of block.rows) {
        row.forEach((cell, column) => {
          if (!isGapText(cell)) return;
          const strength = strengthForColumn(block, tableSpec, strengths, column);
          rows.push([
            where,
            itemLabel(block, row, column, strength) || outlineSection.headingVi,
            strength,
            markerText(cell),
            1,
          ]);
        });
      }
    }
  }
  return rows;
}

// The same count the rows are built from, exposed so a check can compare the two independently rather
// than assert that they were produced together.
export function markerCount(draft) {
  let count = 0;
  for (const section of draft.sections) {
    if (section.status === "gap") {
      if (section.gapReason) count += 1;
      continue;
    }
    for (const block of section.blocks ?? []) {
      if (block.type === "paragraph" && isGapText(block.text)) count += 1;
      if (block.type === "table") {
        for (const row of block.rows) {
          for (const cell of row) if (isGapText(cell)) count += 1;
        }
      }
    }
  }
  return count;
}
