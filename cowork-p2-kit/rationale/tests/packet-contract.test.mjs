import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createRationaleCli } from "../cli.mjs";
import { validateRationalePacket } from "../packet.mjs";
import { canonicalBytes } from "../../reasoning/publication.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const fixtureRoot = resolve(testDir, "fixtures/decision-package");
const selectedPacketFixture = resolve(testDir, "fixtures/rationale-packet/selected.json");
const schemaPath = resolve(repoRoot, "cowork-p2-kit/rationale/rationale-packet.schema.json");
const sourceStore = resolve(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl");
const p4DecisionRoot = resolve(repoRoot, "docs/reports/qbd-p4-reasoning-layer/decision");
const PACKET_KEYS = ["schema_version", "packet_id", "run_id", "source_publication_receipt_sha256", "source_artifacts", "decision", "evaluation", "cohort", "fact_cards", "evidence_log", "linear_attestation", "permitted_sources"];
const FACT_CARD_KEYS = ["id", "record_id", "candidate", "measure", "normalized_value", "unit", "quote", "char_start", "char_end", "provenance"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, code, error?.stack ?? String(error));
    return true;
  });
}

function withFixture(branch, action) {
  const temp = mkdtempSync(join(tmpdir(), "rationale-packet-"));
  const source = join(temp, "source");
  const output = join(temp, "rationale");
  const p4Before = readdirSync(p4DecisionRoot).sort().map((name) => [name, sha256(readFileSync(join(p4DecisionRoot, name)))]);
  cpSync(join(fixtureRoot, branch), source, { recursive: true });
  try { return action({ temp, source, output }); }
  finally {
    assert.deepEqual(readdirSync(p4DecisionRoot).sort().map((name) => [name, sha256(readFileSync(join(p4DecisionRoot, name)))]), p4Before, "sealing never writes into the P4 decision root");
    rmSync(temp, { recursive: true, force: true });
  }
}

function seal({ source, output, store = sourceStore }) {
  return createRationaleCli({ publicationRoot: output }).main([
    "seal-packet", "--source-package", source, "--store", store, "--output-root", output,
  ]);
}

test("G-RL-01 seals an exact, canonical, receipt-bound selected packet without raw records", () => withFixture("selected", ({ source, output }) => {
  const packetPath = seal({ source, output });
  assert.equal(packetPath, join(output, "rationale-packet.json"));
  const bytes = readFileSync(packetPath);
  const packet = readJson(packetPath);
  const receiptBytes = readFileSync(join(source, "publication-receipt.json"));
  const receipt = readJson(join(source, "publication-receipt.json"));
  assert.deepEqual(Object.keys(packet).sort(), [...PACKET_KEYS].sort());
  assert.equal(packet.schema_version, 1);
  assert.equal(packet.run_id, receipt.run_id);
  assert.equal(packet.source_publication_receipt_sha256, sha256(receiptBytes));
  assert.deepEqual(packet.source_artifacts, receipt.artifacts);
  assert.equal(packet.evaluation.decision_sha256, sha256(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(packet.decision).sort()), null, 2) + "\n")));
  assert.ok(packet.packet_id.includes(packet.run_id));
  assert.equal(readFileSync(packetPath, "utf8"), canonicalBytes(packet), "packet uses canonical object key order");
  for (const card of packet.fact_cards.cards) {
    assert.deepEqual(Object.keys(card).sort(), [...FACT_CARD_KEYS].sort());
    assert.equal(Object.hasOwn(card, "raw_text"), false);
    const evidence = packet.evidence_log.entries.find((entry) => entry.record_id === card.record_id);
    assert.equal(card.quote, evidence?.quote);
  }
  const sourceRecords = Object.fromEntries(readFileSync(sourceStore, "utf8").trim().split("\n").map((line) => {
    const record = JSON.parse(line);
    return [record.id, record];
  }));
  assert.doesNotMatch(readFileSync(packetPath, "utf8"), /record\.content|execution-report|store_records\.jsonl/);
  assert.ok(packet.fact_cards.cards.some((card) => card.quote.length > 100), "whole-record quote is retained when admitted");
  assert.doesNotMatch(JSON.stringify(packet), /raw_text/);
  assert.ok(packet.fact_cards.cards.some((card) => sourceRecords[card.record_id]?.content === card.quote), "an admitted full-record quote remains permitted");
  assert.doesNotThrow(() => validateRationalePacket(packet));
  assert.deepEqual(readdirSync(output).sort(), ["rationale-packet.json"]);
  assert.equal(sha256(bytes), sha256(readFileSync(packetPath)));
  assert.deepEqual(bytes, readFileSync(selectedPacketFixture), "committed selected packet fixture is generated from the pinned source package");
}));

