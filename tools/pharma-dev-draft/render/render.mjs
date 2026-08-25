#!/usr/bin/env node
// Stage C CLI: draft.json -> output.docx. Validates the draft first (Stage B contract), then
// renders deterministically. See render/builder.mjs and schemas/p2-draft-contract.md.

import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DraftContractError, validateDraft } from "../draft/validate-draft.mjs";
import { buildDocumentBuffer } from "./builder.mjs";
import { writeBufferAtomic, WriteError } from "./write.mjs";

const renderDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = resolve(renderDir, "..");
const defaultOutputRoot = join(toolRoot, "output");

class RenderInputError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "RenderInputError";
    this.code = code;
  }
}

function parseArguments(argv) {
  let inputPath;
  let outputRoot = defaultOutputRoot;
  let outputName;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--output-root") {
      outputRoot = argv[++index];
      if (!outputRoot || !isAbsolute(outputRoot)) {
        throw new RenderInputError("E_OUTPUT_ROOT", "--output-root must be followed by an absolute path");
      }
    } else if (argument === "--output-name") {
      outputName = argv[++index];
    } else if (argument.startsWith("-")) {
      throw new RenderInputError("E_ARGS", `unsupported option: ${argument}`);
    } else if (inputPath) {
      throw new RenderInputError("E_ARGS", "only one draft input path is supported");
    } else {
      inputPath = argument;
    }
  }
  if (!inputPath) throw new RenderInputError("E_ARGS", "usage: render.mjs <draft.json> [--output-root <abs>] [--output-name <file.docx>]");
  return { inputPath, outputRoot, outputName };
}

function readJson(path, errorCode) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new RenderInputError(errorCode, `cannot read: ${path}`, { cause: error });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new RenderInputError(errorCode, `not valid JSON: ${path}`, { cause: error });
  }
}

function codeOf(error) {
  if (error instanceof RenderInputError || error instanceof DraftContractError || error instanceof WriteError) {
    return error.code;
  }
  return "E_UNKNOWN";
}

function defaultOutputName(draft) {
  const slug = `${draft.meta.apiName}-${draft.meta.draftDate}`
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `p2-draft-${slug || "output"}.docx`;
}

async function main() {
  const { inputPath, outputRoot, outputName } = parseArguments(process.argv.slice(2));
  const draft = validateDraft(readJson(inputPath, "E_DRAFT_INPUT"));
  const outline = readJson(join(toolRoot, "schemas", "p2-outline.json"), "E_OUTLINE_INPUT");

  const buffer = await buildDocumentBuffer(draft, outline);
  const destination = writeBufferAtomic(buffer, {
    outputRoot,
    outputName: outputName || defaultOutputName(draft),
    createOutputRoot: true,
  });
  process.stdout.write(`Written: ${destination} (${buffer.length} bytes)\n`);
}

main().catch((error) => {
  process.stderr.write(`${codeOf(error)}: ${error.message}\n`);
  process.exitCode = 1;
});
