import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const UNZIP = "/usr/bin/unzip";

/**
 * Normalize a DOCX archive into a deterministic manifest.
 *
 * Returns { manifest, manifest_sha256, commands } where:
 * - manifest: object keyed by lexically sorted ZIP entry paths,
 *   values are lowercase SHA-256 of each entry's uncompressed bytes
 * - manifest_sha256: SHA-256 of the UTF-8 JSON.stringify of Object.entries(manifest)
 * - commands: the complete argument arrays used, in execution order
 */
export function normalizeOoxml(docxPath) {
  if (typeof docxPath !== "string" || docxPath.length === 0) {
    throw new Error("docxPath must be a non-empty string");
  }

  const commands = [];

  // Step 1: list all entries with -Z1
  const listResult = spawnSync(UNZIP, ["-Z1", docxPath], {
    encoding: "utf8",
    timeout: 30000,
  });
  commands.push(["-Z1", docxPath]);

  if (listResult.error) {
    throw new Error(`unzip list failed: ${listResult.error.message}`);
  }
  if (listResult.status !== 0) {
    throw new Error(`unzip list exited ${listResult.status}: ${listResult.stderr}`);
  }

  const entries = listResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (entries.length === 0) {
    throw new Error("DOCX archive contains no entries");
  }

  // Validate entries: reject empty, absolute, traversal paths, and duplicates
  const seen = new Set();
  for (const entry of entries) {
    if (entry.length === 0) {
      throw new Error("empty entry path");
    }
    if (entry.startsWith("/") || entry.startsWith("\\")) {
      throw new Error(`absolute entry path: ${entry}`);
    }
    const pathSegments = entry.split(/[\\/]/);
    if (pathSegments.includes("..")) {
      throw new Error(`traversal entry path: ${entry}`);
    }
    if (pathSegments.includes(".")) {
      throw new Error(`dot-segment entry path: ${entry}`);
    }
    if (seen.has(entry)) {
      throw new Error(`duplicate entry path: ${entry}`);
    }
    seen.add(entry);
  }

  // Step 2: sort entries lexically before populating manifest
  const sortedEntries = [...entries].sort();

  // Step 3: read each entry and compute SHA-256 of uncompressed bytes
  // Escape glob characters in entry paths so unzip treats them literally
  const escapeGlob = (s) => s.replace(/[\\[\]*?]/g, "\\$&");
  const manifest = {};
  for (const entry of sortedEntries) {
    const readPath = escapeGlob(entry);
    const readResult = spawnSync(UNZIP, ["-p", docxPath, readPath], {
      encoding: "buffer",
      timeout: 30000,
      maxBuffer: 100 * 1024 * 1024,
    });
    // Record the actual escaped readPath in commands
    commands.push(["-p", docxPath, readPath]);

    if (readResult.error) {
      throw new Error(`unzip read failed for ${entry}: ${readResult.error.message}`);
    }
    if (readResult.status !== 0) {
      throw new Error(`unzip read exited ${readResult.status} for ${entry}: ${readResult.stderr?.toString()}`);
    }

    const hash = createHash("sha256").update(readResult.stdout).digest("hex");
    manifest[entry] = hash;
  }

  // Step 4: compute manifest hash from the already-sorted entries
  const sortedManifestEntries = Object.entries(manifest);
  const manifestJson = JSON.stringify(sortedManifestEntries);
  const manifestSha256 = createHash("sha256")
    .update(manifestJson, "utf8")
    .digest("hex");

  return {
    manifest,
    manifest_sha256: manifestSha256,
    commands,
  };
}
