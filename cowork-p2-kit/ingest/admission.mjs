/** Fail-closed input enumeration and manifest admission. */

import { extname, posix, relative, resolve } from "node:path";
import { IngestError } from "./errors.mjs";
import { canonicalRoot, inside } from "./publication-support.mjs";

function reject(code, message, details) {
  throw new IngestError(code, message, { details });
}

function filesIn(dir, root, config) {
  const { fileOps } = config;
  if (!fileOps.existsSync(dir)) return [];
  const canonicalDir = canonicalRoot(dir, fileOps);
  if (!inside(root, canonicalDir)) reject("E_PATH_ESCAPE", `Input directory escapes configured root: ${dir}`);
  const files = [];
  for (const entry of fileOps.readdirSync(canonicalDir, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") continue;
    const path = resolve(canonicalDir, entry.name);
    if (entry.isSymbolicLink()) reject("E_SYMLINK", `Symlink rejected: ${path}`, { path });
    if (!entry.isFile()) continue;
    const stat = fileOps.lstatSync(path);
    if (stat.isSymbolicLink() || fileOps.realpathSync(path) !== path) reject("E_SYMLINK", `Symlink rejected: ${path}`, { path });
    if (!inside(root, path)) reject("E_PATH_ESCAPE", `Input escapes configured root: ${path}`, { path, root });
    files.push(path);
  }
  return files;
}

function loadManifest(path, inputsRoot, config) {
  const { fileOps } = config;
  if (!inside(inputsRoot, path)) reject("E_PATH_ESCAPE", `Manifest escapes configured root: ${path}`);
  if (!fileOps.existsSync(path)) reject("E_MANIFEST_MISSING", `Classification manifest not found: ${path}`, { path });
  if (fileOps.lstatSync(path).isSymbolicLink() || fileOps.realpathSync(path) !== path) reject("E_SYMLINK", `Symlink rejected: ${path}`, { path });
  try {
    const manifest = JSON.parse(fileOps.readFileSync(path, "utf-8"));
    if (manifest === null || Array.isArray(manifest) || typeof manifest !== "object") throw new Error("Manifest root must be an object");
    return manifest;
  } catch (cause) {
    if (cause instanceof IngestError) throw cause;
    throw new IngestError("E_MANIFEST_INVALID", `Invalid classification manifest: ${cause.message}`, { cause, details: { path } });
  }
}

function entryFor(relPath, manifest) {
  const entry = manifest[relPath];
  if (!entry) reject("E_MANIFEST_ENTRY_MISSING", `File not in manifest: ${relPath}`, { path: relPath });
  if (entry.label !== "public") reject("E_NOT_PUBLIC", `File label is "${entry.label}", not "public": ${relPath}`, { path: relPath, label: entry.label });
  if (typeof entry.citable !== "boolean" || !["eng", "vie"].includes(entry.ocr_language)) {
    reject("E_MANIFEST_INVALID", `Invalid manifest metadata for: ${relPath}`, { path: relPath });
  }
  return entry;
}

/** Return admitted input files in deterministic POSIX-relative order. */
export function admitInputs(config) {
  const { inputsRoot, trialsRoot, referenceRoot, manifestPath, kitDir, fileOps, supportedExtensions } = config;
  const canonicalInputs = canonicalRoot(inputsRoot, fileOps);
  const canonicalKit = canonicalRoot(kitDir, fileOps);
  if (!inside(canonicalKit, canonicalInputs)) reject("E_PATH_ESCAPE", `Inputs root escapes kit root: ${inputsRoot}`);
  const allFiles = [...filesIn(trialsRoot, canonicalInputs, config), ...filesIn(referenceRoot, canonicalInputs, config)];
  if (!allFiles.length) reject("E_INPUT_EMPTY", "No supported files found in inputs/trials/ or inputs/reference/. Run: npm run inputs:build");
  const manifest = loadManifest(resolve(manifestPath), canonicalInputs, config);
  const seen = new Set();
  const admitted = allFiles.map((filePath) => {
    const extension = extname(filePath).toLowerCase();
    const relPath = posix.normalize(relative(canonicalKit, filePath).replaceAll("\\", "/"));
    if (!inside(canonicalInputs, filePath) || relPath === ".." || relPath.startsWith("../")) reject("E_PATH_ESCAPE", `Path escapes configured root: ${filePath}`, { path: filePath });
    if (seen.has(relPath)) reject("E_DUPLICATE_PATH", `Duplicate file path: ${relPath}`, { path: relPath });
    seen.add(relPath);
    if (!supportedExtensions.has(extension)) reject("E_INPUT_UNSUPPORTED", `Unsupported file extension (${extension}): ${relPath}`, { path: relPath, extension });
    return { filePath, relPath, entry: entryFor(relPath, manifest) };
  });
  return admitted.sort((left, right) => left.relPath.localeCompare(right.relPath));
}
