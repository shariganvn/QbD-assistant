// Optional alternate extraction path via the `lit` (LiteParse) CLI, for input this tool's primary
// path (extract/xml-walk.mjs) cannot handle well — scanned/image-based documents, or non-.docx
// input such as PDF. NOT used by default for .docx trial reports (see xml-walk.mjs's header
// comment for why direct XML walking is preferred there). This module intentionally does not
// import anything from cowork-p2-kit/ingest/ (that code is coupled to the ingest pipeline's
// trust-root/admission boundary for a bounded document *package*; this tool operates on one
// standalone trusted local file at a time and has no such package concept).

import { spawn } from "node:child_process";

export class LiteparseError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "LiteparseError";
    this.code = code;
  }
}

function runLit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("lit", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      reject(new LiteparseError("E_LIT_SPAWN", `cannot run 'lit' CLI: ${error.message}`, { cause: error }));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new LiteparseError("E_LIT_EXIT", `'lit' exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });
}

// Returns raw LiteParse text output. This tool does not attempt table reconstruction from
// LiteParse's text-flow output (that heuristic lives in cowork-p2-kit/ingest/table-reconstruction.mjs
// and is not duplicated here) — callers using this path get { paragraphs: [...], tables: [] } and
// must review the raw text manually for any tabular data.
export async function extractViaLiteparse(filePath) {
  const stdout = await runLit(["parse", filePath, "--format", "text", "--no-ocr"]);
  const paragraphs = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return { paragraphs, tables: [] };
}
