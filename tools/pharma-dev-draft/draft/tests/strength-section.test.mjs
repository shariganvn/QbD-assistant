// A section that reports one strength has to say which, and a strength with no batch of its own can
// hold no measurement there. The rules are proved on a small purpose-built outline, then once against
// the committed outline and draft. The measurement rule is a heuristic and the tests say what it
// catches and what it leaves alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

import { validateDraft, DraftContractError } from "../validate-draft.mjs";
import { headingFor } from "../../schemas/headings.mjs";
import { GAP_LABEL, GAP_PREFIX, DECISION_LABEL } from "../../schemas/markers.mjs";
import { dataRequestRows } from "../../render/data-request.mjs";
import { decisionRows } from "../../render/decision-register.mjs";
import { buildDocumentBuffer } from "../../render/builder.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const realOutline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
const realDraft = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));

const para = (text) => ({ type: "paragraph", text });
const form = (index) => ({ headings: [], strengthIndex: index, tables: [{ columns: ["Chỉ tiêu", "Kết quả"], rows: "variable" }] });

function outline() {
  return {
    schemaVersion: "1.0",
    sections: [
      { id: "P.2.1.1", ctdReference: "3.2.P.2.1.1", headingVi: "Kết quả — hàm lượng {strength}", form: form(0) },
      { id: "P.2.1.2", ctdReference: "3.2.P.2.1.2", headingVi: "Kết quả — hàm lượng {strength}", form: form(1) },
      { id: "P.2.1.3", ctdReference: "3.2.P.2.1.3", headingVi: "Mục chung, không theo hàm lượng" },
    ],
  };
}

const results = (rows) => ({ type: "table", headers: ["Chỉ tiêu", "Kết quả"], rows });
const MARKED = [["Độ cứng", `${GAP_PREFIX}]`], ["Độ rã", `${GAP_PREFIX}]`]];

