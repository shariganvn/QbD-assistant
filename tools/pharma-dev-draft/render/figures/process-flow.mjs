// Two ways of drawing a manufacturing process, both taking their labels from a table in the draft so
// that changing the method redraws the diagram without touching this file.
//
// The chain is left-to-right, one box per unit operation: what a risk matrix's columns describe, where
// the interest is which operations exist.
//
// The stage diagram is top-to-bottom, with the ingredients added at each operation branching in from
// the left. That is the shape of a direct-compression process with several blending steps, and the
// thing a reviewer reads off it is exactly what the chain cannot show: which component enters where.

import { escapeXml, svgToPng } from "./browser-png.mjs";

const BOX_WIDTH = 132;
const BOX_HEIGHT = 54;
const GAP = 34;
const MARGIN = 10;
const PER_ROW = 4;

const STROKE = "#33527a";
const FILL = "#eef3fb";
const TEXT = "#14243b";
const INPUT_FILL = "#f6f3ea";
const INPUT_STROKE = "#8a7a52";

const LINE_HEIGHT = 15;

// Long labels wrap onto a second line rather than being clipped: a unit operation whose name is cut
// in half is a diagram that misstates the process. The decision is by width, not by word count —
// wrapping on word count alone breaks a short three-word name like "Trộn sơ bộ" for no reason.
const CHARS_PER_LINE = Math.floor((BOX_WIDTH - 16) / 7);

function labelLines(label, charsPerLine = CHARS_PER_LINE, maxLines = 2) {
  const text = String(label).trim();
  if (text.length <= charsPerLine) return [text];
  const words = text.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (candidate.length <= charsPerLine || !lines[lines.length - 1]) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  return lines.slice(0, maxLines);
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

// ── The stage diagram ────────────────────────────────────────────────────────────────────────────
//
// Operations run down the right-hand column; the components added at each one sit in a box to its left
// with an arrow into it. A stage that adds nothing — compression — simply has no input box, which is
// why the draft writes an em dash there rather than leaving the cell blank: a blank cell in this
// document means "not applicable", and the difference matters for a step that deliberately adds
// nothing.

const STAGE_INPUT_WIDTH = 236;
const STAGE_OP_WIDTH = 150;
const STAGE_H_GAP = 40;
const STAGE_V_GAP = 26;
const STAGE_PAD_Y = 11;
const STAGE_MIN_HEIGHT = 44;

const STAGE_INPUT_CHARS = Math.floor((STAGE_INPUT_WIDTH - 18) / 6.6);
const STAGE_OP_CHARS = Math.floor((STAGE_OP_WIDTH - 18) / 6.6);

// One component per line rather than wrapped prose: five excipients wrapped across three lines is a
// paragraph in a box, and the reader has to parse the separators back out of it. The draft joins them
// with a middle dot, which is what this splits on.
function inputLines(text) {
  return String(text).split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean)
    .flatMap((part) => labelLines(part, STAGE_INPUT_CHARS, 2));
}

function heightFor(lineCount) {
  return Math.max(STAGE_MIN_HEIGHT, STAGE_PAD_Y * 2 + lineCount * LINE_HEIGHT);
}

function stageBox(x, y, width, height, lines, { fill, stroke }) {
  const firstBaseline = y + (height - lines.length * LINE_HEIGHT) / 2 + LINE_HEIGHT - 4;
  const text = lines
    .map((line, index) => `<tspan x="${x + width / 2}" y="${firstBaseline + index * LINE_HEIGHT}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${fill}" stroke="${stroke}"/>` +
    `<text font-size="12" text-anchor="middle" fill="${TEXT}">${text}</text>`;
}

// Down from the bottom of one operation to the top of the next. The mixture carried forward is the
// subject of this arrow, so it is drawn heavier than the input arrows feeding into it.
function arrowDown(x, fromY, toY) {
  return `<path d="M${x} ${fromY} V${toY - 9}" stroke="${STROKE}" stroke-width="2"/>` +
    `<path d="M${x} ${toY} l-5 -9 h10 z" fill="${STROKE}"/>`;
}

function arrowIntoOperation(fromX, toX, y) {
  return `<path d="M${fromX} ${y} H${toX - 9}" stroke="${INPUT_STROKE}" stroke-width="1.5"/>` +
    `<path d="M${toX} ${y} l-9 -5 v10 z" fill="${INPUT_STROKE}"/>`;
}

export function processStageSvg(stages) {
  const laid = stages.map(({ input, operation }) => {
    const inputRows = input === "" ? [] : inputLines(input);
    const operationRows = labelLines(operation, STAGE_OP_CHARS, 3);
    const height = Math.max(heightFor(inputRows.length || 1), heightFor(operationRows.length));
    return { inputRows, operationRows, height };
  });

  const width = MARGIN * 2 + STAGE_INPUT_WIDTH + STAGE_H_GAP + STAGE_OP_WIDTH;
  const height = MARGIN * 2 + laid.reduce((total, stage) => total + stage.height, 0)
    + (laid.length - 1) * STAGE_V_GAP;
  const operationX = MARGIN + STAGE_INPUT_WIDTH + STAGE_H_GAP;

  const parts = [];
  let y = MARGIN;
  laid.forEach((stage, index) => {
    if (stage.inputRows.length > 0) {
      const inputHeight = heightFor(stage.inputRows.length);
      const inputY = y + (stage.height - inputHeight) / 2;
      parts.push(stageBox(MARGIN, inputY, STAGE_INPUT_WIDTH, inputHeight, stage.inputRows,
        { fill: INPUT_FILL, stroke: INPUT_STROKE }));
      parts.push(arrowIntoOperation(MARGIN + STAGE_INPUT_WIDTH, operationX, y + stage.height / 2));
    }
    parts.push(stageBox(operationX, y, STAGE_OP_WIDTH, stage.height, stage.operationRows,
      { fill: FILL, stroke: STROKE }));
    if (index < laid.length - 1) {
      parts.push(arrowDown(operationX + STAGE_OP_WIDTH / 2, y + stage.height, y + stage.height + STAGE_V_GAP));
    }
    y += stage.height + STAGE_V_GAP;
  });

  return {
    svg: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`,
    width,
    height,
  };
}

export function processStagePng(stages) {
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error("a process diagram needs at least one stage");
  }
  const { svg, width, height } = processStageSvg(stages);
  return { png: svgToPng(svg, { width, height }), width, height };
}
