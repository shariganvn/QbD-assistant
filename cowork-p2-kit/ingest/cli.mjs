#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const cliPath = fileURLToPath(import.meta.url);
const legacyIngestPath = fileURLToPath(new URL("./legacy-ingest.mjs", import.meta.url));

export function resolveChildExitCode(result) {
  return Number.isInteger(result.status) ? result.status : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === cliPath) {
  const result = spawnSync(
    process.execPath,
    [legacyIngestPath, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );

  process.exitCode = resolveChildExitCode(result);
}
