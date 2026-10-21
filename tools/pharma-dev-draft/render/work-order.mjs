// Regroups the data requests into work: one entry per experiment, so the person who receives the
// document is handed "run the breakability test on both strengths" and not a list of a hundred holes
// in the order the sections happen to be numbered.
//
// Nothing here is declared per request. The experiment a request belongs to comes from the outline —
// each section names the experiment its markers belong to, which is a property of the form and the
// same for every product — and the owner comes from the marker's own text, as the decision register
// reads its owner: a request that names a department outside the default is attributed to it, and
// every other request goes to the outline's default data owner. The requests themselves are still read
// out of the markers by data-request.mjs, so filling a value still removes exactly its own line.

import { dataRequestRows } from "./data-request.mjs";

export const UNGROUPED = "Chưa xếp vào thí nghiệm nào";
const NO_STRENGTH = "—";

function ownersOf(request, outline, draft) {
  const named = (draft.meta.decisionOwners ?? []).filter((owner) => request.includes(owner));
  return named.length > 0 ? named.join(" · ") : (outline.dataOwner ?? NO_STRENGTH);
}

// Groups appear in the order their first section appears in the outline, so the work order reads in the
// same order as the document it belongs to.
export function workOrderGroups(draft, outline) {
  const experimentOf = new Map(outline.sections.map((section) => [section.id, section.form?.workOrder?.experiment ?? UNGROUPED]));
  const groups = new Map();
  for (const [where, item, strength, request, count, sectionId] of dataRequestRows(draft, outline)) {
    const experiment = experimentOf.get(sectionId) ?? UNGROUPED;
    if (!groups.has(experiment)) groups.set(experiment, { experiment, rows: [], cells: 0, strengths: new Set(), owners: new Set() });
    const group = groups.get(experiment);
    const owner = ownersOf(request, outline, draft);
    group.rows.push({ where, item, strength, owner, request, count, sectionId });
    group.cells += count;
    if (strength !== NO_STRENGTH) group.strengths.add(strength);
    owner.split(" · ").forEach((name) => group.owners.add(name));
  }
  return [...groups.values()];
}

// What the document prints: a summary of the whole order, then each group's lines.
export function printableWorkOrder(draft, outline) {
  const groups = workOrderGroups(draft, outline);
  const summary = groups.map((group) => [
    group.experiment,
    String(group.rows.length),
    [...group.strengths].join(" · ") || NO_STRENGTH,
    [...group.owners].join(" · "),
  ]);
  const tables = groups.map((group) => ({
    experiment: group.experiment,
    rows: group.rows.map((row) => [row.where, row.item, row.strength, row.owner, row.request]),
  }));
  return { summary, tables };
}
