// A dissolution profile: percentage dissolved against time, one line per column of the table it was
// read from. Like the column chart it carries no numbers of its own — the points arrive from the table
// through figure-source.mjs — and it prints each time back as the source wrote it.
//
// Three series at most, because three is how many colours of the reference palette stay apart under
// every colour-vision deficiency when all pairs can be on screen at once. Colour is never the only
// carrier of identity: each series also has its own marker shape and is named in a legend and at the
// end of its line. The green is the one that falls below 3:1 against white, so the names, and the table
// printed directly above the figure, are what a reader relies on for it — not the colour.

import { escapeXml, svgToPng } from "./browser-png.mjs";

export const MAX_PROFILE_SERIES = 3;

const MARGIN = { top: 40, right: 112, bottom: 40, left: 66 };
const PLOT_WIDTH = 360;
const PLOT_HEIGHT = 190;

const AXIS = "#8a93a0";
const GRID = "#c9d3e0";
const LABEL = "#333333";
const MUTED = "#5b6472";
const THRESHOLD = "#b03a3a";
const SERIES_COLOURS = ["#2a78d6", "#eb6834", "#1baf7a"];
const LABEL_SPACING = 14;

function marker(shape, cx, cy, colour) {
  const common = `fill="${colour}" stroke="#ffffff" stroke-width="1.5"`;
  if (shape === 0) return `<circle cx="${cx}" cy="${cy}" r="4.5" ${common}/>`;
  if (shape === 1) return `<rect x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" ${common}/>`;
  return `<polygon points="${cx},${cy - 5.5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}" ${common}/>`;
}

// Direct labels at the end of each line. Two series that end at the same value would print their names
// on top of each other, which is the usual case for a profile that has levelled off near 100, so the
// labels are spread apart by the least that keeps them readable.
function spreadLabels(positions) {
  const order = positions.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < order.length; i += 1) {
    if (order[i].y - order[i - 1].y < LABEL_SPACING) order[i].y = order[i - 1].y + LABEL_SPACING;
  }
  const result = [];
  for (const entry of order) result[entry.index] = entry.y;
  return result;
}

export function profileChartSvg(profile, { axisLabel, threshold, thresholdLabel } = {}) {
  const { times, series, timeUnit } = profile;
  const values = series.flatMap((entry) => entry.points.map((point) => point.value));
  const highest = Math.max(...values, threshold ?? 0);
  const top = highest > 100 ? Math.ceil(highest / 10) * 10 : 100;
  const maxTime = times[times.length - 1].value;
  const width = MARGIN.left + PLOT_WIDTH + MARGIN.right;
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const x = (time) => MARGIN.left + (time / maxTime) * PLOT_WIDTH;
  const y = (value) => MARGIN.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  const parts = [];

  for (const tick of [0, top / 4, top / 2, (3 * top) / 4, top]) {
    parts.push(`<line x1="${MARGIN.left}" y1="${y(tick)}" x2="${MARGIN.left + PLOT_WIDTH}" y2="${y(tick)}" stroke="${GRID}"/>`);
    parts.push(`<text x="${MARGIN.left - 8}" y="${y(tick) + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${escapeXml(String(Math.round(tick)))}</text>`);
  }
  for (const time of times) {
    parts.push(`<text x="${x(time.value)}" y="${MARGIN.top + PLOT_HEIGHT + 16}" font-size="11" text-anchor="middle" fill="${MUTED}">${escapeXml(time.display)}</text>`);
  }

  if (threshold !== undefined) {
    parts.push(`<line x1="${MARGIN.left}" y1="${y(threshold)}" x2="${MARGIN.left + PLOT_WIDTH}" y2="${y(threshold)}" stroke="${THRESHOLD}" stroke-width="1.5" stroke-dasharray="6 4"/>`);
    if (thresholdLabel) {
      parts.push(`<text x="${MARGIN.left + 6}" y="${y(threshold) - 5}" font-size="11" fill="${THRESHOLD}">${escapeXml(thresholdLabel)}</text>`);
    }
  }

  const ends = spreadLabels(series.map((entry) => y(entry.points[entry.points.length - 1].value) + 4));
  series.forEach((entry, index) => {
    const colour = SERIES_COLOURS[index];
    const path = entry.points.map((point, at) => `${at === 0 ? "M" : "L"}${x(times[at].value)} ${y(point.value)}`).join(" ");
    parts.push(`<path d="${path}" fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round"/>`);
    entry.points.forEach((point, at) => parts.push(marker(index, x(times[at].value), y(point.value), colour)));
    parts.push(`<text x="${MARGIN.left + PLOT_WIDTH + 10}" y="${ends[index]}" font-size="11" fill="${LABEL}" stroke="#ffffff" stroke-width="3" paint-order="stroke">${escapeXml(entry.label)}</text>`);
  });

  parts.push(`<line x1="${MARGIN.left}" y1="${MARGIN.top + PLOT_HEIGHT}" x2="${MARGIN.left + PLOT_WIDTH}" y2="${MARGIN.top + PLOT_HEIGHT}" stroke="${AXIS}"/>`);
  parts.push(`<line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + PLOT_HEIGHT}" stroke="${AXIS}"/>`);

  // Legend row above the plot, in text ink with the marker beside it: the colour carries identity,
  // the words do not wear it.
  let legendX = MARGIN.left;
  series.forEach((entry, index) => {
    parts.push(marker(index, legendX + 5, 16, SERIES_COLOURS[index]));
    parts.push(`<text x="${legendX + 16}" y="20" font-size="11" fill="${LABEL}">${escapeXml(entry.label)}</text>`);
    legendX += 28 + entry.label.length * 6.2;
  });

  if (timeUnit) {
    parts.push(`<text x="${MARGIN.left + PLOT_WIDTH / 2}" y="${height - 8}" font-size="11" text-anchor="middle" fill="${MUTED}">${escapeXml(`Thời gian (${timeUnit})`)}</text>`);
  }
  if (axisLabel) {
    const centre = MARGIN.top + PLOT_HEIGHT / 2;
    parts.push(`<text x="14" y="${centre}" font-size="11" text-anchor="middle" fill="${MUTED}" transform="rotate(-90 14 ${centre})">${escapeXml(axisLabel)}</text>`);
  }

  return { svg: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`, width, height };
}

export function profileChartPng(profile, options = {}) {
  if (!profile || !Array.isArray(profile.series) || profile.series.length === 0) throw new Error("a profile needs at least one series");
  const { svg, width, height } = profileChartSvg(profile, options);
  return { png: svgToPng(svg, { width, height }), width, height };
}
