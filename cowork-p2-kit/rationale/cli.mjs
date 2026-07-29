#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RationalePacketError } from "./errors.mjs";
import { sealRationalePacket } from "./packet.mjs";

const cliPath = fileURLToPath(import.meta.url);
const defaultPublicationRoot = resolve(dirname(cliPath), "../../docs/reports/qbd-rationale-report-layer/rationale");
const p4DecisionRoot = resolve(dirname(cliPath), "../../docs/reports/qbd-p4-reasoning-layer/decision");
const required = ["source-package", "store", "output-root"];

function parseArguments(argv) {
  if (argv[0] !== "seal-packet") throw new RationalePacketError("E_PACKET_PATH", "Usage: cli.mjs seal-packet --source-package <dir> --store <file> --output-root <dir>");
  const paths = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    const key = flag?.startsWith("--") ? flag.slice(2) : null;
    if (!key || !required.includes(key) || !value || paths[key] !== undefined) throw new RationalePacketError("E_PACKET_PATH", "seal-packet requires unique declared option/value pairs");
    paths[key] = value;
  }
  if (!required.every((key) => typeof paths[key] === "string")) throw new RationalePacketError("E_PACKET_PATH", "seal-packet requires source package, store, and output root");
  return paths;
}

function readStore(path) {
  try { return { bytes: readFileSync(path) }; }
  catch (error) { throw new RationalePacketError("E_PACKET_SOURCE_INVALID", `cannot read source store: ${error.message}`, { cause: error }); }
}

export function createRationaleCli({ publicationRoot = defaultPublicationRoot, fileSystem } = {}) {
  const declaredRoot = resolve(publicationRoot);
  if (declaredRoot === p4DecisionRoot) throw new RationalePacketError("E_PACKET_PATH", "the P4 decision root is never a rationale publication root");
  return {
    main(argv) {
      const paths = parseArguments(argv);
      const outputRoot = resolve(paths["output-root"]);
      if (outputRoot !== declaredRoot) throw new RationalePacketError("E_PACKET_PATH", "rationale packet must use the declared output root");
      return sealRationalePacket({ sourcePackage: paths["source-package"], store: readStore(paths.store), outputRoot: declaredRoot, ...(fileSystem === undefined ? {} : { fileSystem }) });
    },
  };
}

export function main(argv) {
  return createRationaleCli().main(argv);
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    process.stdout.write(`Sealed rationale packet: ${main(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code ?? "E_PACKET_WRITE"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
