/**
 * liteparse-adapter.mjs — Argument-array CLI invocation and capability discovery.
 *
 * createLiteparseAdapter(config) returns methods that invoke the configured
 * absolute binary through literal argument arrays. No shell evaluation occurs.
 */

import { IngestError } from "./errors.mjs";
import { isAbsolute, resolve } from "node:path";
import { canonicalRoot, inside } from "./publication-support.mjs";

/**
 * Extract JSON from liteparse output (may append timing info after JSON).
 * @param {string} raw
 * @param {"object"|"array"} type
 * @returns {object|Array}
 */
function extractJson(raw, type = "object") {
  const open = type === "array" ? "[" : "{";
  const close = type === "array" ? "]" : "}";
  const first = raw.indexOf(open);
  const last = raw.lastIndexOf(close);
  if (first === -1 || last < first) {
    throw new Error(`No JSON ${type} found in output`);
  }
  return JSON.parse(raw.slice(first, last + 1));
}

/**
 * @param {object} config — from createConfig
 * @returns {{ parse: Function, isComplex: Function, getVersion: Function, getBinary: Function }}
 */
export function createLiteparseAdapter(config) {
  const { litBinary, runProcess, fileOps } = config;

  if (!isAbsolute(litBinary)) {
    throw new IngestError("E_CONFIG", "LiteParse binary must be an absolute path", { details: { binary: litBinary } });
  }

  function assertTrustedInput(filePath) {
    if (!isAbsolute(filePath) || !fileOps.existsSync(filePath)) {
      throw new IngestError("E_PARSE", `Input file not found: ${filePath}`, { details: { path: filePath } });
    }
    if (!config.inputsRoot) return;
    const inputsRoot = canonicalRoot(config.inputsRoot, fileOps);
    const canonicalFile = resolve(filePath);
    const stat = fileOps.lstatSync(canonicalFile);
    if (stat.isSymbolicLink() || fileOps.realpathSync(canonicalFile) !== canonicalFile || !inside(inputsRoot, canonicalFile)) {
      throw new IngestError(stat.isSymbolicLink() ? "E_SYMLINK" : "E_PATH_ESCAPE", `Input is outside trusted root: ${filePath}`, { details: { path: filePath, inputsRoot } });
    }
  }

  return {
    /** Absolute path to the lit binary. */
    getBinary() {
      return litBinary;
    },

    /** Return lit --version output. */
    getVersion() {
      const result = runProcess(litBinary, ["--version"], { encoding: "utf-8" });
      if (result.status !== 0) {
        throw new IngestError("E_DEPENDENCY_UNAVAILABLE", `lit --version failed: ${result.stderr ?? ""}`, {
          details: { binary: litBinary },
        });
      }
      return (result.stdout ?? "").trim();
    },

    /**
     * Parse a file and return the parsed result with pages.
     * @param {string} filePath — absolute path to file
     * @returns {{ pages: Array }}
     */
    parse(filePath) {
      assertTrustedInput(filePath);

      // Argument array — no shell evaluation
      const result = runProcess(litBinary, ["parse", filePath, "--format", "json"], {
        encoding: "utf-8",
        timeout: 60_000,
        maxBuffer: 50 * 1024 * 1024,
      });

      if (result.status !== 0) {
        throw new IngestError("E_PARSE", `liteparse failed for ${filePath}: ${result.stderr ?? ""}`, {
          details: { path: filePath, stderr: result.stderr },
        });
      }

      try {
        return extractJson(result.stdout, "object");
      } catch (err) {
        throw new IngestError("E_PARSE", `Failed to parse liteparse JSON output for ${filePath}: ${err.message}`, {
          cause: err,
          details: { path: filePath },
        });
      }
    },

    /**
     * Run is-complex capability discovery on a file.
     * @param {string} filePath — absolute path to file
     * @returns {{ status: "available", results: Array }|{ status: "unsupported"|"invalid", code: string }}
     */
    isComplex(filePath) {
      try { assertTrustedInput(filePath); } catch {
        return { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" };
      }
      const result = runProcess(litBinary, ["is-complex", filePath, "--compact"], {
        encoding: "utf-8",
        timeout: 60_000,
      });
      if (result.status !== 0) {
        return { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" };
      }
      try {
        return { status: "available", results: extractJson(result.stdout ?? "", "array") };
      } catch {
        return { status: "invalid", code: "E_CAPABILITY_INVALID" };
      }
    },
  };
}
