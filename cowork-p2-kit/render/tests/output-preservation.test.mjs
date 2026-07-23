import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RenderPublicationError, publishBuffer } from "../publication.mjs";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const renderEntry = resolve(testDir, "../render-docx.mjs");
const fixtureDir = resolve(testDir, "fixtures/output-preservation");
const contractFixtureDir = resolve(testDir, "fixtures/contract");

function hashFiles(root) {
  const hashes = {};
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else hashes[relative(root, path)] = createHash("sha256").update(readFileSync(path)).digest("hex");
    }
  };
  visit(root);
  return hashes;
}

function createOutputRoot() {
  const root = mkdtempSync(join(tmpdir(), "qbd-render-output-"));
  writeFileSync(join(root, "seeded-output.docx"), Buffer.from("seeded DOCX bytes"));
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "nested", "seeded-note.txt"), "preserve this nested file");
  return root;
}

function runRender(inputPath, outputRoot) {
  return spawnSync(process.execPath, [renderEntry, inputPath, "--output-root", outputRoot], {
    encoding: "utf8",
  });
}

test("invalid draft inputs preserve every file in the injected output root and declare their failure code", () => {
  const cases = [
    [join(fixtureDir, "invalid-json.txt"), "E_DRAFT_JSON"],
    [join(fixtureDir, "missing-input.json"), "E_DRAFT_INPUT"],
    [join(contractFixtureDir, "uncitable.json"), "E_CITATION_UNCITABLE"],
    [join(contractFixtureDir, "missing-classification.json"), "E_CITATION_ENVELOPE"],
    [join(contractFixtureDir, "invalid-links.json"), "E_EVIDENCE_LINK_POLICY"],
    [join(contractFixtureDir, "unresolved-citation.json"), "E_CITATION_UNRESOLVED"],
    [join(contractFixtureDir, "invalid-source.json"), "E_CITATION_ENVELOPE"],
    [join(contractFixtureDir, "invalid-block.json"), "E_DRAFT_BLOCK"],
  ];
  const outputRoot = createOutputRoot();
  try {
    const before = hashFiles(outputRoot);
    for (const [inputPath, code] of cases) {
      const result = runRender(inputPath, outputRoot);
      assert.notEqual(result.status, 0, inputPath);
      assert.match(`${result.stderr}${result.stdout}`, new RegExp(`\\b${code}\\b`));
      assert.deepEqual(hashFiles(outputRoot), before, inputPath);
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("a valid draft publishes exactly one DOCX through the absolute injected output root", () => {
  const outputRoot = createOutputRoot();
  try {
    const result = runRender(join(fixtureDir, "valid.json"), outputRoot);
    assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
    assert.ok(existsSync(join(outputRoot, "p2-draft.docx")));
    assert.deepEqual(Object.keys(hashFiles(outputRoot)).sort(), ["nested/seeded-note.txt", "p2-draft.docx", "seeded-output.docx"]);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("a non-directory output root is rejected with the declared output-root code", () => {
  const parent = mkdtempSync(join(tmpdir(), "qbd-render-output-root-"));
  const blockedRoot = join(parent, "not-a-directory");
  writeFileSync(blockedRoot, "not a directory");
  try {
    const result = runRender(join(fixtureDir, "valid.json"), blockedRoot);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}${result.stdout}`, /\bE_OUTPUT_ROOT\b/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a publication write failure removes only its temporary file and preserves seeded hashes", () => {
  const outputRoot = createOutputRoot();
  const before = hashFiles(outputRoot);
  const removed = [];
  try {
    assert.throws(() => publishBuffer(Buffer.from("render buffer"), {
      outputRoot,
      fileSystem: {
        mkdirSync,
        renameSync,
        rmSync: (path, options) => {
          removed.push(relative(outputRoot, path));
          return rmSync(path, options);
        },
        statSync,
        writeFileSync: () => {
          throw new Error("simulated write failure");
        },
      },
    }), (error) => error instanceof RenderPublicationError && error.code === "E_OUTPUT_WRITE");
    assert.deepEqual(hashFiles(outputRoot), before);
    assert.equal(removed.length, 1);
    assert.match(removed[0], /^\.p2-draft\.docx\.[\w-]+\.tmp$/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
