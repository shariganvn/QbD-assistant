import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { admitInputs } from "../admission.mjs";
import { createConfig } from "../config.mjs";
import { createLiteparseAdapter } from "../liteparse-adapter.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const recordSchema = resolve(testDir, "../../store/records.schema.json");
const evidence = [];

function setup(name) {
  const root = mkdtempSync(join(tmpdir(), `ingest-boundary-${name}-`));
  const inputsRoot = join(root, "inputs");
  const storeRoot = join(root, "store");
  mkdirSync(join(inputsRoot, "trials"), { recursive: true });
  mkdirSync(join(inputsRoot, "reference"), { recursive: true });
  mkdirSync(storeRoot);
  copyFileSync(recordSchema, join(storeRoot, "records.schema.json"));
  writeFileSync(join(storeRoot, "records.jsonl"), "{\"prior\":true}\n");
  return { root, inputsRoot, storeRoot };
}

function storeHashes(storeRoot) {
  return Object.fromEntries(readdirSync(storeRoot).sort().map((file) => [file, createHash("sha256").update(readFileSync(join(storeRoot, file))).digest("hex")]));
}

function expectRejected(caseName, storeRoot, fn, code) {
  const before = storeHashes(storeRoot);
  assert.throws(fn, { code });
  const after = storeHashes(storeRoot);
  assert.deepEqual(after, before);
  evidence.push({ case: caseName, before, after });
}

function publicManifest(inputsRoot, file) {
  writeFileSync(join(inputsRoot, "classification-manifest.json"), JSON.stringify({
    [`inputs/trials/${file}`]: { label: "public", citable: true, ocr_language: "eng" },
  }));
}

test("admission rejects every symlink before the parser can run", () => {
  const { root, inputsRoot, storeRoot } = setup("symlink");
  try {
    const outside = join(root, "outside.docx");
    writeFileSync(outside, "untrusted");
    symlinkSync(outside, join(inputsRoot, "trials", "linked.docx"));
    publicManifest(inputsRoot, "linked.docx");
    expectRejected("symlink", storeRoot, () => admitInputs(createConfig({ inputsRoot, storeRoot, kitDir: root })), "E_SYMLINK");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("unsupported input is rejected before parsing or publication", () => {
  const { root, inputsRoot, storeRoot } = setup("extension");
  try {
    writeFileSync(join(inputsRoot, "trials", "payload.exe"), "not a document");
    publicManifest(inputsRoot, "payload.exe");
    expectRejected("unsupported-extension", storeRoot, () => admitInputs(createConfig({ inputsRoot, storeRoot, kitDir: root })), "E_INPUT_UNSUPPORTED");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("LiteParse receives a literal argument array and cannot parse outside the configured root", () => {
  const { root, inputsRoot, storeRoot } = setup("adapter");
  try {
    const maliciousName = "safe;touch SHOULD_NOT_EXIST.docx";
    const input = join(inputsRoot, "trials", maliciousName);
    const marker = join(root, "SHOULD_NOT_EXIST");
    writeFileSync(input, "document");
    let observed;
    const config = createConfig({
      inputsRoot, kitDir: root, litBinary: "/absolute/configured/lit",
      storeRoot,
      runProcess: (binary, args) => { observed = { binary, args }; return { status: 0, stdout: "{\"pages\":[]}" }; },
    });
    const adapter = createLiteparseAdapter(config);
    assert.deepEqual(adapter.parse(input), { pages: [] });
    assert.deepEqual(observed, { binary: "/absolute/configured/lit", args: ["parse", input, "--format", "json"] });
    assert.equal(existsSync(marker), false);
    const outside = join(root, "outside.docx");
    writeFileSync(outside, "outside");
    expectRejected("absolute-outside-input-root", storeRoot, () => adapter.parse(outside), "E_PATH_ESCAPE");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("configured traversal, manifest escape, and duplicate normalized paths fail closed", () => {
  const { root, inputsRoot, storeRoot } = setup("admission-config");
  try {
    writeFileSync(join(inputsRoot, "trials", "sample.docx"), "document");
    publicManifest(inputsRoot, "sample.docx");
    const outside = join(root, "outside");
    mkdirSync(outside);
    const traversal = createConfig({ inputsRoot, storeRoot, kitDir: root });
    traversal.trialsRoot = outside;
    expectRejected("traversal-root", storeRoot, () => admitInputs(traversal), "E_PATH_ESCAPE");
    const manifestEscape = createConfig({ inputsRoot, storeRoot, kitDir: root });
    manifestEscape.manifestPath = join(root, "classification-manifest.json");
    writeFileSync(manifestEscape.manifestPath, "{}");
    expectRejected("absolute-manifest-escape", storeRoot, () => admitInputs(manifestEscape), "E_PATH_ESCAPE");
    const duplicate = createConfig({ inputsRoot, storeRoot, kitDir: root });
    duplicate.referenceRoot = duplicate.trialsRoot;
    expectRejected("duplicate-normalized-path", storeRoot, () => admitInputs(duplicate), "E_DUPLICATE_PATH");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("adapter rejects a non-absolute binary instead of falling back to PATH", () => {
  assert.throws(() => createLiteparseAdapter({ litBinary: "lit", fileOps: { existsSync: () => true }, runProcess: () => null }), { code: "E_CONFIG" });
});

test.after(() => {
  if (process.env.GATE_EVIDENCE_PATH) writeFileSync(process.env.GATE_EVIDENCE_PATH, JSON.stringify(evidence));
});
