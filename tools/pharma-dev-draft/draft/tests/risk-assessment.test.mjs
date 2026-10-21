// A risk matrix that has been lowered is a claim that something was learned. These tests hold the
// three things that make the claim checkable: the updated matrix has the initial one's rows and
// columns, the process columns come from the operation list instead of being typed in again, and a
// cell scored lower says which study lowered it.
//
// The rules are proved on a small purpose-built outline, because the committed draft has no risk
// level in it yet — every matrix cell is still a marker, so no cell has been lowered and the
// lowering rule has nothing to act on. The last tests say so out loud rather than letting a green run
// suggest otherwise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateDraft, DraftContractError } from "../validate-draft.mjs";
import { GAP_LABEL, GAP_PREFIX, isMarkedText } from "../../schemas/markers.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const realOutline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
const realDraft = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));

const SCALE = ["Thấp", "Trung bình", "Cao"];
const CQA_FORM = { columns: ["CQA sản phẩm", "..."] };

function outline(overrides = {}) {
  return {
    schemaVersion: "1.0",
    riskScale: SCALE,
    sections: [
      { id: "P.2.1.1", ctdReference: "3.2.P.2.1.1", headingVi: "Chỉ tiêu" },
      { id: "P.2.1.2", ctdReference: "3.2.P.2.1.2", headingVi: "Công đoạn", form: { tables: [{ columns: ["Công đoạn", "Ghi chú"], rows: "variable" }] } },
      {
        id: "P.2.1.3",
        ctdReference: "3.2.P.2.1.3",
        headingVi: "Đánh giá rủi ro ban đầu",
        form: {
          riskAssessment: { kind: "initial" },
          tables: [
            { ...CQA_FORM, rowsFrom: "P.2.1.1", columnsFromRows: { section: "P.2.1.2", column: 0 } },
            { columns: ["Ô rủi ro (CQA × yếu tố)", "Mức rủi ro", "Biện luận"], rows: "variable" },
          ],
        },
      },
      {
        id: "P.2.1.4",
        ctdReference: "3.2.P.2.1.4",
        headingVi: "Đánh giá rủi ro cập nhật",
        form: {
          riskAssessment: { kind: "updated", pairs: "P.2.1.3" },
          tables: [
            { ...CQA_FORM, rowsFrom: "P.2.1.3", columnsFrom: "P.2.1.3" },
            { columns: ["Ô rủi ro (CQA × yếu tố)", "Mức ban đầu → cập nhật", "Nghiên cứu đã hạ mức"], rows: "variable" },
          ],
        },
      },
    ],
    ...overrides,
  };
}

const para = (text) => ({ type: "paragraph", text });
const table = (headers, rows) => ({ type: "table", headers, rows });

// `initial` and `updated` are the score rows, one per quality attribute, one score per operation.
function draftOf({ operations = ["Trộn", "Dập"], initial, updated, justification = [[`${GAP_LABEL} chưa viết`, `${GAP_LABEL} mức`, `${GAP_LABEL} nghiên cứu`]] } = {}) {
  const cqa = ["Độ rã", "Hòa tan"];
  const score = (rows) => cqa.map((label, index) => [label, ...rows[index]]);
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén",
      apiName: "Hoạt chất thử nghiệm",
      sourceFiles: ["fixture.docx"],
      strengths: ["10 mg"],
      draftDate: "2026-09-30",
      assembledBy: "bộ kiểm quy tắc",
      extractionMethod: "xml-walk",
    },
    sections: [
      { id: "P.2.1.1", status: "covered", blocks: [table(["Chỉ tiêu", "Tiêu chuẩn"], cqa.map((label) => [label, "—"]))] },
      { id: "P.2.1.2", status: "covered", blocks: [table(["Công đoạn", "Ghi chú"], operations.map((name) => [name, "—"]))] },
      {
        id: "P.2.1.3",
        status: "covered",
        blocks: [table(["CQA sản phẩm", ...operations], score(initial)), table(["Ô rủi ro (CQA × yếu tố)", "Mức rủi ro", "Biện luận"], [[`${GAP_LABEL} chưa viết`, `${GAP_LABEL} mức`, `${GAP_LABEL} căn cứ`]])],
      },
      {
        id: "P.2.1.4",
        status: "covered",
        blocks: [table(["CQA sản phẩm", ...operations], score(updated)), table(["Ô rủi ro (CQA × yếu tố)", "Mức ban đầu → cập nhật", "Nghiên cứu đã hạ mức"], justification)],
      },
    ],
  };
}

