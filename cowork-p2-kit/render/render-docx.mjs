#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RenderContractError, validateDraft } from "./contract.mjs";
import { buildDocumentBuffer } from "./document-builder.mjs";
import { publishBuffer, RenderPublicationError } from "./publication.mjs";

const renderDir = dirname(fileURLToPath(import.meta.url));
const kitDir = resolve(renderDir, "..");
const defaultOutputRoot = join(kitDir, "outputs");

class RenderInputError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "RenderInputError";
    this.code = code;
  }
}

function parseArguments(argumentsList) {
  let inputPath;
  let outputRoot = defaultOutputRoot;
  let createOutputRoot = true;
  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    if (argument === "--output-root") {
      outputRoot = argumentsList[++index];
      createOutputRoot = false;
      if (!outputRoot || !isAbsolute(outputRoot)) {
        throw new RenderPublicationError("E_OUTPUT_ROOT", "--output-root must be followed by an absolute path");
      }
    } else if (argument.startsWith("-")) {
      throw new RenderInputError("E_DRAFT_INPUT", `unsupported option: ${argument}`);
    } else if (inputPath) {
      throw new RenderInputError("E_DRAFT_INPUT", "only one draft input path is supported");
    } else {
      inputPath = argument;
    }
  }
  return { inputPath, outputRoot, createOutputRoot };
}

function readDraft(inputPath) {
  let raw;
  try {
    raw = readFileSync(inputPath, "utf8");
  } catch (error) {
    throw new RenderInputError("E_DRAFT_INPUT", `cannot read draft input: ${inputPath}`, { cause: error });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new RenderInputError("E_DRAFT_JSON", `draft input is not valid JSON: ${inputPath}`, { cause: error });
  }
}

function buildDemoDraft() {
  const storePath = join(kitDir, "store", "records.jsonl");
  let records;
  try {
    records = readFileSync(storePath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  } catch (error) {
    throw new RenderInputError("E_DRAFT_INPUT", "cannot read store records for demo mode", { cause: error });
  }
  const usable = records.filter((record) => record.id
    && record.extraction_status === "ok"
    && record.classification?.label === "public"
    && record.classification.citable === true
    && record.content?.trim()
    && record.provenance?.file
    && Number.isInteger(record.provenance.page)
    && Number.isInteger(record.provenance.char_start));
  const citations = usable.slice(0, 3).map((record) => ({
    evidenceId: record.id,
    source: record.provenance.file,
    location: `page ${record.provenance.page}, offset ${record.provenance.char_start}`,
    excerpt: record.content.slice(0, 100),
    classification: { label: "public", citable: true },
    evidenceLink: null,
  }));
  const blocks = citations.length
    ? citations.map((citation, index) => ({
      type: "paragraph",
      segments: [{ text: citation.excerpt }, { citation: index }],
    }))
    : [{ type: "chờ_dữ_liệu", text: "Không có bằng chứng công khai có thể trích dẫn trong kho dữ liệu." }];
  return { title: "CTD P.2 — Bản xem trước", citations, blocks };
}

function codeOf(error) {
  return error instanceof RenderContractError || error instanceof RenderInputError || error instanceof RenderPublicationError
    ? error.code
    : "E_OUTPUT_WRITE";
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const draft = validateDraft(options.inputPath ? readDraft(options.inputPath) : buildDemoDraft());
  const buffer = await buildDocumentBuffer(draft);
  const destination = publishBuffer(buffer, options);
  process.stdout.write(`Written: ${destination} (${buffer.length} bytes)\n`);
}

main().catch((error) => {
  process.stderr.write(`${codeOf(error)}: ${error.message}\n`);
  process.exitCode = 1;
});