test("G-RL-01 fails closed before writing for a tampered or mismatched P4 source package", () => withFixture("selected", ({ source, output }) => {
  writeFileSync(join(source, "formula-decision.json"), "{\"tampered\":true}\n");
  expectCode(() => seal({ source, output }), "E_PACKET_SOURCE_INVALID");
  assert.equal(existsSync(join(output, "rationale-packet.json")), false);
}));

test("G-RL-01 revalidates each receipt, store, allowlist, and attestation source failure before staging", () => {
  const cases = [
    ["forged receipt artifact hash", "selected", ({ source }) => {
      const receiptPath = join(source, "publication-receipt.json");
      const receipt = readJson(receiptPath);
      receipt.artifacts["formula-decision.json"] = "a".repeat(64);
      writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
    }],
    ["missing receipt", "selected", ({ source }) => rmSync(join(source, "publication-receipt.json"))],
    ["surplus source member", "selected", ({ source }) => writeFileSync(join(source, "surplus.txt"), "forbidden\n")],
    ["absent attestation", "attested", ({ source }) => rmSync(join(source, "linear-attestation.json"))],
    ["mismatched store", "selected", ({ temp }) => writeFileSync(join(temp, "mismatched-store.jsonl"), `${readFileSync(sourceStore, "utf8")}\n`)],
  ];
  for (const [, branch, arrange] of cases) withFixture(branch, (fixture) => {
    arrange(fixture);
    const store = join(fixture.temp, "mismatched-store.jsonl");
    expectCode(() => seal({ ...fixture, ...(existsSync(store) ? { store } : {}) }), "E_PACKET_SOURCE_INVALID");
    assert.equal(existsSync(join(fixture.output, "rationale-packet.json")), false);
  });
});

test("G-RL-01 rejects packet envelope, receipt, identity, attestation, and raw-text binding mutations", () => withFixture("attested", ({ source, output }) => {
  const packet = readJson(seal({ source, output }));
  const mutations = [
    [(value) => { value.extra = true; }, "E_PACKET_ENVELOPE"],
    [(value) => { delete value.run_id; }, "E_PACKET_ENVELOPE"],
    [(value) => { value.source_publication_receipt_sha256 = "a".repeat(64); }, "E_PACKET_BINDING"],
    [(value) => { value.packet_id = "caller-controlled-packet"; }, "E_PACKET_BINDING"],
    [(value) => { value.evaluation.decision_sha256 = "b".repeat(64); }, "E_PACKET_BINDING"],
    [(value) => { value.linear_attestation = null; }, "E_PACKET_BINDING"],
    [(value) => { value.linear_attestation.attestation_id = "foreign-attestation"; }, "E_PACKET_BINDING"],
    [(value) => { value.fact_cards.cards[0].raw_text = "forbidden source text"; }, "E_PACKET_ENVELOPE"],
    [(value) => { value.evidence_log.entries[0].record_content = "forbidden raw record"; }, "E_PACKET_ENVELOPE"],
  ];
  for (const [mutate, code] of mutations) {
    const candidate = structuredClone(packet);
    mutate(candidate);
    expectCode(() => validateRationalePacket(candidate, { sourcePackage: source }), code);
  }
  const forgedDecision = structuredClone(packet);
  forgedDecision.decision.fact_card_ids.reverse();
  forgedDecision.evaluation.decision_sha256 = sha256(Buffer.from(canonicalBytes(forgedDecision.decision)));
  forgedDecision.packet_id = `rationale-packet-${forgedDecision.run_id}-${forgedDecision.evaluation.decision_sha256}`;
  expectCode(() => validateRationalePacket(forgedDecision, { sourcePackage: source }), "E_PACKET_BINDING");
  const malformed = structuredClone(packet);
  malformed.evaluation = {};
  expectCode(() => validateRationalePacket(malformed), "E_PACKET_ENVELOPE");
}));

