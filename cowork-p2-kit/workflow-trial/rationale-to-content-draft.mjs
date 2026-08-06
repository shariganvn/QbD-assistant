import { validateRationale } from "../rationale/claim-binding.mjs";
import { validateDraft } from "../render/contract.mjs";

export const DEMO_TITLE = "SYNTHETIC / DEMO — không dùng để nộp hoặc trích dẫn";

function fail(code, message) {
  const error = new Error("[" + code + "] " + message);
  error.code = code;
  throw error;
}

function assertPacketBindings({ packet, rationale }) {
  if (!packet || !packet.decision || !packet.evaluation || !packet.cohort) {
    fail("E_DEMO_PACKET_BINDING", "a complete sealed packet is required");
  }
  validateRationale(rationale, packet);
  if (packet.decision.status !== "selected" || packet.evaluation.outcome_code !== "selected") {
    fail("E_DEMO_PACKET_BINDING", "the content adapter requires a selected packet");
  }
  if (rationale.packet_id !== packet.packet_id
    || rationale.decision_id !== packet.decision.decision_id
    || rationale.decision_sha256 !== packet.evaluation.decision_sha256
    || rationale.cohort_id !== packet.cohort.cohort_id
    || rationale.winner !== packet.decision.winner
    || rationale.fd_action !== packet.decision.fd_action) {
    fail("E_DEMO_PACKET_BINDING", "decision, evaluation, and rationale identities disagree");
  }
}

function syntheticScoreRows(packet) {
  const vector = packet.evaluation.sensitivity.vectors[0];
  if (!vector) fail("E_DEMO_SCORE_TABLE", "selected evaluation has no sensitivity vector");
  return packet.evaluation.candidate_reviews.map((review) => [
    review.candidate,
    review.candidate === packet.decision.winner ? "Real evidence lane" : "Synthetic comparator",
    String(vector.totals[review.candidate]),
    review.candidate === packet.decision.winner ? "Selected" : "Comparison only",
  ]);
}

export function validateDemoDraft(draft) {
  if (draft?.title !== DEMO_TITLE) fail("E_DEMO_WATERMARK", "demo draft title must be the exact synthetic watermark");
  if (draft?.blocks?.some((block) => block.type === "chờ_dữ_liệu")) {
    fail("E_DEMO_WAIT_DATA", "content demo must not contain a wait-for-data block");
  }
  return validateDraft(draft);
}

export function buildContentDraft({ packet, rationale, citations }) {
  assertPacketBindings({ packet, rationale });
  if (!Array.isArray(citations) || citations.length !== 3) {
    fail("E_DEMO_CITATION_COUNT", "content demo requires exactly three exact-join citations");
  }
  const draft = {
    title: DEMO_TITLE,
    citations: structuredClone(citations),
    blocks: [
      {
        type: "heading2",
        text: "P.2.2.1 Formulation selection — synthetic review slice",
      },
      {
        type: "paragraph",
        text: "This review slice demonstrates the existing selection and presentation chain with visibly synthetic scoring. It is not a submission dossier and does not establish scientific correctness.",
      },
      {
        type: "paragraph",
        segments: [
          { text: "The provenance lane preserves three exact receipt-to-record examples for format review " },
          { citation: 0 },
          { text: ", " },
          { citation: 1 },
          { text: ", and " },
          { citation: 2 },
          { text: ". These excerpts do not provide causal support for the synthetic comparison or selected outcome." },
        ],
      },
      {
        type: "table",
        headers: ["Candidate", "Lane", "Synthetic score", "Outcome"],
        rows: syntheticScoreRows(packet),
      },
    ],
  };
  return validateDemoDraft(draft);
}
