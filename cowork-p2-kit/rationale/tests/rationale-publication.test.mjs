import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { validateRationale } from "../claim-binding.mjs";
import { createRationaleCli, main as productionMain } from "../cli.mjs";
import { validatePublishedRationalePackage } from "../rationale-publication.mjs";
import { canonicalBytes, sha256 } from "../rationale-contracts.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const sourceRoot = resolve(import.meta.dirname, "fixtures/decision-package");
const storePath = join(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl");
const store = { bytes: readFileSync(storePath) };
const p4DecisionRoot = resolve(repoRoot, "docs/reports/qbd-p4-reasoning-layer/decision");
const publicationNames = ["rationale-packet.json", "rationale.json", "rationale.md", "rationale-receipt.json"];
const hash = (value) => createHash("sha256").update(value).digest("hex");

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, code, error?.stack ?? String(error));
    return true;
  });
}

function packetFor(branch) {
  const { buildRationalePacket } = awaitablePacketModule;
  return buildRationalePacket({ sourcePackage: join(sourceRoot, branch), store });
}

const awaitablePacketModule = await import("../packet.mjs");

function rationaleFor(packet) {
  const card = packet.fact_cards.cards[0];
  const claims = [{ claim_id: "claim-01", kind: "fact", text: "Admitted evidence is recorded.", cites: { fact_card_ids: [card.id], quotes: [card.quote] } }];
  if (packet.permitted_sources.matrix_cells.length > 0) claims.push({ claim_id: "claim-02", kind: "gate", text: "Recorded evaluation evidence applies.", cites: { gate_refs: [{ ...packet.permitted_sources.matrix_cells[0], ref_kind: "matrix_cell" }] } });
  if (packet.permitted_sources.sensitivity_vector_count > 0) claims.push({ claim_id: "claim-03", kind: "sensitivity", text: "Sensitivity evidence is recorded.", cites: { sensitivity_vector_indexes: [0] } });
  if (packet.permitted_sources.exclusions.length > 0) claims.push({ claim_id: "claim-04", kind: "exclusion", text: "The exclusion is recorded.", cites: { exclusion_refs: [packet.permitted_sources.exclusions[0]] } });
  claims.push(packet.decision.status === "inconclusive"
    ? { claim_id: "claim-05", kind: "decision_state", text: packet.decision.fd_action, cites: { decision_state_fields: ["fd_action"], causal_evidence_refs: packet.causal_evidence.refs } }
    : { claim_id: "claim-05", kind: "decision_state", text: packet.decision.status, cites: { decision_state_fields: ["status"] } });
  return validateRationale({
    schema_version: 1,
    rationale_id: `rationale-${packet.run_id}`,
    packet_id: packet.packet_id,
    packet_sha256: sha256(canonicalBytes(packet)),
    run_id: packet.run_id,
    decision_id: packet.decision.decision_id,
    decision_sha256: packet.evaluation.decision_sha256,
    cohort_id: packet.cohort.cohort_id,
    decision_status: packet.decision.status,
    winner: packet.decision.winner,
    fd_action: packet.decision.fd_action,
    display_state: "internal_only",
    claims,
  }, packet);
}

function withPublication(branch, action) {
  const temp = mkdtempSync(join(tmpdir(), "rationale-publication-"));
  const root = join(temp, "rationale");
  const input = join(temp, "input");
  const p4Before = readdirSync(p4DecisionRoot).sort().map((name) => [name, hash(readFileSync(join(p4DecisionRoot, name)))]);
  const packet = packetFor(branch);
  const rationale = rationaleFor(packet);
  mkdirSync(input);
  writeFileSync(join(input, "packet.json"), canonicalBytes(packet));
  writeFileSync(join(input, "rationale.json"), canonicalBytes(rationale));
  try { return action({ temp, root, input, packet, rationale }); }
  finally {
    assert.deepEqual(readdirSync(p4DecisionRoot).sort().map((name) => [name, hash(readFileSync(join(p4DecisionRoot, name)))]), p4Before, "rationale publication never changes the P4 root");
    rmSync(temp, { recursive: true, force: true });
  }
}

function publish({ root, input, outputRoot = root, fileSystem }) {
  return createRationaleCli({ publicationRoot: root, ...(fileSystem === undefined ? {} : { fileSystem }) }).main([
    "publish-rationale", "--packet", join(input, "packet.json"), "--rationale", join(input, "rationale.json"), "--output-root", outputRoot,
  ]);
}

