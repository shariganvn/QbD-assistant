import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import JSZip from "jszip";

import { canonicalBytes } from "../../reasoning/publication.mjs";
import { emitFormulationReview, runFormulationSelection } from "../formulation-selection-run.mjs";
import { validateDraft } from "../../render/contract.mjs";
import { validateFormulationReviewDraft } from "../../render/formulation-review-contract.mjs";
import { normalizeOoxml } from "../../render/normalize-ooxml.mjs";
import { verifyFormulationReviewArtifacts } from "../formulation-review-verifier.mjs";

const filledDocx = new URL("../../inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx", import.meta.url);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("G-05 review render stays watermarked, non-citable, and internally source-bound", async () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-render-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-render" });
    const review = await emitFormulationReview({ phase3Result: phase3, runId: "g05-render" });
    assert.equal(review.rationale.source_classification.citable, false);
    assert.deepEqual(review.rationale.citations, []);
    assert.ok(review.draft.title.includes("NON-CITABLE"));
    assert.ok(review.draft.blocks.some((block) => block.text?.includes("ĐỀ XUẤT KỸ THUẬT")));
    assert.ok(review.rationale.internal_provenance_references.every((reference) => reference.reference_id.startsWith("internal:")));
    const provenanceTable = review.draft.blocks.find((block) => block.type === "table" && block.headers.includes("Quote SHA-256"));
    assert.ok(provenanceTable);
    assert.ok(provenanceTable.headers.includes("Source file"));
    assert.equal(provenanceTable.rows[0][2], review.rationale.internal_provenance_references[0].source_file);
    assert.equal(provenanceTable.rows[0][6], review.rationale.internal_provenance_references[0].quote_sha256);
    validateDraft(review.draft);
    assert.equal(review.renderReceipt.citations_count, 0);
    assert.equal(review.renderReceipt.isolated_render.unshare_net, true);
    assert.equal(review.verification.page_level_marker, true);
    assert.equal(review.verification.p221_sections_complete, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 P.2.2.1 draft contract rejects required marker, watermark, missing-data, and provenance removal", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-draft-contract-"));
  try {
    const phase3 = runFormulationSelection({ outputRoot: root, runId: "g05-draft-contract" });
    const review = emitFormulationReview({ phase3Result: phase3, runId: "g05-draft-contract" });
    const missingState = structuredClone(review.draft);
    missingState.blocks = missingState.blocks.filter((block) => !block.text?.startsWith("Missing/conflicting data state:"));
    assert.throws(() => validateFormulationReviewDraft(missingState), (error) => error.code === "E_FORMULATION_DRAFT_CONTRACT");
    const missingProvenance = structuredClone(review.draft);
    missingProvenance.blocks = missingProvenance.blocks.filter((block) => !(block.type === "table" && block.headers.includes("Quote SHA-256")));
    assert.throws(() => validateFormulationReviewDraft(missingProvenance), (error) => error.code === "E_FORMULATION_DRAFT_CONTRACT");
    const missingMarker = structuredClone(review.draft);
    missingMarker.blocks = missingMarker.blocks.filter((block) => !block.text?.startsWith("REVIEW ONLY — NON-CITABLE — NOT FD APPROVED"));
    assert.throws(() => validateFormulationReviewDraft(missingMarker), (error) => error.code === "E_FORMULATION_DRAFT_CONTRACT");
    const missingWatermark = structuredClone(review.draft);
    missingWatermark.blocks = missingWatermark.blocks.filter((block) => block.text !== "ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT");
    assert.throws(() => validateFormulationReviewDraft(missingWatermark), (error) => error.code === "E_FORMULATION_DRAFT_CONTRACT");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 post-render verifier rejects rationale substitution", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-rationale-substitution-"));
  try {
    const runId = "g05-rationale-substitution";
    const phase3 = runFormulationSelection({ outputRoot: root, runId });
    emitFormulationReview({ phase3Result: phase3, runId });
    const rationalePath = join(root, "rationale.json");
    const rationale = JSON.parse(readFileSync(rationalePath, "utf8"));
    rationale.claims[2].text = "Invented composition values.";
    writeFileSync(rationalePath, JSON.stringify(rationale));
    assert.throws(
      () => verifyFormulationReviewArtifacts({ outputRoot: root, runId }),
      (error) => error.code === "E_FORMULATION_REVIEW_VERIFY",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 post-render verifier rejects DOCX substitution", () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-docx-substitution-"));
  try {
    const runId = "g05-docx-substitution";
    const phase3 = runFormulationSelection({ outputRoot: root, runId });
    emitFormulationReview({ phase3Result: phase3, runId });
    copyFileSync(filledDocx, join(root, "p2.2.1-review.docx"));
    assert.throws(
      () => verifyFormulationReviewArtifacts({ outputRoot: root, runId }),
      (error) => error.code === "E_FORMULATION_REVIEW_VERIFY",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-05 post-render verifier rejects owner-level template content drift even with refreshed render hashes", async () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g05-docx-content-drift-"));
  try {
    const runId = "g05-docx-content-drift";
    const phase3 = runFormulationSelection({ outputRoot: root, runId });
    emitFormulationReview({ phase3Result: phase3, runId });
    const docxPath = join(root, "p2.2.1-review.docx");
    const zip = await JSZip.loadAsync(readFileSync(docxPath));
    const part = zip.file("word/document.xml");
    const documentXml = await part.async("string");
    assert.ok(documentXml.includes("Magnesium stearate"));
    zip.file("word/document.xml", documentXml.replace("Magnesium stearate", "ALTERED EXCIPIENT"));
    const mutated = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    writeFileSync(docxPath, mutated);

    const receiptPath = join(root, "render-receipt.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.docx_sha256 = sha256(mutated);
    receipt.normalized_ooxml_sha256 = normalizeOoxml(docxPath).manifest_sha256;
    writeFileSync(receiptPath, canonicalBytes(receipt));

    assert.throws(
      () => verifyFormulationReviewArtifacts({ outputRoot: root, runId }),
      (error) => error.code === "E_FORMULATION_REVIEW_VERIFY" && error.message.includes("EXCIPIENT-6"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
