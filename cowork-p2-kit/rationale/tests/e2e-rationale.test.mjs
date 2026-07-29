import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import test from "node:test";

import { validateRationale } from "../claim-binding.mjs";
import { createRationaleCli, main as productionMain } from "../cli.mjs";
import { buildRationalePacket } from "../packet.mjs";
import { validatePublishedRationalePackage } from "../rationale-publication.mjs";
import { assertRegeneratedRationaleMarkdown } from "../rationale-markdown.mjs";
import { canonicalBytes, sha256 } from "../rationale-contracts.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const sourceRoot = resolve(import.meta.dirname, "fixtures/decision-package");
const storePath = resolve(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl");
const publicationRoot = resolve(repoRoot, "docs/reports/qbd-rationale-report-layer/rationale");
const gatesPath = resolve(repoRoot, "docs/plans/qbd-rationale-report-layer/gates.yaml");
const publicationMembers = ["rationale-packet.json", "rationale.json", "rationale.md", "rationale-receipt.json"];
const ORIGINAL_SOURCE_PINS = {
  selected: "e2675b861a53db0293df1d9fafa7f9030fdb6d84a60cdc5060f3f17425737559",
  inconclusive: "723a7186a76ab03216bacc23f416e280899bd59eed1b030ab6cf0a456272ea50",
  attested: "e85a819d6548bb3a47493ae314d443ca67f97d33bba52b53e4bdf56ad2ffdf6e",
};

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, code, error?.stack ?? String(error));
    return true;
  });
}

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

function publishBranch({ branch, root }) {
  const inputRoot = mkdtempSync(join(tmpdir(), "rationale-e2e-input-"));
  const cli = createRationaleCli({ publicationRoot: root });
  try {
    const packetPath = cli.main(["seal-packet", "--source-package", join(sourceRoot, branch), "--store", storePath, "--output-root", root]);
    const packet = JSON.parse(readFileSync(packetPath, "utf8"));
    const rationalePath = join(inputRoot, "rationale.json");
    writeFileSync(rationalePath, canonicalBytes(rationaleFor(packet)));
    assert.equal(cli.main(["publish-rationale", "--packet", packetPath, "--rationale", rationalePath, "--output-root", root]), root);
    return { packet, rationale: JSON.parse(readFileSync(join(root, "rationale.json"), "utf8")) };
  } finally {
    rmSync(inputRoot, { recursive: true, force: true });
  }
}

function packageBytes(root) {
  return Object.fromEntries(publicationMembers.map((name) => [name, readFileSync(join(root, name))]));
}

function gatePin(branch) {
  const match = readFileSync(gatesPath, "utf8").match(new RegExp(`^\\s+source_package_${branch}_sha256: ([0-9a-f]{64})$`, "m"));
  assert.ok(match, `missing source package pin for ${branch}`);
  return match[1];
}

function assertSourceFixturePin(branch) {
  const actual = hash(readFileSync(join(sourceRoot, branch, "publication-receipt.json")));
  assert.equal(actual, gatePin(branch), `${branch} fixture receipt must equal its declared source-package pin`);
  if (actual !== ORIGINAL_SOURCE_PINS[branch]) {
    const repinReason = readFileSync(gatesPath, "utf8").match(/^\s+source_package_repin_reason:\s*(.+)$/m)?.[1];
    assert.ok(repinReason && repinReason !== "null", `${branch} fixture changed without pins.source_package_repin_reason`);
  }
}

function assertPackage(root, { branch, packet, rationale }) {
  assert.deepEqual(readdirSync(root).sort(), publicationMembers.slice().sort());
  assert.doesNotThrow(() => validatePublishedRationalePackage(root));
  assert.doesNotThrow(() => assertRegeneratedRationaleMarkdown(root));
  const receipt = JSON.parse(readFileSync(join(root, "rationale-receipt.json"), "utf8"));
  assert.equal(receipt.packet_sha256, sha256(canonicalBytes(packet)));
  assertSourceFixturePin(branch);
  assert.equal(receipt.source_publication_receipt_sha256, gatePin(branch));
  assert.equal(packet.source_publication_receipt_sha256, gatePin(branch));
  for (const name of ["rationale-packet.json", "rationale.json", "rationale.md"]) assert.equal(receipt.artifacts[name], hash(readFileSync(join(root, name))), `${branch} receipt hash for ${name}`);
  assert.equal(rationale.display_state, "internal_only");
}

function fileHashSet(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else entries.push([relative(root, path), hash(readFileSync(path))]);
    }
  };
  visit(root);
  return entries;
}

