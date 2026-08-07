import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import JSZip from "jszip";

const FORMULA_IDS = ["formula-01", "formula-02", "formula-03"];
const FORMULA_HEADERS = ["Công thức 01", "Công thức 02", "Công thức 03"];
const SOURCE_FILE = "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx";
const receiptSchema = JSON.parse(readFileSync(new URL("./contracts/formula-cell-receipt.schema.v1.json", import.meta.url), "utf8"));
const SYMBOL_TEXT = new Map([["Symbol:F02D", "–"]]);

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function assertReceiptSchemaContract() {
  if (receiptSchema.$id !== "formula-cell-receipt.schema.v1" || receiptSchema.properties?.source_file?.const !== SOURCE_FILE
    || receiptSchema.properties?.record_binding?.properties?.status?.const !== "exact") {
    fail("E_RECEIPT_SCHEMA", "formula-cell receipt schema does not match the bound-receipt contract");
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function decodeXml(value) {
  return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

function cellText(xml) {
  const tokens = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:sym\s+([^>]*?)\/>/g;
  return [...xml.matchAll(tokens)].map((match) => {
    if (match[1] !== undefined) return decodeXml(match[1]);
    const font = match[2].match(/w:font="([^"]+)"/)?.[1];
    const char = match[2].match(/w:char="([^"]+)"/)?.[1];
    const decoded = SYMBOL_TEXT.get(`${font}:${char}`);
    if (!decoded) fail("E_OOXML_SYMBOL", `unsupported OOXML symbol ${font ?? "unknown"}:${char ?? "unknown"}`);
    return decoded;
  }).join("").replace(/\s+/g, " ").trim();
}

function gridSpan(xml) { return Number(xml.match(/<w:gridSpan\s+w:val="(\d+)"\s*\/>/)?.[1] ?? 1); }
function verticalMerge(xml) { const value = xml.match(/<w:vMerge(?:\s+w:val="([^"]+)")?\s*\/>/)?.[1]; return value === undefined ? "none" : value === "restart" ? "restart" : "continue"; }
function normalizedText(value) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("Đ", "D").replaceAll("đ", "d").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim(); }

export function parseFormulaTables(documentXml) {
  const tableMatches = [...documentXml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)];
  if (tableMatches.length < 3) fail("E_FORMULA_TABLE", `expected at least three tables, found ${tableMatches.length}`);
  return tableMatches.map((tableMatch, tableIndex) => {
    const rows = [...tableMatch[0].matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map((rowMatch, rowIndex) => {
      let logicalColumn = 1;
      const cells = [...rowMatch[0].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((cellMatch, cellIndex) => {
        const xml = cellMatch[1]; const span = gridSpan(xml);
        const cell = { text: cellText(xml), raw_xml: xml, physical_cell: cellIndex + 1, logical_column_start: logicalColumn, logical_column_end: logicalColumn + span - 1, grid_span: span, vertical_merge: verticalMerge(xml) };
        logicalColumn += span; return cell;
      });
      return { row: rowIndex + 1, cells };
    });
    return { table: tableIndex + 1, rows, signature: sha256(canonicalJson(rows.map((row) => row.cells.map((cell) => cell.text)))) };
  });
}

function exactOne(items, code, message) {
  if (items.length !== 1) fail(code, `${message}; found ${items.length}`);
  return items[0];
}
function rowContains(row, needle) { return row.cells.some((cell) => normalizedText(cell.text).includes(needle)); }
function uniqueRow(table, needle) { return exactOne(table.rows.filter((row) => rowContains(row, needle)), "E_FORMULA_ROW", `table ${table.table} row ${needle} is not unique`); }
function boundedMetricRow(table, metricNeedle, submetric) {
  const metric = uniqueRow(table, metricNeedle); const start = table.rows.indexOf(metric);
  if (submetric === "tb") return metric;
  const nextMetric = table.rows.slice(start + 1).findIndex((row) => row.cells[1] && row.cells[1].text.trim());
  const end = nextMetric < 0 ? table.rows.length : start + 1 + nextMetric;
  return exactOne(table.rows.slice(start + 1, end).filter((row) => rowContains(row, submetric)), "E_FORMULA_ROW", `metric ${metricNeedle} submetric ${submetric} is not unique`);
}
function cellAt(row, logicalColumn) { return exactOne(row.cells.filter((cell) => cell.logical_column_start <= logicalColumn && cell.logical_column_end >= logicalColumn), "E_FORMULA_CELL", `row ${row.row} logical column ${logicalColumn} is ambiguous`); }
function numberValue(raw) { const match = raw.replaceAll(".", "").replace(",", ".").match(/-?\d+(?:\.\d+)?/); if (!match || !Number.isFinite(Number(match[0]))) fail("E_FORMULA_VALUE", `cell does not contain a finite number: ${raw}`); return Number(match[0]); }

export function deriveFormulaColumns(table, profile) {
  if (!table?.rows?.length || !["results", "composition"].includes(profile)) fail("E_FORMULA_HEADER", "table and supported header profile are required");
  const header = exactOne(table.rows.filter((row) => FORMULA_HEADERS.every((name) => row.cells.some((cell) => cell.text === name))), "E_FORMULA_HEADER", `table ${table.table} formula header row is not unique`);
  const headers = FORMULA_HEADERS.map((name) => exactOne(header.cells.filter((cell) => cell.text === name), "E_FORMULA_HEADER", `formula header ${name} is not unique`));
  if (headers.some((cell, index) => index && cell.logical_column_start <= headers[index - 1].logical_column_end)) fail("E_FORMULA_HEADER", "formula headers are not ordered");
  if (profile === "results") {
    if (headers.some((cell) => cell.grid_span !== 1)) fail("E_FORMULA_HEADER", "result formula headers must each own one logical column");
    return Object.fromEntries(FORMULA_IDS.map((id, index) => [id, { header: FORMULA_HEADERS[index], logical_column: headers[index].logical_column_start }]));
  }
  if (headers.some((cell) => cell.grid_span !== 2)) fail("E_FORMULA_HEADER", "composition formula headers must span exactly two leaves");
  const headerIndex = table.rows.indexOf(header);
  const leaves = table.rows[headerIndex + 1];
  if (!leaves || !headers.every((cell) => cellAt(leaves, cell.logical_column_start).text && cellAt(leaves, cell.logical_column_end).text)) fail("E_FORMULA_HEADER", "composition header must be followed by a complete leaf row");
  return Object.fromEntries(FORMULA_IDS.map((id, index) => {
    const parent = headers[index]; const childLeaves = leaves.cells.filter((cell) => cell.logical_column_start >= parent.logical_column_start && cell.logical_column_end <= parent.logical_column_end);
    if (childLeaves.length !== 2 || childLeaves.some((cell, childIndex) => cell.grid_span !== 1 || cell.logical_column_start !== parent.logical_column_start + childIndex || cell.logical_column_end !== parent.logical_column_start + childIndex)) fail("E_FORMULA_HEADER", `${FORMULA_HEADERS[index]} must have two width-one leaves that partition its span`);
    const percent = exactOne(childLeaves.filter((cell) => normalizedText(cell.text) === "ty le %"), "E_FORMULA_HEADER", `${FORMULA_HEADERS[index]} must have one Tỷ lệ (%) leaf`);
    return [id, { header: FORMULA_HEADERS[index], logical_column: percent.logical_column_start }];
  }));
}

function specificationText(metric, rawCellXml) {
  const text = cellText(rawCellXml); if (!text) fail("E_SPECIFICATION", `${metric} specification cell is empty`); return text;
}
function specProjection(metric, text) {
  const operator = text.match(/(≥|<=|≤|>=|<|=)/)?.[1];
  if (metric === "assay") {
    const range = text.match(/(\d+(?:[,.]\d+)?)\s*(?:–|—|-)\s*(\d+(?:[,.]\d+)?)\s*%/);
    if (!range) fail("E_SPECIFICATION", `assay range is missing or ambiguous: ${text}`);
    return { operator: "range-inclusive", lower: Number(range[1].replace(",", ".")), upper: Number(range[2].replace(",", ".")), unit: "percent" };
  }
  const threshold = text.match(/(≥|<=|≤|>=|<|=)\s*(\d+(?:[,.]\d+)?)\s*%?/);
  if (!operator || !threshold) fail("E_SPECIFICATION", `${metric} operator or threshold is missing: ${text}`);
  const operators = { "≥": ">=", ">=": ">=", "≤": "<=", "<=": "<=", "<": "<", "=": "=" };
  return { operator: operators[threshold[1]], threshold: Number(threshold[2].replace(",", ".")), unit: "percent" };
}

export function parseSourceSpecification(metric, rawCellXml) { return specProjection(metric, specificationText(metric, rawCellXml)); }
export function parseQuoteSpecification(metric, quote) {
  if (typeof quote !== "string" || !quote) fail("E_QUOTE_SPECIFICATION", `${metric} quote is empty`);
  const marker = metric === "content-uniformity-av" ? "cep" : metric === "dissolution" ? "hoa tan" : "bisoprolol";
  const normalized = normalizedText(quote); if (!normalized.includes(marker)) fail("E_QUOTE_SPECIFICATION", `${metric} marker is absent from quote`);
  return specProjection(metric, quote);
}

function owner(table, row, cell, formulaHeader, rowKey) { return { table_index: table.table, table_signature_sha256: table.signature, row: row.row, row_key: rowKey, formula_column_header: formulaHeader, physical_cell: cell.physical_cell, logical_column_start: cell.logical_column_start, logical_column_end: cell.logical_column_end, grid_span: cell.grid_span, vertical_merge: cell.vertical_merge }; }
function receipt({ id, formulaId, evidenceKind, table, row, cell, formulaHeader, rowKey, normalizedValue, sourceHashes }) {
  return { schema_version: "formula-cell-receipt/v1", receipt_id: id, formula_id: formulaId, evidence_kind: evidenceKind, source_file: SOURCE_FILE, source_document_sha256: sourceHashes.source_document_sha256, document_xml_sha256: sourceHashes.document_xml_sha256, owner: owner(table, row, cell, formulaHeader, rowKey), raw_cell_text: cell.text, raw_cell_sha256: sha256(cell.text), raw_cell_xml_sha256: sha256(cell.raw_xml), normalized_value: normalizedValue, normalized_value_sha256: sha256(canonicalJson(normalizedValue)), classification: { label: "public", citable: false }, record_binding: null };
}
function resultReceipts({ table, row, receiptKey, rowKey, columns, evidenceKind, sourceHashes }) { return FORMULA_IDS.map((formulaId) => { const column = columns[formulaId]; const cell = cellAt(row, column.logical_column); return receipt({ id: `${receiptKey}:${formulaId}`, formulaId, evidenceKind, table, row, cell, formulaHeader: column.header, rowKey, normalizedValue: { value: numberValue(cell.text), unit: "percent" }, sourceHashes }); }); }
function specificationReceipt({ id, metric, table, row, rowKey, sourceHashes }) { const cell = cellAt(row, 2); return receipt({ id, formulaId: null, evidenceKind: "specification", table, row, cell, formulaHeader: null, rowKey, normalizedValue: parseSourceSpecification(metric, cell.raw_xml), sourceHashes }); }

export function deriveQuoteFidelityReplacements(documentXml) {
  const tables = parseFormulaTables(documentXml); const results = exactOne(tables.filter((table) => table.rows.some((row) => rowContains(row, "do hoa tan")) && table.rows.some((row) => row.cells.some((cell) => cell.text === "Công thức 01"))), "E_FORMULA_TABLE", "results table is not unique");
  const dissolution = parseSourceSpecification("dissolution", cellAt(boundedMetricRow(results, "do hoa tan", "tb"), 2).raw_xml);
  const assay = parseSourceSpecification("assay", cellAt(uniqueRow(results, "dinh luong"), 2).raw_xml);
  if (dissolution.operator !== ">=" || dissolution.threshold !== 80 || assay.operator !== "range-inclusive" || assay.lower !== 90 || assay.upper !== 110) fail("E_SOURCE_FIDELITY", "source specification does not support the declared fidelity restoration");
  return [{ from: "=", to: "≥", context: "80%" }, { from: "90 - 110%", to: "90 – 110%" }];
}

export function locateFormulaOwnership(tables) {
  const composition = exactOne(tables.filter((table) => table.rows.some((row) => rowContains(row, "croscarmellose sodium"))), "E_FORMULA_TABLE", "composition table is not unique");
  const results = exactOne(tables.filter((table) => table.rows.some((row) => rowContains(row, "do hoa tan")) && table.rows.some((row) => rowContains(row, "dinh luong"))), "E_FORMULA_TABLE", "results table is not unique");
  const compositionColumns = deriveFormulaColumns(composition, "composition"); const resultColumns = deriveFormulaColumns(results, "results");
  return { composition, results, compositionColumns, resultColumns, croscarmellose: uniqueRow(composition, "croscarmellose sodium"), assay: uniqueRow(results, "dinh luong"), dissolutionMean: boundedMetricRow(results, "do hoa tan", "tb"), dissolutionMax: boundedMetricRow(results, "do hoa tan", "max"), dissolutionMin: boundedMetricRow(results, "do hoa tan", "min"), contentUniformity: uniqueRow(results, "do dong deu ham luong theo yeu cau") };
}

export async function extractFormulaCellReceipts({ sourcePath, sourceHashes }) {
  const zip = await JSZip.loadAsync(readFileSync(sourcePath)); const document = zip.file("word/document.xml"); if (!document) fail("E_DOCUMENT_XML", "source DOCX has no word/document.xml");
  const documentXml = await document.async("string"); if (sha256(documentXml) !== sourceHashes.document_xml_sha256) fail("E_DOCUMENT_HASH", "document.xml changed after source verification");
  const tables = parseFormulaTables(documentXml);
  const { composition, results, compositionColumns, resultColumns, croscarmellose, assay, dissolutionMean, dissolutionMax, dissolutionMin, contentUniformity } = locateFormulaOwnership(tables);
  const receipts = [
    ...resultReceipts({ table: composition, row: croscarmellose, receiptKey: "croscarmellose-sodium", rowKey: "croscarmellose-sodium", columns: compositionColumns, evidenceKind: "composition_context", sourceHashes }),
    ...resultReceipts({ table: results, row: assay, receiptKey: "assay", rowKey: "assay", columns: resultColumns, evidenceKind: "observed_result", sourceHashes }),
    ...resultReceipts({ table: results, row: dissolutionMean, receiptKey: "dissolution-mean", rowKey: "dissolution-mean", columns: resultColumns, evidenceKind: "observed_result", sourceHashes }),
    ...resultReceipts({ table: results, row: dissolutionMax, receiptKey: "dissolution-max", rowKey: "dissolution-max", columns: resultColumns, evidenceKind: "observed_result", sourceHashes }),
    ...resultReceipts({ table: results, row: dissolutionMin, receiptKey: "dissolution-min", rowKey: "dissolution-min", columns: resultColumns, evidenceKind: "observed_result", sourceHashes }),
    ...resultReceipts({ table: results, row: contentUniformity, receiptKey: "content-uniformity-av", rowKey: "content-uniformity-av", columns: resultColumns, evidenceKind: "observed_result", sourceHashes }),
    specificationReceipt({ id: "specification:dissolution", metric: "dissolution", table: results, row: dissolutionMean, rowKey: "dissolution-specification", sourceHashes }),
    specificationReceipt({ id: "specification:assay", metric: "assay", table: results, row: assay, rowKey: "assay-specification", sourceHashes }),
    specificationReceipt({ id: "specification:content-uniformity-av", metric: "content-uniformity-av", table: results, row: contentUniformity, rowKey: "content-uniformity-specification", sourceHashes }),
  ];
  return { receipts, documentXml };
}

function recordAnchors(receipt) { if (receipt.receipt_id.startsWith("croscarmellose-sodium:")) return ["croscarmellose", "primellose"]; if (receipt.receipt_id.startsWith("assay:") || receipt.receipt_id === "specification:assay") return ["bisoprolol", "90", "110"]; if (receipt.receipt_id.startsWith("dissolution-") || receipt.receipt_id === "specification:dissolution") return ["hoa tan", "80", "bisoprolol"]; if (receipt.receipt_id.startsWith("content-uniformity-av:") || receipt.receipt_id === "specification:content-uniformity-av") return ["cep", "15"]; fail("E_RECEIPT_ANCHOR", `no metric anchors defined for ${receipt.receipt_id}`); }
function assertReceiptIntegrity(receipt) {
  assertReceiptSchemaContract();
  if (receipt.schema_version !== "formula-cell-receipt/v1" || typeof receipt.receipt_id !== "string" || !receipt.receipt_id || !["observed_result", "composition_context", "specification"].includes(receipt.evidence_kind) || (receipt.formula_id !== null && !FORMULA_IDS.includes(receipt.formula_id)) || receipt.source_file !== SOURCE_FILE || !/^[a-f0-9]{64}$/.test(receipt.source_document_sha256) || !/^[a-f0-9]{64}$/.test(receipt.document_xml_sha256) || receipt.classification?.label !== "public" || receipt.classification?.citable !== false) fail("E_RECEIPT_SOURCE", `${receipt.receipt_id} is not bound to the frozen source`);
  if (sha256(receipt.raw_cell_text) !== receipt.raw_cell_sha256 || !/^[a-f0-9]{64}$/.test(receipt.raw_cell_xml_sha256)) fail("E_RECEIPT_RAW_HASH", `${receipt.receipt_id} raw cell hashes drifted`);
  if (sha256(canonicalJson(receipt.normalized_value)) !== receipt.normalized_value_sha256) fail("E_RECEIPT_NORMALIZED_HASH", `${receipt.receipt_id} normalized-value hash drifted`);
  const owner = receipt.owner; if (!owner?.table_signature_sha256 || !/^[a-f0-9]{64}$/.test(owner.table_signature_sha256) || typeof owner.row_key !== "string" || !owner.row_key || !(owner.formula_column_header === null || typeof owner.formula_column_header === "string") || !Number.isInteger(owner.table_index) || owner.table_index < 1 || !Number.isInteger(owner.row) || owner.row < 1 || !Number.isInteger(owner.physical_cell) || owner.physical_cell < 1 || !Number.isInteger(owner.logical_column_start) || owner.logical_column_start < 1 || !Number.isInteger(owner.logical_column_end) || owner.logical_column_end < owner.logical_column_start || !Number.isInteger(owner.grid_span) || owner.grid_span < 1 || !["none", "restart", "continue"].includes(owner.vertical_merge)) fail("E_RECEIPT_OWNER", `${receipt.receipt_id} has invalid table-cell ownership`);
}
function assertBoundReceipt(receipt) { const binding = receipt.record_binding; if (!binding || binding.status !== "exact" || !binding.record_id || binding.source_document_sha256 !== receipt.source_document_sha256 || binding.raw_cell_sha256 !== receipt.raw_cell_sha256 || binding.quote_sha256 !== sha256(binding.quote) || !Number.isInteger(binding.page) || binding.page < 1 || !Number.isInteger(binding.char_start) || !Number.isInteger(binding.char_end) || binding.char_start < 0 || binding.char_end <= binding.char_start || (receipt.evidence_kind === "specification" && binding.quote_projection_sha256 !== sha256(canonicalJson(receipt.normalized_value)))) fail("E_RECEIPT_BINDING", `${receipt.receipt_id} has an invalid exact record binding`); }
function recordMatches(receipt, records) { const requiredTokens = recordAnchors(receipt); return records.filter((record) => { if (record.provenance?.file !== SOURCE_FILE || record.classification?.label !== "public" || record.classification?.citable !== false || record.extraction_status !== "ok" || record.provenance?.quote !== record.content) return false; const content = normalizedText(record.content); if (!requiredTokens.every((token) => content.includes(token))) return false; if (receipt.evidence_kind !== "specification") return record.content.includes(receipt.raw_cell_text); try { return canonicalJson(parseQuoteSpecification(receipt.receipt_id.replace("specification:", ""), record.provenance.quote)) === canonicalJson(receipt.normalized_value); } catch { return false; } }); }
export function reconcileFormulaReceipts({ receipts, records, storeRecordsSha256 }) {
  if (!Array.isArray(receipts) || !Array.isArray(records)) fail("E_RECEIPT_JOIN", "receipts and records arrays are required"); const storeBytes = Buffer.from(records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "")); if (sha256(storeBytes) !== storeRecordsSha256) fail("E_RECEIPT_STORE_HASH", "receipt join records do not match the supplied canonical store hash");
  return receipts.map((entry) => { assertReceiptIntegrity(entry); const matches = recordMatches(entry, records); if (matches.length !== 1) { if (entry.evidence_kind === "specification" && matches.length === 0) fail("E_RECEIPT_SPECIFICATION_PROJECTION", `${entry.receipt_id} has no quote with an equal specification projection`); fail("E_RECEIPT_JOIN_CARDINALITY", `${entry.receipt_id} matched ${matches.length} admitted records`); } const [record] = matches; const quoteProjection = entry.evidence_kind === "specification" ? parseQuoteSpecification(entry.receipt_id.replace("specification:", ""), record.provenance.quote) : null; const boundReceipt = { ...entry, record_binding: { status: "exact", match_basis: entry.evidence_kind === "specification" ? "semantic-specification" : "raw-cell-text", record_id: record.id, store_records_sha256: storeRecordsSha256, source_document_sha256: entry.source_document_sha256, raw_cell_sha256: entry.raw_cell_sha256, page: record.provenance.page, quote: record.provenance.quote, quote_sha256: sha256(record.provenance.quote), quote_projection_sha256: quoteProjection ? sha256(canonicalJson(quoteProjection)) : null, char_start: record.provenance.char_start, char_end: record.provenance.char_end } }; assertBoundReceipt(boundReceipt); return boundReceipt; });
}
export function buildFormulaEvidenceMatrix(receipts) { const formulas = Object.fromEntries(FORMULA_IDS.map((formulaId) => [formulaId, {}])); const specifications = {}; for (const entry of receipts) { if (entry.formula_id) formulas[entry.formula_id][entry.receipt_id.replace(/:[^:]+$/, "").replaceAll("-", "_")] = entry.normalized_value.value; else specifications[entry.receipt_id.replace("specification:", "").replaceAll("-", "_")] = entry.normalized_value; } return { schema_version: "formula-evidence-matrix/v1", formula_ids: FORMULA_IDS, formulas, specifications }; }
