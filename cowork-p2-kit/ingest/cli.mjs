#!/usr/bin/env node

/**
 * cli.mjs — Thin composition root and exit-code mapping.
 *
 * main(argv) is the only code that renders an IngestError and maps it to an exit code.
 * No library module calls process.exit().
 *
 * Usage:
 *   node cowork-p2-kit/ingest/cli.mjs
 *   node cowork-p2-kit/ingest/cli.mjs --config <absolute-config.json>
 */

import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IngestError } from "./errors.mjs";
import { createConfig } from "./config.mjs";
import { runIngest } from "./pipeline.mjs";

const ALLOWED_CONFIG_KEYS = new Set([
  "inputsRoot", "storeRoot", "artifactRoot", "kitDir",
  "litBinary", "sofficeBinary", "ghostscriptBinary", "tessdataRoot",
]);

/**
 * Parse CLI arguments into a config overrides object.
 * @param {string[]} argv — process.argv.slice(2)
 * @returns {object} config overrides
 * @throws {IngestError}
 */
function parseArgs(argv) {
  if (argv.length === 0) return {};

  if (argv.length !== 2 || argv[0] !== "--config") {
    throw new IngestError("E_CONFIG", "Usage: cli.mjs [--config <absolute-config.json>]", {
      details: { argv },
    });
  }

  const configPath = argv[1];

  if (!isAbsolute(configPath)) {
    throw new IngestError("E_CONFIG", `Config path must be absolute: ${configPath}`, {
      details: { configPath },
    });
  }

  const resolved = resolve(configPath);
  if (!existsSync(resolved)) {
    throw new IngestError("E_CONFIG", `Config file not found: ${resolved}`, {
      details: { configPath: resolved },
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(resolved, "utf-8"));
  } catch (err) {
    throw new IngestError("E_CONFIG", `Invalid config JSON: ${err.message}`, {
      cause: err,
      details: { configPath: resolved },
    });
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new IngestError("E_CONFIG", "Config JSON must be an object of absolute path values", {
      details: { configPath: resolved },
    });
  }

  // Reject unknown keys — programmatic collaborators are not JSON-serializable
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      throw new IngestError("E_CONFIG", `Unknown config key: "${key}" — only path values are accepted via --config`, {
        details: { key, allowed: [...ALLOWED_CONFIG_KEYS] },
      });
    }
  }

  // Validate all path values are absolute
  for (const key of ALLOWED_CONFIG_KEYS) {
    if (parsed[key] !== undefined && (typeof parsed[key] !== "string" || !isAbsolute(parsed[key]))) {
      throw new IngestError("E_CONFIG", `Config "${key}" must be absolute: ${parsed[key]}`, {
        details: { key, value: parsed[key] },
      });
    }
  }

  return parsed;
}

/**
 * Main entry point.
 * @param {string[]} argv — process.argv.slice(2)
 */
export async function main(argv) {
  try {
    const overrides = parseArgs(argv);
    const config = createConfig(overrides);
    const result = runIngest(config);

    console.log(`\n=== Ingest Complete ===`);
    console.log(`  Total records: ${result.recordCount}`);
    console.log(`  Store: ${result.storePath}`);
    console.log(`  Store hash: ${result.storeHash}`);
    console.log(`  Capabilities: ${JSON.stringify(result.capabilities)}`);
  } catch (err) {
    if (err instanceof IngestError) {
      console.error(err.format());
      process.exitCode = 1;
      return;
    }
    console.error(`FATAL: ${err.message}`);
    process.exitCode = 1;
  }
}

// Direct execution
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main(process.argv.slice(2));
}
