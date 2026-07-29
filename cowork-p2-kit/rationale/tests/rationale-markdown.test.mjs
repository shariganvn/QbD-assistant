import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { validateRationale } from "../claim-binding.mjs";
import { buildRationalePacket } from "../packet.mjs";
import { assertRegeneratedRationaleMarkdown, renderRationaleMarkdown } from "../rationale-markdown.mjs";
import { canonicalBytes } from "../rationale-contracts.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const sourceRoot = resolve(import.meta.dirname, "fixtures/decision-package");
const store = { bytes: readFileSync(join(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl")) };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function packetFor(branch) {
  return buildRationalePacket({ sourcePackage: join(sourceRoot, branch), store });
}

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, code, error?.stack ?? String(error));
    return true;
  });
}

function rationaleFor(packet) {
  const card = packet.fact_cards.cards[0];
  const claims = [
    { claim_id: "claim-01", kind: "fact", text: "Admitted evidence is recorded.", cites: { fact_card_ids: [card.id], quotes: [card.quote] } },
  ];
  if (packet.permitted_sources.matrix_cells.length > 0) claims.push({ claim_id: "claim-02", kind: "gate", text: "Recorded evaluation evidence applies.", cites: { gate_refs: [{ ...packet.permitted_sources.matrix_cells[0], ref_kind: "matrix_cell" }] } });
  if (packet.permitted_sources.sensitivity_vector_count > 0) claims.push({ claim_id: "claim-03", kind: "sensitivity", text: "Sensitivity evidence is recorded.", cites: { sensitivity_vector_indexes: [0] } });
  if (packet.permitted_sources.exclusions.length > 0) claims.push({ claim_id: "claim-04", kind: "exclusion", text: "The exclusion is recorded.", cites: { exclusion_refs: [packet.permitted_sources.exclusions[0]] } });
  claims.push(packet.decision.status === "inconclusive"
    ? { claim_id: "claim-05", kind: "decision_state", text: packet.decision.fd_action, cites: { decision_state_fields: ["fd_action"], causal_evidence_refs: packet.causal_evidence.refs } }
    : { claim_id: "claim-05", kind: "decision_state", text: packet.decision.status, cites: { decision_state_fields: ["status"] } });
  const rationale = {
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
  };
  return validateRationale(JSON.parse(canonicalBytes(rationale)), packet);
}