function draftOf({ derived = ["5 mg"], strengths = ["5 mg", "10 mg"], first = [para(`${GAP_LABEL} chưa có lô`), results(MARKED)], second = [para(`${GAP_LABEL} kết quả của lô`), results(MARKED)], meta = {} } = {}) {
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén",
      apiName: "Hoạt chất thử nghiệm",
      sourceFiles: ["fixture.docx"],
      strengths,
      ...(derived.length ? { derivedStrengths: derived } : {}),
      draftDate: "2026-10-01",
      assembledBy: "bộ kiểm quy tắc",
      extractionMethod: "xml-walk",
      ...meta,
    },
    sections: [
      { id: "P.2.1.1", status: "covered", blocks: first },
      { id: "P.2.1.2", status: "covered", blocks: second },
      { id: "P.2.1.3", status: "covered", blocks: [para("Nội dung chung.")] },
    ],
  };
}

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DraftContractError, `expected DraftContractError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}
const withFirst = (blocks) => draftOf({ first: blocks });

// --- a strength with no batch holds no measurement --------------------------------------------------

test("a derived strength's section with every cell marked and no measurement validates", () => {
  validateDraft(draftOf(), outline());
});

test("a measured value in a derived strength's table is refused, and the message names the row", () => {
  const draft = withFirst([para(`${GAP_LABEL} chưa có lô`), results([["Độ cứng", "85,2"], ["Độ rã", `${GAP_PREFIX}]`]])]);
  assert.throws(() => validateDraft(draft, outline()), (error) => {
    assert.equal(error.code, "E_DERIVED_SECTION_HAS_RESULT");
    assert.match(error.message, /Độ cứng/);
    assert.match(error.message, /5 mg/);
    return true;
  });
});

test("a blank cell and a decision marker are refused too", () => {
  expectCode("E_DERIVED_SECTION_HAS_RESULT", () => validateDraft(withFirst([results([["Độ cứng", ""]])]), outline()));
  expectCode("E_DERIVED_SECTION_HAS_RESULT", () => validateDraft(withFirst([results([["Độ cứng", `${DECISION_LABEL} FD chốt`]])]), outline()));
});

test("a number with a unit in the prose is refused", () => {
  for (const text of ["Độ cứng đo được 85 N.", "Hòa tan đạt 98%.", "Rã sau 12 phút.", "Cân 100 mg mỗi viên.", "Lấy 30 viên."]) {
    expectCode("E_DERIVED_SECTION_HAS_RESULT", () => validateDraft(withFirst([para(`${GAP_LABEL} ${text}`), results(MARKED)]), outline()));
  }
});

test("a number with two decimals in the prose is refused", () => {
  expectCode("E_DERIVED_SECTION_HAS_RESULT", () => validateDraft(withFirst([para(`${GAP_LABEL} Kết quả 98,64 so với chuẩn.`), results(MARKED)]), outline()));
});

test("the strength's own name, a section reference and a document's section number are not measurements", () => {
  const text = `${GAP_LABEL} Hàm lượng 5 mg chưa có lô. Xem mục 3.2.P.2.1.3 và P.2.1.3; khung theo ICH Q8(R2) mục 2.3 và Q6A mục 3.3.2.`;
  validateDraft(withFirst([para(text), results(MARKED)]), outline());
});

test("the strength that has batches is free to hold measurements", () => {
  const measured = draftOf({ second: [para("Độ cứng đo được 85 N, hòa tan 98,64%."), results([["Độ cứng", "85,2"], ["Độ rã", "4,5"]])] });
  validateDraft(measured, outline());
});

test("with no derived strength declared, no section is held to the rule", () => {
  validateDraft(draftOf({ derived: [], first: [para("Độ cứng 85 N."), results([["Độ cứng", "85,2"]])] }), outline());
});

// --- every strength has a section, and every section a strength ----------------------------------------

test("more strengths than the outline has per-strength sections is refused", () => {
  expectCode("E_STRENGTH_SECTIONS_MISSING", () => validateDraft(draftOf({ strengths: ["5 mg", "10 mg", "20 mg"] }), outline()));
});

test("a per-strength section with no strength must be declared not applicable", () => {
  const one = draftOf({ strengths: ["5 mg"], second: [para("Sản phẩm chỉ có một hàm lượng."), results(MARKED)] });
  expectCode("E_STRENGTH_SECTION_ORPHAN", () => validateDraft(one, outline()));
  one.meta.notApplicableSections = ["P.2.1.2"];
  validateDraft(one, outline());
});

test("a section for a strength the draft declares cannot also be declared not applicable", () => {
  expectCode("E_STRENGTH_SECTION_CONTRADICTION", () => validateDraft(draftOf({ meta: { notApplicableSections: ["P.2.1.2"] } }), outline()));
});

test("not-applicable cannot name a section that reports no strength and develops nothing", () => {
  expectCode("E_META_NOT_APPLICABLE", () => validateDraft(draftOf({ meta: { notApplicableSections: ["P.2.1.3"] } }), outline()));
});

test("an outline whose per-strength positions skip or repeat is refused", () => {
  const broken = outline();
  broken.sections[1].form.strengthIndex = 0;
  expectCode("E_OUTLINE_STRENGTH_SECTION", () => validateDraft(draftOf(), broken));
});

// --- the section says which strength it is ------------------------------------------------------------

test("a heading with {strength} prints the strength at the section's position", () => {
  const entries = outline().sections;
  const meta = { strengths: ["5 mg", "10 mg"] };
  assert.equal(headingFor(entries[0], meta), "Kết quả — hàm lượng 5 mg");
  assert.equal(headingFor(entries[1], meta), "Kết quả — hàm lượng 10 mg");
  assert.equal(headingFor(entries[2], meta), "Mục chung, không theo hàm lượng");
  assert.equal(headingFor(entries[1], { strengths: ["5 mg"] }), "Kết quả — hàm lượng không áp dụng");
});

test("the action lists name the strength in the heading and attribute it to the request", () => {
  const draft = draftOf({
    first: [para(`${GAP_LABEL} Kết quả của lô đầu tiên.`)],
    second: [para(`${DECISION_LABEL} FD chốt tiêu chí. Chốt bởi FD.`), results(MARKED)],
  });
  draft.meta.decisionOwners = ["FD", "QA"];
  const requests = dataRequestRows(draft, outline());
  const first = requests.find((row) => row[0].startsWith("3.2.P.2.1.1"));
  assert.match(first[0], /hàm lượng 5 mg/);
  assert.equal(first[2], "5 mg", "the request carries the strength of the section it was raised in");
  const second = requests.find((row) => row[0].startsWith("3.2.P.2.1.2"));
  assert.equal(second[2], "10 mg");
  const decision = decisionRows(draft, outline()).find((row) => row[0].startsWith("3.2.P.2.1.2"));
  assert.match(decision[0], /hàm lượng 10 mg/);
});

// --- the committed outline and draft --------------------------------------------------------------------

test("the committed outline binds three families of two sections to positions 0 and 1", () => {
  const bound = realOutline.sections.filter((s) => Number.isInteger(s.form?.strengthIndex));
  assert.deepEqual(bound.map((s) => [s.id, s.form.strengthIndex]), [
    ["P.2.2.3.3.2", 0], ["P.2.2.3.3.3", 1], ["P.2.2.3.4.1", 0], ["P.2.2.3.4.2", 1], ["P.2.3.3.1", 0], ["P.2.3.3.2", 1],
  ]);
  for (const entry of bound) assert.match(entry.headingVi, /\{strength\}/);
});

test("in the committed draft the sections at position 0 belong to the derived strength", () => {
  const draft = realDraft();
  validateDraft(draft);
  assert.equal(draft.meta.strengths[0], "5 mg");
  assert.deepEqual(draft.meta.derivedStrengths, ["5 mg"]);
});

test("in the committed draft, a hardness typed into the derived strength's table is refused", () => {
  const draft = realDraft();
  const table = draft.sections.find((s) => s.id === "P.2.2.3.3.2").blocks.find((b) => b.type === "table");
  table.rows.find((row) => row[0] === "Độ cứng")[1] = "85,2";
  expectCode("E_DERIVED_SECTION_HAS_RESULT", () => validateDraft(draft));
});

test("in the committed draft, a third strength with no section for it is refused", () => {
  const draft = realDraft();
  draft.meta.strengths = ["5 mg", "10 mg", "20 mg"];
  expectCode("E_STRENGTH_SECTIONS_MISSING", () => validateDraft(draft));
});

test("the rendered document prints the strength in each per-strength heading", async () => {
  const draft = realDraft();
  const buffer = await buildDocumentBuffer(draft, realOutline);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  const text = xml.replace(/<[^>]+>/g, "");
  for (const strength of ["5 MG", "10 MG"]) {
    assert.ok(text.includes(`3.2.P.2.2.3.3.${strength === "5 MG" ? 2 : 3} ĐẶC TÍNH LÝ HÓA — HÀM LƯỢNG ${strength}`), `no heading for ${strength}`);
  }
  assert.ok(!text.includes("{STRENGTH}") && !text.includes("{strength}"), "the placeholder must never reach the document");
});
