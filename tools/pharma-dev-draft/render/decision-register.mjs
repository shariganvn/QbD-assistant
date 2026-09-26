// Turns the draft's decision markers into a list somebody can act on, the way data-request.mjs does
// for the gap markers. The two registers are deliberately separate lists rather than one list with a
// kind column, because they go to different people: a data request goes to whoever can run the
// experiment, and a decision goes to whoever has the authority to choose.
//
// This document needed the second list because it was under-reporting itself. It carried a hundred
// data requests and, in prose only, half a dozen unresolved conflicts — a finished-product impurity
// limit that names no impurity while the substance certificate names three, two pharmacopoeia
// versions cited in one dossier, an excipient sitting at the top of its recommended range. Each was
// written down and each was invisible to every list, so the document read as though data were the
// only thing standing between it and submission.
//
// Every row is read out of a marker, and the owner is read out of the marker's own text against
// meta.decisionOwners. There is no table here mapping a section to a role: that would be a second
// source of truth, and the first time a decision moved section the two would disagree.

import { isDecisionText, markerText } from "../schemas/markers.mjs";
import { labelColumnCount } from "../schemas/table-shape.mjs";

const NO_OWNER = "—";

// Who the marker names, out of the roles the draft declares. Listed in declaration order so the
// register sorts the same way whatever order a sentence happens to mention them in, and joined rather
// than reduced to one, because a pharmacopoeia version genuinely binds two departments at once.
function ownersNamed(text, owners) {
  const named = owners.filter((owner) => text.includes(owner));
  return named.length > 0 ? named.join(" · ") : NO_OWNER;
}

// The item a decision is about: a table row is named by its label columns, a paragraph by its section.
function rowLabel(table, row) {
  return row.slice(0, labelColumnCount(table)).map((cell) => String(cell).trim()).filter(Boolean).join(" — ");
}

// Rows carry a trailing marker count used only for the accounting check; the printed table drops it.
export function printableDecisionRows(draft, outline) {
  return decisionRows(draft, outline).map((row) => row.slice(0, 4));
}

export function decisionRows(draft, outline) {
  const owners = draft.meta.decisionOwners ?? [];
  const sectionsById = new Map(draft.sections.map((section) => [section.id, section]));
  const rows = [];

  for (const outlineSection of outline.sections) {
    if (outlineSection.container) continue;
    const section = sectionsById.get(outlineSection.id);
    if (!section || section.status === "gap") continue;
    const where = `${outlineSection.ctdReference} ${outlineSection.headingVi}`;

    for (const block of section.blocks ?? []) {
      if (block.type === "paragraph") {
        if (!isDecisionText(block.text)) continue;
        const body = markerText(block.text);
        rows.push([where, outlineSection.headingVi, ownersNamed(body, owners), body, 1]);
        continue;
      }
      if (block.type !== "table") continue;
      for (const row of block.rows) {
        row.forEach((cell) => {
          if (!isDecisionText(cell)) return;
          const body = markerText(cell);
          rows.push([where, rowLabel(block, row) || outlineSection.headingVi, ownersNamed(body, owners), body, 1]);
        });
      }
    }
  }
  return rows;
}

// The same count the rows are built from, exposed so a check can compare the two independently rather
// than assert that they were produced together.
export function decisionCount(draft) {
  let count = 0;
  for (const section of draft.sections) {
    if (section.status === "gap") continue;
    for (const block of section.blocks ?? []) {
      if (block.type === "paragraph" && isDecisionText(block.text)) count += 1;
      if (block.type === "table") {
        for (const row of block.rows) {
          for (const cell of row) if (isDecisionText(cell)) count += 1;
        }
      }
    }
  }
  return count;
}
