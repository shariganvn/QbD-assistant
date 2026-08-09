import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { validateDraft } from "../../render/contract.mjs";
import { buildFormulationReviewDraft } from "../formulation-selection-review-draft.mjs";
import { emitFormulationReview, runFormulationSelection } from "../formulation-selection-run.mjs";
import { validateFormulationRationale } from "../formulation-selection-rationale.mjs";

async function renderOnce() {
  const outputRoot = mkdtempSync(join(tmpdir(), "qbd-p221-rationale-"));
  const phase3 = runFormulationSelection({ outputRoot });
  return emitFormulationReview({ phase3Result: phase3 });
}

test("G-04 rationale is source-bound, non-citable, and keeps proposal separate from FD state", async () => {
  const result = await renderOnce();
  validateFormulationRationale(result.rationale);
  validateDraft(result.draft);
  assert.equal(result.rationale.source_classification.citable, false);
  assert.deepEqual(result.rationale.citations, []);
  assert.equal(result.rationale.decision_state.status, "inconclusive");
  assert.equal(result.rationale.decision_state.winner, null);
  assert.equal(result.rationale.engineering_proposal.proposed_survivor, "formula-03");
  assert.equal(result.rationale.engineering_proposal.fd_approved, false);
  assert.equal(result.renderReceipt.citations_count, 0);
  assert.equal(result.renderReceipt.isolated_render.unshare_net, true);
});

test("G-04 review DOCX contains the required watermarks, evidence table, and concise source basis", async () => {
  const result = await renderOnce();
  const zip = await JSZip.loadAsync(readFileSync(result.outputDocx));
  const documentXml = await zip.file("word/document.xml").async("string");
  const text = [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("\n");
  assert.match(text, /REVIEW ONLY/);
  assert.match(text, /NON-CITABLE/);
  assert.match(text, /NOT FD APPROVED/);
  assert.match(text, /ĐỀ XUẤT KỸ THUẬT/);
  assert.match(text, /formula-03/);
  assert.match(text, /98\.64/);
  assert.match(text, /filled-public-mock-document-030826\.docx/);
  assert.match(text, /P\.2\.2\.1 results table/);
  assert.doesNotMatch(text, /internal:observed|Quote SHA-256|Cell receipt/);
  assert.doesNotMatch(text, /CT03[^.\n]*(winner|selected|decision)/i);
});

test("G-04 two fresh review renders have identical normalized OOXML", async () => {
  const first = await renderOnce();
  const second = await renderOnce();
  assert.equal(first.renderReceipt.normalized_ooxml_sha256, second.renderReceipt.normalized_ooxml_sha256);
  assert.deepEqual(first.draft, second.draft);
});

test("G-04 draft refuses a proposal that is marked FD-approved", async () => {
  const result = await renderOnce();
  const invalid = structuredClone(result.engineeringProposal);
  invalid.fd_approved = true;
  assert.throws(
    () => buildFormulationReviewDraft({ diagnostic: result.diagnostic, engineeringProposal: invalid, rationale: result.rationale }),
    /E_DRAFT_PROPOSAL/,
  );
});

test("G-04 rationale rejects a claim with no evidence bindings", async () => {
  const result = await renderOnce();
  const invalid = structuredClone(result.rationale);
  invalid.claims[0].bound_evidence_ids = [];
  assert.throws(
    () => validateFormulationRationale(invalid),
    (error) => error.code === "E_RATIONALE_CLAIM_BINDING",
  );
});

test("G-04 rationale rejects invented claim text", async () => {
  const result = await renderOnce();
  const invalid = structuredClone(result.rationale);
  invalid.claims[2].text = "Croscarmellose sodium context is 2%, 4%, and 8%.";
  assert.throws(
    () => validateFormulationRationale(invalid),
    (error) => error.code === "E_RATIONALE_CLAIM_CONTRACT",
  );
});

test("G-04 rationale rejects recommendation wording", async () => {
  const result = await renderOnce();
  const invalid = structuredClone(result.rationale);
  invalid.claims[3].text = `${invalid.claims[3].text} Recommendation: advance formula-03.`;
  assert.throws(
    () => validateFormulationRationale(invalid),
    (error) => error.code === "E_RATIONALE_CLAIM_CONTRACT",
  );
});

test("G-04 rationale rejects invalid provenance ranges", async () => {
  const result = await renderOnce();
  const invalid = structuredClone(result.rationale);
  invalid.internal_provenance_references[0].char_start = -1;
  assert.throws(
    () => validateFormulationRationale(invalid),
    (error) => error.code === "E_INTERNAL_PROVENANCE",
  );
});

test("G-04 rationale rejects public citation-object injection", async () => {
  const result = await renderOnce();
  const invalid = structuredClone(result.rationale);
  invalid.citations = [{ evidence_id: "invented-public-citation" }];
  assert.throws(
    () => validateFormulationRationale(invalid),
    (error) => error.code === "E_RATIONALE_CITATION_POLICY",
  );
});
