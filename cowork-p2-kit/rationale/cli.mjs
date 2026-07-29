#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RationalePacketError } from "./errors.mjs";
import { sealRationalePacket } from "./packet.mjs";
import { publishRationale } from "./rationale-publication.mjs";

const cliPath = fileURLToPath(import.meta.url);
const defaultPublicationRoot = resolve(dirname(cliPath), "../../docs/reports/qbd-rationale-report-layer/rationale");
const p4DecisionRoot = resolve(dirname(cliPath), "../../docs/reports/qbd-p4-reasoning-layer/decision");
const sealRequired = ["source-package", "store", "output-root"];
const publishRequired = ["packet", "rationale", "output-root"];

function parseArguments(argv, command, required, code) {
  if (argv[0] !== command) throw new RationalePacketError(code, `Usage: cli.mjs ${command} ${required.map((key) => `--${key} <path>`).join(" ")}`);
  const paths = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    const key = flag?.startsWith("--") ? flag.slice(2) : null;
    if (!key || !required.includes(key) || !value || paths[key] !== undefined) throw new RationalePacketError(code, `${command} requires unique declared option/value pairs`);
    paths[key] = value;
  }
  if (!required.every((key) => typeof paths[key] === "string")) throw new RationalePacketError(code, `${command} requires all declared options`);
  return paths;
}

function readStore(path) {
  try { return { bytes: readFileSync(path) }; }
  catch (error) { throw new RationalePacketError("E_PACKET_SOURCE_INVALID", `cannot read source store: ${error.message}`, { cause: error }); }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new RationalePacketError("E_RATIONALE_PUBLICATION_RECEIPT", `cannot read publication input: ${error.message}`, { cause: error }); }
}

export function createRationaleCli({ publicationRoot = defaultPublicationRoot, fileSystem } = {}) {
  const declaredRoot = resolve(publicationRoot);
  if (declaredRoot === p4DecisionRoot) throw new RationalePacketError("E_PACKET_PATH", "the P4 decision root is never a rationale publication root");
  return {
    main(argv) {
      const command = argv[0];
      if (command === "seal-packet") {
        const paths = parseArguments(argv, "seal-packet", sealRequired, "E_PACKET_PATH");
        const outputRoot = resolve(paths["output-root"]);
        if (outputRoot !== declaredRoot) throw new RationalePacketError("E_PACKET_PATH", "rationale packet must use the declared output root");
        return sealRationalePacket({ sourcePackage: paths["source-package"], store: readStore(paths.store), outputRoot: declaredRoot, ...(fileSystem === undefined ? {} : { fileSystem }) });
      }
      if (command !== "publish-rationale") throw new RationalePacketError("E_RATIONALE_PUBLICATION_PATH", "Usage: cli.mjs publish-rationale --packet <file> --rationale <file> --output-root <dir>");
      const paths = parseArguments(argv, "publish-rationale", publishRequired, "E_RATIONALE_PUBLICATION_PATH");
      const outputRoot = resolve(paths["output-root"]);
      if (outputRoot !== declaredRoot) throw new RationalePacketError("E_RATIONALE_PUBLICATION_PATH", "rationale package must use the declared output root");
      return publishRationale({ packet: readJson(paths.packet), rationale: readJson(paths.rationale), outputRoot: declaredRoot, ...(fileSystem === undefined ? {} : { fileSystem }) });
    },
  };
}

export function main(argv) {
  return createRationaleCli().main(argv);
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    process.stdout.write(`${process.argv[2] === "publish-rationale" ? "Published rationale package" : "Sealed rationale packet"}: ${main(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code ?? "E_PACKET_WRITE"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
