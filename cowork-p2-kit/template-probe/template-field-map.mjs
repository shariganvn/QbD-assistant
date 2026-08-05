#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import {
  assertGrammar,
  assertFieldMap,
  assertMetadataCatalog,
  assertTemplateBinding,
  canonicalJson,
  deriveOccurrenceId,
  loadTemplateContracts,
  sha256,
  writeCanonicalJsonAtomic,
} from "./template-field-contract.mjs";

const TOKEN_PATTERN = /^[A-Z][A-Z0-9%-]*$/;

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function blocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<w:${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/w:${tag}>`, "g"))]
    .map((match) => match[1]);
}

function xmlAttribute(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1] ?? null;
}

function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function visibleText(xml) {
  const withBreaks = xml
    .replace(/<w:tab\s*\/?\s*>/g, "\t")
    .replace(/<w:(?:br|cr)(?:\s[^>]*)?\s*\/?\s*>/g, "\n");
  return [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
}

function parseGridSpan(properties) {
  const gridSpan = properties.match(/<w:gridSpan(?:\s[^>]*)?\/?\s*>/);
  const span = Number(xmlAttribute(gridSpan?.[0] ?? "", "w:val") ?? 1);
  if (!Number.isInteger(span) || span < 1) fail("E_MALFORMED_OWNER", `invalid grid span ${span}`);
  return span;
}

function parseVerticalMerge(properties) {
  const merge = properties.match(/<w:vMerge(?:\s[^>]*)?\/?\s*>/);
  if (!merge) return "none";
  return xmlAttribute(merge[0], "w:val") ?? "continue";
}

function parsePlaceholderText(text, location) {
  const occurrences = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("<", cursor);
    if (open < 0) break;
    if (text[open + 1] === "<" || text[open - 1] === ">") {
      fail("E_MALFORMED_TOKEN", `${location} contains nested placeholder delimiters`);
    }
    // The frozen template contains literal comparison labels such as "< 75 µm".
    // Only an uppercase semantic ID can begin a placeholder; preserve other
    // angle-bracket text as source-rendered label content.
    if (!/^[A-Z]/.test(text[open + 1] ?? "")) {
      cursor = open + 1;
      continue;
    }
    const close = text.indexOf(">", open + 1);
    if (close < 0) fail("E_MALFORMED_TOKEN", `${location} contains an unterminated placeholder`);
    const nestedOpen = text.indexOf("<", open + 1);
    if (nestedOpen >= 0 && nestedOpen < close) fail("E_MALFORMED_TOKEN", `${location} contains nested placeholder delimiters`);
    const sourceToken = text.slice(open + 1, close);
    if (!TOKEN_PATTERN.test(sourceToken)) fail("E_MALFORMED_TOKEN", `${location} contains malformed placeholder ${text.slice(open, close + 1)}`);
    if (text[close + 1] === ">") fail("E_MALFORMED_TOKEN", `${location} contains an extra placeholder delimiter`);
    occurrences.push({ sourceToken, rawSourceToken: text.slice(open, close + 1) });
    cursor = close + 1;
  }
  return occurrences;
}

function extractLogicalOwners(documentXml) {
  const owners = [];
  const tables = blocks(documentXml, "tbl");
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const activeMerges = new Map();
    const rows = blocks(tables[tableIndex], "tr");
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      let logicalColumn = 1;
      let physicalCell = 0;
      for (const cellXml of blocks(rows[rowIndex], "tc")) {
        physicalCell += 1;
        const properties = cellXml.match(/<w:tcPr(?:\s[^>]*)?>([\s\S]*?)<\/w:tcPr>/)?.[1] ?? "";
        const gridSpan = parseGridSpan(properties);
        const verticalState = parseVerticalMerge(properties);
        const mergeGroups = [...Array(gridSpan).keys()].map((offset) => activeMerges.get(logicalColumn + offset));
        let verticalGroupId = null;
        if (verticalState === "restart") {
          verticalGroupId = `VM-T${String(tableIndex + 1).padStart(2, "0")}-R${String(rowIndex + 1).padStart(2, "0")}-C${String(physicalCell).padStart(2, "0")}`;
          for (let offset = 0; offset < gridSpan; offset += 1) activeMerges.set(logicalColumn + offset, verticalGroupId);
        } else if (verticalState === "continue") {
          if (mergeGroups.some((group) => !group) || new Set(mergeGroups).size !== 1) {
            fail("E_MERGED_CONTINUATION", `table ${tableIndex + 1}, row ${rowIndex + 1}, cell ${physicalCell} has an unresolved merged continuation`);
          }
          verticalGroupId = mergeGroups[0];
        } else {
          for (let offset = 0; offset < gridSpan; offset += 1) activeMerges.delete(logicalColumn + offset);
        }

        const owner = {
          kind: "cell",
          table: tableIndex + 1,
          row: rowIndex + 1,
          physical_cell: physicalCell,
          logical_column_start: logicalColumn,
          logical_column_end: logicalColumn + gridSpan - 1,
          grid_span: gridSpan,
          vertical_merge: { state: verticalState, group_id: verticalGroupId },
        };
        const text = visibleText(cellXml);
        const tokens = parsePlaceholderText(text, `table ${tableIndex + 1}, row ${rowIndex + 1}, cell ${physicalCell}`);
        if (verticalState === "continue" && tokens.length > 0) {
          fail("E_MERGED_CONTINUATION", `table ${tableIndex + 1}, row ${rowIndex + 1}, cell ${physicalCell} contains a placeholder in a merged continuation`);
        }
        for (const token of tokens) owners.push({ owner, text, ...token });
        logicalColumn += gridSpan;
      }
    }
  }

  const outsideTables = documentXml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
  const paragraphs = blocks(outsideTables, "p");
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const text = visibleText(paragraphs[paragraphIndex]);
    const tokens = parsePlaceholderText(text, `paragraph ${paragraphIndex + 1}`);
    const owner = { kind: "paragraph", paragraph: paragraphIndex + 1 };
    for (const token of tokens) owners.push({ owner, text, ...token });
  }
  return owners;
}

function validateOwnerPolicy(owner, sourceToken, grammar) {
  const paragraphException = grammar.owner_policy?.paragraph_exceptions?.[sourceToken];
  if (owner.kind === "paragraph" && !paragraphException) {
    fail("E_UNAPPROVED_OWNER", `${sourceToken} is not approved for paragraph ownership`);
  }
  if (owner.kind === "cell" && paragraphException) {
    fail("E_UNAPPROVED_OWNER", `${sourceToken} is approved only for paragraph ownership`);
  }
}

function validateMultiplicity(owners, grammar) {
  const declared = new Set(grammar.declared_anchor_ids);
  const counts = new Map();
  for (const occurrence of owners) {
    if (!declared.has(occurrence.sourceToken)) fail("E_UNKNOWN_TOKEN", `template contains undeclared placeholder ${occurrence.sourceToken}`);
    counts.set(occurrence.sourceToken, (counts.get(occurrence.sourceToken) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicates.length) fail("E_DUPLICATE_TOKEN", `template contains duplicate placeholders: ${duplicates.join(", ")}`);
  const missing = [...declared].filter((id) => !counts.has(id));
  if (missing.length) fail("E_MISSING_TOKEN", `template is missing placeholders: ${missing.join(", ")}`);
}

async function readDocumentXml(sourceBytes, sourcePath) {
  let zip;
  try {
    zip = await JSZip.loadAsync(sourceBytes);
  } catch (error) {
    fail("E_TEMPLATE_READ", `cannot open DOCX ${sourcePath}: ${error.message}`);
  }
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) fail("E_TEMPLATE_READ", `DOCX has no word/document.xml: ${sourcePath}`);
  return documentFile.async("string");
}

export async function compileTemplateFieldMap(sourcePath, options = {}) {
  const resolvedSource = resolve(sourcePath);
  const sourceBytes = readFileSync(resolvedSource);
  const sourceSha256 = sha256(sourceBytes);
  const { manifest, grammar, metadata } = loadTemplateContracts(options);
  assertGrammar(grammar);
  assertMetadataCatalog(metadata, grammar, manifest);
  const documentXml = await readDocumentXml(sourceBytes, resolvedSource);
  assertTemplateBinding(manifest, grammar, metadata, sourceSha256, sha256(documentXml));

  const owners = extractLogicalOwners(documentXml);
  validateMultiplicity(owners, grammar);
  const metadataBySource = new Map(metadata.entries.map((entry) => [entry.source_token, entry]));
  const entries = owners.map(({ owner, rawSourceToken, sourceToken }) => {
    validateOwnerPolicy(owner, sourceToken, grammar);
    const metadataEntry = metadataBySource.get(sourceToken);
    if (!metadataEntry) fail("E_METADATA_MISSING", `metadata is missing ${sourceToken}`);
    return {
      raw_source_token: rawSourceToken,
      canonical_field_id: metadataEntry.canonical_field_id,
      occurrence_id: deriveOccurrenceId(sourceSha256, rawSourceToken, owner),
      template_version: manifest.template_version,
      template_sha256: sourceSha256,
      metadata: {
        type: metadataEntry.type,
        unit: metadataEntry.unit,
        scope: metadataEntry.scope,
        required: metadataEntry.required,
      },
      owner,
    };
  });
  entries.sort((left, right) => left.occurrence_id < right.occurrence_id ? -1 : left.occurrence_id > right.occurrence_id ? 1 : 0);

  const fieldMap = {
    schema_version: "template-field-map/v1",
    template_version: manifest.template_version,
    template_sha256: sourceSha256,
    metadata_catalog_version: metadata.schema_version,
    metadata_catalog_sha256: sha256(canonicalJson(metadata)),
    grammar_schema_version: grammar.schema_version,
    occurrence_count: entries.length,
    entries,
    field_map_sha256: null,
  };
  fieldMap.field_map_sha256 = sha256(canonicalJson(fieldMap));
  assertFieldMap(fieldMap, metadata);

  if (options.outputPath) {
    writeCanonicalJsonAtomic(fieldMap, options.outputPath, "E_MAP_WRITE");
  }
  return fieldMap;
}

function parseArgs(argv) {
  if (argv.length !== 4 || argv[0] !== "--source" || argv[2] !== "--output") {
    throw new Error("Usage: template-field-map.mjs --source <template.docx> --output <template-field-map.v1.json>");
  }
  return { source: argv[1], output: argv[3] };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { source, output } = parseArgs(process.argv.slice(2));
  compileTemplateFieldMap(source, { outputPath: output })
    .then((fieldMap) => console.log(`Wrote deterministic template field map: ${basename(output)} (${fieldMap.occurrence_count} occurrences)`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
