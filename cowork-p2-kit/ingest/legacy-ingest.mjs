#!/usr/bin/env node

/**
 * ingest.mjs — Layer A: deterministic ingest via liteparse.
 *
 * Reads .docx files from inputs/trials/ and inputs/reference/,
 * extracts text with provenance, writes JSONL records to store/.
 *
 * Remediation patch 2026-07-16:
 * - Deterministic IDs (hash-based, not random)
 * - No ingested_at (run timing in non-contract log)
 * - Preflight rejects unsupported files before any write
 * - OCR detection only (not execution) — flags on textLength < 50
 * - Atomic publication (write temp → validate → replace)
 *
 * Usage: npm run ingest
 *   or:  node cowork-p2-kit/ingest/cli.mjs
 */

import { execSync } from "node:child_process";
import {
  readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync,
  renameSync, unlinkSync, copyFileSync,
} from "node:fs";
import { join, basename, resolve, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KIT_DIR = resolve(__dirname, "..");
const INPUTS_DIR = join(KIT_DIR, "inputs");
const TRIALS_DIR = join(INPUTS_DIR, "trials");
const REFERENCE_DIR = join(INPUTS_DIR, "reference");
const MANIFEST_PATH = join(INPUTS_DIR, "classification-manifest.json");
const STORE_DIR = join(KIT_DIR, "store");
const RECORDS_PATH = join(STORE_DIR, "records.jsonl");
const TEMP_RECORDS_PATH = join(STORE_DIR, "records.jsonl.tmp");
const LIT_BIN = resolve(KIT_DIR, "../node_modules/.bin/lit");

// Supported extensions (liteparse can read these)
const SUPPORTED_EXTENSIONS = new Set([".docx", ".pdf"]);

// Run log (non-contract, for timing + OCR eligibility)
const runLog = {
  started: new Date().toISOString(),
  litBinary: null,
  litVersion: null,
  files: [],
  ocrEligiblePages: [],
  errors: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  runLog.errors.push(msg);
  writeRunLog();
  process.exit(1);
}

function warn(msg) {
  console.error(`WARN: ${msg}`);
}

/**
 * Deterministic ID: hash of relative file path + page + char_start + quote.
 * Same inputs always produce the same ID.
 */
function deterministicId(file, page, charStart, quote) {
  const content = `${file}:${page}:${charStart}:${quote}`;
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function writeRunLog() {
  runLog.finished = new Date().toISOString();
  const logPath = join(STORE_DIR, "run-log.json");
  writeFileSync(logPath, JSON.stringify(runLog, null, 2));
}

// ─── Step 0: Verify system deps ────────────────────────────────────────

console.log("=== Admission Gate ===\n");

// Verify liteparse binary
if (!existsSync(LIT_BIN)) {
  fail(`Repo-local lit binary not found at ${LIT_BIN}`);
}
runLog.litBinary = LIT_BIN;
const litVersion = execSync(`"${LIT_BIN}" --version`, { encoding: "utf-8" }).trim();
runLog.litVersion = litVersion;
console.log(`  lit binary: ${LIT_BIN}`);
console.log(`  lit version: ${litVersion}`);

// Verify LibreOffice
const soffice = "/usr/bin/soffice";
if (!existsSync(soffice)) fail("LibreOffice not found at /usr/bin/soffice");
const sofficeVer = execSync("soffice --version 2>&1", { encoding: "utf-8" }).trim().split("\n")[0];
console.log(`  soffice: ${sofficeVer}`);

// Verify Ghostscript
const gs = "/usr/bin/gs";
if (!existsSync(gs)) fail("Ghostscript not found at /usr/bin/gs");
const gsVer = execSync("gs --version 2>&1", { encoding: "utf-8" }).trim();
console.log(`  gs: ${gsVer}`);

// Verify tessdata (required field, even though OCR is deferred)
const tessdataPrefix = "/usr/share/tesseract-ocr/5/tessdata";
for (const lang of ["eng", "vie"]) {
  if (!existsSync(join(tessdataPrefix, `${lang}.traineddata`))) {
    fail(`Tessdata missing: ${lang}.traineddata at ${tessdataPrefix}`);
  }
}
console.log(`  tessdata: ${tessdataPrefix} (eng + vie OK)`);

// ─── Step 1: Load classification manifest ──────────────────────────────

console.log("\n=== Classification Manifest ===\n");

if (!existsSync(MANIFEST_PATH)) {
  fail(`Classification manifest not found: ${MANIFEST_PATH}`);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
console.log(`  Loaded ${Object.keys(manifest).length} entries`);

// ─── Step 2: Preflight — enumerate ALL files, reject unsupported ──────

console.log("\n=== Preflight Check ===\n");

function enumerateAllFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== ".gitkeep") {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const trialFilesAll = enumerateAllFiles(TRIALS_DIR);
const refFilesAll = enumerateAllFiles(REFERENCE_DIR);
const allFilesAll = [...trialFilesAll, ...refFilesAll];

// Check for unsupported extensions
for (const filePath of allFilesAll) {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    const relPath = relative(KIT_DIR, filePath);
    fail(`Unsupported file extension (${ext}) — liteparse cannot read: ${relPath}`);
  }
}

// Check for .md files (explicit rejection)
for (const filePath of allFilesAll) {
  if (filePath.endsWith(".md")) {
    const relPath = relative(KIT_DIR, filePath);
    fail(`liteparse-unreadable input (.md): ${relPath}`);
  }
}

// Filter to supported files only
const trialFiles = trialFilesAll.filter(f => SUPPORTED_EXTENSIONS.has(extname(f).toLowerCase()));
const refFiles = refFilesAll.filter(f => SUPPORTED_EXTENSIONS.has(extname(f).toLowerCase()));
const allFiles = [...trialFiles, ...refFiles];

if (allFiles.length === 0) {
  fail("No supported files found in inputs/trials/ or inputs/reference/. Run: npm run inputs:build");
}

console.log(`  Trials: ${trialFiles.length}`);
console.log(`  Reference: ${refFiles.length}`);
console.log(`  Total: ${allFiles.length}`);

// ─── Step 3: Admission gate per file ───────────────────────────────────

console.log("\n=== Admission Check ===\n");

const admitted = [];
const seenPaths = new Set();

for (const filePath of allFiles) {
  const relPath = relative(KIT_DIR, filePath);
  const normalizedPath = relPath.replace(/\\/g, "/"); // Normalize for dedup

  // Check for duplicate normalized paths
  if (seenPaths.has(normalizedPath)) {
    fail(`Duplicate file path: ${relPath}`);
  }
  seenPaths.add(normalizedPath);

  const entry = manifest[relPath];

  if (!entry) {
    fail(`File not in manifest (unlabeled ⇒ internal ⇒ blocked): ${relPath}`);
  }

  if (entry.label !== "public") {
    fail(`File label is "${entry.label}", not "public" — MVP admits public only: ${relPath}`);
  }

  if (typeof entry.citable !== "boolean") {
    fail(`Invalid citable field (must be boolean) for: ${relPath}`);
  }

  if (!entry.ocr_language) {
    fail(`Missing ocr_language in manifest for: ${relPath}`);
  }

  if (!["eng", "vie"].includes(entry.ocr_language)) {
    fail(`Invalid ocr_language "${entry.ocr_language}" (must be eng/vie) for: ${relPath}`);
  }

  admitted.push({ filePath, relPath, entry });
  console.log(`  ADMITTED: ${relPath} [${entry.label}, citable:${entry.citable}, ocr:${entry.ocr_language}]`);
  runLog.files.push({ path: relPath, label: entry.label, citable: entry.citable, ocr_language: entry.ocr_language });
}

console.log(`\n  ${admitted.length} files admitted for ingest.`);

// Sort admitted files by stable key (relative path) for deterministic order
admitted.sort((a, b) => a.relPath.localeCompare(b.relPath));

// ─── Step 4–5: Extract + provenance anchoring ──────────────────────────

console.log("\n=== Extracting ===\n");

export const records = [];
let totalRecords = 0;
let totalRejected = 0;

for (const { filePath, relPath, entry } of admitted) {
  console.log(`  Processing: ${relPath}`);

  // Run liteparse with --format json
  let parseResult;
  try {
    const raw = execSync(
      `"${LIT_BIN}" parse "${filePath}" --format json 2>/dev/null`,
      { encoding: "utf-8", timeout: 60_000, maxBuffer: 50 * 1024 * 1024 }
    );
    // liteparse may append timing info after JSON; extract JSON portion
    const jsonEnd = raw.lastIndexOf("}");
    parseResult = JSON.parse(raw.slice(0, jsonEnd + 1));
  } catch (err) {
    fail(`liteparse failed for ${relPath}: ${err.message}`);
  }

  if (!parseResult.pages || parseResult.pages.length === 0) {
    warn(`  No pages extracted from ${relPath} — skipping`);
    continue;
  }

  let fileRecords = 0;

  // Run is-complex for OCR detection (not execution)
  let isComplexResults = [];
  try {
    const complexRaw = execSync(
      `"${LIT_BIN}" is-complex "${filePath}" --compact 2>/dev/null`,
      { encoding: "utf-8", timeout: 60_000 }
    );
    isComplexResults = JSON.parse(complexRaw);
    if (!Array.isArray(isComplexResults)) {
      warn(`  is-complex returned non-array for ${relPath} — treating as empty`);
      isComplexResults = [];
    }
  } catch (err) {
    warn(`  is-complex failed for ${relPath}: ${err.message} — continuing without OCR detection`);
  }

  // Build lookup by pageNumber
  const complexByPage = new Map();
  for (const entry of isComplexResults) {
    complexByPage.set(entry.pageNumber, entry);
  }

  for (const page of parseResult.pages) {
    const pageNum = page.page;
    const pageText = page.text || "";
    const pageKind = "renderer-derived"; // DOCX pages are liteparse layout

    // OCR detection: check is-complex results
    const complexInfo = complexByPage.get(pageNum);
    const reasons = complexInfo?.reasons || [];
    const textLength = complexInfo?.textLength ?? pageText.length;
    const fullPageImage = complexInfo?.fullPageImage ?? false;
    const isGarbled = complexInfo?.isGarbled ?? false;

    // OCR-eligibility marker (for deferred OCR session)
    // A page is OCR-eligible when: fullPageImage OR isGarbled OR reason outside benign set
    const benignReasons = new Set(["sparse-text", "vector-text"]);
    const hasNonBenignReason = reasons.some(r => !benignReasons.has(r));
    const isOcrEligible = fullPageImage || isGarbled || hasNonBenignReason;

    if (isOcrEligible) {
      runLog.ocrEligiblePages.push({
        file: relPath,
        page: pageNum,
        reasons,
        fullPageImage,
        isGarbled,
        textLength,
      });
    }

    // Flag rule: confidence:"low", extraction_status:"needs-ocr" ONLY when textLength < 50
    const needsOcrFlag = textLength < 50;

    if (needsOcrFlag) {
      // Page has no substantial text — flag as needs-ocr
      warn(`  Page ${pageNum} of ${relPath}: textLength=${textLength} < 50 — flagging as needs-ocr`);
      const id = deterministicId(relPath, pageNum, 0, "");
      records.push({
        id,
        source_type: "text",
        content: pageText,
        table: null,
        provenance: {
          file: relPath,
          page: pageNum,
          char_start: 0,
          char_end: 0,
          quote: "",
          page_kind: pageKind,
        },
        confidence: "low",
        extraction_status: "needs-ocr",
        classification: { label: entry.label, citable: entry.citable },
      });
      fileRecords++;
      continue;
    }

    // Page has text — extract normally
    // Split page text into paragraphs/sections for granular records
    const segments = splitIntoSegments(pageText);

    for (const seg of segments) {
      const charStart = seg.offset;
      const charEnd = seg.offset + seg.text.length;
      const quote = pageText.slice(charStart, charEnd);

      // Round-trip assertion
      if (quote !== seg.text) {
        warn(`  Round-trip mismatch on page ${pageNum} of ${relPath} at offset ${charStart} — skipping segment`);
        totalRejected++;
        continue;
      }

      // Detect if this segment is a table region
      const tableData = tryReconstructTable(page.textItems || [], seg);

      const id = deterministicId(relPath, pageNum, charStart, quote);
      records.push({
        id,
        source_type: tableData ? "table" : "text",
        content: seg.text,
        table: tableData,
        provenance: {
          file: relPath,
          page: pageNum,
          char_start: charStart,
          char_end: charEnd,
          quote,
          page_kind: pageKind,
        },
        confidence: "high",
        extraction_status: "ok",
        classification: { label: entry.label, citable: entry.citable },
      });
      fileRecords++;
    }
  }

  console.log(`    → ${fileRecords} records extracted`);
  totalRecords += fileRecords;
}

console.log(`\n  Total records: ${totalRecords} (${totalRejected} rejected)`);

// Sort records by stable key (file + page + char_start) for deterministic output
records.sort((a, b) => {
  const cmp = a.provenance.file.localeCompare(b.provenance.file);
  if (cmp !== 0) return cmp;
  const cmpPage = a.provenance.page - b.provenance.page;
  if (cmpPage !== 0) return cmpPage;
  return a.provenance.char_start - b.provenance.char_start;
});

// ─── Step 6: Table reconstruction spike ────────────────────────────────

/**
 * Attempt to reconstruct a table from textItems within a text segment.
 * Strategy: cluster textItems by y (rows) and x (columns) to rebuild the grid.
 * Returns { headers, rows } if successful, null otherwise.
 */
function tryReconstructTable(textItems, segment) {
  if (!textItems || textItems.length === 0) return null;

  // Find textItems whose text overlaps with the segment
  const segLower = segment.text.toLowerCase();
  const segItems = textItems.filter((item) => {
    const itemText = (item.text || "").trim();
    return itemText.length > 0 && segLower.includes(itemText.toLowerCase().slice(0, 20));
  });

  if (segItems.length < 4) return null; // Need at least 2×2

  // Cluster by y (rows) — items within 5px y-gap are same row
  const ySorted = [...segItems].sort((a, b) => a.y - b.y);
  const rows = [];
  let currentRow = [ySorted[0]];

  for (let i = 1; i < ySorted.length; i++) {
    if (Math.abs(ySorted[i].y - currentRow[0].y) < 8) {
      currentRow.push(ySorted[i]);
    } else {
      rows.push(currentRow);
      currentRow = [ySorted[i]];
    }
  }
  rows.push(currentRow);

  if (rows.length < 2) return null;

  // Sort each row by x position
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }

  // First row = headers
  const headers = rows[0].map((item) => item.text.trim());
  const dataRows = rows.slice(1).map((row) => row.map((item) => item.text.trim()));

  // Validate: all rows should have same column count
  const colCount = headers.length;
  const validRows = dataRows.filter((r) => r.length === colCount);

  if (validRows.length < 1) return null;

  return { headers, rows: validRows };
}

/**
 * Split page text into meaningful segments (paragraphs + table regions).
 * Returns array of { text, offset }.
 */
function splitIntoSegments(text) {
  const segments = [];
  // Split on double-newline (paragraph boundaries)
  const parts = text.split(/\n{2,}/);
  let offset = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      offset += part.length + 2; // account for the \n\n
      continue;
    }

    // Find the actual offset in the original text
    const actualOffset = text.indexOf(trimmed, Math.max(0, offset - 10));
    if (actualOffset === -1) {
      // Fallback: use computed offset
      segments.push({ text: trimmed, offset });
    } else {
      segments.push({ text: trimmed, offset: actualOffset });
    }
    offset = actualOffset + trimmed.length;
  }

  return segments;
}

