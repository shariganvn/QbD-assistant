#!/usr/bin/env node
// Stage A CLI: <input.docx> -> extracted.json ({ paragraphs, tables, sourceFile, extractedAt,
// extractionMethod }). Deterministic — no interpretation of what the content means happens here.
//
// Usage:
//   node extract/extract.mjs <input.docx> -o extracted.json
//   node extract/extract.mjs <input.docx> -o extracted.json --method liteparse   # opt-in alternate path

import { writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

import { extractViaXmlWalk, XmlWalkError } from "./xml-walk.mjs";
import { extractViaLiteparse, LiteparseError } from "./liteparse-path.mjs";

class ExtractInputError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "ExtractInputError";
    this.code = code;
  }
}

function parseArguments(argv) {
  let inputPath;
  let outputPath;
  let method = "xml-walk";
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "-o" || argument === "--output") {
      outputPath = argv[++index];
    } else if (argument === "--method") {
      method = argv[++index];
      if (method !== "xml-walk" && method !== "liteparse") {
        throw new ExtractInputError("E_ARGS", `--method must be "xml-walk" or "liteparse", got: ${method}`);
      }
    } else if (argument.startsWith("-")) {
      throw new ExtractInputError("E_ARGS", `unsupported option: ${argument}`);
    } else if (inputPath) {
      throw new ExtractInputError("E_ARGS", "only one input path is supported");
    } else {
      inputPath = argument;
    }
  }
  if (!inputPath) throw new ExtractInputError("E_ARGS", "usage: extract.mjs <input.docx> -o <extracted.json> [--method xml-walk|liteparse]");
  if (!outputPath) throw new ExtractInputError("E_ARGS", "-o/--output <extracted.json> is required");
  return { inputPath, outputPath, method };
}

function codeOf(error) {
  if (error instanceof ExtractInputError || error instanceof XmlWalkError || error instanceof LiteparseError) {
    return error.code;
  }
  return "E_UNKNOWN";
}

async function main() {
  const { inputPath, outputPath, method } = parseArguments(process.argv.slice(2));
  const absoluteInput = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);

  const extracted = method === "liteparse"
    ? await extractViaLiteparse(absoluteInput)
    : await extractViaXmlWalk(absoluteInput);

  const result = {
    sourceFile: basename(absoluteInput),
    extractedAt: new Date().toISOString(),
    extractionMethod: method,
    paragraphs: extracted.paragraphs,
    tables: extracted.tables,
  };

  writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  process.stdout.write(
    `Written: ${outputPath} (method=${method}, paragraphs=${result.paragraphs.length}, tables=${result.tables.length})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${codeOf(error)}: ${error.message}\n`);
  process.exitCode = 1;
});
