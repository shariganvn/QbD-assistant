// A figure in this document is a claim about measured data, so it is held to the same rule as every
// other claim: it may only state what a source states. The block carries no numbers — it names a
// table and a row already in its section — which gives two properties worth testing. A value cannot
// disagree with its own chart, because there is only one copy of it. And a chart cannot be drawn from
// data that does not exist, because the gap markers are still there to refuse.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateDraft } from "../validate-draft.mjs";
import { barSeries, flowSteps } from "../../render/figures/figure-source.mjs";
import { parseValue, barChartSvg } from "../../render/figures/bar-chart.mjs";
import { processFlowSvg } from "../../render/figures/process-flow.mjs";
import { GAP_PREFIX } from "../../schemas/markers.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const loadExample = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));
const sectionOf = (draft, id) => draft.sections.find((section) => section.id === id);
const figureOf = (section) => section.blocks.find((block) => block.type === "figure");

function expectFailure(draft, code) {
  assert.throws(() => validateDraft(draft), (error) => {
    assert.equal(error.code, code);
    return true;
  });
}

// --- reading a figure's data out of the table it names ---------------------

test("a chart reads its values from the table row it names", () => {
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.2.1.3.3");
  const figure = figureOf(section);
  const series = barSeries(section, figure);
  const table = section.blocks.filter((block) => block.type === "table")[figure.fromTable];
  const row = table.rows.find((candidate) => candidate[0] === figure.fromRow);
  assert.deepEqual(series.map((entry) => entry.display), row.slice(1));
  assert.deepEqual(series.map((entry) => entry.label), table.headers.slice(1));
});

test("changing a value in the table changes the chart, because there is only one copy of it", () => {
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.2.1.3.3");
  const figure = figureOf(section);
  const table = section.blocks.filter((block) => block.type === "table")[figure.fromTable];
  table.rows.find((row) => row[0] === figure.fromRow)[1] = "42,00";
  assert.equal(barSeries(section, figure)[0].value, 42);
});

test("a process flow takes its steps from the columns the risk matrix scores", () => {
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.3.1");
  const figure = figureOf(section);
  const table = section.blocks.filter((block) => block.type === "table")[figure.fromTable];
  assert.deepEqual(flowSteps(section, figure), table.headers.slice(1));
});

test("changing the manufacturing method redraws the flow with no code change", () => {
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.3.1");
  const table = section.blocks.filter((block) => block.type === "table")[0];
  table.headers = ["CQA sản phẩm", "Xát hạt ướt", "Sấy", "Dập viên"];
  table.rows = table.rows.map((row) => [row[0], GAP_PREFIX, GAP_PREFIX, GAP_PREFIX]);
  assert.deepEqual(flowSteps(section, figureOf(section)), ["Xát hạt ướt", "Sấy", "Dập viên"]);
});

// --- refusing to draw what is not there ------------------------------------

test("a chart over a row of gap markers is rejected, not drawn as zeroes", () => {
  // The failure this prevents: an empty chart in a document shaped like a dossier reads as a measured
  // result of nothing, which is a stronger claim than the blank it replaced.
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.2.1.3.3");
  const figure = figureOf(section);
  const table = section.blocks.filter((block) => block.type === "table")[figure.fromTable];
  const row = table.rows.find((candidate) => candidate[0] === figure.fromRow);
  row[1] = `${GAP_PREFIX} – CẦN BỔ SUNG] chưa đo`;
  expectFailure(draft, "E_FIGURE_SOURCE");
});

test("a chart naming a row the table does not have is rejected", () => {
  const draft = loadExample();
  figureOf(sectionOf(draft, "P.2.2.1.3.3")).fromRow = "Chỉ tiêu không tồn tại";
  expectFailure(draft, "E_FIGURE_SOURCE");
});

test("a figure naming a table the section does not have is rejected", () => {
  const draft = loadExample();
  figureOf(sectionOf(draft, "P.2.3.1")).fromTable = 7;
  expectFailure(draft, "E_FIGURE_SOURCE");
});

test("a chart over values that are not numbers is rejected", () => {
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.2.1.3.3");
  const figure = figureOf(section);
  const table = section.blocks.filter((block) => block.type === "table")[figure.fromTable];
  table.rows.find((row) => row[0] === figure.fromRow)[1] = "Đạt";
  expectFailure(draft, "E_FIGURE_SOURCE");
});

test("a figure with no caption is rejected", () => {
  const draft = loadExample();
  delete figureOf(sectionOf(draft, "P.2.3.1")).caption;
  expectFailure(draft, "E_FIGURE_SHAPE");
});

test("a supplied image outside the assets directory is rejected", () => {
  const draft = loadExample();
  sectionOf(draft, "P.2.6").blocks.push({ type: "image", path: "../../../etc/hosts.png", caption: "x" });
  expectFailure(draft, "E_IMAGE_PATH");
});

test("a supplied image that does not exist is rejected rather than dropped", () => {
  const draft = loadExample();
  sectionOf(draft, "P.2.6").blocks.push({ type: "image", path: "assets/khong-co.png", caption: "x" });
  expectFailure(draft, "E_IMAGE_MISSING");
});

// --- what the drawing itself has to get right ------------------------------

test("Vietnamese comma decimals are read as numbers and printed back unchanged", () => {
  assert.equal(parseValue("98,64"), 98.64);
  assert.equal(parseValue("100,98 / 96,15"), 100.98);
  assert.equal(parseValue("Đạt"), undefined);
  const { svg } = barChartSvg([{ label: "CT03", display: "98,64", value: 98.64 }]);
  assert.match(svg, /98,64/, "the chart must print the value the way the source writes it");
  assert.doesNotMatch(svg, /98\.64/, "a period decimal would restate the source's number");
});

test("the chart scale keeps the columns readable rather than rounding to the next power of ten", () => {
  // A 0-200 axis for a set of values near 98 squashes every column into the bottom half and hides the
  // differences between formulations, which is the only thing the chart is for.
  const { svg } = barChartSvg([
    { label: "CT01", display: "73,89", value: 73.89 },
    { label: "CT03", display: "98,64", value: 98.64 },
  ]);
  assert.match(svg, />110</, "the axis should top out just above the tallest column");
});

test("a long process flow wraps instead of running off the page", () => {
  const many = ["Cân", "Rây", "Trộn sơ bộ", "Trộn hoàn tất", "Dập viên", "Bao phim", "Đóng gói"];
  const { width, height } = processFlowSvg(many);
  const { height: shortHeight } = processFlowSvg(many.slice(0, 3));
  assert.ok(height > shortHeight, "a seven-step process needs more than one row");
  assert.ok(width < 800, "a wrapped flow must stay within the page width");
});

test("a short step name is not broken across two lines", () => {
  const { svg } = processFlowSvg(["Trộn sơ bộ"]);
  assert.equal((svg.match(/<tspan/g) ?? []).length, 1, "a name that fits on one line must stay on one");
});

// --- the browser the figures depend on -------------------------------------

test("rendering stops when the browser is missing instead of dropping the figure", () => {
  // A figure that silently disappears is evidence removed from a document without anyone being told.
  const script = "import('./tools/pharma-dev-draft/render/figures/browser-png.mjs')" +
    ".then((m) => { m.findHeadlessShell(); console.log('FOUND'); })" +
    ".catch((error) => { console.log(error.code); });";
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: join(toolRoot, "..", ".."),
    encoding: "utf8",
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "/nonexistent-browser-root", PHARMA_DEV_HEADLESS_SHELL: "" },
  });
  assert.match(output.trim(), /E_BROWSER_MISSING/);
});
