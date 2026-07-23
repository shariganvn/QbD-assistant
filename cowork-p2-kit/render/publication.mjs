import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export class RenderPublicationError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "RenderPublicationError";
    this.code = code;
  }
}

function outputRootError(message, cause) {
  return new RenderPublicationError("E_OUTPUT_ROOT", message, cause ? { cause } : undefined);
}

function prepareOutputRoot(outputRoot, createOutputRoot, fileSystem) {
  if (!isAbsolute(outputRoot)) throw outputRootError("--output-root must be an absolute path");
  try {
    if (createOutputRoot) fileSystem.mkdirSync(outputRoot, { recursive: true });
    if (!fileSystem.statSync(outputRoot).isDirectory()) throw outputRootError("output root must be a directory");
  } catch (error) {
    if (error instanceof RenderPublicationError) throw error;
    throw outputRootError(`cannot use output root: ${error.message}`, error);
  }
}

export function publishBuffer(buffer, {
  outputRoot,
  createOutputRoot = false,
  fileSystem = { mkdirSync, renameSync, rmSync, statSync, writeFileSync },
}) {
  prepareOutputRoot(outputRoot, createOutputRoot, fileSystem);
  const outputName = "p2-draft.docx";
  const destination = join(outputRoot, outputName);
  const temporary = join(outputRoot, `.${outputName}.${randomUUID()}.tmp`);
  try {
    fileSystem.writeFileSync(temporary, buffer, { flag: "wx" });
    fileSystem.renameSync(temporary, destination);
    return destination;
  } catch (error) {
    try {
      fileSystem.rmSync(temporary, { force: true });
    } catch {
      // The invocation-owned temporary file is best-effort cleanup only.
    }
    throw new RenderPublicationError("E_OUTPUT_WRITE", `cannot publish DOCX: ${error.message}`, { cause: error });
  }
}
