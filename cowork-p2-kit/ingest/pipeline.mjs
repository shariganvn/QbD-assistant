/**
 * pipeline.mjs — Injectable orchestration of admission, parsing,
 * record construction, and publication.
 *
 * runIngest(config) composes all modules and returns
 * { records, storeHash, capabilities } on success.
 */

import { join } from "node:path";
import { IngestError } from "./errors.mjs";
import { admitInputs } from "./admission.mjs";
import { createLiteparseAdapter } from "./liteparse-adapter.mjs";
import { buildRecords, verifyRoundTrips } from "./records.mjs";
import { publishRecords } from "./publication.mjs";

/**
 * Probe a binary dependency exists and is executable at the expected absolute path.
 * @param {string} binary — absolute path
 * @param {string} name — human name for error messages
 * @param {object} config
 */
function probeBinary(binary, name, config) {
  const { fileOps, runProcess } = config;
  if (!fileOps.existsSync(binary)) {
    throw new IngestError("E_DEPENDENCY_UNAVAILABLE", `${name} not found at ${binary}`, {
      details: { binary, name },
    });
  }
  const result = runProcess(binary, ["--version"], { timeout: 5_000 });
  if (result.status !== 0) {
    throw new IngestError("E_DEPENDENCY_UNAVAILABLE", `${name} exists but is not executable at ${binary}`, {
      details: { binary, name, stderr: result.stderr },
    });
  }
}

/**
 * Run the full ingest pipeline.
 *
 * @param {object} config — from createConfig
 * @returns {{ records: object[], storeHash: string, capabilities: object }}
 * @throws {IngestError} on any pipeline failure
 */
export function runIngest(config) {
  const {
    litBinary, sofficeBinary, ghostscriptBinary, tessdataRoot,
    fileOps, clock,
  } = config;

  // ─── Dependency probes ─────────────────────────────────────────────
  probeBinary(litBinary, "lit binary", config);
  probeBinary(sofficeBinary, "LibreOffice", config);
  probeBinary(ghostscriptBinary, "Ghostscript", config);

  // Tessdata check
  for (const lang of ["eng", "vie"]) {
    const tessFile = join(tessdataRoot, `${lang}.traineddata`);
    if (!fileOps.existsSync(tessFile)) {
      throw new IngestError("E_DEPENDENCY_UNAVAILABLE", `Tessdata missing: ${lang}.traineddata at ${tessdataRoot}`, {
        details: { lang, tessdataRoot },
      });
    }
  }

  // ─── Create adapter ────────────────────────────────────────────────
  const adapter = createLiteparseAdapter(config);

  // ─── Admission ─────────────────────────────────────────────────────
  const admitted = admitInputs(config);

  // ─── Build records ─────────────────────────────────────────────────
  const { records, capabilities } = buildRecords(admitted, adapter, config);

  // ─── Round-trip verification ───────────────────────────────────────
  const { verified, failed } = verifyRoundTrips(records, adapter, config);
  if (failed > 0) {
    throw new IngestError("E_ROUND_TRIP", `${failed} round-trip failures detected`, {
      details: { verified, failed },
    });
  }

  // ─── Publication ───────────────────────────────────────────────────
  const { storeHash } = publishRecords(records, config);

  return { records, storeHash, capabilities };
}
