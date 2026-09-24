// Layout constants shared by the Stage B validator and the Stage C renderer. They live here, in
// schemas/, so neither side owns them: a draft that declares explicit column widths is checked
// against the same page-width budget the renderer lays tables out against, enforced by the import
// rather than by a comment asking the two files to stay in sync.

export const TABLE_WIDTH_DXA = 10000;
