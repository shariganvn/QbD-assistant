// Atomic fail-closed write helper. Ports the idiom used by cowork-p2-kit/render/publication.mjs
// (temp-file-then-rename with an "wx" exclusive-create flag, best-effort temp cleanup on failure)
// without importing that module — see docs/decisions/D20260825-pharma-dev-draft-tool-boundary.md
// for why this tool does not import from cowork-p2-kit/.

import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export class WriteError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "WriteError";
    this.code = code;
  }
}

export function writeBufferAtomic(buffer, { outputRoot, outputName, createOutputRoot = true }) {
  if (!isAbsolute(outputRoot)) throw new WriteError("E_OUTPUT_ROOT", "--output-root must be an absolute path");
  try {
    if (createOutputRoot) mkdirSync(outputRoot, { recursive: true });
    if (!statSync(outputRoot).isDirectory()) throw new WriteError("E_OUTPUT_ROOT", "output root must be a directory");
  } catch (error) {
    if (error instanceof WriteError) throw error;
    throw new WriteError("E_OUTPUT_ROOT", `cannot use output root: ${error.message}`, { cause: error });
  }

  const destination = join(outputRoot, outputName);
  const temporary = join(outputRoot, `.${outputName}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, buffer, { flag: "wx" });
    renameSync(temporary, destination);
    return destination;
  } catch (error) {
    try {
      rmSync(temporary, { force: true });
    } catch {
      // Best-effort cleanup only; the write failure below is the real error to surface.
    }
    throw new WriteError("E_OUTPUT_WRITE", `cannot write output: ${error.message}`, { cause: error });
  }
}
