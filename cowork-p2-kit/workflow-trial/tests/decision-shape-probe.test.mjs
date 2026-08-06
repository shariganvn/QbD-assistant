import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { buildCohortEvidence } from "../../reasoning/cohort-evidence.mjs";
import { evaluateSelection } from "../../reasoning/decision-engine.mjs";
import { canonicalBytes } from "../../reasoning/publication.mjs";
import {
  buildComparatorCards,
  buildComparatorRecords,
  buildDemoCandidateMap,
  buildDemoProfiles,
  buildRealCandidateCards,
  COMPARATOR_CANDIDATE,
  COMPARATOR_SOURCE_FILE,
  REAL_CANDIDATE,
  REAL_SOURCE_FILE,
  storeHash,
} from "../demo-data-pack.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const rubric = JSON.parse(readFileSync(resolve(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json"), "utf8"));
const rubricPin = JSON.parse(readFileSync(resolve(repoRoot, "cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-pin.json"), "utf8")).selection_rubric_sha256;

function realRecord() {
  const content = "REAL-LANE RECORD — bisoprolol fumarate 90 - 110%";
  return {
    id: "real-lane-record",
    source_type: "text",
    content,
    provenance: { file: REAL_SOURCE_FILE, page: 1, char_start: 0, char_end: content.length, quote: content, page_kind: "renderer-derived" },
    confidence: "high",
    extraction_status: "ok",
    classification: { label: "public", citable: false },
  };
}

function buildArtifacts() {
  const records = [realRecord(), ...buildComparatorRecords()];
  const candidateMap = buildDemoCandidateMap();
  const candidateProfiles = buildDemoProfiles();
  const common = {
    records,
    candidateMap,
    candidateProfiles,
    rankingCandidates: [REAL_CANDIDATE, COMPARATOR_CANDIDATE],
    cohortId: "template-docx-content-demo-probe",
    storeRecordsSha256: storeHash(records),
  };
  const initial = buildCohortEvidence(common);
  const factCards = {
    schema_version: 1,
    cards: [
      ...buildRealCandidateCards({ records, evidenceLog: initial.evidenceLog }),
      ...buildComparatorCards({ records, evidenceLog: initial.evidenceLog }),
    ],
  };
  const { cohort, evidenceLog } = buildCohortEvidence({ ...common, factCards });
  const recordRoles = Object.fromEntries(evidenceLog.entries.map((entry) => [entry.record_id, "results"]));
  const result = evaluateSelection({
    cohort,
    evidenceLog,
    factCards,
    rubric,
    rubricPin,
    recordRoles,
    decisionId: "template-docx-content-demo-probe-decision",
  });
  return { cohort, evidenceLog, factCards, result };
}

function expectOutcome(input, code) {
  const result = evaluateSelection(input);
  assert.equal(result.decision.status, "inconclusive");
  assert.equal(result.decision.fd_action, code);
}

test("approved and pinned two-candidate demo reaches selected with a bounded shape", () => {
  const { cohort, evidenceLog, factCards, result } = buildArtifacts();
  assert.equal(result.decision.status, "selected");
  assert.equal(result.decision.winner, REAL_CANDIDATE);
  assert.deepEqual(cohort.candidates, [REAL_CANDIDATE, COMPARATOR_CANDIDATE]);
  assert.equal(factCards.cards.length, 4);
  assert.equal(result.evaluation.matrix_cells.length, 4);
  assert.equal(result.evaluation.candidate_reviews.length, 2);
  assert.equal(result.evaluation.sensitivity.stable_winner, REAL_CANDIDATE);
  assert.ok(evidenceLog.entries.some((entry) => entry.provenance.file === COMPARATOR_SOURCE_FILE));
  assert.ok(factCards.cards.filter((card) => card.candidate === COMPARATOR_CANDIDATE).every((card) => card.id.includes("COMPARATOR")));
  assert.match(canonicalBytes(result.decision), /selected/);
});

test("rubric approval, pin presence, and pin equality remain fail-closed", () => {
  const { cohort, evidenceLog, factCards } = buildArtifacts();
  const common = {
    cohort,
    evidenceLog,
    factCards,
    rubric,
    recordRoles: Object.fromEntries(evidenceLog.entries.map((entry) => [entry.record_id, "results"])),
    decisionId: "template-docx-content-demo-negative",
  };
  expectOutcome({ ...common, rubric: { ...rubric, approval_state: "proposal" }, rubricPin: null }, "E_RUBRIC_APPROVAL_REQUIRED");
  expectOutcome({ ...common, rubricPin: null }, "E_RUBRIC_PIN_REQUIRED");
  expectOutcome({ ...common, rubricPin: "0".repeat(64) }, "E_RUBRIC_PIN_MISMATCH");
});
