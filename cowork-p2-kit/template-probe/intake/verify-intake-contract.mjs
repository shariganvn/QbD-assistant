#!/usr/bin/env node

/** Read-only verifier for the frozen placeholder-template intake contract. */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const intakeDir = dirname(fileURLToPath(import.meta.url));
const kitDir = resolve(intakeDir, "../..");
const manifest = readJson("template-freeze-manifest.v1.json");
const grammar = readJson("field-grammar.v1.json");
const coverage = readJson("fixture-coverage.v1.json");
const TOKEN_PATTERN = new RegExp(grammar.visible_token.semantic_id_pattern);

function readJson(name) {
  return JSON.parse(readFileSync(resolve(intakeDir, name), "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function count(xml, pattern) {
  return [...xml.matchAll(pattern)].length;
}

function decodeXml(value) {
  return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function textRuns(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(([, text]) => decodeXml(text));
}

function visibleText(xml) {
  let text = "";
  for (const match of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:tab|br|cr)(?:\s[^>]*)?\/?>(?:<\/w:(?:tab|br|cr)>)?/g)) {
    text += match[1] === undefined ? "\u0000" : decodeXml(match[1]);
  }
  return text;
}

function tokensFrom(text) {
  return [...text.matchAll(/<([^<>\r\n]+)>/g)].map(([, token]) => token);
}

function assertInputPath(relativePath) {
  assert.match(relativePath, /^inputs\/(reference|trials)\/.+\.docx$/, `unsupported intake path: ${relativePath}`);
  assert.equal(relativePath.includes(".."), false, `intake path escapes kit: ${relativePath}`);
}

function inventoryCell(cellXml, table, row, cell) {
  const runs = textRuns(cellXml);
  const text = visibleText(cellXml);
  const verticalMerge = cellXml.match(/<w:vMerge(?:\s[^>]*)?\/?>(?:<\/w:vMerge>)?/);
  const mergedVertical = verticalMerge ? (/w:val=["']restart["']/.test(verticalMerge[0]) ? "restart" : "continue") : null;
  const mergedGrid = /<w:gridSpan(?:\s[^>]*)?\/?>(?:<\/w:gridSpan>)?/.test(cellXml);
  return tokensFrom(text).map((token) => ({
    token,
    kind: "cell",
    owner: `table=${table},row=${row},cell=${cell}`,
    splitAcrossRuns: !runs.some((run) => run.includes(`<${token}>`)),
    verticalMerge: mergedVertical,
    mergedGrid,
  }));
}

function inventoryTemplate(xml) {
  const entries = [];
  let tableIndex = 0;
  for (const [, tableXml] of xml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)) {
    tableIndex += 1;
    let rowIndex = 0;
    for (const [, rowXml] of tableXml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)) {
      rowIndex += 1;
      let cellIndex = 0;
      for (const [, cellXml] of rowXml.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)) {
        cellIndex += 1;
        entries.push(...inventoryCell(cellXml, tableIndex, rowIndex, cellIndex));
      }
    }
  }

  const outsideTables = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
  let paragraphIndex = 0;
  for (const [, paragraphXml] of outsideTables.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    paragraphIndex += 1;
    const runs = textRuns(paragraphXml);
    for (const token of tokensFrom(visibleText(paragraphXml))) {
      entries.push({
        token,
        kind: "paragraph",
        owner: `paragraph=${paragraphIndex}`,
        splitAcrossRuns: !runs.some((run) => run.includes(`<${token}>`)),
        verticalMerge: null,
        mergedGrid: false,
      });
    }
  }
  return entries;
}

async function readDocx(relativePath) {
  assertInputPath(relativePath);
  const bytes = readFileSync(resolve(kitDir, relativePath));
  const zip = await JSZip.loadAsync(bytes);
  const document = zip.file("word/document.xml");
  assert.ok(document, `word/document.xml missing from ${relativePath}`);
  return { bytes, xml: await document.async("string") };
}

function assertFrozenFile(name, file, expected) {
  assert.equal(sha256(file.bytes), expected.sha256, `${name} SHA-256 changed`);
  assert.equal(sha256(file.xml), expected.document_xml_sha256, `${name} document.xml SHA-256 changed`);
}

