// Resolves what a figure block draws, out of a table that is already in the same section.
//
// A figure block carries no numbers. Copying the values into it would put the same measurement in two
// places, and the two would disagree the first time one was corrected — the comparison tool would
// report it as a duplicate, which is exactly what it is. The block names a table and a row instead,
// and the numbers stay in the table where a reader can check them.
//
// The second thing this buys: a figure cannot be drawn from data that does not exist. A row of gap
// markers yields no series, so the attempt fails here rather than producing an empty chart that looks
// like a measured result of zero.

import { isGapText } from "../../schemas/markers.mjs";
import { labelColumnCount } from "../../schemas/table-shape.mjs";
import { parseValue } from "./bar-chart.mjs";

export class FigureSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = "FigureSourceError";
    this.code = "E_FIGURE_SOURCE";
  }
}

export function tableAt(section, index) {
  const tables = (section.blocks ?? []).filter((block) => block.type === "table");
  const table = tables[index];
  if (!table) {
    throw new FigureSourceError(`section "${section.id}" has no table ${index} for its figure to draw from (${tables.length} table(s) present)`);
  }
  return table;
}

// The steps of a process, taken from whichever axis of the table holds the unit operations: the risk
// matrix carries them as columns, the parameter table as rows. Which one is data, so the block says.
export function flowSteps(section, { fromTable = 0, fromAxis = "columns" }) {
  const table = tableAt(section, fromTable);
  const steps = fromAxis === "rows"
    ? table.rows.map((row) => String(row[0] ?? "").trim())
    : table.headers.slice(labelColumnCount(table)).map((header) => String(header).trim());
  const usable = steps.filter((step) => step !== "" && !isGapText(step));
  if (usable.length === 0) {
    throw new FigureSourceError(`section "${section.id}" table ${fromTable} has no ${fromAxis} to draw a process flow from`);
  }
  return usable;
}

// One column per value cell of the named row. Every cell must be a number the source actually states;
// a marker means the measurement has not been made, and a chart is not the place to imply otherwise.
export function barSeries(section, { fromTable = 0, fromRow }) {
  const table = tableAt(section, fromTable);
  const skip = labelColumnCount(table);
  const row = table.rows.find((candidate) => String(candidate[0] ?? "").trim() === String(fromRow).trim());
  if (!row) {
    const available = table.rows.map((candidate) => String(candidate[0] ?? "").trim()).filter(Boolean);
    throw new FigureSourceError(`section "${section.id}" table ${fromTable} has no row "${fromRow}" (rows: ${available.join(" | ")})`);
  }
  const series = [];
  row.slice(skip).forEach((cell, index) => {
    const label = String(table.headers[skip + index] ?? "").trim();
    if (isGapText(cell)) {
      throw new FigureSourceError(`section "${section.id}" row "${fromRow}" has no measurement for "${label}" — a figure cannot be drawn from a gap`);
    }
    const value = parseValue(cell);
    if (value === undefined) {
      throw new FigureSourceError(`section "${section.id}" row "${fromRow}" column "${label}" is "${cell}", which is not a number a chart can plot`);
    }
    series.push({ label, display: String(cell).trim(), value });
  });
  if (series.length === 0) {
    throw new FigureSourceError(`section "${section.id}" row "${fromRow}" has no value columns`);
  }
  return series;
}

// The stages of a manufacturing process: what is added, and the operation it is added at.
//
// This one does not use labelColumnCount. That helper models "leading ordinals plus one label column",
// which is right for a results table but wrong here: both non-ordinal columns are meaningful to the
// diagram and they sit on opposite sides of the boundary it would draw. So the shape is required
// outright — step number, components, operation — and anything else is refused rather than guessed at.
// A fourth column appended later would otherwise be drawn as the operation.
export function processStages(section, { fromTable = 0 }) {
  const table = tableAt(section, fromTable);
  if (table.headers.length !== 3) {
    throw new FigureSourceError(`section "${section.id}" table ${fromTable} has ${table.headers.length} columns; a process diagram needs exactly three: step number, components added, unit operation`);
  }
  if (table.rows.length === 0) {
    throw new FigureSourceError(`section "${section.id}" table ${fromTable} has no rows to draw a process from`);
  }
  return table.rows.map((row, index) => {
    const input = String(row[1] ?? "").trim();
    const operation = String(row[2] ?? "").trim();
    if (operation === "" || isGapText(operation)) {
      throw new FigureSourceError(`section "${section.id}" table ${fromTable} row ${index + 1} has no unit operation to draw — a process missing a step reads as a different process`);
    }
    if (isGapText(input)) {
      throw new FigureSourceError(`section "${section.id}" table ${fromTable} row ${index + 1} has a gap marker where its components belong; write "—" if the step adds nothing`);
    }
    // An em dash means the step adds nothing, which compression does. A blank cell would read as
    // "not applicable", so the draft has to say which it means and this turns that into no input box.
    return { input: input === "—" ? "" : input, operation };
  });
}
