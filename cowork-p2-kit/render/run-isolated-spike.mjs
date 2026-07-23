#!/usr/bin/env node

/**
 * run-isolated-spike.mjs — Sole owner of bwrap --unshare-net isolation.
 *
 * Receives test-created absolute output and report roots. Read-only binds the
 * repository at /work and runtime paths /usr, /lib, /lib64, /bin, /etc.
 * Bind-mounts only the output and report roots writable at /out and /report.
 * Uses --tmpfs /tmp --proc /proc --dev /dev, changes to /work, and invokes
 * node on render-spike.mjs with --output-root /out --report-root /report.
 *
 * This script alone owns bwrap invocation. render-spike.mjs must NOT invoke
 * bwrap, a shell, execSync, or a fallback renderer.
 *
 * Usage:
 *   node run-isolated-spike.mjs --draft <path> --output-root <abs> --report-root <abs>
 *
 * Returns JSON on stdout with: argv, stdout, stderr, versions, output_sha256.
 */

import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = realpathSync(resolve(__dirname, "../.."));
const temporaryRoot = realpathSync(tmpdir());

// ─── Argument parsing ──────────────────────────────────────────────────

function parseArguments(argv) {
  let draftPath;
  let outputRoot;
  let reportRoot;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--draft") {
      draftPath = argv[++i];
    } else if (arg === "--output-root") {
      outputRoot = argv[++i];
    } else if (arg === "--report-root") {
      reportRoot = argv[++i];
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  if (!draftPath) {
    process.stderr.write("Missing required --draft <path>\n");
    process.exit(1);
  }
  if (!outputRoot || !isAbsolute(outputRoot)) {
    process.stderr.write("Missing or non-absolute --output-root <path>\n");
    process.exit(1);
  }
  if (!reportRoot || !isAbsolute(reportRoot)) {
    process.stderr.write("Missing or non-absolute --report-root <path>\n");
    process.exit(1);
  }

  return { draftPath, outputRoot, reportRoot };
}

// ─── bwrap discovery ───────────────────────────────────────────────────

function discoverBwrap() {
  const result = spawnSync("which", ["bwrap"], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write("bwrap not found in PATH\n");
    process.exit(1);
  }
  return result.stdout.trim();
}

// ─── Version collection ────────────────────────────────────────────────

function collectVersions() {
  const versions = {};

  const nodeResult = spawnSync("node", ["--version"], { encoding: "utf8" });
  versions.node = nodeResult.stdout?.trim() || "unknown";

  const npmResult = spawnSync("npm", ["--version"], { encoding: "utf8" });
  versions.npm = npmResult.stdout?.trim() || "unknown";

  const bwrapResult = spawnSync("bwrap", ["--version"], { encoding: "utf8" });
  versions.bwrap = bwrapResult.stdout?.trim() || "unknown";

  return versions;
}

// ─── Build argv hash ───────────────────────────────────────────────────

function hashArgv(argv) {
  return createHash("sha256").update(JSON.stringify(argv)).digest("hex").slice(0, 16);
}

function toIsolatedDraftPath(draftPath) {
  const absoluteDraftPath = isAbsolute(draftPath) ? draftPath : resolve(repoRoot, draftPath);
  let realDraftPath;
  try {
    realDraftPath = realpathSync(absoluteDraftPath);
  } catch {
    process.stderr.write("--draft must resolve to a readable file below the repository root\n");
    process.exit(1);
  }
  const relativeDraftPath = relative(repoRoot, realDraftPath);
  if (
    relativeDraftPath === ""
    || relativeDraftPath === ".."
    || relativeDraftPath.startsWith(`..${sep}`)
    || isAbsolute(relativeDraftPath)
  ) {
    process.stderr.write("--draft must resolve to a file below the repository root\n");
    process.exit(1);
  }
  return join("/work", relativeDraftPath);
}

function resolveWritableRoot(root, label) {
  let rootStat;
  let realRoot;
  try {
    if (lstatSync(root).isSymbolicLink()) throw new Error("symlink");
    rootStat = statSync(root);
    realRoot = realpathSync(root);
  } catch {
    process.stderr.write(`--${label}-root must be an existing non-symlink directory\n`);
    process.exit(1);
  }
  if (!rootStat.isDirectory() || dirname(realRoot) !== temporaryRoot || !basename(realRoot).startsWith(`isolated-${label}-`)) {
    process.stderr.write(`--${label}-root must be a direct test-created child of ${temporaryRoot}\n`);
    process.exit(1);
  }
  return realRoot;
}

// ─── Main ──────────────────────────────────────────────────────────────

function main() {
  const { draftPath, outputRoot: requestedOutputRoot, reportRoot: requestedReportRoot } = parseArguments(process.argv.slice(2));

  // Discover bwrap
  const bwrapPath = discoverBwrap();

  // The sandbox exposes the repository only at /work, never at its host path.
  const isolatedDraftPath = toIsolatedDraftPath(draftPath);
  const outputRoot = resolveWritableRoot(requestedOutputRoot, "output");
  const reportRoot = resolveWritableRoot(requestedReportRoot, "report");
  if (outputRoot === reportRoot) {
    process.stderr.write("--output-root and --report-root must be different directories\n");
    process.exit(1);
  }

  // The spike script path (relative to /work mount point)
  const spikeScript = "cowork-p2-kit/render/render-spike.mjs";

  // Build bwrap argument array — NOT a shell string
  const bwrapArgs = [
    "--unshare-net",
    // Read-only bind the repository
    "--ro-bind", repoRoot, "/work",
    // Read-only bind runtime paths
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/etc", "/etc",
    // Writable bind-mounts for output and report
    "--bind", outputRoot, "/out",
    "--bind", reportRoot, "/report",
    // Temp, proc, dev
    "--tmpfs", "/tmp",
    "--proc", "/proc",
    "--dev", "/dev",
    // Change to work directory
    "--chdir", "/work",
    // Execute node on the spike script
    "node", spikeScript,
    "--draft", isolatedDraftPath,
    "--output-root", "/out",
    "--report-root", "/report",
  ];

  // Collect versions before isolation
  const versions = collectVersions();

  // Run bwrap
  const result = spawnSync(bwrapPath, bwrapArgs, {
    encoding: "utf8",
    timeout: 60_000,
  });

  const stdout = result.stdout ?? "";
  const stderr = `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;

  // Compute output hash from the published file
  let outputHash = null;
  try {
    const outputFiles = readdirSync(outputRoot);
    const docxFile = outputFiles.find((f) => f.endsWith(".docx"));
    if (docxFile) {
      const content = readFileSync(join(outputRoot, docxFile));
      outputHash = createHash("sha256").update(content).digest("hex");
    }
  } catch {
    // Output hash is best-effort
  }

  // Build the snapshot record
  const snapshot = {
    argv: [bwrapPath, ...bwrapArgs],
    argv_hash: hashArgv([bwrapPath, ...bwrapArgs]),
    stdout,
    stderr,
    exit_code: result.status,
    versions,
    output_sha256: outputHash,
    timestamp: new Date().toISOString(),
  };

  // Write snapshot to report root
  const snapshotPath = join(reportRoot, "isolated-snapshot.json");
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");

  // Output snapshot JSON to stdout for the test to capture
  process.stdout.write(JSON.stringify(snapshot));

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

main();