function assertStructure(xml, expected) {
  assert.equal(count(xml, /<w:tbl(?:\s|>)/g), expected.table_count, "table count changed");
  assert.equal(count(xml, /<w:tr(?:\s|>)/g), expected.table_row_count, "table-row count changed");
  assert.equal(count(xml, /<w:tc(?:\s|>)/g), expected.cell_count, "cell count changed");
  assert.equal(count(xml, /<w:gridSpan(?:\s|>)/g), expected.grid_span_count, "grid-span count changed");
  assert.equal(count(xml, /<w:vMerge(?:\s|>)/g), expected.vertical_merge_count, "vertical-merge count changed");
}

function assertContract(entries) {
  const actualIds = entries.map(({ token }) => token).sort();
  const declaredIds = [...grammar.declared_anchor_ids].sort();
  assert.equal(new Set(actualIds).size, actualIds.length, "duplicate visible anchor owner");
  assert.deepEqual(actualIds, declaredIds, "visible anchor inventory changed or contains an unknown token");
  for (const entry of entries) assert.match(entry.token, TOKEN_PATTERN, `invalid token grammar: ${entry.token}`);

  const expectedParagraphs = Object.keys(grammar.owner_policy.paragraph_exceptions).sort();
  const actualParagraphs = entries.filter(({ kind }) => kind === "paragraph").map(({ token }) => token).sort();
  assert.deepEqual(actualParagraphs, expectedParagraphs, "unapproved paragraph owner");
  for (const entry of entries) assert.notEqual(entry.verticalMerge, "continue", `anchor cannot own a merged-cell continuation: ${entry.token}`);
  assert.equal(entries.filter(({ kind }) => kind === "cell").length, coverage.expected_anchor_census.cell_anchors, "cell anchor census changed");
  assert.equal(new Set(entries.filter(({ kind }) => kind === "cell").map(({ owner }) => owner)).size,
    coverage.expected_anchor_census.cell_owner_locations, "cell owner-location census changed");
  assert.equal(entries.length, coverage.expected_anchor_census.total, "anchor census changed");

  const canonicalOwners = entries.map(({ kind, owner, token }) => `${kind}\t${owner}\t${token}`).sort().join("\n") + "\n";
  assert.equal(sha256(canonicalOwners), manifest.structural_fingerprint.owner_inventory_sha256, "owner inventory fingerprint changed");
  const sourceAlias = grammar.canonical_id_aliases["EXPERIMENT-DISCRIPTION"];
  assert.equal(sourceAlias, "EXPERIMENT-DESCRIPTION", "experiment-description canonical spelling changed");
  assert.ok(actualIds.includes("EXPERIMENT-DISCRIPTION"), "source experiment-description anchor missing");
  assert.match(sourceAlias, TOKEN_PATTERN, "experiment-description canonical spelling violates token grammar");
  const conclusion = grammar.owner_policy.paragraph_exceptions.CONCLUSION;
  assert.equal(conclusion.role, "reference_only", "CONCLUSION role changed");
  assert.equal(conclusion.write_allowed, false, "CONCLUSION must not be written");
  assert.equal(conclusion.derivation_allowed, false, "CONCLUSION must not be derived");
}

function assertCoverage(entries) {
  const byToken = new Map(entries.map((entry) => [entry.token, entry]));
  assert.equal(byToken.get("PDS-180-CT02")?.splitAcrossRuns, true, "split-run fixture no longer crosses XML runs");
  assert.equal(byToken.get("UOM-SPEC")?.verticalMerge, "restart", "merged-cell fixture lost restart ownership");
  for (const token of coverage.expected_anchor_census.paragraph_anchors) {
    assert.equal(byToken.get(token)?.kind, "paragraph", `paragraph fixture changed: ${token}`);
  }
}

