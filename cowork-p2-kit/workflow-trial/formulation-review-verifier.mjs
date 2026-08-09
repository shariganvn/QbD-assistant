#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import { canonicalBytes } from "../reasoning/publication.mjs";
import { normalizeOoxml } from "../render/normalize-ooxml.mjs";
import { inspectFilledTemplateContent, REVIEW_TITLE, validateFormulationReviewDraft } from "../render/formulation-review-contract.mjs";
import { visibleText } from "../template-probe/template-owner-reader.mjs";
import { canonicalJson } from "./formula-cell-receipt.mjs";
import { buildFormulationRationalePackage } from "./formulation-selection-rationale.mjs";
import { buildFormulationReviewDraft } from "./formulation-selection-review-draft.mjs";

const UNZIP = "/usr/bin/unzip";
const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fail(message) {
  const error = new Error(`[E_FORMULATION_REVIEW_VERIFY] ${message}`);
  error.code = "E_FORMULATION_REVIEW_VERIFY";
  throw error;
}

function readJson(root, name) {
  try { return JSON.parse(readFileSync(join(root, name), "utf8")); }
  catch (error) { fail(`cannot read ${name}: ${error.message}`); }
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) fail(`${label} keys do not match the contract`);
}

function unzipPart(docxPath, part) {
  const escapedPart = part.replace(/[\[\]*?]/g, "\\$&");
  const result = spawnSync(UNZIP, ["-p", docxPath, escapedPart], { encoding: "utf8", timeout: 30_000, maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) fail(`DOCX part is missing or unreadable: ${part}`);
  return result.stdout;
}

function verifyHeader({ documentXml, relationshipsXml, contentTypesXml, headerXml }) {
  const relationship = [...relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)]
    .map((match) => Object.fromEntries([...match[1].matchAll(/([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g)].map((attribute) => [attribute[1], attribute[2]])))
    .find((attributes) => attributes.Type?.endsWith("/header") && attributes.Target === "header1.xml");
  if (!relationship?.Id) fail("page-level review header relationship is missing");
  if (!new RegExp(`<w:headerReference\\b[^>]*r:id="${relationship.Id}"`).test(documentXml)) fail("page-level review header is not attached to the document section");
  if (!contentTypesXml.includes('PartName="/word/header1.xml"') || !contentTypesXml.includes("wordprocessingml.header+xml")) fail("review header content type is missing");
  if (!visibleText(headerXml).includes(REVIEW_TITLE)) fail("page-level review header marker is missing");
}

function verifyRenderedDraft({ draft, rationale, documentXml }) {
  const text = visibleText(documentXml);
  for (const block of draft.blocks) {
    if (block.text && !text.includes(block.text)) fail(`rendered DOCX is missing draft block: ${block.text}`);
    if (block.type === "table") {
      for (const value of [...block.headers, ...block.rows.flat()]) {
        if (!text.includes(String(value))) fail(`rendered DOCX is missing draft table value: ${value}`);
      }
    }
  }
  const sourceFile = rationale.internal_provenance_references[0]?.source_file?.split("/").at(-1);
  if (!sourceFile || !text.includes(sourceFile) || !text.includes("P.2.2.1")) {
    fail("rendered DOCX is missing the concise source-basis marker");
  }
}

export function verifyFormulationReviewArtifacts({ outputRoot, runId } = {}) {
  const root = resolve(outputRoot ?? "");
  if (!runId) fail("runId is required");
  const expectedBundle = buildFormulationRationalePackage({ phase3Root: root, runId });
  const expectedDraft = buildFormulationReviewDraft({
    diagnostic: expectedBundle.diagnostic,
    engineeringProposal: expectedBundle.engineeringProposal,
    rationale: expectedBundle.rationale,
  });
  const packet = readJson(root, "rationale-package.json");
  const rationale = readJson(root, "rationale.json");
  const draft = validateFormulationReviewDraft(readJson(root, "review-draft.json"));
  if (canonicalJson(packet) !== canonicalJson(expectedBundle.packet)) fail("rationale package differs from regenerated source artifacts");
  if (canonicalJson(rationale) !== canonicalJson(expectedBundle.rationale)) fail("rationale differs from regenerated source artifacts");
  if (canonicalJson(draft) !== canonicalJson(expectedDraft)) fail("review draft differs from regenerated rationale and source artifacts");

  const rationaleReceipt = readJson(root, "rationale-receipt.json");
  exactKeys(rationaleReceipt, [
    "schema_version", "run_id", "source_publication_receipt_sha256", "packet_sha256",
    "rationale_sha256", "draft_sha256", "template_cell_receipt_sha256",
  ], "rationale receipt");
  const expectedRationaleReceipt = {
    schema_version: "formulation-rationale-receipt/v1",
    run_id: runId,
    source_publication_receipt_sha256: expectedBundle.packet.source_publication_receipt_sha256,
    packet_sha256: sha256(Buffer.from(canonicalBytes(packet))),
    rationale_sha256: sha256(Buffer.from(canonicalBytes(rationale))),
    draft_sha256: sha256(Buffer.from(canonicalBytes(draft))),
    template_cell_receipt_sha256: expectedBundle.publicationReceipt.template_cell_receipt_sha256,
  };
  if (canonicalJson(rationaleReceipt) !== canonicalJson(expectedRationaleReceipt)) fail("rationale receipt does not seal the regenerated artifacts");

  const renderReceipt = readJson(root, "render-receipt.json");
  exactKeys(renderReceipt, [
    "schema_version", "run_id", "source_publication_receipt_sha256", "rationale_receipt_sha256",
    "docx_sha256", "normalized_ooxml_sha256", "citations_count", "classification", "template_sha256",
    "template_field_map_sha256", "template_cell_receipt_sha256", "isolated_render",
  ], "render receipt");
  exactKeys(renderReceipt.isolated_render, ["argv_hash", "unshare_net", "exit_code", "versions"], "isolated render receipt");
  const docxPath = join(root, "p2.2.1-review.docx");
  const docxBytes = readFileSync(docxPath);
  const normalized = normalizeOoxml(docxPath);
  if (renderReceipt.schema_version !== "formulation-render-receipt/v1" || renderReceipt.run_id !== runId
    || renderReceipt.source_publication_receipt_sha256 !== expectedBundle.packet.source_publication_receipt_sha256
    || renderReceipt.rationale_receipt_sha256 !== sha256(Buffer.from(canonicalBytes(rationaleReceipt)))
    || renderReceipt.docx_sha256 !== sha256(docxBytes)
    || renderReceipt.normalized_ooxml_sha256 !== normalized.manifest_sha256
    || renderReceipt.citations_count !== 0
    || canonicalJson(renderReceipt.classification) !== canonicalJson({ label: "public", citable: false })
    || renderReceipt.template_sha256 !== expectedBundle.publicationReceipt.template_sha256
    || renderReceipt.template_field_map_sha256 !== expectedBundle.publicationReceipt.template_field_map_sha256
    || renderReceipt.template_cell_receipt_sha256 !== expectedBundle.publicationReceipt.template_cell_receipt_sha256
    || renderReceipt.isolated_render.unshare_net !== true || renderReceipt.isolated_render.exit_code !== 0
    || typeof renderReceipt.isolated_render.argv_hash !== "string" || renderReceipt.isolated_render.argv_hash.length === 0
    || !SHA256.test(renderReceipt.docx_sha256) || !SHA256.test(renderReceipt.normalized_ooxml_sha256)) {
    fail("render receipt does not seal the review artifacts and required invariants");
  }

  const documentXml = unzipPart(docxPath, "word/document.xml");
  const relationshipsXml = unzipPart(docxPath, "word/_rels/document.xml.rels");
  const contentTypesXml = unzipPart(docxPath, "[Content_Types].xml");
  const headerXml = unzipPart(docxPath, "word/header1.xml");
  verifyHeader({ documentXml, relationshipsXml, contentTypesXml, headerXml });
  const templateReceipt = readJson(root, "template-cell-receipt.v1.json");
  const templateInspection = inspectFilledTemplateContent(documentXml, templateReceipt);
  if (!templateInspection.receipt_complete
    || templateInspection.missing_required_fields.length > 0
    || templateInspection.unresolved_placeholder) {
    fail(`rendered DOCX does not preserve the complete filled-template content: ${templateInspection.missing_required_fields.join(", ") || "invalid receipt or unresolved placeholder"}`);
  }
  verifyRenderedDraft({ draft, rationale, documentXml });
  return {
    schema_version: "formulation-review-verification/v1",
    run_id: runId,
    docx_sha256: renderReceipt.docx_sha256,
    normalized_ooxml_sha256: renderReceipt.normalized_ooxml_sha256,
    rationale_sha256: rationaleReceipt.rationale_sha256,
    page_level_marker: true,
    p221_sections_complete: true,
    internal_provenance_complete: true,
  };
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const rootIndex = process.argv.indexOf("--root");
    const runIndex = process.argv.indexOf("--run-id");
    const result = verifyFormulationReviewArtifacts({ outputRoot: process.argv[rootIndex + 1], runId: process.argv[runIndex + 1] });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code ?? "E_FORMULATION_REVIEW_VERIFY"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
