import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import JSZip from "jszip";

import { emitFormulationReview, runFormulationSelection } from "../formulation-selection-run.mjs";
import { visibleText } from "../../template-probe/template-owner-reader.mjs";

const TEMPLATE_SHA256 = "c492532054d9ba04d2dbd5c3d03706c423534cce5329d2657b2588760e0087e0";
const FILLED_SHA256 = "01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function freshRun(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return { root, result: runFormulationSelection({ outputRoot: root, runId: "template-binding-test" }) };
}

test("G-00/G-03 bind all 146 official-template fields to the frozen filled mock", () => {
  const run = freshRun("p221-template-binding-");
  try {
    const fieldMap = JSON.parse(readFileSync(join(run.root, "template-field-map.v1.json"), "utf8"));
    const receipt = JSON.parse(readFileSync(join(run.root, "template-cell-receipt.v1.json"), "utf8"));
    assert.equal(fieldMap.occurrence_count, 146);
    assert.equal(receipt.occurrence_count, 146);
    assert.equal(fieldMap.template_sha256, TEMPLATE_SHA256);
    assert.equal(receipt.template_sha256, TEMPLATE_SHA256);
    assert.equal(receipt.source_document_sha256, FILLED_SHA256);
    assert.equal(receipt.entries.filter((entry) => entry.metadata.required && entry.raw_value.length === 0).length, 0);
    assert.equal(receipt.entries.find((entry) => entry.canonical_field_id === "EXPERIMENT-DESCRIPTION")?.raw_value, "Khảo sát tỷ lệ tá dược rã");
    assert.equal(receipt.entries.find((entry) => entry.canonical_field_id === "DISSOLUTION-MIN-CT03")?.raw_value, "96,15");
    assert.equal(receipt.entries.find((entry) => entry.canonical_field_id === "ASSAY-CT01")?.raw_value, "100,31");
    assert.equal(run.result.publication_receipt.template_field_map_sha256, sha256(readFileSync(join(run.root, "template-field-map.v1.json"))));
    assert.equal(run.result.publication_receipt.template_cell_receipt_sha256, sha256(readFileSync(join(run.root, "template-cell-receipt.v1.json"))));
  } finally {
    rmSync(run.root, { recursive: true, force: true });
  }
});

test("G-04 final P.2.2.1 review retains the complete filled template and appends the review-only rationale", async () => {
  const run = freshRun("p221-template-render-");
  try {
    const review = emitFormulationReview({ phase3Result: run.result, runId: "template-binding-test" });
    const zip = await JSZip.loadAsync(readFileSync(review.outputDocx));
    const documentXml = await zip.file("word/document.xml").async("string");
    const headerXml = await zip.file("word/header1.xml").async("string");
    const relationshipsXml = await zip.file("word/_rels/document.xml.rels").async("string");
    const text = visibleText(documentXml);
    for (const expected of [
      "Khảo sát tỷ lệ tá dược rã",
      "Công thức 01",
      "65,15",
      "79,12",
      "96,15",
      "100,31",
      "3,04",
      "REVIEW ONLY — NON-CITABLE — NOT FD APPROVED",
      "ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT",
      "CT01 không đạt dissolution tối thiểu (65,15% < 80%)",
      "CT02 cũng không đạt (79,12% < 80%)",
      "CT03 là ứng viên duy nhất còn lại",
      "filled-public-mock-document-030826.docx — P.2.2.1 results table",
      "formula-03",
    ]) assert.ok(text.includes(expected), `missing rendered text: ${expected}`);
    assert.doesNotMatch(text, /Quote SHA-256|Cell receipt|internal:observed|char_start|record_id/);
    assert.doesNotMatch(text, /<[A-Z][A-Z0-9%-]*>/);
    assert.match(visibleText(headerXml), /REVIEW ONLY — NON-CITABLE — NOT FD APPROVED/);
    assert.match(relationshipsXml, /relationships\/header/);
    assert.match(documentXml, /<w:headerReference\b/);
    assert.equal(review.renderReceipt.template_sha256, TEMPLATE_SHA256);
    assert.equal(review.renderReceipt.template_cell_receipt_sha256, run.result.publication_receipt.template_cell_receipt_sha256);
    assert.equal(review.renderReceipt.isolated_render.unshare_net, true);
  } finally {
    rmSync(run.root, { recursive: true, force: true });
  }
});

test("G-04 isolated template render rejects a receipt that no longer matches the frozen DOCX pair", () => {
  const run = freshRun("p221-template-tamper-");
  try {
    const receiptPath = join(run.root, "template-cell-receipt.v1.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.entries.find((entry) => entry.canonical_field_id === "ASSAY-CT01").raw_value = "99,99";
    writeFileSync(receiptPath, JSON.stringify(receipt));
    assert.throws(
      () => emitFormulationReview({ phase3Result: run.result, runId: "template-binding-test" }),
      (error) => error.code === "E_RATIONALE_SOURCE_BINDING" || error.code === "E_FORMULATION_RENDER",
    );
  } finally {
    rmSync(run.root, { recursive: true, force: true });
  }
});