test("G-RL-05 seals and publishes all committed branches, retaining their exact boundaries", () => {
  for (const branch of ["selected", "inconclusive", "attested"]) {
    const temp = mkdtempSync(join(tmpdir(), `rationale-e2e-${branch}-`));
    try {
      const root = join(temp, "rationale");
      const result = publishBranch({ branch, root });
      assertPackage(root, { branch, ...result });
      if (branch === "selected") {
        assert.equal(result.packet.decision.status, "selected");
        assert.equal(result.rationale.winner, "F-01");
        assert.deepEqual(new Set(result.rationale.claims.map((claim) => claim.kind)).has("fact"), true);
        assert.deepEqual(new Set(result.rationale.claims.map((claim) => claim.kind)).has("gate"), true);
        assert.deepEqual(new Set(result.rationale.claims.map((claim) => claim.kind)).has("sensitivity"), true);
      }
      if (branch === "inconclusive") {
        assert.equal(result.rationale.winner, null);
        assert.ok(result.packet.causal_evidence.refs.length > 0);
        const explanation = result.rationale.claims.find((claim) => claim.kind === "decision_state");
        assert.equal(explanation.text, result.packet.decision.fd_action);
        assert.deepEqual(explanation.cites.causal_evidence_refs, result.packet.causal_evidence.refs);
        assert.doesNotMatch(readFileSync(join(root, "rationale.md"), "utf8"), /recommend/i);
      }
      if (branch === "attested") {
        assert.equal(result.packet.linear_attestation.attestation_id, result.packet.cohort.linear_attestation_id);
        assert.equal(sha256(canonicalBytes(result.packet.linear_attestation)), result.packet.cohort.linear_attestation_sha256);
        const markdown = readFileSync(join(root, "rationale.md"), "utf8");
        assert.match(markdown, new RegExp(result.packet.cohort.linear_attestation_id));
        assert.match(markdown, new RegExp(result.packet.cohort.linear_attestation_sha256));
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
});

test("G-RL-05 publishes and revalidates the committed selected reference package byte-exactly", () => {
  const first = publishBranch({ branch: "selected", root: publicationRoot });
  assertPackage(publicationRoot, { branch: "selected", ...first });
  const before = packageBytes(publicationRoot);
  const second = publishBranch({ branch: "selected", root: publicationRoot });
  assertPackage(publicationRoot, { branch: "selected", ...second });
  assert.deepEqual(packageBytes(publicationRoot), before, "a suite re-run leaves the committed reference package byte-identical");
});

test("G-RL-05 fails closed for a missing attestation, tampered member, stale receipt, and surplus file", () => {
  const temp = mkdtempSync(join(tmpdir(), "rationale-e2e-negative-"));
  try {
    const attestedSource = join(temp, "attested-source");
    cpSync(join(sourceRoot, "attested"), attestedSource, { recursive: true });
    rmSync(join(attestedSource, "linear-attestation.json"));
    expectCode(() => buildRationalePacket({ sourcePackage: attestedSource, store: { bytes: readFileSync(storePath) } }), "E_PACKET_SOURCE_INVALID");

    const root = join(temp, "rationale");
    cpSync(publicationRoot, root, { recursive: true });
    writeFileSync(join(root, "rationale.md"), "tampered\n");
    expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_RECEIPT");
    rmSync(root, { recursive: true, force: true });
    cpSync(publicationRoot, root, { recursive: true });
    const receipt = JSON.parse(readFileSync(join(root, "rationale-receipt.json"), "utf8"));
    receipt.artifacts["rationale.json"] = "0".repeat(64);
    writeFileSync(join(root, "rationale-receipt.json"), canonicalBytes(receipt));
    expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_RECEIPT");
    rmSync(root, { recursive: true, force: true });
    cpSync(publicationRoot, root, { recursive: true });
    writeFileSync(join(root, "surplus.txt"), "forbidden\n");
    expectCode(() => validatePublishedRationalePackage(root), "E_RATIONALE_PUBLICATION_SURPLUS_FILE");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("G-RL-05 rejects production roots other than the declared rationale root and preserves P4 during isolated regression", () => {
  const otherRoot = mkdtempSync(join(tmpdir(), "rationale-production-root-"));
  try {
    expectCode(() => productionMain(["seal-packet", "--source-package", join(sourceRoot, "selected"), "--store", storePath, "--output-root", otherRoot]), "E_PACKET_PATH");
    expectCode(() => productionMain(["publish-rationale", "--packet", join(otherRoot, "packet.json"), "--rationale", join(otherRoot, "rationale.json"), "--output-root", otherRoot]), "E_RATIONALE_PUBLICATION_PATH");
  } finally {
    rmSync(otherRoot, { recursive: true, force: true });
  }

  const p4Roots = [resolve(repoRoot, "cowork-p2-kit/reasoning"), resolve(repoRoot, "docs/reports/qbd-p4-reasoning-layer")];
  const before = p4Roots.map((root) => [root, fileHashSet(root)]);
  const worktree = mkdtempSync(join(tmpdir(), "qbd-p4-isolated-"));
  rmSync(worktree, { recursive: true, force: true });
  const add = spawnSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(add.status, 0, add.stderr);
  try {
    const result = spawnSync("npm", ["run", "verify:reasoning"], { cwd: worktree, encoding: "utf8", timeout: 300000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    const remove = spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(remove.status, 0, remove.stderr);
  }
  assert.deepEqual(p4Roots.map((root) => [root, fileHashSet(root)]), before, "isolated P4 verification leaves the active P4 boundary byte-identical");
});
