import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import test, { after, before } from "node:test";

import { validateDraft } from "../../render/contract.mjs";
import { buildContentDraft, DEMO_TITLE, validateDemoDraft } from "../rationale-to-content-draft.mjs";
import { parseArguments, runContentDemo } from "../content-demo-run.mjs";
import { buildExactReceiptJoin, REAL_SOURCE_FILE, storeHash } from "../demo-data-pack.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const artifactParent = resolve(repoRoot, "artifacts/template-docx-content-demo");
let testRoot;
let first;
let second;

before(async () => {
  mkdirSync(artifactParent, { recursive: true });
  testRoot = mkdtempSync(join(artifactParent, "acceptance-"));
  const firstRoot = join(testRoot, "run-1");
  const secondRoot = join(testRoot, "run-2");
  first = await runContentDemo({ artifactRoot: firstRoot, reportRoot: null });
  second = await runContentDemo({ artifactRoot: secondRoot, reportRoot: null });
});

after(() => {
  if (testRoot) rmSync(testRoot, { recursive: true, force: true });
});

test("selected pack is store-bound and its receipt join is exactly 3/2/0", () => {
  assert.deepEqual(first.receipt_join, { exact: 3, ambiguous: 0, unmapped: 2 });
  assert.equal(first.join.counts.exact, 3);
  assert.equal(first.join.entries.filter((entry) => entry.status === "exact").length, 3);
  assert.equal(first.join.entries.filter((entry) => entry.status === "unmapped").length, 2);
  assert.ok(first.join.entries.filter((entry) => entry.status === "unmapped").every((entry) => (
    entry.record_id === null && entry.location === null && entry.excerpt === null
  )));
  assert.equal(first.citations.length, 3);
  assert.ok(first.citations.every((citation) => citation.classification.label === "public" && citation.classification.citable === true));
  assert.ok(first.citations.every((citation) => citation.evidenceLink === null));
  assert.ok(first.packet.fact_cards.cards.some((card) => card.candidate === "demo-comparator" && card.id.includes("COMPARATOR")));
  assert.equal(first.decision.status, "selected");
  assert.equal(first.decision.winner, "demo-real-candidate");
});

test("same-packet rationale and rich draft satisfy the demo boundary", () => {
  assert.equal(first.rationale.display_state, "internal_only");
  assert.equal(first.rationale.packet_id, first.packet.packet_id);
  assert.equal(first.rationale.decision_sha256, first.packet.evaluation.decision_sha256);
  assert.equal(first.draft.title, DEMO_TITLE);
  assert.deepEqual(validateDraft(first.draft), first.draft);
  assert.deepEqual(validateDemoDraft(first.draft), first.draft);
  assert.equal(first.draft.citations.length, 3);
  assert.equal(first.draft.blocks.filter((block) => block.type === "paragraph").length, 2);
  assert.ok(first.draft.blocks.some((block) => block.type === "heading2"));
  assert.ok(first.draft.blocks.some((block) => block.type === "table"));
  assert.equal(first.draft.blocks.some((block) => block.type === "chờ_dữ_liệu"), false);
  const body = first.draft.blocks.flatMap((block) => {
    if (typeof block.text === "string") return [block.text];
    if (Array.isArray(block.segments)) return block.segments.filter((segment) => segment.text).map((segment) => segment.text);
    if (Array.isArray(block.rows)) return block.rows.flat();
    return [];
  }).join("\n");
  for (const citation of first.citations) assert.equal(body.includes(citation.excerpt), false);
});

test("Bubblewrap render places the watermark first and retains the review artifact", () => {
  assert.equal(first.status, "pass");
  assert.equal(first.sandbox.unshare_net, true);
  assert.equal(first.sandbox.exit_code, 0);
  assert.ok(existsSync(first.output));
  assert.ok(existsSync(join(resolve(first.output, ".."), "draft.json")));
  assert.equal(first.rendered_first_text, DEMO_TITLE);
  assert.ok(first.normalized_ooxml_sha256.length === 64);
  const snapshot = JSON.parse(readFileSync(join(resolve(first.output, ".."), "isolated-snapshot.json"), "utf8"));
  assert.ok(snapshot.argv.includes("--unshare-net"));
  assert.equal(snapshot.exit_code, 0);
});

