import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createReasoningCli } from "../cli.mjs";
import { publishArtifacts } from "../publication.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = resolve(repoRoot, "cowork-p2-kit/reasoning/cli.mjs");
const fixtureRoot = resolve(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/contract");
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function treeHashes(root) {
  return Object.fromEntries(readdirSync(root).sort().map((name) => [name, sha256(join(root, name))]));
}

function runSpawned(args, publicationRoot) {
  return spawnSync(process.execPath, [cli, "publish", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, REASONING_PUBLICATION_ROOT: publicationRoot },
  });
}

function runInjected(args, publicationRoot) {
  try {
    const destination = createReasoningCli({ publicationRoot }).main(["publish", ...args]);
    return { status: 0, stdout: `Published reasoning artifacts: ${destination}\n`, stderr: "" };
  } catch (error) {
    return { status: 1, stdout: "", stderr: `${error.code ?? "E_PUBLICATION_WRITE"}: ${error.message}\n` };
  }
}

function commonArgs(root) {
  return [
    "--decision", join(root, "valid-decision.json"),
    "--cohort", join(root, "valid-cohort.json"),
    "--fact-cards", join(root, "valid-fact-cards.json"),
    "--linear-attestation", join(root, "valid-linear-attestation.json"),
    "--evidence-log", join(root, "valid-evidence-log.json"),
    "--store", join(root, "store-records.jsonl"),
  ];
}

function ordered(value, reverse = false) {
  if (Array.isArray(value)) return value.map((entry) => ordered(entry, reverse));
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort((a, b) => reverse ? b.localeCompare(a) : a.localeCompare(b)).map((key) => [key, ordered(value[key], reverse)]));
  return value;
}