const SAME = [["Cao", "Cao"], ["Cao", "Cao"]];

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DraftContractError, `expected DraftContractError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test("a matrix pair with identical labels and no lowered cell validates", () => {
  validateDraft(draftOf({ initial: SAME, updated: SAME }), outline());
});

// --- the updated matrix repeats the initial one's labels ------------------------------------------

test("an updated matrix that renames a quality attribute is refused", () => {
  const draft = draftOf({ initial: SAME, updated: SAME });
  draft.sections[3].blocks[0].rows[0][0] = "Độ rã (30 phút)";
  expectCode("E_FORM_ROWS", () => validateDraft(draft, outline()));
});

test("an updated matrix that renames or drops a column is refused", () => {
  const renamed = draftOf({ initial: SAME, updated: SAME });
  renamed.sections[3].blocks[0].headers[1] = "Trộn sơ bộ";
  expectCode("E_FORM_COLUMNS", () => validateDraft(renamed, outline()));

  const dropped = draftOf({ initial: SAME, updated: SAME });
  dropped.sections[3].blocks[0].headers.pop();
  dropped.sections[3].blocks[0].rows = dropped.sections[3].blocks[0].rows.map((row) => row.slice(0, -1));
  expectCode("E_FORM_COLUMNS", () => validateDraft(dropped, outline()));
});

// --- the process columns come from the operation list ---------------------------------------------

test("a matrix column that is not an operation of the list is refused", () => {
  const draft = draftOf({ initial: SAME, updated: SAME });
  for (const id of ["P.2.1.3", "P.2.1.4"]) {
    const matrix = draft.sections.find((s) => s.id === id).blocks[0];
    matrix.headers.push("Bao phim");
    matrix.rows = matrix.rows.map((row) => [...row, "Cao"]);
  }
  expectCode("E_FORM_COLUMNS", () => validateDraft(draft, outline()));
});

test("an operation added to the list but missing from the matrix is refused", () => {
  // The matrices are still two columns wide while the list now has three operations.
  const draft = draftOf({ operations: ["Trộn", "Dập", "Bao phim"], initial: [["Cao", "Cao", "Cao"], ["Cao", "Cao", "Cao"]], updated: [["Cao", "Cao", "Cao"], ["Cao", "Cao", "Cao"]] });
  for (const id of ["P.2.1.3", "P.2.1.4"]) {
    const matrix = draft.sections.find((s) => s.id === id).blocks[0];
    matrix.headers.pop();
    matrix.rows = matrix.rows.map((row) => row.slice(0, -1));
  }
  expectCode("E_FORM_COLUMNS", () => validateDraft(draft, outline()));
});

test("the same operations in a different order are refused: the list fixes the order too", () => {
  const draft = draftOf({ initial: SAME, updated: SAME });
  for (const id of ["P.2.1.3", "P.2.1.4"]) {
    const matrix = draft.sections.find((s) => s.id === id).blocks[0];
    matrix.headers = ["CQA sản phẩm", "Dập", "Trộn"];
  }
  expectCode("E_FORM_COLUMNS", () => validateDraft(draft, outline()));
});

test("a table cannot declare both column sources", () => {
  const both = outline();
  both.sections[2].form.tables[0].columnsFrom = "P.2.1.4";
  expectCode("E_FORM_COLUMNS", () => validateDraft(draftOf({ initial: SAME, updated: SAME }), both));
});

// --- a lowered cell names the study that lowered it ----------------------------------------------

const LOWERED = [["Cao", "Cao"], ["Thấp", "Cao"]]; // Hòa tan × Trộn: Cao -> Thấp
const KEY = "Hòa tan × Trộn";

test("a cell scored lower with no justification row is refused", () => {
  expectCode("E_RISK_LOWERED_NO_EVIDENCE", () => validateDraft(draftOf({ initial: SAME, updated: LOWERED }), outline()));
});

test("a justification that names no study is refused", () => {
  const draft = draftOf({ initial: SAME, updated: LOWERED, justification: [[KEY, "Cao → Thấp", "Đã kiểm tra, không còn lo ngại"]] });
  expectCode("E_RISK_LOWERED_NO_EVIDENCE", () => validateDraft(draft, outline()));
});

test("a justification that cites a section of the document is accepted", () => {
  const draft = draftOf({ initial: SAME, updated: LOWERED, justification: [[KEY, "Cao → Thấp", "Kết quả ở mục 3.2.P.2.1.2"]] });
  validateDraft(draft, outline());
});

test("a justification may instead carry a marker saying the study is not attached yet", () => {
  const draft = draftOf({ initial: SAME, updated: LOWERED, justification: [[KEY, "Cao → Thấp", `${GAP_LABEL} Nghiên cứu đã hạ mức này`]] });
  validateDraft(draft, outline());
});

test("a citation of a section that does not exist is caught by the reference check", () => {
  const draft = draftOf({ initial: SAME, updated: LOWERED, justification: [[KEY, "Cao → Thấp", "Kết quả ở mục 3.2.P.2.9.9"]] });
  expectCode("E_XREF_UNKNOWN", () => validateDraft(draft, outline()));
});

test("a cell left unchanged or raised needs no justification", () => {
  const raised = [["Trung bình", "Cao"], ["Cao", "Cao"]]; // initial below, so updated is higher
  validateDraft(draftOf({ initial: [["Thấp", "Cao"], ["Cao", "Cao"]], updated: raised }), outline());
});

test("a cell holding a marker on either side has no level to compare", () => {
  const marked = [[GAP_PREFIX, "Cao"], ["Cao", "Cao"]];
  validateDraft(draftOf({ initial: SAME, updated: marked }), outline());
  validateDraft(draftOf({ initial: marked, updated: SAME }), outline());
});

test("a matrix cell that is neither a level nor a marker is refused", () => {
  const free = [["khá thấp", "Cao"], ["Cao", "Cao"]];
  expectCode("E_RISK_CELL_INVALID", () => validateDraft(draftOf({ initial: SAME, updated: free }), outline()));
  expectCode("E_RISK_CELL_INVALID", () => validateDraft(draftOf({ initial: free, updated: SAME }), outline()));
});

test("a justification row for a cell that was not lowered is refused as stale", () => {
  const draft = draftOf({ initial: SAME, updated: SAME, justification: [[KEY, "Cao → Thấp", "Kết quả ở mục 3.2.P.2.1.2"]] });
  expectCode("E_RISK_JUSTIFICATION_ORPHAN", () => validateDraft(draft, outline()));
});

test("a placeholder row still carrying a marker is not mistaken for a stale one", () => {
  const draft = draftOf({
    initial: SAME,
    updated: LOWERED,
    justification: [[KEY, "Cao → Thấp", "Kết quả ở mục 3.2.P.2.1.2"], [`${GAP_LABEL} Các ô còn lại chưa xét`, `${GAP_LABEL} mức`, `${GAP_LABEL} nghiên cứu`]],
  });
  validateDraft(draft, outline());
});

// --- the outline itself has to be coherent --------------------------------------------------------

test("a risk assessment with no declared scale is refused", () => {
  const noScale = outline();
  delete noScale.riskScale;
  expectCode("E_OUTLINE_RISK_SCALE", () => validateDraft(draftOf({ initial: SAME, updated: SAME }), noScale));
});

test("an updated assessment must pair with an initial one", () => {
  const wrong = outline();
  wrong.sections[3].form.riskAssessment.pairs = "P.2.1.2";
  expectCode("E_OUTLINE_RISK_PAIR", () => validateDraft(draftOf({ initial: SAME, updated: SAME }), wrong));
});

// --- the committed outline and draft ----------------------------------------------------------------

test("the committed outline pairs each updated assessment with the initial one it revises", () => {
  const pairs = realOutline.sections
    .filter((s) => s.form?.riskAssessment?.kind === "updated")
    .map((s) => [s.id, s.form.riskAssessment.pairs]);
  assert.deepEqual(pairs, [["P.2.1.1.4", "P.2.1.1.3"], ["P.2.2.1.3.4", "P.2.2.1.3.2"], ["P.2.3.4", "P.2.3.1"]]);
  for (const [, initial] of pairs) {
    assert.equal(realOutline.sections.find((s) => s.id === initial).form.riskAssessment.kind, "initial");
  }
});

test("the committed process matrix takes its columns from the operation list, not from its own text", () => {
  const spec = realOutline.sections.find((s) => s.id === "P.2.3.1").form.tables[0];
  assert.deepEqual(spec.columnsFromRows, { section: "P.2.3.2", column: 0 });
  const draft = realDraft();
  const operations = draft.sections.find((s) => s.id === "P.2.3.2").blocks.find((b) => b.type === "table").rows.map((row) => row[0]);
  const matrix = draft.sections.find((s) => s.id === "P.2.3.1").blocks.find((b) => b.type === "table");
  assert.deepEqual(matrix.headers.slice(1), operations);
});

test("the committed draft validates, and renaming one operation is caught in the matrix", () => {
  validateDraft(realDraft());
  const draft = realDraft();
  draft.sections.find((s) => s.id === "P.2.3.2").blocks.find((b) => b.type === "table").rows[0][0] = "Rây thô";
  expectCode("E_FORM_COLUMNS", () => validateDraft(draft));
});

test("the committed draft has no risk level in any matrix yet, so the lowering rule has not acted on it", () => {
  // This is a statement about what the green run above does and does not prove. Every matrix cell is
  // still a marker because the levels are the formulation department's to assign. The day one is
  // filled in this test fails, and whoever fills it in is pointed at the justification table.
  const draft = realDraft();
  const ids = realOutline.sections.filter((s) => s.form?.riskAssessment).map((s) => s.id);
  assert.equal(ids.length, 6);
  for (const id of ids) {
    const matrix = draft.sections.find((s) => s.id === id).blocks.find((b) => b.type === "table");
    for (const row of matrix.rows) {
      for (const cell of row.slice(1)) assert.ok(isMarkedText(cell), `${id} already holds a level ("${cell}") — check its justification table`);
    }
  }
});
