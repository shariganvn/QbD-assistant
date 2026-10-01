// A comparative dissolution section carries two things: the profiles, which a figure can draw, and a
// statement about similarity, which a reader needs to be able to check. These tests hold both. The
// figure reads its numbers from the table it names and nothing else, and refuses to draw anything the
// table does not state; the similarity table refuses an exemption with no condition attached.
//
// The committed draft has no dissolution result yet, so it holds no profile figure and the figure
// tests run on a copy with the table filled in — the last tests say so rather than leave the green run
// to suggest the real document has a profile.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateDraft, DraftContractError } from "../validate-draft.mjs";
import { profileSeries } from "../../render/figures/figure-source.mjs";
import { profileChartSvg, profileChartPng } from "../../render/figures/profile-chart.mjs";
import { GAP_LABEL, GAP_PREFIX } from "../../schemas/markers.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const realOutline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
const loadExample = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));
const sectionOf = (draft, id) => draft.sections.find((section) => section.id === id);

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

// The committed draft with the profile table filled in for both strengths and the figure added. Both
// strengths are treated as made, since a calculated strength cannot hold a result.
function filledDraft() {
  const draft = loadExample();
  delete draft.meta.derivedStrengths;
  const section = sectionOf(draft, "P.2.2.3.2");
  const table = section.blocks.find((block) => block.type === "table");
  table.id = "profil-hoa-tan";
  table.rows = [["5 phút", "41,2", "38,5"], ["10 phút", "72,0", "69,4"], ["15 phút", "88,6", "90,1"], ["30 phút", "97,3", "98,0"]];
  section.blocks.push({ type: "figure", kind: "profile", fromTable: "profil-hoa-tan", axisLabel: "Phần trăm hoạt chất đã hòa tan", caption: "Hồ sơ hòa tan của hai hàm lượng, dựng từ bảng trên." });
  return { draft, section, table };
}

// --- the figure draws what the table states --------------------------------------------------------------

test("a profile takes its times, series and values from the table it names", () => {
  const { section } = filledDraft();
  const profile = profileSeries(section, section.blocks.find((b) => b.type === "figure"));
  assert.deepEqual(profile.times.map((time) => time.value), [5, 10, 15, 30]);
  assert.equal(profile.timeUnit, "phút");
  assert.deepEqual(profile.series.map((entry) => entry.label), ["5 mg", "10 mg"]);
  assert.deepEqual(profile.series[0].points.map((point) => point.value), [41.2, 72, 88.6, 97.3]);
});

test("a figure block carries no value of its own", () => {
  const { section } = filledDraft();
  const figure = section.blocks.find((b) => b.type === "figure");
  assert.ok(!JSON.stringify(figure).match(/\d+[.,]\d+/), "the block must name a table, not repeat its numbers");
});

test("correcting the table changes the figure, with no second edit", () => {
  const { draft, section, table } = filledDraft();
  const figure = section.blocks.find((b) => b.type === "figure");
  const before = profileSeries(section, figure).series[0].points[0].value;
  table.rows[0][1] = "44,4";
  assert.notEqual(profileSeries(section, figure).series[0].points[0].value, before);
  validateDraft(draft);
});

test("the filled draft validates with the profile figure in it", () => {
  validateDraft(filledDraft().draft);
});

test("a gap in any cell refuses the figure rather than drawing it as a zero", () => {
  const { draft, table } = filledDraft();
  table.rows[2][2] = `${GAP_PREFIX}] chưa đo`;
  expectCode("E_FIGURE_SOURCE", () => validateDraft(draft));
});

test("a value that is not a number refuses the figure", () => {
  const { draft, table } = filledDraft();
  table.rows[1][1] = "Đạt";
  expectCode("E_FIGURE_SOURCE", () => validateDraft(draft));
});

test("sampling times that do not increase refuse the figure", () => {
  const { draft, table } = filledDraft();
  table.rows[2][0] = "10 phút";
  expectCode("E_FIGURE_SOURCE", () => validateDraft(draft));
});

test("mixed time units and a single time point refuse the figure", () => {
  const mixed = filledDraft();
  mixed.table.rows[3][0] = "45 giờ";
  expectCode("E_FIGURE_SOURCE", () => validateDraft(mixed.draft));
  const single = filledDraft();
  single.table.rows = single.table.rows.slice(0, 1);
  expectCode("E_FIGURE_SOURCE", () => validateDraft(single.draft));
});

test("more than three series refuse the figure, and say to split the table", () => {
  const { section, table } = filledDraft();
  table.headers.push("Thuốc đối chiếu 5 mg", "Thuốc đối chiếu 10 mg");
  table.rows = table.rows.map((row) => [...row, "50,0", "50,0"]);
  assert.throws(() => profileSeries(section, section.blocks.find((b) => b.type === "figure")), (error) => {
    assert.equal(error.code, "E_FIGURE_SOURCE");
    assert.match(error.message, /split the table/);
    return true;
  });
});

