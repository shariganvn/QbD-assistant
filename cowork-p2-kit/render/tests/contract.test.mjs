import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { RenderContractError, validateDraft } from "../contract.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/contract");
const ingestRecords = readFileSync(resolve(testDir, "../../ingest/tests/fixtures/contract/records.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);

function fixture(name) {
  return JSON.parse(readFileSync(resolve(fixtureDir, `${name}.json`), "utf8"));
}

function expectCode(draft, code) {
  assert.throws(() => validateDraft(draft), (error) => {
    assert.ok(error instanceof RenderContractError);
    assert.equal(error.code, code);
    return true;
  });
}

test("accepts the committed public citation envelope and supported block shapes", () => {
  const draft = fixture("valid");
  assert.deepEqual(validateDraft(draft), draft);
});

test("preserves the existing optional title boundary and Phase 2 evidence identity mapping", () => {
  const titled = fixture("valid");
  titled.title = "CTD P.2 — Deterministic render contract";
  assert.deepEqual(validateDraft(titled), titled);

  const record = ingestRecords[0];
  const derived = fixture("valid");
  derived.citations = [{
    evidenceId: record.id,
    source: record.provenance.file,
    location: `page ${record.provenance.page}, offset ${record.provenance.char_start}`,
    excerpt: record.provenance.quote,
    classification: record.classification,
    evidenceLink: null,
  }];
  derived.blocks[1].segments[1].citation = 0;
  assert.deepEqual(validateDraft(derived).citations[0], derived.citations[0]);
});

test("accepts only the two exact HTTPS hosts without credentials or ports", () => {
  for (const link of ["https://www.usp.org/path", "https://dav.gov.vn/path"]) {
    const draft = fixture("valid");
    draft.citations[0].evidenceLink = link;
    assert.deepEqual(validateDraft(draft), draft);
  }

  for (const link of [
    "http://www.usp.org/",
    "https://sub.www.usp.org/",
    "https://www.usp.org.evil.example/",
    "https://user@www.usp.org/",
    "https://www.usp.org:443/",
    "https://www.usp.org:0443/",
    "https://www.usp.org:8443/",
    "file:///tmp/evidence.docx",
    "/tmp/evidence.docx",
    "relative/evidence.docx",
  ]) {
    const draft = fixture("valid");
    draft.citations[0].evidenceLink = link;
    expectCode(draft, "E_EVIDENCE_LINK_POLICY");
  }
});

test("rejects the committed citation deny fixtures with declared codes", () => {
  for (const [name, code] of [
    ["uncitable", "E_CITATION_UNCITABLE"],
    ["missing-classification", "E_CITATION_ENVELOPE"],
    ["invalid-links", "E_EVIDENCE_LINK_POLICY"],
    ["unresolved-citation", "E_CITATION_UNRESOLVED"],
    ["invalid-source", "E_CITATION_ENVELOPE"],
    ["invalid-block", "E_DRAFT_BLOCK"],
  ]) expectCode(fixture(name), code);
});

test("rejects duplicate evidence IDs, unknown keys, malformed segments, and ragged tables", () => {
  const duplicate = fixture("valid");
  duplicate.citations.push({ ...duplicate.citations[0], evidenceLink: null });
  expectCode(duplicate, "E_CITATION_ENVELOPE");

  const unknownKey = fixture("valid");
  unknownKey.blocks[0].surprise = true;
  expectCode(unknownKey, "E_DRAFT_BLOCK");

  const malformedSegment = fixture("valid");
  malformedSegment.blocks[1].segments = [{ text: "text", citation: 0 }];
  expectCode(malformedSegment, "E_DRAFT_BLOCK");

  const raggedTable = fixture("valid");
  raggedTable.blocks[2].rows = [["only one cell"]];
  expectCode(raggedTable, "E_DRAFT_BLOCK");
});

test("rejects non-object drafts, top-level extras, path escapes, and malformed nested shapes", () => {
  expectCode(null, "E_DRAFT_BLOCK");
  expectCode([], "E_DRAFT_BLOCK");

  const topLevelExtra = fixture("valid");
  topLevelExtra.extra = true;
  expectCode(topLevelExtra, "E_DRAFT_BLOCK");

  for (const source of ["inputs\\trial.docx", "C:\\trial.docx", "inputs/../trial.docx", "inputs/%2E%2E/trial.docx", "inputs/%2Fetc%2Fpasswd", "inputs/a%5Cb.docx", "file:trial.docx"]) {
    const draft = fixture("valid");
    draft.citations[0].source = source;
    expectCode(draft, "E_CITATION_ENVELOPE");
  }

  const citationExtra = fixture("valid");
  citationExtra.citations[0].extra = true;
  expectCode(citationExtra, "E_CITATION_ENVELOPE");

  const classificationExtra = fixture("valid");
  classificationExtra.citations[0].classification.extra = true;
  expectCode(classificationExtra, "E_CITATION_ENVELOPE");

  const emptyBlocks = fixture("valid");
  emptyBlocks.blocks = [];
  assert.deepEqual(validateDraft(emptyBlocks), emptyBlocks);
});