test("two fresh runs have equal normalized OOXML and preserve the documented trust lanes", () => {
  assert.deepEqual(first.normalized.manifest, second.normalized.manifest);
  assert.equal(first.normalized_ooxml_sha256, second.normalized_ooxml_sha256);
  assert.equal(first.canonical_unchanged, true);
  assert.equal(second.canonical_unchanged, true);
  assert.equal(first.dirty_tracked_files_unchanged, true);
  assert.equal(second.dirty_tracked_files_unchanged, true);
  assert.notEqual(first.output_sha256.length, 0);
  assert.notEqual(second.output_sha256.length, 0);
});

test("adapter and render contracts fail closed on watermark, wait-data, and uncitable drift", () => {
  const wrongTitle = structuredClone(first.draft);
  wrongTitle.title = "Synthetic demo";
  assert.throws(() => validateDemoDraft(wrongTitle), (error) => error.code === "E_DEMO_WATERMARK");

  const waitData = structuredClone(first.draft);
  waitData.blocks.push({ type: "chờ_dữ_liệu", text: "not permitted" });
  assert.throws(() => validateDemoDraft(waitData), (error) => error.code === "E_DEMO_WAIT_DATA");

  const uncitable = structuredClone(first.draft);
  uncitable.citations[0].classification.citable = false;
  assert.throws(() => validateDraft(uncitable), (error) => error.code === "E_CITATION_UNCITABLE");
});

test("receipt joins bind the canonical store and substring-specific offsets", () => {
  const content = "prefix ALPHA BETA GAMMA suffix";
  const records = [{
    id: "receipt-record",
    content,
    provenance: { file: REAL_SOURCE_FILE, page: 7, char_start: 100, char_end: 100 + content.length, quote: content },
  }];
  const receipt = { entries: [
    { canonical_field_id: "a", raw_value: "ALPHA" },
    { canonical_field_id: "b", raw_value: "BETA" },
    { canonical_field_id: "c", raw_value: "GAMMA" },
    { canonical_field_id: "d", raw_value: "MISSING-1" },
    { canonical_field_id: "e", raw_value: "MISSING-2" },
  ] };
  const join = buildExactReceiptJoin({ receipt, records, storeRecordsSha256: storeHash(records) });
  assert.equal(join.entries[0].char_start, 107);
  assert.equal(join.entries[0].char_end, 112);
  assert.equal(join.store_records_sha256, storeHash(records));
  assert.throws(() => buildExactReceiptJoin({ receipt, records, storeRecordsSha256: "0".repeat(64) }), (error) => error.code === "E_RECEIPT_STORE_HASH");
  const duplicateRecords = [...records, { ...records[0], id: "receipt-record-2" }];
  assert.throws(() => buildExactReceiptJoin({ receipt, records: duplicateRecords, storeRecordsSha256: storeHash(duplicateRecords) }), (error) => error.code === "E_RECEIPT_JOIN_CARDINALITY");
});

test("content adapter does not alias caller-owned citation envelopes", () => {
  const sourceCitations = structuredClone(first.citations);
  const draft = buildContentDraft({ packet: first.packet, rationale: first.rationale, citations: sourceCitations });
  draft.citations[0].classification.citable = false;
  assert.equal(sourceCitations[0].classification.citable, true);
});

test("artifact containment rejects an ancestor symlink before any run write", async () => {
  const symlinkRoot = join(testRoot, "symlink-probe");
  symlinkSync(resolve(repoRoot, "cowork-p2-kit/store"), symlinkRoot, "dir");
  try {
    await assert.rejects(() => runContentDemo({ artifactRoot: join(symlinkRoot, "child"), reportRoot: null }), (error) => error.code === "E_DEMO_PATH");
  } finally {
    unlinkSync(symlinkRoot);
  }
});

test("CLI parser consumes option values", () => {
  assert.deepEqual(parseArguments(["--artifact-root", "artifacts/demo", "--report-root", "plans/demo/reports"]), {
    artifactRoot: "artifacts/demo",
    reportRoot: "plans/demo/reports",
  });
});
