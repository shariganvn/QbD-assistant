#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import JSZip from "jszip";

import { assertFieldMap } from "../template-probe/template-field-contract.mjs";
import { assertCellReceipt } from "../template-probe/template-cell-receipt.mjs";
import { visibleText } from "../template-probe/template-owner-reader.mjs";
import { compileTemplateFieldMap } from "../template-probe/template-field-map.mjs";
import { extractTemplateCellReceipt } from "../template-probe/template-record-extractor.mjs";
import { inspectFilledTemplateContent, REVIEW_TITLE, validateFormulationReviewDraft } from "./formulation-review-contract.mjs";
import { determinizeDocx } from "./determinize-ooxml.mjs";
import {
  buildProposalConclusion,
  buildProposalReasoning,
} from "./formulation-proposal-reasoning.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const templatePath = resolve(repoRoot, "cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx");
const filledPath = resolve(repoRoot, "cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx");
const outputName = "p2.2.1-review.docx";
const headerRelationshipId = "rIdP221ReviewHeader";

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function paragraphXml(text, { bold = false, size = 20 } = {}) {
  const runProperties = `<w:rPr><w:rFonts w:ascii="Arimo" w:hAnsi="Arimo" w:cs="Arimo"/><w:b w:val="${bold ? 1 : 0}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
  return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function pageBreakXml() {
  return "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";
}

function reviewHeaderXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraphXml(REVIEW_TITLE, { bold: true, size: 18 })}</w:hdr>`;
}

async function addReviewHeader(zip, documentXml) {
  const relationshipsPart = zip.file("word/_rels/document.xml.rels");
  const contentTypesPart = zip.file("[Content_Types].xml");
  if (!relationshipsPart || !contentTypesPart) fail("E_TEMPLATE_RENDER_DOCX", "DOCX relationship or content-type part is missing");
  let relationships = await relationshipsPart.async("string");
  let contentTypes = await contentTypesPart.async("string");
  if (relationships.includes(headerRelationshipId) || zip.file("word/header1.xml")) fail("E_TEMPLATE_RENDER_DOCX", "review header identity already exists");
  relationships = relationships.replace(
    "</Relationships>",
    `<Relationship Id="${headerRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`,
  );
  contentTypes = contentTypes.replace(
    "</Types>",
    '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>',
  );
  const sectionCount = [...documentXml.matchAll(/<w:sectPr(?:\s[^>]*)?>/g)].length;
  if (sectionCount !== 1) fail("E_TEMPLATE_RENDER_DOCX", "complete filled template must contain exactly one section");
  documentXml = documentXml.replace(
    /<w:sectPr(\s[^>]*)?>/,
    (open) => `${open}<w:headerReference w:type="default" r:id="${headerRelationshipId}"/>`,
  );
  zip.file("word/_rels/document.xml.rels", relationships);
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("word/header1.xml", reviewHeaderXml());
  return documentXml;
}

function replaceOutsideParagraph(documentXml, paragraphNumber, replacementText) {
  const outsideTables = documentXml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
  const paragraphs = [...outsideTables.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
  const target = paragraphs[paragraphNumber - 1]?.[0];
  if (!target) fail("E_TEMPLATE_RENDER_OWNER", `outside-table paragraph ${paragraphNumber} is missing`);
  const first = documentXml.indexOf(target);
  if (first < 0 || documentXml.indexOf(target, first + target.length) >= 0) {
    fail("E_TEMPLATE_RENDER_OWNER", `outside-table paragraph ${paragraphNumber} is not uniquely addressable`);
  }
  const openTag = target.match(/^<w:p(?:\s[^>]*)?>/)?.[0] ?? "<w:p>";
  const paragraphProperties = target.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const runProperties = target.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0]
    ?? '<w:rPr><w:rFonts w:ascii="Arimo" w:hAnsi="Arimo" w:cs="Arimo"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
  const replacement = `${openTag}${paragraphProperties}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(replacementText)}</w:t></w:r></w:p>`;
  return `${documentXml.slice(0, first)}${replacement}${documentXml.slice(first + target.length)}`;
}

function draftAddendumXml(draft) {
  const output = [pageBreakXml()];
  for (const block of draft.blocks) {
    if (block.type === "heading1") output.push(paragraphXml(block.text, { bold: true, size: 30 }));
    else if (block.type === "heading2") output.push(paragraphXml(block.text, { bold: true, size: 24 }));
    else if (block.type === "paragraph" || block.type === "chờ_dữ_liệu") output.push(paragraphXml(block.text));
    else if (block.type === "table") {
      output.push(paragraphXml(block.headers.join(" | "), { bold: true }));
      for (const row of block.rows) output.push(paragraphXml(row.join(" | ")));
    }
  }
  return output.join("");
}

function completeTemplateText(documentXml, receipt) {
  const text = visibleText(documentXml);
  const inspection = inspectFilledTemplateContent(documentXml, receipt);
  if (!inspection.receipt_complete) fail("E_TEMPLATE_RENDER_INCOMPLETE", "complete official-template receipt is required");
  if (inspection.missing_required_fields.length > 0) {
    fail("E_TEMPLATE_RENDER_INCOMPLETE", `render lost required filled-template values at their owners: ${inspection.missing_required_fields.join(", ")}`);
  }
  if (inspection.unresolved_placeholder) fail("E_TEMPLATE_RENDER_INCOMPLETE", "render retains an unresolved semantic placeholder");
  return text;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--draft", "--field-map", "--receipt", "--output-root"].includes(flag) || !value) {
      fail("E_TEMPLATE_RENDER_ARGS", "expected --draft, --field-map, --receipt and --output-root values");
    }
    options[flag.slice(2).replaceAll("-", "_")] = value;
  }
  for (const key of ["draft", "field_map", "receipt", "output_root"]) {
    if (!options[key]) fail("E_TEMPLATE_RENDER_ARGS", `${key} is required`);
  }
  return options;
}

