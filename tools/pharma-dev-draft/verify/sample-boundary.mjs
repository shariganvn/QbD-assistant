#!/usr/bin/env node
// Keeps a format reference from becoming a data source.
//
// The repo now has access to a finished P.2 for the same product, written by a different company from a
// different formula. It answers a question nothing else could — what a complete P.2 looks like — and it
// answers no question at all about this product, because not one of its numbers was measured here. The
// danger is not that someone decides to copy; it is that a section sits empty next to a section that is
// full, for months, and one number moves across without anyone deciding anything.
//
// Two rules, because two mistakes are possible:
//
//   identity — a batch number, a supplier or a DMF id from the reference cannot legitimately be ours.
//              One occurrence fails.
//   groups   — measured-looking values, grouped by the reference table they came from. One value in
//              common is a coincidence and passes; three from the same table inside one section is a
//              copied block. This is the same reasoning that found the first copied results table in
//              this project, where 25 of 45 cells matched in a block pattern.
//
// What this rule cannot do is stated plainly rather than papered over: someone who retypes a value and
// changes its last digit gets past it. Normalising the decimal separator closes one evasion; the rest
// is discipline, and draft/checklist.md says so.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashToken, tokensOf } from "./reference-tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const TOKEN_FILE = join(HERE, "format-reference-tokens.json");

export function loadReferenceTokens(path = TOKEN_FILE) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return {
    minimumGroupMatch: parsed.minimumGroupMatch ?? 3,
    identity: new Set(parsed.identity ?? []),
    groups: (parsed.groups ?? []).map((group) => ({ label: group.label, values: new Set(group.values) })),
  };
}

// Identity is checked against any text at all — a draft, a rendered document, a report. Nothing about
// the rule needs structure, because one hit is already a failure. The token is reported rather than its
// hash: whoever has to fix this needs to see what to remove, and the value is already in the file being
// checked, so naming it reveals nothing that was not there.
export function identityFailures(text, tokens, where) {
  const reported = new Set();
  const failures = [];
  for (const token of tokensOf(text)) {
    const hash = hashToken(token);
    if (!tokens.identity.has(hash) || reported.has(hash)) continue;
    reported.add(hash);
    failures.push(
      `${where}: "${token}" is an identifier from the format reference (a batch number, supplier or ` +
      "DMF id). It names something another company made; it cannot appear in this dossier.",
    );
  }
  return failures;
}

// Groups are checked per section, because the unit of copying is a table inside a section. Flattened
// text would lose that boundary and the threshold would stop meaning anything.
export function groupFailures(sections, tokens) {
  const failures = [];
  for (const section of sections ?? []) {
    const hashes = new Set(tokensOf(JSON.stringify(section)).map(hashToken));
    for (const group of tokens.groups) {
      const matched = [...group.values].filter((value) => hashes.has(value));
      if (matched.length >= tokens.minimumGroupMatch) {
        failures.push(
          `section "${section.id}": ${matched.length} measured values match one table of the format ` +
          `reference (${group.label}). One shared value is a coincidence; this many from one table is a ` +
          "copied block. Those numbers were measured by another company on another formula.",
        );
      }
    }
  }
  return failures;
}

export function draftFailures(draft, tokens = loadReferenceTokens()) {
  return [
    ...identityFailures(JSON.stringify(draft), tokens, "draft"),
    ...groupFailures(draft?.sections, tokens),
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [target, ...rest] = process.argv.slice(2);
  if (!target) {
    process.stderr.write("usage: sample-boundary.mjs <draft.json> [--text <extracted-text-file>]\n");
    process.exit(2);
  }
  const tokens = loadReferenceTokens();
  const draft = JSON.parse(readFileSync(target, "utf8"));
  const failures = draftFailures(draft, tokens);

  for (let index = 0; index < rest.length; index++) {
    if (rest[index] === "--text") {
      const textPath = rest[++index];
      failures.push(...identityFailures(readFileSync(textPath, "utf8"), tokens, `text ${textPath}`));
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`Format-reference boundary: FAIL\n${failures.map((line) => `  - ${line}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `Format-reference boundary: PASS (${tokens.identity.size} identifiers, ` +
    `${tokens.groups.length} value groups checked)\n`,
  );
}
