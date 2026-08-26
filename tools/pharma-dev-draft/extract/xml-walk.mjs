// Deterministic docx -> {paragraphs, tables} extraction by walking word/document.xml directly.
//
// This is the PRIMARY extraction path for this tool (not merely a fallback), despite the plan's
// original "prefer LiteParse" framing: trial reports handed to this tool are always native,
// text-based .docx files (never scanned/OCR input), and LiteParse's table reconstruction is a
// heuristic x/y-position clustering of a text-flow rendering — inherently less exact for numeric
// tables than reading the OOXML table structure (<w:tbl>/<w:tr>/<w:tc>) directly. Direct XML
// walking is also unconditionally available: LibreOffice/soffice-backed conversion is broken in
// this sandbox (confirmed via a trivial one-paragraph docx and even a plain .txt conversion both
// failing with "source file could not be loaded"), so this path cannot depend on soffice being
// reachable. See extract/liteparse-path.mjs for the optional alternate path (e.g. for scanned or
// non-docx input), kept separate and not used by default.

import { readFile } from "node:fs/promises";
import JSZip from "jszip";

export class XmlWalkError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "XmlWalkError";
    this.code = code;
  }
}

const ENTITY_MAP = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function unescapeXml(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (match, entity) => {
    if (entity in ENTITY_MAP) return ENTITY_MAP[entity];
    if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return match;
  });
}

function extractRunText(xmlFragment) {
  const texts = [];
  const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = textPattern.exec(xmlFragment)) !== null) {
    texts.push(unescapeXml(match[1]));
  }
  return texts.join("");
}

function parseTable(tableXml) {
  const rowPattern = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
  const cellPattern = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
  const rows = [];
  let rowMatch;
  while ((rowMatch = rowPattern.exec(tableXml)) !== null) {
    const rowXml = rowMatch[0];
    const cells = [];
    let cellMatch;
    cellPattern.lastIndex = 0;
    while ((cellMatch = cellPattern.exec(rowXml)) !== null) {
      cells.push(extractRunText(cellMatch[0]).trim());
    }
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const copy = row.slice(0, width);
    while (copy.length < width) copy.push("");
    return copy;
  });
  return { headers: padded[0], rows: padded.slice(1) };
}

// Top-level document-order walk: matches whole <w:tbl>...</w:tbl> or <w:p ...>...</w:p> blocks in
// sequence. Because global regex exec advances lastIndex past each full match, paragraphs nested
// inside a matched table's cells are never re-visited as top-level paragraphs. Nested tables and
// w:tab/w:br run breaks are not specially handled (acceptable simplification for trial-report
// style tables and prose paragraphs — no nested tables were observed in either reference file
// this tool was built against).
const TOP_LEVEL_PATTERN = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;

export function parseDocumentXml(xml) {
  const bodyMatch = /<w:body(?:\s[^>]*)?>([\s\S]*)<\/w:body>/.exec(xml);
  if (!bodyMatch) throw new XmlWalkError("E_NO_BODY", "word/document.xml has no <w:body> element");
  const body = bodyMatch[1];

  const paragraphs = [];
  const tables = [];
  let match;
  TOP_LEVEL_PATTERN.lastIndex = 0;
  while ((match = TOP_LEVEL_PATTERN.exec(body)) !== null) {
    const block = match[0];
    if (block.startsWith("<w:tbl")) {
      const table = parseTable(block);
      if (table) tables.push(table);
    } else {
      const text = extractRunText(block).trim();
      if (text) paragraphs.push(text);
    }
  }
  return { paragraphs, tables };
}

export async function extractViaXmlWalk(filePath) {
  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new XmlWalkError("E_INPUT_READ", `cannot read input file: ${filePath}`, { cause: error });
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (error) {
    throw new XmlWalkError("E_NOT_A_ZIP", `not a valid .docx (zip) file: ${filePath}`, { cause: error });
  }
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new XmlWalkError("E_NO_DOCUMENT_XML", `word/document.xml not found inside: ${filePath}`);
  }
  const xml = await documentXmlFile.async("string");
  return parseDocumentXml(xml);
}
