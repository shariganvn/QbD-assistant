#!/usr/bin/env node
// Builds verify/format-reference-tokens.json from a document used as a FORMAT reference.
//
// The reference document is deliberately NOT committed: it is another company's dossier, and putting
// it in the repo would be the very mixing this rule exists to prevent. What is committed is the hash
// list this script produces, which is reproducible by anyone holding the same reference document.
//
// Two kinds of token come out, because two kinds of mistake are possible:
//
//   identity  — a batch number, a supplier, a DMF number. These can never legitimately be ours, so one
//               occurrence is a failure. Supplied by hand via --identity: a generated guess at "what
//               looks like a batch number" would both miss some and, worse, invent some.
//   groups    — measured-looking values, kept per table of the reference. A single shared value is a
//               coincidence; several from one table landing in one section is a copied block.
//
// Excipient names are deliberately NOT in either list. Crospovidone, hypromellose and titanium dioxide
// are ordinary excipients that our own formula may legitimately come to use, and a rule that fires on
// legitimate content is a rule someone switches off.
//
// Usage:
//   node verify/build-reference-tokens.mjs --reference <extracted-text> --exclude <draft.json>
//        --identity <plaintext-lines-file> [--label "<what the reference is>"] -o <out.json>

import { readFileSync, writeFileSync } from "node:fs";

import { HASH_ALGORITHM, hashToken, measuredValuesOf, tokensOf } from "./reference-tokens.mjs";

const MINIMUM_GROUP_SIZE = 3;

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--reference") options.reference = argv[++index];
    else if (argument === "--exclude") options.exclude = argv[++index];
    else if (argument === "--identity") options.identity = argv[++index];
    else if (argument === "--label") options.label = argv[++index];
    else if (argument === "-o" || argument === "--output") options.output = argv[++index];
    else throw new Error(`unsupported option: ${argument}`);
  }
  for (const required of ["reference", "exclude", "identity", "output"]) {
    if (!options[required]) throw new Error(`missing --${required}`);
  }
  return options;
}

// A run of consecutive pipe-delimited lines is one table. The caption that precedes it is only used as
// a human-readable label, so a reference whose tables are unnumbered still groups correctly.
function tableBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;
  let lastCaption = "";
  lines.forEach((line, index) => {
    const isRow = line.trimStart().startsWith("|");
    if (isRow) {
      if (!current) current = { label: lastCaption || `reference table at line ${index + 1}`, rows: [] };
      current.rows.push(line);
      return;
    }
    if (current) {
      blocks.push(current);
      current = null;
    }
    // Only the table's NUMBER is kept, never its caption text. A caption naming the trial batch carries
    // the other company's batch number, so storing it would put in plaintext exactly what the identity
    // list exists to keep out — and would make this file trip its own rule.
    const caption = /^\s*Table\s+(\d+)\b/.exec(line);
    if (caption) lastCaption = `reference table ${caption[1]}`;
  });
  if (current) blocks.push(current);
  return blocks;
}

const options = parseArguments(process.argv.slice(2));
const referenceText = readFileSync(options.reference, "utf8");
const excludeText = readFileSync(options.exclude, "utf8");

// Anything already present in our own draft is excluded outright. The gate must be incapable of firing
// on content that was here before the reference document arrived, or its first run is a false alarm and
// nobody trusts the second.
const excluded = new Set(tokensOf(excludeText).map(hashToken));

const identityPlaintexts = readFileSync(options.identity, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const identity = [];
const identitySkipped = [];
for (const plaintext of identityPlaintexts) {
  const hash = hashToken(plaintext);
  if (!hash) continue;
  if (excluded.has(hash)) identitySkipped.push(plaintext);
  else if (!identity.includes(hash)) identity.push(hash);
}

const groups = [];
let droppedGroups = 0;
for (const block of tableBlocks(referenceText)) {
  const values = [...new Set(measuredValuesOf(block.rows.join("\n")).map(hashToken))]
    .filter((hash) => hash && !excluded.has(hash));
  if (values.length < MINIMUM_GROUP_SIZE) {
    droppedGroups++;
    continue;
  }
  groups.push({ label: block.label, values });
}

const output = {
  _why:
    "Hashes of names and values from a document used as a format reference. The rule they serve: a " +
    "reference used for FORMAT must never become a source of DATA. Hashes, not values, so this file " +
    "is not itself a copy of the other company's dossier.",
  _reference: options.label ?? "unnamed format reference (not committed)",
  _reproduce:
    "node verify/build-reference-tokens.mjs --reference <extracted text of the reference> " +
    "--exclude draft/example-draft.json --identity <identity plaintext lines> -o " +
    "verify/format-reference-tokens.json",
  _identityMeaning: "one occurrence anywhere is a failure: a batch number, supplier or DMF id can never be ours",
  _groupMeaning:
    `${MINIMUM_GROUP_SIZE} or more values from one group inside one draft section is a copied block; ` +
    "one shared value is a coincidence and is allowed",
  hashAlgorithm: HASH_ALGORITHM,
  minimumGroupMatch: MINIMUM_GROUP_SIZE,
  identity,
  groups,
};

writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");

process.stdout.write(
  `identity hashes: ${identity.length}` +
  (identitySkipped.length ? ` (skipped, already in our draft: ${identitySkipped.join(", ")})` : "") +
  `\ngroups: ${groups.length} (dropped for holding fewer than ${MINIMUM_GROUP_SIZE} distinct measured values: ${droppedGroups})` +
  `\ngroup values total: ${groups.reduce((sum, group) => sum + group.values.length, 0)}\n`,
);
