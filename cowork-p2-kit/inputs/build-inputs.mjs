#!/usr/bin/env node

/**
 * build-inputs.mjs — Convert inputs/src/*.md → .docx via headless LibreOffice.
 *
 * Trials land in inputs/trials/, product profile in inputs/.
 * Each generated .docx is registered in classification-manifest.json.
 *
 * Usage: node cowork-p2-kit/inputs/build-inputs.mjs
 *   or:  npm run inputs:build
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "src");
const TRIALS_DIR = join(__dirname, "trials");
const INPUTS_DIR = __dirname;
const MANIFEST_PATH = join(__dirname, "classification-manifest.json");

// Ensure output dirs exist
for (const dir of [TRIALS_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Verify LibreOffice
const SOFFICE = "/usr/bin/soffice";
if (!existsSync(SOFFICE)) {
  console.error("ERROR: LibreOffice not found at", SOFFICE);
  process.exit(1);
}

// Read existing manifest or start fresh
let manifest = {};
if (existsSync(MANIFEST_PATH)) {
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    manifest = {};
  }
}

// Find all .md source files
const mdFiles = readdirSync(SRC_DIR).filter((f) => f.endsWith(".md"));
if (mdFiles.length === 0) {
  console.error("ERROR: No .md files found in", SRC_DIR);
  process.exit(1);
}

console.log(`Found ${mdFiles.length} source file(s) to convert:`);

let converted = 0;
let errors = 0;

for (const mdFile of mdFiles) {
  const srcPath = join(SRC_DIR, mdFile);
  const baseName = basename(mdFile, ".md");

  // Trials go to inputs/trials/, product profile stays in inputs/
  const isTrial = baseName.startsWith("formulation-trial");
  const destDir = isTrial ? TRIALS_DIR : INPUTS_DIR;
  const expectedDocx = join(destDir, `${baseName}.docx`);

  console.log(`  Converting: ${mdFile} → ${isTrial ? "trials/" : ""}${baseName}.docx`);

  try {
    // LibreOffice headless conversion
    execSync(
      `soffice --headless --convert-to docx --outdir "${destDir}" "${srcPath}"`,
      { stdio: "pipe", timeout: 30_000 }
    );

    if (!existsSync(expectedDocx)) {
      console.error(`    ERROR: Expected output not found: ${expectedDocx}`);
      errors++;
      continue;
    }

    // Register in manifest (relative path from cowork-p2-kit/)
    const manifestKey = isTrial
      ? `inputs/trials/${baseName}.docx`
      : `inputs/${baseName}.docx`;

    manifest[manifestKey] = {
      label: "public",
      citable: true,
      ocr_language: "vie",
    };

    converted++;
    console.log(`    OK: ${expectedDocx}`);
  } catch (err) {
    console.error(`    ERROR converting ${mdFile}:`, err.message);
    errors++;
  }
}

// Write updated manifest
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nManifest updated: ${MANIFEST_PATH}`);
console.log(`  Entries: ${Object.keys(manifest).length}`);

console.log(`\nDone: ${converted} converted, ${errors} errors.`);
if (errors > 0) process.exit(1);
