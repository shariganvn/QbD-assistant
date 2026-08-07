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

function restoreTextFidelity(parsed, replacements) {
  if (!replacements) return parsed;
  if (!Array.isArray(replacements) || replacements.length === 0) {
    throw new IngestError("E_PARSE", "Text-fidelity replacements must be a non-empty array");
  }
  const pages = parsed?.pages;
  if (!Array.isArray(pages)) throw new IngestError("E_PARSE", "LiteParse result has no pages for text-fidelity restoration");
  const restored = pages.map((page) => ({ ...page }));
  for (const replacement of replacements) {
    const { from, to, context = "" } = replacement ?? {};
    if (typeof from !== "string" || !from || typeof to !== "string" || !to) {
      throw new IngestError("E_PARSE", "Text-fidelity replacement must be a non-empty string pair");
    }
    if (typeof context !== "string") throw new IngestError("E_PARSE", "Text-fidelity replacement context must be a string");
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "\\s*");
    const escapedContext = context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`(?<![<>=])${escapedFrom}(?![<>=])${context ? `(?=\\s*${escapedContext})` : ""}`, "g");
    const matches = restored.flatMap((page, pageIndex) => [...String(page.text ?? "").matchAll(matcher)]
      .map((match) => ({ pageIndex, offset: match.index, length: match[0].length })));
    if (matches.length !== 1) {
      throw new IngestError("E_PARSE", `Text-fidelity replacement ${JSON.stringify(from)} matched ${matches.length} locations`, { details: { from, matches } });
    }
    const { pageIndex, offset, length } = matches[0];
    const text = String(restored[pageIndex].text ?? "");
    restored[pageIndex].text = `${text.slice(0, offset)}${to}${text.slice(offset + length)}`;
  }
  return { ...parsed, pages: restored };
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
        return restoreTextFidelity(extractJson(result.stdout, "object"), config.textFidelityReplacements);
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
        return { status: "invalid", code: "E_CAPABILITY_INVALID" };
      }
      const result = runProcess(litBinary, ["is-complex", filePath, "--compact"], {
        encoding: "utf-8",
        timeout: 60_000,
      });
      // Try to extract valid JSON array — available regardless of exit code (lit exits 1 for complex pages)
      try {
        return { status: "available", results: extractJson(result.stdout ?? "", "array") };
      } catch { /* no valid JSON */ }
      // No valid JSON: unavailable executable is unsupported; everything else is invalid.
      if (result.error?.code === "ENOENT" || result.status === 127) {
        return { status: "unsupported", code: "E_CAPABILITY_UNSUPPORTED" };
      }
      return { status: "invalid", code: "E_CAPABILITY_INVALID" };
    },
  };
}