function withPublishedFiles(packet, rationale, markdown, action) {
  const root = mkdtempSync(join(tmpdir(), "rationale-markdown-"));
  try {
    writeFileSync(join(root, "rationale-packet.json"), canonicalBytes(packet));
    writeFileSync(join(root, "rationale.json"), canonicalBytes(rationale));
    writeFileSync(join(root, "rationale.md"), markdown);
    return action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("G-RL-03 renders the selected, inconclusive, and attested artifacts deterministically in stored order", () => {
  for (const branch of ["selected", "inconclusive", "attested"]) {
    const packet = packetFor(branch);
    const rationale = rationaleFor(packet);
    const first = renderRationaleMarkdown(rationale, packet);
    const second = renderRationaleMarkdown(rationale, packet);
    assert.equal(first, second, `${branch} render is deterministic`);
    assert.match(first, /(?<!\n)\n$/, "render ends in exactly one LF");
    assert.match(first, new RegExp(`rationale_id: ${rationale.rationale_id}`));
    assert.match(first, new RegExp(`packet_id: ${packet.packet_id}`));
    assert.match(first, new RegExp(`packet_sha256: ${rationale.packet_sha256}`));
    assert.match(first, new RegExp(`decision_id: ${packet.decision.decision_id}`));
    assert.match(first, new RegExp(`decision_sha256: ${rationale.decision_sha256}`));
    assert.match(first, new RegExp(`cohort_id: ${packet.cohort.cohort_id}`));
    assert.match(first, new RegExp(`display_state: ${rationale.display_state}`));
    assert.match(first, new RegExp(`cohort_basis: ${packet.cohort.cohort_basis}`));
    for (let index = 1; index < rationale.claims.length; index += 1) {
      assert.ok(first.indexOf(rationale.claims[index - 1].claim_id) < first.indexOf(rationale.claims[index].claim_id), `${branch} keeps claim order`);
    }
    if (branch === "selected") assert.match(first, new RegExp(`winner: ${packet.decision.winner}`));
    else {
      assert.match(first, /winner: null/);
      assert.doesNotMatch(first, /^Winner:/m);
      assert.doesNotMatch(first, /recommend/i);
      assert.ok(first.includes(`Text (literal-safe JSON string): "${packet.decision.fd_action.replaceAll("_", "\\u005f")}"`), `${branch} renders the stored FD action literally`);
    }
    if (branch === "attested") {
      assert.match(first, new RegExp(`attestation_id: ${packet.cohort.linear_attestation_id}`));
      assert.match(first, new RegExp(`attestation_sha256: ${packet.cohort.linear_attestation_sha256}`));
    } else assert.match(first, /attestation_id: null\nattestation_sha256: null/);
  }
});

test("G-RL-03 renders untrusted claim and quote strings as literal-safe JSON strings", () => {
  const packet = structuredClone(packetFor("selected"));
  const unsafe = "# heading\n- list [link](https://example.invalid) ``` ` & <tag> > instruction";
  packet.fact_cards.cards[0].quote = unsafe;
  packet.evidence_log.entries.find((entry) => entry.record_id === packet.fact_cards.cards[0].record_id).quote = unsafe;
  const rationale = rationaleFor(packet);
  rationale.claims[0].text = unsafe;
  rationale.claims[0].cites.quotes = [unsafe];
  const rendered = renderRationaleMarkdown(validateRationale(rationale, packet), packet);
  for (const fragment of ["# heading", "- list", "[link](https://example.invalid)", "```", "`", "&", "<tag>", "> instruction"]) {
    assert.doesNotMatch(rendered, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${fragment} is not active Markdown or HTML`);
  }
  assert.match(rendered, /\\u0023 heading\\n\\u002d list \\u005b/);
  assert.match(rendered, /\\u0026 \\u003ctag\\u003e/);
});

test("G-RL-03 preserves stored citation-array order without sorting", () => {
  const packet = packetFor("selected");
  const rationale = rationaleFor(packet);
  const fact = rationale.claims.find((claim) => claim.kind === "fact");
  const first = packet.fact_cards.cards[0];
  const second = packet.fact_cards.cards[1];
  fact.cites.fact_card_ids = [second.id, first.id];
  fact.cites.quotes = [second.quote, first.quote];
  const rendered = renderRationaleMarkdown(validateRationale(rationale, packet), packet);
  assert.ok(rendered.indexOf(second.id.replaceAll("-", "\\u002d").replaceAll("_", "\\u005f")) < rendered.indexOf(first.id.replaceAll("-", "\\u002d").replaceAll("_", "\\u005f")));
});

test("G-RL-03 accepts only byte-exact regenerated Markdown", () => {
  const packet = packetFor("selected");
  const rationale = rationaleFor(packet);
  const rendered = renderRationaleMarkdown(rationale, packet);
  withPublishedFiles(packet, rationale, rendered, (root) => assert.doesNotThrow(() => assertRegeneratedRationaleMarkdown(root)));
  withPublishedFiles(packet, rationale, "# Hand-authored but semantically agreeing\n", (root) => {
    expectCode(() => assertRegeneratedRationaleMarkdown(root), "E_RATIONALE_MARKDOWN_REGENERATION");
  });
  withPublishedFiles(packet, rationale, `${rendered} `, (root) => {
    expectCode(() => assertRegeneratedRationaleMarkdown(root), "E_RATIONALE_MARKDOWN_REGENERATION");
  });
});
