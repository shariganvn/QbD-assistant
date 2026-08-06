import { validateRationale } from "../rationale/claim-binding.mjs";
import { canonicalBytes, sha256 } from "../rationale/rationale-contracts.mjs";

export const DEMO_RATIONALE_ID = "template-docx-content-demo-rationale";

export function buildDemoRationale(packet) {
  if (!packet || packet.decision?.status !== "selected") {
    throw new Error("E_DEMO_RATIONALE: a selected sealed packet is required");
  }
  const card = packet.fact_cards.cards[0];
  const matrixCell = packet.permitted_sources.matrix_cells[0];
  if (!card || !matrixCell || packet.permitted_sources.sensitivity_vector_count < 1) {
    throw new Error("E_DEMO_RATIONALE: selected packet does not contain the required authoring sources");
  }
  return validateRationale({
    schema_version: 1,
    rationale_id: DEMO_RATIONALE_ID,
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
    claims: [
      {
        claim_id: "claim-01",
        kind: "fact",
        text: "The real evidence lane is retained for review.",
        cites: { fact_card_ids: [card.id], quotes: [card.quote] },
      },
      {
        claim_id: "claim-02",
        kind: "gate",
        text: "The synthetic comparison satisfies the configured critical gates.",
        cites: { gate_refs: [{ ...matrixCell, ref_kind: "matrix_cell" }] },
      },
      {
        claim_id: "claim-03",
        kind: "sensitivity",
        text: "The selected outcome remains stable across the configured sensitivity vectors.",
        cites: { sensitivity_vector_indexes: [0] },
      },
      {
        claim_id: "claim-04",
        kind: "decision_state",
        text: packet.decision.status,
        cites: { decision_state_fields: ["status"] },
      },
    ],
  }, packet);
}
