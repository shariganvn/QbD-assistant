#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const repoRoot = realpathSync(resolve(import.meta.dirname, "../.."));
const temporaryRoot = realpathSync(tmpdir());

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--draft", "--field-map", "--receipt", "--output-root", "--report-root"].includes(flag) || !value) {
      fail("expected --draft, --field-map, --receipt, --output-root and --report-root values");
    }
    options[flag.slice(2).replaceAll("-", "_")] = value;
  }
  for (const key of ["draft", "field_map", "receipt", "output_root", "report_root"]) {
    if (!options[key]) fail(`${key} is required`);
  }
  return options;
}

function discoverBwrap() {
  const result = spawnSync("which", ["bwrap"], { encoding: "utf8" });
  if (result.status !== 0) fail("bwrap not found in PATH");
  return result.stdout.trim();
}

function isolatedReadablePath(requested, label) {
  const absolute = isAbsolute(requested) ? requested : resolve(repoRoot, requested);
  let real;
  try { real = realpathSync(absolute); } catch { fail(`${label} must resolve to a readable file below the repository root`); }
  const local = relative(repoRoot, real);
  if (!local || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) fail(`${label} must stay below the repository root`);
  return join("/work", local);
}

function writableRoot(requested, label) {
  let real;
  try {
    if (lstatSync(requested).isSymbolicLink() || !statSync(requested).isDirectory()) throw new Error("invalid");
    real = realpathSync(requested);
  } catch {
    fail(`${label} root must be an existing non-symlink directory`);
  }
  if (dirname(real) !== temporaryRoot || !basename(real).startsWith(`isolated-${label}-`)) {
    fail(`${label} root must be a direct test-created child of ${temporaryRoot}`);
  }
  return real;
}

function version(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.stdout?.trim() || "unknown";
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const bwrap = discoverBwrap();
  const outputRoot = writableRoot(options.output_root, "output");
  const reportRoot = writableRoot(options.report_root, "report");
  if (outputRoot === reportRoot) fail("output and report roots must differ");
  const args = [
    "--unshare-net",
    "--ro-bind", repoRoot, "/work",
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/etc", "/etc",
    "--bind", outputRoot, "/out",
    "--bind", reportRoot, "/report",
    "--tmpfs", "/tmp",
    "--proc", "/proc",
    "--dev", "/dev",
    "--chdir", "/work",
    "node", "cowork-p2-kit/render/template-bound-review-docx.mjs",
    "--draft", isolatedReadablePath(options.draft, "draft"),
    "--field-map", isolatedReadablePath(options.field_map, "field map"),
    "--receipt", isolatedReadablePath(options.receipt, "receipt"),
    "--output-root", "/out",
  ];
  const result = spawnSync(bwrap, args, { encoding: "utf8", timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
  const outputFile = readdirSync(outputRoot).find((name) => name === "p2.2.1-review.docx");
  const outputSha256 = outputFile ? createHash("sha256").update(readFileSync(join(outputRoot, outputFile))).digest("hex") : null;
  const argv = [bwrap, ...args];
  const snapshot = {
    argv,
    argv_hash: createHash("sha256").update(JSON.stringify(argv)).digest("hex").slice(0, 16),
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
    exit_code: result.status,
    versions: { node: version("node"), npm: version("npm"), bwrap: version("bwrap") },
    output_sha256: outputSha256,
  };
  writeFileSync(join(reportRoot, "isolated-template-review-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(JSON.stringify(snapshot));
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

main();
