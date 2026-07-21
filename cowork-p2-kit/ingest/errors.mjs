/**
 * errors.mjs — Typed failure taxonomy for the ingest pipeline.
 *
 * Every expected ingest failure throws an IngestError.
 * Library modules never call exit — only cli.mjs maps errors to exit codes.
 */

const ERROR_CODES = new Set([
  "E_CONFIG",
  "E_PATH_ESCAPE",
  "E_SYMLINK",
  "E_DUPLICATE_PATH",
  "E_INPUT_UNSUPPORTED",
  "E_INPUT_EMPTY",
  "E_MANIFEST_MISSING",
  "E_MANIFEST_ENTRY_MISSING",
  "E_MANIFEST_INVALID",
  "E_NOT_PUBLIC",
  "E_DEPENDENCY_UNAVAILABLE",
  "E_PARSE",
  "E_CAPABILITY_INVALID",
  "E_CAPABILITY_UNSUPPORTED",
  "E_RECORD_SCHEMA",
  "E_ROUND_TRIP",
  "E_EMPTY_STORE",
  "E_PUBLICATION_LOCKED",
  "E_PUBLICATION_FAILED",
]);

export class IngestError extends Error {
  /**
   * @param {string} code — one of ERROR_CODES
   * @param {string} message — human-readable description
   * @param {object} [options]
   * @param {Error} [options.cause] — underlying error
   * @param {object} [options.details] — structured context
   */
  constructor(code, message, { cause, details } = {}) {
    if (!ERROR_CODES.has(code)) {
      throw new Error(`Unknown ingest error code: ${code}`);
    }
    super(message, { cause });
    this.name = "IngestError";
    this.code = code;
    this.details = details ?? {};
  }

  /** Format for stderr: [<code>] <message> */
  format() {
    return `[${this.code}] ${this.message}`;
  }
}

export { ERROR_CODES };