test("G-RL-04 publishes a canonical, receipt-bound package for all sealed decision branches", () => {
  for (const branch of ["selected", "inconclusive", "attested"]) withPublication(branch, ({ root, input, packet, rationale }) => {
    assert.equal(publish({ root, input }), root);
    assert.deepEqual(readdirSync(root).sort(), [...publicationNames].sort());
    assert.equal(readFileSync(join(root, "rationale-packet.json"), "utf8"), canonicalBytes(packet));
    assert.equal(readFileSync(join(root, "rationale.json"), "utf8"), canonicalBytes(rationale));
    const receipt = JSON.parse(readFileSync(join(root, "rationale-receipt.json"), "utf8"));
    assert.deepEqual(Object.keys(receipt).sort(), ["artifacts", "packet_sha256", "run_id", "schema_version", "source_publication_receipt_sha256"].sort());
    assert.equal(receipt.run_id, packet.run_id);
    assert.equal(receipt.packet_sha256, sha256(canonicalBytes(packet)));
    assert.equal(receipt.source_publication_receipt_sha256, packet.source_publication_receipt_sha256);
    for (const name of ["rationale-packet.json", "rationale.json", "rationale.md"]) assert.equal(receipt.artifacts[name], hash(readFileSync(join(root, name))));
    assert.doesNotThrow(() => validatePublishedRationalePackage(root));
  });
});

test("G-RL-04 fails closed for missing, surplus, stale-receipt, symlink, and directory members", () => withPublication("selected", ({ root, input }) => {
  publish({ root, input });
  rmSync(join(root, "rationale.md"));
  expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_MISSING_FILE");
  writeFileSync(join(root, "rationale.md"), "tampered\n");
  expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_RECEIPT");
  rmSync(join(root, "rationale.md"));
  publish({ root, input });
  writeFileSync(join(root, "surplus.txt"), "no\n");
  expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_SURPLUS_FILE");
  rmSync(join(root, "surplus.txt"));
  mkdirSync(join(root, "surplus-dir"));
  expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_SURPLUS_FILE");
  rmSync(join(root, "surplus-dir"), { recursive: true });
  symlinkSync(join(root, "rationale.json"), join(root, "surplus-link"));
  expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_SURPLUS_FILE");
}));

test("G-RL-04 publishes through the declared root only and rolls back a failed first publication including .gitkeep", () => withPublication("selected", ({ root, input, temp }) => {
  expectCode(() => publish({ root, input, outputRoot: join(temp, "other") }), "E_RATIONALE_PUBLICATION_PATH");
  expectCode(() => productionMain(["publish-rationale", "--packet", join(input, "packet.json"), "--rationale", join(input, "rationale.json"), "--output-root", root]), "E_RATIONALE_PUBLICATION_PATH");
  expectCode(() => createRationaleCli({ publicationRoot: root }).main(["publish-rationale", "--packet", join(input, "packet.json"), "--rationale", join(input, "rationale.json"), "--output-root", root, "--display-state", "internal_only"]), "E_RATIONALE_PUBLICATION_PATH");
  mkdirSync(root);
  writeFileSync(join(root, ".gitkeep"), "");
  const fileSystem = {
    mkdirSync,
    renameSync: (...args) => { if (String(args[1]).endsWith("rationale.md")) throw new Error("injected rename failure"); return renameSync(...args); },
    rmSync,
    writeFileSync,
  };
  expectCode(() => publish({ root, input, fileSystem }), "E_RATIONALE_PUBLICATION_WRITE");
  assert.deepEqual(readdirSync(root), [".gitkeep"]);
  assert.equal(readFileSync(join(root, ".gitkeep"), "utf8"), "");
}));

test("G-RL-04 publishes into a first-publish root that seal-packet already filled beside the .gitkeep placeholder", () => withPublication("selected", ({ root, input }) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, ".gitkeep"), "");
  const cli = createRationaleCli({ publicationRoot: root });
  cli.main(["seal-packet", "--source-package", join(sourceRoot, "selected"), "--store", storePath, "--output-root", root]);
  assert.deepEqual(readdirSync(root).sort(), [".gitkeep", "rationale-packet.json"]);
  const sealed = JSON.parse(readFileSync(join(root, "rationale-packet.json"), "utf8"));
  const rationalePath = join(input, "sealed-rationale.json");
  writeFileSync(rationalePath, canonicalBytes(rationaleFor(sealed)));
  assert.equal(cli.main(["publish-rationale", "--packet", join(root, "rationale-packet.json"), "--rationale", rationalePath, "--output-root", root]), root);
  assert.deepEqual(readdirSync(root).sort(), [...publicationNames].sort());
  assert.doesNotThrow(() => validatePublishedRationalePackage(root));
}));

