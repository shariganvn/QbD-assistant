// A column chart of one measured attribute across the formulations that were made, with an optional
// acceptance line. It takes the values as the source states them — Vietnamese comma decimals — and
// prints them back in that form, because a chart that renders 98,64 as 98.64 has restated a number
// the source document wrote differently.

import { escapeXml, svgToPng } from "./browser-png.mjs";

const MARGIN = { top: 16, right: 18, bottom: 54, left: 52 };
const PLOT_HEIGHT = 190;
const BAR_WIDTH = 74;
const BAR_GAP = 34;

const AXIS = "#8a93a0";
const GRID = "#c9d3e0";
const BAR = "#5b7fb5";
const BAR_BELOW = "#b08a8a";
const LABEL = "#333333";
const MUTED = "#5b6472";

// The source writes 98,64 and may carry a unit or a qualifier. Read the leading number and keep the
// original string for display; anything without one is not plottable and the caller is told so.
export function parseValue(text) {
  const match = String(text).trim().match(/^([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return undefined;
  return Number(match[1].replace(",", "."));
}

// Rounding only to the next power of ten turns a 98,64 chart into a 0–200 axis, with every column
// squashed into the bottom half and the differences between formulations — the thing the chart is for
// — no longer readable. Step through finer multiples so the columns fill the plot.
function niceCeiling(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

export function barChartSvg(series, { threshold, thresholdLabel, axisLabel } = {}) {
  const values = series.map((entry) => entry.value);
  const top = niceCeiling(Math.max(...values, threshold ?? 0) * 1.08);
  // The acceptance label gets a gutter of its own to the right of the plot. Placed inside, it lands
  // either on a column or on the value label of a column sitting just under the line — which is
  // exactly where an acceptance line matters most and where the two must not overlap.
  const gutter = thresholdLabel ? 18 + String(thresholdLabel).length * 6 : 0;
  const plotRight = MARGIN.left + series.length * BAR_WIDTH + (series.length - 1) * BAR_GAP;
  const width = plotRight + MARGIN.right + gutter;
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const y = (value) => MARGIN.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;

  const parts = [];
  for (const tick of [0, top / 2, top]) {
    parts.push(`<line x1="${MARGIN.left}" y1="${y(tick)}" x2="${plotRight}" y2="${y(tick)}" stroke="${GRID}"/>`);
    parts.push(`<text x="${MARGIN.left - 8}" y="${y(tick) + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${escapeXml(String(Math.round(tick)))}</text>`);
  }

  if (threshold !== undefined) {
    parts.push(`<line x1="${MARGIN.left}" y1="${y(threshold)}" x2="${plotRight}" y2="${y(threshold)}" stroke="#b03a3a" stroke-width="1.5" stroke-dasharray="6 4"/>`);
    if (thresholdLabel) {
      parts.push(`<text x="${plotRight + 8}" y="${y(threshold) + 4}" font-size="11" fill="#b03a3a">${escapeXml(thresholdLabel)}</text>`);
    }
  }

  series.forEach((entry, index) => {
    const x = MARGIN.left + index * (BAR_WIDTH + BAR_GAP);
    const barTop = y(entry.value);
    // A column that misses the acceptance line is coloured differently. The chart is read at a
    // glance, and "which formulation failed" is the question it exists to answer.
    const fill = threshold !== undefined && entry.value < threshold ? BAR_BELOW : BAR;
    parts.push(`<rect x="${x}" y="${barTop}" width="${BAR_WIDTH}" height="${MARGIN.top + PLOT_HEIGHT - barTop}" fill="${fill}"/>`);
    // A white halo behind the value. A column just under the acceptance line puts its label right
    // where the dashed line runs, and a number struck through by a rule is a number a reader has to
    // guess at. The halo keeps every label readable wherever the line falls.
    parts.push(`<text x="${x + BAR_WIDTH / 2}" y="${barTop - 6}" font-size="12" text-anchor="middle" fill="${LABEL}" stroke="#ffffff" stroke-width="3" paint-order="stroke">${escapeXml(entry.display)}</text>`);
    parts.push(`<text x="${x + BAR_WIDTH / 2}" y="${MARGIN.top + PLOT_HEIGHT + 18}" font-size="12" text-anchor="middle" fill="${LABEL}">${escapeXml(entry.label)}</text>`);
  });

  parts.push(`<line x1="${MARGIN.left}" y1="${MARGIN.top + PLOT_HEIGHT}" x2="${plotRight}" y2="${MARGIN.top + PLOT_HEIGHT}" stroke="${AXIS}"/>`);
  parts.push(`<line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + PLOT_HEIGHT}" stroke="${AXIS}"/>`);
  if (axisLabel) {
    parts.push(`<text x="${(MARGIN.left + plotRight) / 2}" y="${height - 12}" font-size="11" text-anchor="middle" fill="${MUTED}">${escapeXml(axisLabel)}</text>`);
  }

  return { svg: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`, width, height };
}

export function barChartPng(series, options = {}) {
  if (!Array.isArray(series) || series.length === 0) throw new Error("a chart needs at least one column");
  const { svg, width, height } = barChartSvg(series, options);
  return { png: svgToPng(svg, { width, height }), width, height };
}
