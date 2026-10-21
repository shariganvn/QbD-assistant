// The heading a section prints. Shared by the document builder, the gap register and both action
// lists, because a section that belongs to one strength has to say which one wherever its name
// appears — and four places each doing the substitution is four places that can disagree.
//
// An outline heading may hold `{strength}`; it is replaced by the strength at the position the
// section's form names (`strengthIndex`) in meta.strengths. A section whose position is past the end
// of the list — the second strength of a product that has only one — prints "không áp dụng" in its
// place rather than the placeholder, so the reader sees the section is empty by design.
export const STRENGTH_PLACEHOLDER = "{strength}";
export const NO_STRENGTH_LABEL = "không áp dụng";

export function headingFor(entry, meta) {
  if (!entry.headingVi.includes(STRENGTH_PLACEHOLDER)) return entry.headingVi;
  const index = entry.form?.strengthIndex;
  const strength = Number.isInteger(index) ? meta?.strengths?.[index] : undefined;
  return entry.headingVi.replace(STRENGTH_PLACEHOLDER, strength ?? NO_STRENGTH_LABEL);
}
