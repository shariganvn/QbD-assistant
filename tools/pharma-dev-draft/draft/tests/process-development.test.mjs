// An operation with no development section is a step nobody studied, and a development section for an
// operation the list does not contain is a study of something the process does not do. Neither shows
// up in a document that merely has both a process description and development sections, so the
// operation list has to point at the sections and the sections have to be pointed at.
//
// Proved on a small purpose-built outline, like the risk-assessment rules, and then once against the
// committed outline and draft.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateDraft, DraftContractError } from "../validate-draft.mjs";
import { GAP_LABEL } from "../../schemas/markers.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const realOutline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
const realDraft = () => JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));

function outline({ listForm = true } = {}) {
  return {
    schemaVersion: "1.0",
    sections: [
      {
        id: "P.2.1.1",
        ctdReference: "3.2.P.2.1.1",
        headingVi: "Danh mục công đoạn",
        form: listForm ? { operationList: { developmentColumn: 2 }, tables: [{ columns: ["Công đoạn", "Thương mại", "Mục phát triển"], rows: "variable" }] } : { tables: [{ columns: ["Công đoạn", "Thương mại", "Mục phát triển"], rows: "variable" }] },
      },
      { id: "P.2.1.2", ctdReference: "3.2.P.2.1.2", headingVi: "Phát triển trộn", form: { developsOperations: true } },
      { id: "P.2.1.3", ctdReference: "3.2.P.2.1.3", headingVi: "Phát triển dập viên", form: { developsOperations: true } },
      { id: "P.2.1.4", ctdReference: "3.2.P.2.1.4", headingVi: "Mục khác, không phát triển công đoạn" },
    ],
  };
}

const para = (text) => ({ type: "paragraph", text });

function draftOf(rows, meta = {}) {
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén",
      apiName: "Hoạt chất thử nghiệm",
      sourceFiles: ["fixture.docx"],
      strengths: ["10 mg"],
      draftDate: "2026-10-01",
      assembledBy: "bộ kiểm quy tắc",
      extractionMethod: "xml-walk",
      ...meta,
    },
    sections: [
      { id: "P.2.1.1", status: "covered", blocks: [{ type: "table", headers: ["Công đoạn", "Thương mại", "Mục phát triển"], rows }] },
      { id: "P.2.1.2", status: "covered", blocks: [para("Phát triển công đoạn trộn.")] },
      { id: "P.2.1.3", status: "covered", blocks: [para("Phát triển công đoạn dập viên.")] },
      { id: "P.2.1.4", status: "covered", blocks: [para("Nội dung khác.")] },
    ],
  };
}

const MARK = `${GAP_LABEL} chưa có mục phát triển riêng`;
const GOOD = [["Trộn", "—", "3.2.P.2.1.2"], ["Dập", "—", "3.2.P.2.1.3"]];

function expectCode(code, run) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof DraftContractError, `expected DraftContractError, got ${error}`);
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test("operations that each point at a development section, and every section pointed at, validate", () => {
  validateDraft(draftOf(GOOD), outline());
});

test("several operations may share one development section", () => {
  validateDraft(draftOf([["Trộn 1", "—", "3.2.P.2.1.2"], ["Trộn 2", "—", "P.2.1.2"], ["Dập", "—", "3.2.P.2.1.3"]]), outline());
});

test("an operation with no development section yet carries a marker instead", () => {
  validateDraft(draftOf([...GOOD, ["Rây", "—", MARK]]), outline());
});

test("an operation pointing at no section is refused", () => {
  expectCode("E_PROCESS_DEVELOPMENT_UNKNOWN", () => validateDraft(draftOf([...GOOD, ["Rây", "—", "đã khảo sát"]]), outline()));
});

test("an operation pointing at a section that does not develop operations is refused", () => {
  expectCode("E_PROCESS_DEVELOPMENT_UNKNOWN", () => validateDraft(draftOf([...GOOD, ["Rây", "—", "3.2.P.2.1.4"]]), outline()));
});

test("an operation pointing at two sections is refused", () => {
  expectCode("E_PROCESS_DEVELOPMENT_MULTIPLE", () => validateDraft(draftOf([["Trộn", "—", "3.2.P.2.1.2 và 3.2.P.2.1.3"]]), outline()));
});

test("a development section no operation points at is refused", () => {
  expectCode("E_PROCESS_DEVELOPMENT_UNUSED", () => validateDraft(draftOf([["Trộn", "—", "3.2.P.2.1.2"]]), outline()));
});

test("a section can be declared not applicable instead of being pointed at", () => {
  validateDraft(draftOf([["Trộn", "—", "3.2.P.2.1.2"]], { notApplicableSections: ["P.2.1.3"] }), outline());
});

test("a section declared not applicable cannot also be pointed at", () => {
  expectCode("E_PROCESS_DEVELOPMENT_CONTRADICTION", () => validateDraft(draftOf(GOOD, { notApplicableSections: ["P.2.1.3"] }), outline()));
});

test("not-applicable can only name a section that develops an operation", () => {
  expectCode("E_META_NOT_APPLICABLE", () => validateDraft(draftOf(GOOD, { notApplicableSections: ["P.2.1.4"] }), outline()));
});

test("an outline that marks developing sections with no operation list is refused", () => {
  expectCode("E_OUTLINE_PROCESS_DEVELOPMENT", () => validateDraft(draftOf(GOOD), outline({ listForm: false })));
});

test("the committed outline marks the blending, compression and coating sections", () => {
  const developing = realOutline.sections.filter((s) => s.form?.developsOperations).map((s) => s.id);
  assert.deepEqual(developing, ["P.2.3.2.3", "P.2.3.2.4", "P.2.3.2.5"]);
});

test("in the committed draft every operation points at a section or carries a marker, and the figure follows the list", () => {
  validateDraft(realDraft());
  const list = realDraft().sections.find((s) => s.id === "P.2.3.2").blocks.find((b) => b.type === "table");
  const cited = list.rows.map((row) => row[2]).filter((cell) => !cell.includes("[CHƯA CÓ"));
  assert.deepEqual([...new Set(cited)].sort(), ["3.2.P.2.3.2.3", "3.2.P.2.3.2.4", "3.2.P.2.3.2.5"]);
});

test("in the committed draft, dropping the coating operation's pointer is caught", () => {
  const draft = realDraft();
  const list = draft.sections.find((s) => s.id === "P.2.3.2").blocks.find((b) => b.type === "table");
  list.rows.find((row) => row[0] === "Bao phim")[2] = `${GAP_LABEL} chưa có mục`;
  expectCode("E_PROCESS_DEVELOPMENT_UNUSED", () => validateDraft(draft));
});