test("G-RL-04 restores both the sealed packet and the .gitkeep placeholder when a first publish fails mid-write", () => withPublication("selected", ({ root, input }) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, ".gitkeep"), "");
  const cli = createRationaleCli({ publicationRoot: root });
  cli.main(["seal-packet", "--source-package", join(sourceRoot, "selected"), "--store", storePath, "--output-root", root]);
  const sealedBytes = readFileSync(join(root, "rationale-packet.json"));
  const sealed = JSON.parse(sealedBytes.toString("utf8"));
  const rationalePath = join(input, "sealed-rationale.json");
  writeFileSync(rationalePath, canonicalBytes(rationaleFor(sealed)));
  const fileSystem = {
    mkdirSync,
    renameSync: (...args) => { if (String(args[1]).endsWith("rationale.md")) throw new Error("injected rename failure"); return renameSync(...args); },
    rmSync,
    writeFileSync,
  };
  expectCode(() => createRationaleCli({ publicationRoot: root, fileSystem }).main([
    "publish-rationale", "--packet", join(root, "rationale-packet.json"), "--rationale", rationalePath, "--output-root", root,
  ]), "E_RATIONALE_PUBLICATION_WRITE");
  assert.deepEqual(readdirSync(root).sort(), [".gitkeep", "rationale-packet.json"]);
  assert.equal(readFileSync(join(root, ".gitkeep"), "utf8"), "");
  assert.deepEqual(readFileSync(join(root, "rationale-packet.json")), sealedBytes);
}));

test("G-RL-04 rejects a packet or rationale binding failure before a publication byte is staged", () => withPublication("selected", ({ root, input }) => {
  mkdirSync(root);
  writeFileSync(join(root, ".gitkeep"), "");
  const rationalePath = join(input, "rationale.json");
  const invalid = JSON.parse(readFileSync(rationalePath, "utf8"));
  invalid.packet_sha256 = "a".repeat(64);
  writeFileSync(rationalePath, canonicalBytes(invalid));
  expectCode(() => publish({ root, input }), "E_RATIONALE_CLAIM_BINDING");
  assert.deepEqual(readdirSync(root), [".gitkeep"]);
}));

test("G-RL-04 restores every prior byte if backup cleanup fails, and public validation cannot allowlist a surplus file", () => withPublication("selected", ({ root, input }) => {
  publish({ root, input });
  const before = Object.fromEntries(publicationNames.map((name) => [name, readFileSync(join(root, name))]));
  const rationalePath = join(input, "rationale.json");
  const changed = JSON.parse(readFileSync(rationalePath, "utf8"));
  changed.rationale_id = `${changed.rationale_id}-update`;
  writeFileSync(rationalePath, canonicalBytes(changed));
  let backupRemovalCount = 0;
  const fileSystem = {
    mkdirSync,
    renameSync,
    writeFileSync,
    rmSync(path, options) {
      if (String(path).endsWith(".bak") && backupRemovalCount++ === 1) throw new Error("injected backup cleanup failure");
      return rmSync(path, options);
    },
  };
  expectCode(() => publish({ root, input, fileSystem }), "E_RATIONALE_PUBLICATION_WRITE");
  assert.deepEqual(readdirSync(root).sort(), [...publicationNames].sort());
  for (const name of publicationNames) assert.deepEqual(readFileSync(join(root, name)), before[name]);
  writeFileSync(join(root, "surplus.txt"), "forbidden\n");
  assert.equal(validatePublishedRationalePackage.length, 1, "published-package validation exposes no caller-supplied allowlist parameter");
  expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_SURPLUS_FILE");
}));

test("G-RL-04 skill has one valid selected-packet template and preserves the Cowork boundary", () => {
  const skill = readFileSync(join(repoRoot, "cowork-p2-kit/RATIONALE-SKILL.md"), "utf8");
  for (const phrase of ["only input", "store", "ingest", "DOCX", "execution report", "untrusted", "fact cards", "publish-rationale", "internal_only"]) assert.match(skill, new RegExp(phrase, "i"));
  for (const forbidden of ["P.2.2", "P.2.3", "headings[]", "prose[]", "tables[]", "citations[]", "soạn thảo", "soạn nội dung", "dự thảo"]) assert.doesNotMatch(skill, new RegExp(forbidden.replace(/[.\[\]]/g, "\\$&"), "i"));
  const blocks = [...skill.matchAll(/```json qbd-template=rationale\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 1);
  const packet = JSON.parse(readFileSync(join(repoRoot, "cowork-p2-kit/rationale/tests/fixtures/rationale-packet/selected.json"), "utf8"));
  assert.deepEqual(validateRationale(JSON.parse(blocks[0][1]), packet), JSON.parse(blocks[0][1]));
});
