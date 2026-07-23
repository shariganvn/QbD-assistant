#!/usr/bin/env node

/**
 * render-spike.mjs — Unisolated, argument-driven diagnostic render.
 *
 * Accepts explicit --draft, --output-root, and --report-root absolute paths.
 * Validates through the production contract, renders through buildDocumentBuffer,
 * and publishes through publishBuffer.
 *
 * This script must NOT invoke bwrap, a shell, execSync, or a fallback renderer.
 * Isolation is owned exclusively by run-isolated-spike.mjs.
 *
 * Usage:
 *   node render-spike.mjs --draft <path> --output-root <path> --report-root <path>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";

import { validateDraft, RenderContractError } from "./contract.mjs";
import { buildDocumentBuffer } from "./document-builder.mjs";
import { publishBuffer, RenderPublicationError } from "./publication.mjs";

// ─── Argument parsing ──────────────────────────────────────────────────

function parseArguments(argv) {
  let draftPath;
  let outputRoot;
  let reportRoot;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--draft") {
      draftPath = argv[++i];
    } else if (arg === "--output-root") {
      outputRoot = argv[++i];
    } else if (arg === "--report-root") {
      reportRoot = argv[++i];
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  if (!draftPath) {
    process.stderr.write("Missing required --draft <path>\n");
    process.exit(1);
  }
  if (!outputRoot || !isAbsolute(outputRoot)) {
    process.stderr.write("Missing or non-absolute --output-root <path>\n");
    process.exit(1);
  }
  if (!reportRoot || !isAbsolute(reportRoot)) {
    process.stderr.write("Missing or non-absolute --report-root <path>\n");
    process.exit(1);
  }

  return { draftPath, outputRoot, reportRoot };
}

// ─── Draft reading ─────────────────────────────────────────────────────

function readDraft(draftPath) {
  let raw;
  try {
    raw = readFileSync(draftPath, "utf8");
  } catch (error) {
    process.stderr.write(`E_DRAFT_INPUT: cannot read draft: ${draftPath}\n`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`E_DRAFT_JSON: invalid JSON: ${draftPath}\n`);
    process.exit(1);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const { draftPath, outputRoot, reportRoot } = parseArguments(process.argv.slice(2));

  // Read and validate through production contract
  const rawDraft = readDraft(draftPath);
  let draft;
  try {
    draft = validateDraft(rawDraft);
  } catch (error) {
    if (error instanceof RenderContractError) {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  // Render through production builder
  const buffer = await buildDocumentBuffer(draft);

  // Publish through production publication
  let destination;
  try {
    destination = publishBuffer(buffer, { outputRoot, createOutputRoot: true });
  } catch (error) {
    if (error instanceof RenderPublicationError) {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  // Collect run metadata
  const outputHash = createHash("sha256").update(buffer).digest("hex");
  const timestamp = new Date().toISOString();

  // Build structured report
  const report = {
    timestamp,
    draft: draftPath,
    output: destination,
    output_sha256: outputHash,
    output_bytes: buffer.length,
    versions: {
      node: process.version,
    },
    citations_count: draft.citations.length,
    blocks_count: draft.blocks.length,
    title: draft.title || null,
  };

  // Write report
  mkdirSync(reportRoot, { recursive: true });
  const reportPath = join(reportRoot, "render-spike-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  // Print summary to stdout
  process.stdout.write(`Render spike completed\n`);
  process.stdout.write(`  Output: ${destination}\n`);
  process.stdout.write(`  SHA-256: ${outputHash}\n`);
  process.stdout.write(`  Size: ${buffer.length} bytes\n`);
  process.stdout.write(`  Report: ${reportPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`E_OUTPUT_WRITE: ${error.message}\n`);
  process.exitCode = 1;
});