test("G-RL-01 rejects malformed nested evaluation references with its stable envelope code", () => withFixture("selected", ({ source, output }) => {
  const malformedGate = readJson(seal({ source, output }));
  malformedGate.evaluation.candidate_reviews[0].hard_gates = [null];
  expectCode(() => validateRationalePacket(malformedGate), "E_PACKET_ENVELOPE");
}));

test("G-RL-01 schema declares the exact source-artifact names instead of rejecting all valid receipt members", () => {
  const schema = readJson(schemaPath);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties.source_artifacts.properties).sort(), [
    "cohort.json", "evidence-log.json", "evidence-log.md", "fact-cards.json", "formula-decision.json", "formula-decision.md", "linear-attestation.json", "selection-evaluation.json",
  ]);
  assert.deepEqual(schema.properties.source_artifacts.required.sort(), Object.keys(schema.properties.source_artifacts.properties).sort());
});

test("G-RL-01 derives deterministic permitted sources without cross-citation borrowing", () => withFixture("selected", ({ source, output }) => {
  const first = readFileSync(seal({ source, output }));
  const second = readFileSync(seal({ source, output }));
  assert.deepEqual(second, first);
  const packet = JSON.parse(first);
  assert.deepEqual(packet.permitted_sources.fact_card_ids, [...packet.permitted_sources.fact_card_ids].sort());
  assert.equal(new Set(packet.permitted_sources.fact_card_ids).size, packet.permitted_sources.fact_card_ids.length);
  assert.equal(packet.permitted_sources.source_value_index.fact_cards.length, packet.fact_cards.cards.length);
  assert.ok(packet.permitted_sources.source_value_index.fact_cards.every((entry) => Object.keys(entry).sort().join("\0") === ["fact_card_id", "value_tokens", "unit_tokens", "quote_value_tokens", "quote_unit_tokens"].sort().join("\0")));
  assert.ok(packet.permitted_sources.source_value_index.gate_refs.some((entry) => entry.ref_kind === "matrix_cell" && entry.unit_tokens.includes("%")), "matrix-cell units stay local to their exact citation");
  assert.deepEqual(packet.permitted_sources.decision_state_fields, ["status", "winner", "cohort_id", "cohort_basis", "fd_action", "rubric_sha256", "linear_attestation_id", "linear_attestation_sha256"]);
  const invented = structuredClone(packet);
  invented.permitted_sources.fact_card_ids.push("FC-FOREIGN");
  expectCode(() => validateRationalePacket(invented), "E_PACKET_BINDING");
}));

test("G-RL-01 CLI has no caller-selected run id and cannot write outside its declared root", () => withFixture("selected", ({ source, output, temp }) => {
  const cli = createRationaleCli({ publicationRoot: output });
  expectCode(() => cli.main(["seal-packet", "--source-package", source, "--store", sourceStore, "--output-root", join(temp, "other")]), "E_PACKET_PATH");
  expectCode(() => cli.main(["seal-packet", "--source-package", source, "--store", sourceStore, "--output-root", output, "--run-id", "caller-value"]), "E_PACKET_PATH");
  expectCode(() => cli.main(["seal-packet", "--source-package", source, "--store", sourceStore, "--source-package", source, "--output-root", output]), "E_PACKET_PATH");
  expectCode(() => createRationaleCli({ publicationRoot: p4DecisionRoot }).main(["seal-packet", "--source-package", source, "--store", sourceStore, "--output-root", p4DecisionRoot]), "E_PACKET_PATH");
}));

test("G-RL-01 refuses output root and target symlinks before any packet write", () => withFixture("selected", ({ source, output, temp }) => {
  const rootLink = join(temp, "root-link");
  symlinkSync(p4DecisionRoot, rootLink, "dir");
  expectCode(() => createRationaleCli({ publicationRoot: rootLink }).main(["seal-packet", "--source-package", source, "--store", sourceStore, "--output-root", rootLink]), "E_PACKET_PATH");
  mkdirSync(output);
  symlinkSync(join(p4DecisionRoot, ".gitkeep"), join(output, "rationale-packet.json"));
  expectCode(() => seal({ source, output }), "E_PACKET_PATH");
}));

test("G-RL-01 seals the production-shaped inconclusive source branch", () => withFixture("inconclusive", ({ source, output }) => {
  const packet = readJson(seal({ source, output }));
  assert.equal(packet.decision.status, "inconclusive");
  assert.equal(packet.decision.winner, null);
}));
