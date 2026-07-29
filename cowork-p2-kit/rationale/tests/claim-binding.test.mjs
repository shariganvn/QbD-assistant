import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { validateRationale } from "../claim-binding.mjs";
import { createRationaleCli } from "../cli.mjs";
import { buildRationalePacket } from "../packet.mjs";
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

function baseRationale(packet, claims) {
  return {
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
}

function validClaims(packet, { includeSensitivity = packet.permitted_sources.sensitivity_vector_count > 0, includeExclusion = packet.permitted_sources.exclusions.length > 0 } = {}) {
  const card = packet.fact_cards.cards[0];
  const matrix = packet.permitted_sources.matrix_cells[0];
  const claims = [{ claim_id: "claim-01", kind: "fact", text: "Admitted evidence is recorded.", cites: { fact_card_ids: [card.id], quotes: [card.quote] } }];
  if (matrix) claims.push({ claim_id: "claim-02", kind: "gate", text: "Recorded evaluation evidence applies.", cites: { gate_refs: [{ ...matrix, ref_kind: "matrix_cell" }] } });
  if (includeSensitivity) claims.push({ claim_id: "claim-03", kind: "sensitivity", text: "Sensitivity evidence is recorded.", cites: { sensitivity_vector_indexes: [0] } });
  if (includeExclusion) claims.push({ claim_id: "claim-04", kind: "exclusion", text: "The exclusion is recorded.", cites: { exclusion_refs: [packet.permitted_sources.exclusions[0]] } });
  if (packet.decision.status === "inconclusive") {
    claims.push({ claim_id: "claim-05", kind: "decision_state", text: packet.decision.fd_action, cites: { decision_state_fields: ["fd_action"], causal_evidence_refs: packet.causal_evidence.refs } });
  } else {
    claims.push({ claim_id: "claim-05", kind: "decision_state", text: packet.decision.status, cites: { decision_state_fields: ["status"] } });
  }
  return claims.sort((left, right) => left.claim_id.localeCompare(right.claim_id));
}

test("G-RL-02 accepts every claim kind over sealed selected, rubric-pin inconclusive, and attested inconclusive packets", () => {
  const selected = packetFor("selected");
  const inconclusive = packetFor("inconclusive");
  const attested = packetFor("attested");
  assert.deepEqual(validateRationale(baseRationale(selected, validClaims(selected)), selected), baseRationale(selected, validClaims(selected)));
  assert.deepEqual(validateRationale(baseRationale(inconclusive, validClaims(inconclusive)), inconclusive), baseRationale(inconclusive, validClaims(inconclusive)));
  assert.deepEqual(validateRationale(baseRationale(attested, validClaims(attested)), attested), baseRationale(attested, validClaims(attested)));
});

test("G-RL-02 fails closed for malformed envelopes, unsorted claims, and non-internal display state", () => {
  const packet = packetFor("selected");
  const rationale = baseRationale(packet, validClaims(packet));
  expectCode(() => validateRationale({ ...rationale, explanation: "unbound narrative" }, packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale({ ...rationale, claims: [...rationale.claims].reverse() }, packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale({ ...rationale, claims: [...rationale.claims, { ...rationale.claims[0] }] }, packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale({ ...rationale, display_state: "external" }, packet), "E_RATIONALE_DISPLAY_STATE");
  expectCode(() => validateRationale(rationale, { ...packet, display_state: "internal_only" }), "E_RATIONALE_DISPLAY_STATE");
  expectCode(() => createRationaleCli({ publicationRoot: "/tmp/rationale-display-state-forbidden" }).main(["seal-packet", "--display-state", "internal_only"]), "E_PACKET_PATH");
});

test("G-RL-02 rejects foreign and unresolved fact, gate, sensitivity, exclusion, quote, and record citations", () => {
  const packet = packetFor("selected");
  const rationale = baseRationale(packet, validClaims(packet));
  const mutate = (claimId, change) => {
    const candidate = structuredClone(rationale);
    change(candidate.claims.find((claim) => claim.claim_id === claimId));
    return candidate;
  };
  expectCode(() => validateRationale(mutate("claim-01", (claim) => { claim.cites.fact_card_ids = ["FC-FOREIGN"]; }), packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale(mutate("claim-01", (claim) => { claim.cites.quotes = ["outside the sealed packet"]; }), packet), "E_RATIONALE_EVIDENCE_OUTSIDE_PACKET");
  expectCode(() => validateRationale(mutate("claim-02", (claim) => { claim.cites.gate_refs[0].candidate = "F-404"; }), packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale(mutate("claim-02", (claim) => { claim.cites.gate_refs[0].measure_id = "absent-measure"; }), packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale(mutate("claim-03", (claim) => { claim.cites.sensitivity_vector_indexes = [packet.permitted_sources.sensitivity_vector_count]; }), packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale(mutate("claim-04", (claim) => { claim.cites.exclusion_refs[0].reason = "E_OTHER"; }), packet), "E_RATIONALE_CLAIM_BINDING");
  expectCode(() => validateRationale(mutate("claim-04", (claim) => { claim.cites.exclusion_refs[0].record_id = "R-OUTSIDE"; }), packet), "E_RATIONALE_EVIDENCE_OUTSIDE_PACKET");
});

test("G-RL-02 rejects invented, rounded, converted, and cross-source numeric or unit values", () => {
  const packet = packetFor("selected");
  const rationale = baseRationale(packet, validClaims(packet));
  const candidate = structuredClone(rationale);
  const fact = candidate.claims.find((claim) => claim.claim_id === "claim-01");
  const first = packet.permitted_sources.source_value_index.fact_cards.find((entry) => entry.fact_card_id === fact.cites.fact_card_ids[0]);
  const foreign = packet.permitted_sources.source_value_index.fact_cards.find((entry) => entry.fact_card_id !== first.fact_card_id && !first.value_tokens.includes(entry.value_tokens[0]));
  delete fact.cites.quotes;
  fact.text = `The value is ${foreign.value_tokens[0]} %.`;
  expectCode(() => validateRationale(candidate, packet), "E_RATIONALE_INVENTED_VALUE");
  const rounded = structuredClone(rationale);
  rounded.claims.find((claim) => claim.claim_id === "claim-01").text = "The value is 94.1 %.";
  expectCode(() => validateRationale(rounded, packet), "E_RATIONALE_INVENTED_VALUE");
  const unknownUnit = structuredClone(rationale);
  unknownUnit.claims.find((claim) => claim.claim_id === "claim-01").text = "The unit is kg.";
  expectCode(() => validateRationale(unknownUnit, packet), "E_RATIONALE_INVENTED_VALUE");
  const converted = structuredClone(rationale);
  converted.claims.find((claim) => claim.claim_id === "claim-01").text = "The converted value is 0.105 kg.";
  expectCode(() => validateRationale(converted, packet), "E_RATIONALE_INVENTED_VALUE");
  const aggregate = structuredClone(rationale);
  aggregate.claims.find((claim) => claim.claim_id === "claim-01").text = "The aggregate is 199 %.";
  expectCode(() => validateRationale(aggregate, packet), "E_RATIONALE_INVENTED_VALUE");
});

test("G-RL-02 resolves hard-gate and critical-evidence references only in their matching packet slices", () => {
  const packet = packetFor("selected");
  for (const [refKind, permitted] of [["hard_gate", packet.permitted_sources.hard_gates], ["critical_evidence", packet.permitted_sources.critical_evidence]]) {
    assert.ok(permitted.length > 0, `${refKind} fixture is available`);
    const rationale = baseRationale(packet, validClaims(packet));
    rationale.claims.find((claim) => claim.claim_id === "claim-02").cites.gate_refs = [{ ...permitted[0], ref_kind: refKind }];
    assert.deepEqual(validateRationale(rationale, packet), rationale);
  }
});

test("G-RL-02 permits a quote-local numeric token only when that exact quote is cited", () => {
  const packet = packetFor("selected");
  const rationale = baseRationale(packet, validClaims(packet));
  rationale.claims.find((claim) => claim.claim_id === "claim-01").text = "The measured result is 94 %.";
  assert.deepEqual(validateRationale(rationale, packet), rationale);
  const withoutQuote = structuredClone(rationale);
  delete withoutQuote.claims.find((claim) => claim.claim_id === "claim-01").cites.quotes;
  expectCode(() => validateRationale(withoutQuote, packet), "E_RATIONALE_INVENTED_VALUE");
});

test("G-RL-02 rejects altered decision state and recommendation drift over an inconclusive packet", () => {
  const packet = packetFor("inconclusive");
  const rationale = baseRationale(packet, validClaims(packet));
  expectCode(() => validateRationale({ ...rationale, decision_status: "selected" }, packet), "E_RATIONALE_DECISION_ALTERED");
  expectCode(() => validateRationale({ ...rationale, winner: "F-01" }, packet), "E_RATIONALE_DECISION_ALTERED");
  expectCode(() => validateRationale({ ...rationale, fd_action: "E_CHANGED" }, packet), "E_RATIONALE_DECISION_ALTERED");
  expectCode(() => validateRationale({ ...rationale, cohort_id: "cohort-altered" }, packet), "E_RATIONALE_DECISION_ALTERED");
  const paraphrase = structuredClone(rationale);
  paraphrase.claims.find((claim) => claim.kind === "decision_state").text = `FD action: ${packet.decision.fd_action}`;
  expectCode(() => validateRationale(paraphrase, packet), "E_RATIONALE_DECISION_ALTERED");
  const recommendation = structuredClone(rationale);
  recommendation.claims[0].text = "We recommend this formulation.";
  expectCode(() => validateRationale(recommendation, packet), "E_RATIONALE_DECISION_ALTERED");
});

test("G-RL-02 requires a literal fd_action and sealed causal-evidence explanation for inconclusive packets", () => {
  const packet = packetFor("inconclusive");
  const rationale = baseRationale(packet, validClaims(packet));
  const noAction = structuredClone(rationale);
  noAction.claims = noAction.claims.filter((claim) => claim.kind !== "decision_state");
  expectCode(() => validateRationale(noAction, packet), "E_RATIONALE_INCONCLUSIVE_EXPLANATION");
  const noCausalEvidence = structuredClone(rationale);
  delete noCausalEvidence.claims.find((claim) => claim.kind === "decision_state").cites.causal_evidence_refs;
  expectCode(() => validateRationale(noCausalEvidence, packet), "E_RATIONALE_INCONCLUSIVE_EXPLANATION");
  const unrelatedExclusion = structuredClone(noCausalEvidence);
  assert.ok(unrelatedExclusion.claims.some((claim) => claim.kind === "exclusion"), "rubric fixture retains its unrelated exclusion");
  expectCode(() => validateRationale(unrelatedExclusion, packet), "E_RATIONALE_INCONCLUSIVE_EXPLANATION");
  const foreignCausalEvidence = structuredClone(rationale);
  foreignCausalEvidence.claims.find((claim) => claim.kind === "decision_state").cites.causal_evidence_refs = [{ ref_kind: "evaluation_state", field: "outcome_code", value: "E_FOREIGN" }];
  expectCode(() => validateRationale(foreignCausalEvidence, packet), "E_RATIONALE_CLAIM_BINDING");
  const partialCausalEvidence = structuredClone(rationale);
  partialCausalEvidence.claims.find((claim) => claim.kind === "decision_state").cites.causal_evidence_refs = packet.causal_evidence.refs.slice(1);
  expectCode(() => validateRationale(partialCausalEvidence, packet), "E_RATIONALE_INCONCLUSIVE_EXPLANATION");
});

test("G-RL-02 is pure and deterministic for the same sealed packet and artifact", () => {
  const packet = packetFor("selected");
  const rationale = baseRationale(packet, validClaims(packet));
  assert.deepEqual(validateRationale(rationale, packet), validateRationale(rationale, packet));
  for (const modulePath of ["rationale-contracts.mjs", "claim-binding.mjs"]) {
    const source = readFileSync(join(repoRoot, "cowork-p2-kit/rationale", modulePath), "utf8");
    assert.doesNotMatch(source, /node:(?:fs|http|child_process)|readFileSync|fetch\(/, `${modulePath} remains I/O-free`);
  }
});
