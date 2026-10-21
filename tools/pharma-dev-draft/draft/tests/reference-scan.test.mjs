// The format reference is another company's dossier. Its identifying tokens are kept out of the draft
// and the rendered document by sample-boundary.mjs; this runs the same identity rule over everything
// the workstream wrote as files — the tool's source, tests, schemas and notes, and the report and plan
// that describe the comparison — because a report about a dossier is exactly where one of its batch
// numbers would be quoted "for reference".
//
// It also checks the report against the outline: every section id the report names exists, so a
// renumbering that leaves the report describing sections that are gone fails here rather than in a
// reviewer's hands.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { identityFailures, loadReferenceTokens, TOKEN_FILE } from "../../verify/sample-boundary.mjs";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = join(toolRoot, "..", "..");
const TEXT_EXTENSIONS = new Set([".mjs", ".js", ".md", ".json", ".yaml", ".yml", ".txt"]);
const SKIPPED_DIRECTORIES = new Set(["output", "node_modules", ".git"]);

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const name of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else if (TEXT_EXTENSIONS.has(name.slice(name.lastIndexOf(".")))) found.push(path);
  }
  return found;
}

const SCANNED = [
  toolRoot,
  join(repoRoot, "docs", "reports", "qbd-p2-format-reference"),
  join(repoRoot, "docs", "plans", "qbd-p2-format-reference"),
  join(repoRoot, "docs", "reports", "qbd-p2-ich-q8r2-audit"),
];

test("no file the workstream wrote carries an identifying token of the format reference", () => {
  const tokens = loadReferenceTokens();
  const files = SCANNED.flatMap(filesUnder).filter((path) => path !== TOKEN_FILE);
  assert.ok(files.length > 30, `scanned only ${files.length} files — the walk is not finding them`);
  const failures = files.flatMap((path) => identityFailures(readFileSync(path, "utf8"), tokens, relative(repoRoot, path)));
  assert.deepEqual(failures, []);
});

test("the scan would notice a token if one were there", () => {
  const tokens = loadReferenceTokens();
  assert.ok(tokens.identity.size > 0, "the token file holds no identity hashes, so the scan above proves nothing");
});

test("every section id the comparison report names is a section of the outline", () => {
  const outline = JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
  const known = new Set(outline.sections.map((section) => section.id));
  const report = readFileSync(join(repoRoot, "docs", "reports", "qbd-p2-format-reference", "format-reference-comparison.md"), "utf8");
  const cited = [...new Set([...report.matchAll(/\bP\.2(?:\.\d+)+\b/g)].map((match) => match[0]))];
  assert.ok(cited.length > 0, "the report cites no section");
  const unknown = cited.filter((id) => !known.has(id));
  assert.deepEqual(unknown, [], `the report names sections the outline does not have: ${unknown.join(", ")}`);
});
