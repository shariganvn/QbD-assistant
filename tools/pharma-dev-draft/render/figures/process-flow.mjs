// A left-to-right chain of boxes, one per unit operation, wrapping onto further lines when the
// process is long. The step names are not written here: they come from the table the draft points
// the figure at, so changing the manufacturing method redraws the diagram without touching this file.

import { escapeXml, svgToPng } from "./browser-png.mjs";

const BOX_WIDTH = 132;
const BOX_HEIGHT = 54;
const GAP = 34;
const MARGIN = 10;
const PER_ROW = 4;

const STROKE = "#33527a";
const FILL = "#eef3fb";
const TEXT = "#14243b";

// Long labels wrap onto a second line rather than being clipped: a unit operation whose name is cut
// in half is a diagram that misstates the process. The decision is by width, not by word count —
// wrapping on word count alone breaks a short three-word name like "Trộn sơ bộ" for no reason.
const CHARS_PER_LINE = Math.floor((BOX_WIDTH - 16) / 7);

function labelLines(label) {
  const text = String(label).trim();
  if (text.length <= CHARS_PER_LINE) return [text];
  const words = text.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (candidate.length <= CHARS_PER_LINE || !lines[lines.length - 1]) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  return lines.slice(0, 2);
}

function box(x, y, label) {
  const lines = labelLines(label);
  const firstBaseline = y + BOX_HEIGHT / 2 + (lines.length === 1 ? 5 : -2);
  const text = lines
    .map((line, index) => `<tspan x="${x + BOX_WIDTH / 2}" y="${firstBaseline + index * 15}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<rect x="${x}" y="${y}" width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="6" fill="${FILL}" stroke="${STROKE}"/>` +
    `<text font-size="13" text-anchor="middle" fill="${TEXT}">${text}</text>`;
}

function arrowRight(x, y) {
  const midY = y + BOX_HEIGHT / 2;
  return `<path d="M${x} ${midY} H${x + GAP - 9}" stroke="${STROKE}" stroke-width="2"/>` +
    `<path d="M${x + GAP} ${midY} l-9 -5 v10 z" fill="${STROKE}"/>`;
}

// A wrap is drawn as an elbow down to the start of the next line, so the reading order stays obvious.
function arrowWrap(fromX, fromY, toX, toY) {
  const startY = fromY + BOX_HEIGHT;
  const midY = startY + (toY - startY) / 2;
  return `<path d="M${fromX} ${startY} V${midY} H${toX} V${toY - 9}" stroke="${STROKE}" stroke-width="2" fill="none"/>` +
    `<path d="M${toX} ${toY} l-5 -9 h10 z" fill="${STROKE}"/>`;
}

export function processFlowSvg(steps) {
  const rows = [];
  for (let index = 0; index < steps.length; index += PER_ROW) rows.push(steps.slice(index, index + PER_ROW));
  const rowHeight = BOX_HEIGHT + 40;
  const width = MARGIN * 2 + Math.min(steps.length, PER_ROW) * BOX_WIDTH + (Math.min(steps.length, PER_ROW) - 1) * GAP;
  const height = MARGIN * 2 + rows.length * rowHeight - 40;

  const parts = [];
  rows.forEach((row, rowIndex) => {
    const y = MARGIN + rowIndex * rowHeight;
    row.forEach((label, columnIndex) => {
      const x = MARGIN + columnIndex * (BOX_WIDTH + GAP);
      parts.push(box(x, y, label));
      if (columnIndex < row.length - 1) parts.push(arrowRight(x + BOX_WIDTH, y));
    });
    if (rowIndex < rows.length - 1) {
      const lastX = MARGIN + (row.length - 1) * (BOX_WIDTH + GAP) + BOX_WIDTH / 2;
      parts.push(arrowWrap(lastX, y, MARGIN + BOX_WIDTH / 2, y + rowHeight));
    }
  });

  return {
    svg: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`,
    width,
    height,
  };
}

export function processFlowPng(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("a process flow needs at least one step");
  }
  const { svg, width, height } = processFlowSvg(steps);
  return { png: svgToPng(svg, { width, height }), width, height };
}