// ─── Step 7: Atomic publication ────────────────────────────────────────

console.log("\n=== Atomic Publication ===\n");

// Ensure store dir exists
if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });

// Write to temp file first
const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(TEMP_RECORDS_PATH, jsonl);
console.log(`  Written temp: ${TEMP_RECORDS_PATH}`);

// Validate every record against schema (hand-rolled validation)
console.log("  Validating records against schema...");
const schema = JSON.parse(readFileSync(join(STORE_DIR, "records.schema.json"), "utf-8"));
let validationErrors = 0;

for (const rec of records) {
  // Check required fields
  for (const field of schema.required) {
    if (rec[field] === undefined) {
      console.error(`  VALIDATION ERROR: Record ${rec.id} missing required field: ${field}`);
      validationErrors++;
    }
  }

  // Check provenance required fields
  if (rec.provenance) {
    for (const field of schema.properties.provenance.required) {
      if (rec.provenance[field] === undefined) {
        console.error(`  VALIDATION ERROR: Record ${rec.id} missing provenance.${field}`);
        validationErrors++;
      }
    }
  }

  // Check classification required fields
  if (rec.classification) {
    for (const field of schema.properties.classification.required) {
      if (rec.classification[field] === undefined) {
        console.error(`  VALIDATION ERROR: Record ${rec.id} missing classification.${field}`);
        validationErrors++;
      }
    }
  }
}

