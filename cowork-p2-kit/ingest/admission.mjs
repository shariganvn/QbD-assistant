/**
 * admission.mjs — Enumeration, manifest checks, and fail-closed admission.
 *
 * admitInputs(config) returns admitted files sorted by POSIX relative path
 * or throws an IngestError. Every trust boundary rejection is explicit.
 */

import { posix, relative, resolve, extname } from "node:path";
import { IngestError } from "./errors.mjs";

/**
 * Enumerate files in a directory, rejecting symlinks and non-files.
 * @param {string} dir — absolute directory path
 * @param {object} fileOps
 * @returns {string[]} absolute file paths
 */
function enumerateFiles(dir, fileOps) {
  if (!fileOps.existsSync(dir)) return [];
  const entries = fileOps.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    const abs = resolve(dir, entry.name);
    // Symlink check first — entry.isFile() returns false for symlinks,
    // so checking isFile() before isSymbolicLink() would silently drop them.
    if (entry.isSymbolicLink()) {
      throw new IngestError("E_SYMLINK", `Symlink rejected: ${abs}`, {
        details: { path: abs },
      });
    }
    if (!entry.isFile()) continue;
    files.push(abs);
  }
  return files;
}

/**
 * Validate a single file path against security boundaries.
 * @param {string} abs — absolute path
 * @param {string} inputsRoot — absolute root
 * @param {object} config
 */
function validateFilePath(abs, inputsRoot, config) {
  const { fileOps, supportedExtensions } = config;

  // Reject symlinks
  const stat = fileOps.lstatSync(abs);
  if (stat.isSymbolicLink()) {
    throw new IngestError("E_SYMLINK", `Symlink rejected: ${abs}`, {
      details: { path: abs },
    });
  }

  // Reject path traversal — resolved path must stay within inputsRoot
  const resolved = resolve(abs);
  if (!resolved.startsWith(inputsRoot + "/") && resolved !== inputsRoot) {
    throw new IngestError("E_PATH_ESCAPE", `Path escapes inputs root: ${abs}`, {
      details: { path: abs, inputsRoot },
    });
  }

  // Reject unsupported extensions
  const ext = extname(abs).toLowerCase();
  if (!supportedExtensions.has(ext)) {
    const rel = posix.normalize(relative(inputsRoot, abs));
    throw new IngestError("E_INPUT_UNSUPPORTED", `Unsupported file extension (${ext}): ${rel}`, {
      details: { path: rel, extension: ext },
    });
  }
}

/**
 * Load and validate the classification manifest.
 * @param {string} manifestPath
 * @param {object} fileOps
 * @returns {object} parsed manifest
 */
function loadManifest(manifestPath, fileOps) {
  if (!fileOps.existsSync(manifestPath)) {
    throw new IngestError("E_MANIFEST_MISSING", `Classification manifest not found: ${manifestPath}`, {
      details: { path: manifestPath },
    });
  }
  const raw = fileOps.readFileSync(manifestPath, "utf-8");
  try {
    const manifest = JSON.parse(raw);
    if (manifest === null || Array.isArray(manifest) || typeof manifest !== "object") {
      throw new Error("Manifest root must be an object");
    }
    return manifest;
  } catch (err) {
    throw new IngestError("E_MANIFEST_INVALID", `Invalid classification manifest: ${err.message}`, {
      cause: err,
      details: { path: manifestPath },
    });
  }
}

/**
 * Validate a file's manifest entry.
 * @param {string} relPath — POSIX relative path
 * @param {object} manifest
 */
function validateManifestEntry(relPath, manifest) {
  const entry = manifest[relPath];
  if (!entry) {
    throw new IngestError("E_MANIFEST_ENTRY_MISSING", `File not in manifest: ${relPath}`, {
      details: { path: relPath },
    });
  }
  if (entry.label !== "public") {
    throw new IngestError("E_NOT_PUBLIC", `File label is "${entry.label}", not "public": ${relPath}`, {
      details: { path: relPath, label: entry.label },
    });
  }
  if (typeof entry.citable !== "boolean") {
    throw new IngestError("E_MANIFEST_INVALID", `Invalid citable field for: ${relPath}`, {
      details: { path: relPath, citable: entry.citable },
    });
  }
  if (!entry.ocr_language) {
    throw new IngestError("E_MANIFEST_INVALID", `Missing ocr_language for: ${relPath}`, {
      details: { path: relPath },
    });
  }
  if (!["eng", "vie"].includes(entry.ocr_language)) {
    throw new IngestError("E_MANIFEST_INVALID", `Invalid ocr_language "${entry.ocr_language}" for: ${relPath}`, {
      details: { path: relPath, ocr_language: entry.ocr_language },
    });
  }
  return entry;
}

/**
 * Admit inputs: enumerate, validate, and sort by POSIX relative path.
 *
 * @param {object} config — from createConfig
 * @returns {{ filePath: string, relPath: string, entry: object }[]}
 * @throws {IngestError} on any trust boundary violation
 */
export function admitInputs(config) {
  const { inputsRoot, trialsRoot, referenceRoot, manifestPath, fileOps, supportedExtensions, kitDir } = config;

  // Enumerate files from both directories
  const trialFiles = enumerateFiles(trialsRoot, fileOps);
  const refFiles = enumerateFiles(referenceRoot, fileOps);
  const allFiles = [...trialFiles, ...refFiles];

  if (allFiles.length === 0) {
    throw new IngestError("E_INPUT_EMPTY", "No supported files found in inputs/trials/ or inputs/reference/. Run: npm run inputs:build");
  }

  // Validate each file path
  for (const abs of allFiles) {
    validateFilePath(abs, inputsRoot, { fileOps, supportedExtensions });
  }

  // Load manifest
  const manifest = loadManifest(manifestPath, fileOps);

  // Check for duplicate normalized paths and validate manifest entries
  const seenPaths = new Set();
  const admitted = [];

  for (const abs of allFiles) {
    const relPath = posix.normalize(relative(kitDir, abs));

    // Duplicate check
    if (seenPaths.has(relPath)) {
      throw new IngestError("E_DUPLICATE_PATH", `Duplicate file path: ${relPath}`, {
        details: { path: relPath },
      });
    }
    seenPaths.add(relPath);

    // Manifest validation
    const entry = validateManifestEntry(relPath, manifest);

    admitted.push({ filePath: abs, relPath, entry });
  }

  // Sort by POSIX relative path for deterministic order
  admitted.sort((a, b) => a.relPath.localeCompare(b.relPath));

  return admitted;
}