export async function renderTemplateBoundReview({ draftPath, fieldMapPath, receiptPath, outputRoot }) {
  const draft = validateFormulationReviewDraft(JSON.parse(readFileSync(resolve(draftPath), "utf8")));
  const evidenceTable = draft.blocks.find((block) => block.type === "table"
    && block.headers[0] === "Formula"
    && block.headers[1] === "Dissolution min %");
  const specificationTable = draft.blocks.find((block) => block.type === "table"
    && block.headers[0] === "Measure"
    && block.headers[1] === "Operator");
  const proposalBlock = draft.blocks.find((block) => block.type === "paragraph"
    && block.text.startsWith("Proposed survivor under the proposed rule:"));
  const proposedSurvivor = proposalBlock?.text.match(/: (formula-\d+) \(/)?.[1];
  const reasoning = buildProposalReasoning({
    evidenceRows: evidenceTable?.rows,
    specificationRows: specificationTable?.rows,
    proposedSurvivor,
  });
  const fieldMap = JSON.parse(readFileSync(resolve(fieldMapPath), "utf8"));
  const receipt = JSON.parse(readFileSync(resolve(receiptPath), "utf8"));
  assertFieldMap(fieldMap);
  assertCellReceipt(receipt, fieldMap);
  if (fieldMap.occurrence_count !== 146 || receipt.occurrence_count !== 146) {
    fail("E_TEMPLATE_RENDER_INCOMPLETE", "complete official-template binding requires 146 fields");
  }

  const templateBytes = readFileSync(templatePath);
  const filledBytes = readFileSync(filledPath);
  if (sha256(templateBytes) !== fieldMap.template_sha256 || receipt.template_sha256 !== fieldMap.template_sha256) {
    fail("E_TEMPLATE_RENDER_BINDING", "template bytes, field map and receipt are not hash-bound");
  }
  if (sha256(filledBytes) !== receipt.source_document_sha256) {
    fail("E_TEMPLATE_RENDER_BINDING", "filled document bytes differ from the template-cell receipt");
  }
  const expectedFieldMap = await compileTemplateFieldMap(templatePath);
  const expectedReceipt = await extractTemplateCellReceipt(expectedFieldMap, filledPath, {
    ownerFieldMap: expectedFieldMap,
    templateSourcePath: templatePath,
  });
  if (expectedFieldMap.field_map_sha256 !== fieldMap.field_map_sha256 || expectedReceipt.receipt_sha256 !== receipt.receipt_sha256) {
    fail("E_TEMPLATE_RENDER_BINDING", "template field map or filled-template receipt cannot be regenerated from the frozen DOCX pair");
  }

  const zip = await JSZip.loadAsync(filledBytes);
  const documentPart = zip.file("word/document.xml");
  if (!documentPart) fail("E_TEMPLATE_RENDER_DOCX", "filled document has no word/document.xml");
  let documentXml = await documentPart.async("string");
  const conclusion = receipt.entries.find((entry) => entry.canonical_field_id === "CONCLUSION");
  if (!conclusion || conclusion.owner.kind !== "paragraph") fail("E_TEMPLATE_RENDER_OWNER", "CONCLUSION owner is missing from the complete receipt");
  documentXml = replaceOutsideParagraph(
    documentXml,
    conclusion.owner.paragraph,
    buildProposalConclusion(reasoning),
  );
  if (!documentXml.includes("<w:body>")) fail("E_TEMPLATE_RENDER_DOCX", "word/document.xml has no body");
  const sectionIndex = documentXml.lastIndexOf("<w:sectPr");
  if (sectionIndex < 0) fail("E_TEMPLATE_RENDER_DOCX", "word/document.xml has no final section properties");
  documentXml = `${documentXml.slice(0, sectionIndex)}${draftAddendumXml(draft)}${documentXml.slice(sectionIndex)}`;
  documentXml = await addReviewHeader(zip, documentXml);
  const text = completeTemplateText(documentXml, receipt);
  if (!text.includes("REVIEW ONLY — NON-CITABLE — NOT FD APPROVED") || !text.includes("ĐỀ XUẤT KỸ THUẬT — CHƯA ĐƯỢC FD DUYỆT")) {
    fail("E_TEMPLATE_RENDER_WATERMARK", "required review and proposal watermarks are missing");
  }

  zip.file("word/document.xml", documentXml);
  const raw = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const deterministic = await determinizeDocx(raw);
  const resolvedOutputRoot = resolve(outputRoot);
  if (!isAbsolute(resolvedOutputRoot) || lstatSync(resolvedOutputRoot).isSymbolicLink() || !lstatSync(resolvedOutputRoot).isDirectory()) {
    fail("E_TEMPLATE_RENDER_PATH", "output root must be an existing real directory");
  }
  const outputPath = join(resolvedOutputRoot, outputName);
  writeFileSync(outputPath, deterministic, { flag: "wx" });
  return { outputPath, output_sha256: sha256(deterministic), template_sha256: fieldMap.template_sha256, template_cell_receipt_sha256: receipt.receipt_sha256 };
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await renderTemplateBoundReview({
      draftPath: options.draft,
      fieldMapPath: options.field_map,
      receiptPath: options.receipt,
      outputRoot: options.output_root,
    });
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(`${error?.code ?? "E_TEMPLATE_RENDER"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