if (validationErrors > 0) {
  fail(`${validationErrors} schema validation errors — aborting, prior store untouched`);
  unlinkSync(TEMP_RECORDS_PATH);
  process.exit(1);
}

console.log(`  All ${records.length} records pass schema validation`);

// Round-trip verification (re-parse and check)
console.log("  Running round-trip verification...");
let verified = 0;
let failed = 0;

for (const rec of records) {
  if (rec.extraction_status === "needs-ocr") continue; // Skip empty pages
  if (!rec.provenance.quote) continue;

  // Re-parse the source file and verify
  const srcFile = join(KIT_DIR, rec.provenance.file);
  if (!existsSync(srcFile)) {
    warn(`  Source file missing for round-trip: ${rec.provenance.file}`);
    failed++;
    continue;
  }

  try {
    const raw = execSync(
      `"${LIT_BIN}" parse "${srcFile}" --format json 2>/dev/null`,
      { encoding: "utf-8", timeout: 60_000, maxBuffer: 50 * 1024 * 1024 }
    );
    const jsonEnd = raw.lastIndexOf("}");
    const reParsed = JSON.parse(raw.slice(0, jsonEnd + 1));

    const page = reParsed.pages.find((p) => p.page === rec.provenance.page);
    if (!page) {
      warn(`  Page ${rec.provenance.page} not found in re-parse of ${rec.provenance.file}`);
      failed++;
      continue;
    }

    const sliced = page.text.slice(rec.provenance.char_start, rec.provenance.char_end);
    if (sliced === rec.provenance.quote) {
      verified++;
    } else {
      warn(`  Round-trip FAIL: ${rec.provenance.file} p${rec.provenance.page} offset ${rec.provenance.char_start}`);
      failed++;
    }
  } catch (err) {
    warn(`  Re-parse error for ${rec.provenance.file}: ${err.message}`);
    failed++;
  }
}

