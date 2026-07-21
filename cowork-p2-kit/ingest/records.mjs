/** Deterministic record construction and round-trip checks. */

import { createHash } from "node:crypto";
import { join } from "node:path";
import { IngestError } from "./errors.mjs";
import { reconstructTable, splitIntoSegments } from "./table-reconstruction.mjs";

function deterministicId(file, page, charStart, quote) {
  return createHash("sha256").update(`${file}:${page}:${charStart}:${quote}`).digest("hex").slice(0, 16);
}

function record({ relPath, entry, page, charStart, charEnd, quote, content, table, confidence, extractionStatus }) {
  return {
    id: deterministicId(relPath, page.page, charStart, quote),
    source_type: table ? "table" : "text",
    content,
    table,
    provenance: {
      file: relPath,
      page: page.page,
      char_start: charStart,
      char_end: charEnd,
      quote,
      page_kind: "renderer-derived",
    },
    confidence,
    extraction_status: extractionStatus,
    classification: { label: entry.label, citable: entry.citable },
  };
}

function mergeCapability(current, outcome) {
  if (outcome?.status === "invalid") return { status: "invalid", code: "E_CAPABILITY_INVALID" };
  if (current.status === "invalid") return current;
  if (outcome?.status === "available") return { status: "available" };
  return current;
}

function addPageRecords(records, relPath, entry, page, complexByPage, capabilities) {
  const text = page.text || "";
  const complex = complexByPage.get(page.page);
  const reasons = complex?.reasons || [];
  const textLength = complex?.textLength ?? text.length;
  const ocrEligible = complex?.fullPageImage || complex?.isGarbled || reasons.some((reason) => !["sparse-text", "vector-text"].includes(reason));
  if (ocrEligible) capabilities.ocrEligible.push({ file: relPath, page: page.page });

  if (textLength < 50) {
    records.push(record({
      relPath, entry, page, charStart: 0, charEnd: 0, quote: "", content: text,
      table: null, confidence: "low", extractionStatus: "needs-ocr",
    }));
    return;
  }

  for (const segment of splitIntoSegments(text)) {
    const charStart = segment.offset;
    const charEnd = charStart + segment.text.length;
    const quote = text.slice(charStart, charEnd);
    if (quote !== segment.text) continue;
    records.push(record({
      relPath, entry, page, charStart, charEnd, quote, content: segment.text,
      table: reconstructTable(page.textItems || [], segment), confidence: "high", extractionStatus: "ok",
    }));
  }
}

/**
 * Build records from admitted files using the LiteParse adapter.
 * @param {{ filePath: string, relPath: string, entry: object }[]} admitted
 * @param {{ parse: Function, isComplex: Function }} adapter
 * @returns {{ records: object[], capabilities: object }}
 */
export function buildRecords(admitted, adapter) {
  const records = [];
  const capabilities = {
    isComplex: { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" },
    ocrEligible: [],
  };

  for (const { filePath, relPath, entry } of admitted) {
    let parsed;
    try {
      parsed = adapter.parse(filePath);
    } catch (err) {
      if (err instanceof IngestError) throw err;
      throw new IngestError("E_PARSE", `liteparse failed for ${relPath}: ${err.message}`, {
        cause: err,
        details: { path: relPath },
      });
    }
    if (!parsed.pages?.length) continue;

    let outcome;
    try {
      outcome = adapter.isComplex(filePath);
    } catch {
      outcome = { status: "invalid", code: "E_CAPABILITY_INVALID" };
    }
    capabilities.isComplex = mergeCapability(capabilities.isComplex, outcome);
    const complexByPage = new Map(outcome?.status === "available" ? outcome.results.map((item) => [item.pageNumber, item]) : []);
    for (const page of parsed.pages) addPageRecords(records, relPath, entry, page, complexByPage, capabilities);
  }

  records.sort((left, right) => left.provenance.file.localeCompare(right.provenance.file)
    || left.provenance.page - right.provenance.page
    || left.provenance.char_start - right.provenance.char_start);
  return { records, capabilities };
}

/** Verify quote offsets by parsing each source file once. */
export function verifyRoundTrips(records, adapter, config) {
  let verified = 0;
  let failed = 0;
  const cache = new Map();

  for (const rec of records) {
    if (rec.extraction_status === "needs-ocr" || !rec.provenance.quote) continue;
    try {
      if (!cache.has(rec.provenance.file)) {
        cache.set(rec.provenance.file, adapter.parse(join(config.kitDir, rec.provenance.file)));
      }
      const page = cache.get(rec.provenance.file).pages.find((item) => item.page === rec.provenance.page);
      const quote = page?.text.slice(rec.provenance.char_start, rec.provenance.char_end);
      if (quote === rec.provenance.quote) verified++;
      else {
        console.error(`[E_ROUND_TRIP] content mismatch at ${rec.provenance.file}:${rec.provenance.page}`);
        failed++;
      }
    } catch (err) {
      console.error(`[E_ROUND_TRIP] ${err?.code ?? "unknown"} for ${rec.provenance.file}:${rec.provenance.page} — ${err.message}`);
      failed++;
    }
  }
  return { verified, failed };
}