test("G-P4-01 each invalid CLI envelope exits 1, prints E_ code, and preserves all prior output bytes", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-output-preservation-"));
  const input = join(temp, "input");
  const output = join(temp, "decision");
  cpSync(fixtureRoot, input, { recursive: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "published.json"), "{\"stable\":true}\n");
  try {
    const badDecision = join(input, "valid-decision.json");
    const decision = JSON.parse(readFileSync(badDecision, "utf8"));
    decision.unexpected = true;
    writeFileSync(badDecision, `${JSON.stringify(decision)}\n`);
    const before = treeHashes(output);
    const result = runInjected([...commonArgs(input), "--output-root", output], output);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /E_DECISION_ENVELOPE/);
    assert.deepEqual(treeHashes(output), before);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 refuses publication outside the declared root with one nonzero E_ failure", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-publication-boundary-"));
  const declared = join(temp, "declared");
  const outside = join(temp, "outside");
  try {
    const result = runInjected([...commonArgs(fixtureRoot), "--output-root", outside], declared);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /E_PUBLICATION_PATH/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 CLI requires a JSONL store and always validates fact-card bindings against it", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-required-store-"));
  const input = join(temp, "input");
  const output = join(temp, "decision");
  cpSync(fixtureRoot, input, { recursive: true });
  try {
    const withoutStore = runInjected([...commonArgs(input).filter((entry) => entry !== "--store" && entry !== join(input, "store-records.jsonl")), "--output-root", output], output);
    assert.equal(withoutStore.status, 1, withoutStore.stderr);
    assert.match(withoutStore.stderr, /E_INPUT_PATH/);

    const factCardsPath = join(input, "valid-fact-cards.json");
    const factCards = JSON.parse(readFileSync(factCardsPath, "utf8"));
    factCards.cards[0].candidate = "F-02";
    writeFileSync(factCardsPath, `${JSON.stringify(factCards)}\n`);
    const invalidBinding = runInjected([...commonArgs(input), "--output-root", output], output);
    assert.equal(invalidBinding.status, 1, invalidBinding.stderr);
    assert.match(invalidBinding.stderr, /E_FACT_CANDIDATE_BINDING/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 valid publication creates canonical JSON only inside its declared root", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-valid-publication-"));
  const output = join(temp, "decision");
  try {
    const result = runInjected([...commonArgs(fixtureRoot), "--output-root", output], output);
    assert.equal(result.status, 0, result.stderr);
    const published = join(output, "formula-decision.json");
    assert.deepEqual(JSON.parse(readFileSync(published, "utf8")), JSON.parse(readFileSync(join(fixtureRoot, "valid-decision.json"), "utf8")));
    assert.match(readFileSync(published, "utf8"), /\n$/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 canonical publication bytes do not depend on valid input object key order", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-canonical-bytes-"));
  const reorderedInput = join(temp, "reordered-input");
  const firstOutput = join(temp, "first");
  const secondOutput = join(temp, "second");
  cpSync(fixtureRoot, reorderedInput, { recursive: true });
  try {
    for (const name of ["valid-decision.json", "valid-cohort.json", "valid-fact-cards.json", "valid-linear-attestation.json", "valid-evidence-log.json"]) {
      const path = join(reorderedInput, name);
      writeFileSync(path, `${JSON.stringify(ordered(JSON.parse(readFileSync(path, "utf8")), true))}\n`);
    }
    const first = runInjected([...commonArgs(fixtureRoot), "--output-root", firstOutput], firstOutput);
    const second = runInjected([...commonArgs(reorderedInput), "--output-root", secondOutput], secondOutput);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(treeHashes(secondOutput), treeHashes(firstOutput));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 a synchronous mid-rename failure restores every pre-existing publication byte", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-rename-rollback-"));
  const output = join(temp, "decision");
  const artifacts = {
    decision: JSON.parse(readFileSync(join(fixtureRoot, "valid-decision.json"), "utf8")),
    cohort: JSON.parse(readFileSync(join(fixtureRoot, "valid-cohort.json"), "utf8")),
    factCards: JSON.parse(readFileSync(join(fixtureRoot, "valid-fact-cards.json"), "utf8")),
    linearAttestation: JSON.parse(readFileSync(join(fixtureRoot, "valid-linear-attestation.json"), "utf8")),
    evidenceLog: JSON.parse(readFileSync(join(fixtureRoot, "valid-evidence-log.json"), "utf8")),
  };
  mkdirSync(output, { recursive: true });
  for (const name of ["fact-cards.json", "cohort.json", "linear-attestation.json", "evidence-log.json", "formula-decision.json"]) writeFileSync(join(output, name), `before:${name}\n`);
  const before = treeHashes(output);
  let renameCount = 0;
  const fileSystem = {
    mkdirSync,
    writeFileSync,
    rmSync,
    renameSync(from, to) {
      renameCount += 1;
      if (renameCount === 2) throw new Error("injected synchronous rename failure");
      renameSync(from, to);
    },
  };
  try {
    assert.throws(() => publishArtifacts(artifacts, output, fileSystem), (error) => error.code === "E_PUBLICATION_WRITE");
    assert.deepEqual(treeHashes(output), before);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 spawned CLI ignores REASONING_PUBLICATION_ROOT and retains its fixed production root", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-fixed-publication-root-"));
  try {
    const result = runSpawned([...commonArgs(fixtureRoot), "--output-root", temp], temp);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /E_PUBLICATION_PATH/);
    assert.deepEqual(readdirSync(temp), []);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("G-P4-01 store bytes must SHA-256 match the cohort pin before publication and preserve prior output", () => {
  const temp = mkdtempSync(join(tmpdir(), "reasoning-store-sha-"));
  const input = join(temp, "input");
  const output = join(temp, "decision");
  cpSync(fixtureRoot, input, { recursive: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "published.json"), "{\"stable\":true}\n");
  try {
    writeFileSync(join(input, "store-records.jsonl"), `${readFileSync(join(input, "store-records.jsonl"), "utf8")}\n`);
    const before = treeHashes(output);
    const result = runInjected([...commonArgs(input), "--output-root", output], output);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /E_STORE_SHA256/);
    assert.deepEqual(treeHashes(output), before);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
