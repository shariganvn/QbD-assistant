// Which of a table's leading columns are structure rather than assertion. Shared because more than one
// reader needs the same answer — the gap register, when deciding whether a section holds any datum, and
// the value inventory, when deciding whether a value moved or was duplicated — and because getting it
// wrong the same way twice is how a built-out but empty form comes to be reported as holding data.

// Column 0 is always a label. So is any further column whose cells are all bare ordinals: several of
// the department's tables open with a numbering column, which puts the real row label in column 1.
// Derived from the cells, so no header name is written down here — an ordinal column looks the same
// whatever it is called, in any product's table.
export function labelColumnCount(table) {
  const rows = table?.rows ?? [];
  const isOrdinal = (column) => rows.length > 0
    && rows.every((row) => /^\d+$/.test(String(row[column] ?? "").trim()));
  let count = 1;
  while (count < (table?.headers?.length ?? 0) && isOrdinal(count - 1)) count += 1;
  return count;
}

// Everything a table actually asserts: its cells outside the label columns.
export function tableValueCells(table) {
  const skip = labelColumnCount(table);
  return (table?.rows ?? []).flatMap((row) => row.slice(skip));
}