console.log(`  Round-trip verified: ${verified}/${verified + failed}`);

if (failed > 0) {
  fail(`${failed} round-trip failures — aborting, prior store untouched`);
  unlinkSync(TEMP_RECORDS_PATH);
  process.exit(1);
}

// Assert non-empty store
if (records.length === 0) {
  fail("Store is EMPTY after ingest — admission gate may have silently dropped all files");
  unlinkSync(TEMP_RECORDS_PATH);
  process.exit(1);
}

// Atomic replace: rename temp to final
try {
  // Backup existing store if present
  if (existsSync(RECORDS_PATH)) {
    const backupPath = RECORDS_PATH + ".bak";
    copyFileSync(RECORDS_PATH, backupPath);
  }
  renameSync(TEMP_RECORDS_PATH, RECORDS_PATH);
  console.log(`  Atomically replaced: ${RECORDS_PATH}`);
} catch (err) {
  fail(`Failed to atomically replace store: ${err.message}`);
}

// ─── Step 8: Final verification ────────────────────────────────────────

console.log("\n=== Final Verification ===\n");

// Verify the written store is byte-identical to what we computed
const writtenStore = readFileSync(RECORDS_PATH, "utf-8");
const expectedStore = records.map((r) => JSON.stringify(r)).join("\n") + "\n";

if (writtenStore === expectedStore) {
  console.log("  ✓ Store bytes match expected output");
} else {
  fail("Store bytes do NOT match expected output — possible corruption");
}

// Compute determinism hash (for the determinism gate)
const storeHash = createHash("sha256").update(writtenStore).digest("hex");
console.log(`  Store SHA-256: ${storeHash}`);

// ─── Summary ───────────────────────────────────────────────────────────

console.log("\n=== Ingest Complete ===");
console.log(`  Total records: ${records.length}`);
console.log(`  Round-trip verified: ${verified}/${verified + failed}`);
console.log(`  Store: ${RECORDS_PATH}`);
console.log(`  Store hash: ${storeHash}`);
console.log(`  OCR-eligible pages: ${runLog.ocrEligiblePages.length} (logged for deferred session)`);

// Write run log
writeRunLog();
console.log(`  Run log: ${join(STORE_DIR, "run-log.json")}`);

if (failed > 0) {
  console.error(`\nWARNING: ${failed} round-trip failures detected.`);
  process.exit(1);
}