function assertFrozenBoundary() {
  assert.equal(manifest.schema_version, "template-freeze-manifest/v1", "freeze-manifest schema changed");
  assert.equal(manifest.template_version, "po-fd-like-placeholder-template-v1-040826", "template version changed");
  assert.equal(manifest.scope, "mvp-isolated-workflow-probe", "intake scope changed");
  assert.equal(manifest.canonical_ingest_admission, false, "freeze manifest must stay isolated from canonical ingest");
  assert.deepEqual(manifest.authorization, {
    authority: "PO-supplied closest FD-like template for MVP",
    data_basis: "public/synthetic",
    confirmed_on: "2026-08-04",
  }, "authorization boundary changed");
  assert.deepEqual(manifest.classification, {
    label: "public",
    citable: false,
    ocr_language: "vie",
    non_citable_reason: "Isolated workflow-probe material; never dossier evidence.",
  }, "isolated classification changed");
  assert.deepEqual(manifest.template, {
    source_path: "inputs/reference/official-placeholder-template-v1-040826.docx",
    immutable: true,
    sha256: "a8002623e0808cc54c870ab2f47adab44498a6c2ce5b7c4b3bd21cd99973a01d",
    document_xml_sha256: "5ee079441d5db87b7964c6f876b67c55f7b2859714763f371d1109cfbbdc4095",
  }, "template source boundary changed");
  assert.deepEqual(manifest.public_mock, {
    source_path: "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx",
    immutable: true,
    sha256: "01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f",
    document_xml_sha256: "ebefbf16e4f7bcae2907d6655d72a3e374cc4b2b6f185380203403f61a2bdf8a",
  }, "public mock source boundary changed");
  const canonicalManifest = JSON.parse(readFileSync(resolve(kitDir, "inputs/classification-manifest.json"), "utf8"));
  assert.equal(Object.hasOwn(canonicalManifest, manifest.template.source_path), false, "template must not be admitted to canonical ingest");
  assert.equal(Object.hasOwn(canonicalManifest, manifest.public_mock.source_path), false, "public mock must not be admitted to canonical ingest");
  assert.equal(grammar.template_sha256, manifest.template.sha256, "field grammar template hash changed");
  assert.equal(coverage.template_sha256, manifest.template.sha256, "fixture coverage template hash changed");
  assert.equal(coverage.public_mock_sha256, manifest.public_mock.sha256, "fixture coverage public mock hash changed");
  assert.deepEqual(grammar.canonical_id_aliases, {
    "EXPERIMENT-DISCRIPTION": "EXPERIMENT-DESCRIPTION",
  }, "canonical alias boundary changed");
  assert.deepEqual(grammar.owner_policy.paragraph_exceptions, {
    "EXPERIMENT-DISCRIPTION": {
      canonical_id: "EXPERIMENT-DESCRIPTION",
      role: "supplied_data",
      required: true,
      write_allowed: false,
      derivation_allowed: false,
    },
    "BATCH-SIZE": {
      role: "supplied_data",
      required: true,
      write_allowed: false,
      derivation_allowed: false,
    },
    CONCLUSION: {
      role: "reference_only",
      required: false,
      write_allowed: false,
      derivation_allowed: false,
    },
  }, "paragraph-owner boundary changed");
}

async function main() {
  assertFrozenBoundary();

  const [template, mock] = await Promise.all([
    readDocx(manifest.template.source_path),
    readDocx(manifest.public_mock.source_path),
  ]);
  assertFrozenFile("template", template, manifest.template);
  assertFrozenFile("public mock", mock, manifest.public_mock);
  assertStructure(template.xml, manifest.structural_fingerprint);
  assertStructure(mock.xml, manifest.structural_fingerprint);
  const entries = inventoryTemplate(template.xml);
  assert.equal(inventoryTemplate(mock.xml).length, 0, "filled public mock still contains placeholder anchors");
  assertContract(entries);
  assertCoverage(entries);

  process.stdout.write(`${JSON.stringify({
    status: "ok",
    template_sha256: manifest.template.sha256,
    public_mock_sha256: manifest.public_mock.sha256,
    anchors: entries.length,
    cell_anchors: entries.filter(({ kind }) => kind === "cell").length,
    paragraph_anchors: entries.filter(({ kind }) => kind === "paragraph").map(({ token }) => token).sort(),
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`intake contract verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