test("the drawing names every series and is built from the table's own points", () => {
  const { section, table } = filledDraft();
  const profile = profileSeries(section, section.blocks.find((b) => b.type === "figure"));
  const { svg } = profileChartSvg(profile, { axisLabel: "Phần trăm hoạt chất đã hòa tan" });
  assert.match(svg, />5 mg</);
  assert.match(svg, />10 mg</);
  assert.match(svg, /Thời gian \(phút\)/);
  table.rows[0][1] = "44,4";
  const changed = profileChartSvg(profileSeries(section, section.blocks.find((b) => b.type === "figure")), {}).svg;
  assert.notEqual(changed, profileChartSvg(profile, {}).svg, "a corrected table must redraw the line");
});

test("two series that end at the same value get separate labels", () => {
  const { section, table } = filledDraft();
  table.rows[3][1] = "98,0";
  const { svg } = profileChartSvg(profileSeries(section, section.blocks.find((b) => b.type === "figure")), {});
  const ys = [...svg.matchAll(/<text x="\d+" y="([\d.]+)" font-size="11" fill="#333333" stroke="#ffffff"/g)].map((m) => Number(m[1]));
  assert.equal(ys.length, 2);
  assert.ok(Math.abs(ys[0] - ys[1]) >= 14, `end labels at ${ys.join(" and ")} would overlap`);
});

test("the profile rasterises to a PNG", () => {
  const { section } = filledDraft();
  const { png, width, height } = profileChartPng(profileSeries(section, section.blocks.find((b) => b.type === "figure")));
  assert.ok(png.length > 1000 && width > 0 && height > 0);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
});

// --- the similarity statement cannot be missing --------------------------------------------------------

const similarity = (draft) => sectionOf(draft, "P.2.2.3.2").blocks.filter((block) => block.type === "table")[1];
const NA_WITH_CONDITION = "Cả hai chế phẩm hòa tan rất nhanh ở môi trường này, theo số liệu ở bảng trên";

test("the committed draft states that f2 is still to be compared, and that is accepted", () => {
  validateDraft(loadExample());
});

test("a similarity table with no row is refused", () => {
  const draft = loadExample();
  similarity(draft).rows = [];
  expectCode("E_F2_MISSING", () => validateDraft(draft));
});

test("a computed f2 in range is accepted, and one outside 0–100 is not", () => {
  const draft = loadExample();
  similarity(draft).rows = [["pH 1,2 — thử với đối chiếu", "62,4", "—"]];
  validateDraft(draft);
  similarity(draft).rows = [["pH 1,2 — thử với đối chiếu", "162,4", "—"]];
  expectCode("E_F2_CELL_INVALID", () => validateDraft(draft));
});

test("'does not apply' with a stated condition is accepted", () => {
  const draft = loadExample();
  similarity(draft).rows = [["pH 1,2 — thử với đối chiếu", "Không áp dụng", NA_WITH_CONDITION]];
  validateDraft(draft);
});

test("'does not apply' with no condition, or a one-word one, is refused", () => {
  for (const condition of ["—", "", "Không áp dụng", "N/A", "do nhanh"]) {
    const draft = loadExample();
    similarity(draft).rows = [["pH 1,2 — thử với đối chiếu", "Không áp dụng", condition]];
    expectCode("E_F2_UNCONDITIONAL", () => validateDraft(draft));
  }
});

test("'does not apply' whose condition is itself still a marker is accepted as pending", () => {
  const draft = loadExample();
  similarity(draft).rows = [["pH 1,2 — thử với đối chiếu", "Không áp dụng", `${GAP_LABEL} Điều kiện và số liệu chứng minh nó`]];
  validateDraft(draft);
});

test("an f2 cell that is neither a number, a marker nor 'does not apply' is refused", () => {
  const draft = loadExample();
  similarity(draft).rows = [["pH 1,2 — thử với đối chiếu", "Tương đồng", NA_WITH_CONDITION]];
  expectCode("E_F2_CELL_INVALID", () => validateDraft(draft));
});

test("an outline whose similarity section loses its second table is refused by the form", () => {
  const draft = loadExample();
  const section = sectionOf(draft, "P.2.2.3.2");
  section.blocks = section.blocks.filter((block, index, all) => !(block.type === "table" && block === all.filter((b) => b.type === "table")[1]));
  expectCode("E_FORM_TABLE_COUNT", () => validateDraft(draft));
});

// --- the committed outline and draft ----------------------------------------------------------------------

test("the committed outline marks the comparative dissolution section as one that states similarity", () => {
  const entry = realOutline.sections.find((s) => s.id === "P.2.2.3.2");
  assert.equal(entry.form.similarity, true);
  assert.equal(entry.form.tables.length, 2);
});

test("the committed draft holds no dissolution result and therefore no profile figure yet", () => {
  // A statement about what the green run above does and does not prove. The profile figure kind is
  // proved on a filled copy; the real section is still waiting for the measurements the figure needs.
  const section = sectionOf(loadExample(), "P.2.2.3.2");
  assert.ok(!section.blocks.some((block) => block.type === "figure"));
  const profile = section.blocks.find((block) => block.type === "table");
  for (const row of profile.rows) for (const cell of row.slice(1)) assert.ok(cell.includes(GAP_PREFIX), `a result is already filled in: "${cell}"`);
});
