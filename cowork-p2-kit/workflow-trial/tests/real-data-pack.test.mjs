import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { canonicalJson, sha256 } from "../formula-cell-receipt.mjs";
import { runFormulationSpike } from "../formulation-spike-run.mjs";
import { buildRealDataPackage, deriveRecordRoles, validateBindings, validateDataPackage, validateEvidenceEnvelope } from "../real-data-pack.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");

// One isolated ingest per test-file run: each spike is ~18s (liteparse on the
// frozen mock), so all cases share a single cached in-memory evidence snapshot.
let spikePromise;
function spikeEvidence() {
  spikePromise ??= (async () => {
    const root = mkdtempSync(join(tmpdir(), "qbd-p221-g01-test-"));
    try {
      return await runFormulationSpike({ outDir: join(root, "out") });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  })();
  return spikePromise;
}

function inputs(spike) {
  return {
    matrix: spike.matrix,
    inventory: spike.inventory,
    receipts: spike.receipts,
    sourceHashes: spike.sourceHashes,
    storeRecordsSha256: spike.evidence["two-run-ingest-hashes.json"].first_store_sha256,
    receiptSetSha256: spike.evidence["go-no-go.json"].receipt_set_sha256,
  };
}

test("G-01 builds a deterministic sealed real-data package from the frozen source", async () => {
  const spike = await spikeEvidence();
  const first = buildRealDataPackage(inputs(spike));
  const second = buildRealDataPackage(inputs(spike));

  // Exact cohort and typed evidence kinds
  assert.deepEqual(first.evidence.exact_cohort, ["formula-01", "formula-02", "formula-03"]);
  assert.equal(first.evidence.observed_results.length, 15);
  assert.equal(first.evidence.specifications.length, 3);
  assert.equal(first.evidence.composition_context.length, 3);
  assert.ok(first.evidence.observed_results.every((entry) => entry.kind === "observed_result"));
  assert.ok(first.evidence.specifications.every((entry) => entry.kind === "specification"));
  assert.ok(first.evidence.composition_context.every((entry) => entry.kind === "composition_context"));

  // Observed result sanity (dissolution min/mean/max, assay, CU AV)
  const min01 = first.evidence.observed_results.find((entry) => entry.evidence_id === "observed-result:dissolution-min:formula-01");
  assert.equal(min01.value, 65.15);
  assert.equal(min01.candidate, "formula-01");
  assert.equal(min01.statistic, "minimum");
  assert.equal(min01.unit, "percent");
  assert.equal(min01.raw_cell_text, "65,15");
  assert.match(min01.record_id, /^[0-9a-f]{16}$/);
  assert.match(min01.source_document_sha256, /^[a-f0-9]{64}$/);
  assert.match(min01.store_records_sha256, /^[a-f0-9]{64}$/);

  // Distinct specs with the strict CU operator (no < to <= weakening)
  const dissolutionSpec = first.evidence.specifications.find((entry) => entry.measure === "dissolution");
  assert.deepEqual({ operator: dissolutionSpec.operator, threshold: dissolutionSpec.threshold, unit: dissolutionSpec.unit }, { operator: ">=", threshold: 80, unit: "percent" });
  const assaySpec = first.evidence.specifications.find((entry) => entry.measure === "assay");
  assert.deepEqual({ operator: assaySpec.operator, lower: assaySpec.lower, upper: assaySpec.upper }, { operator: "range-inclusive", lower: 90, upper: 110 });
  const cuSpec = first.evidence.specifications.find((entry) => entry.measure === "content_uniformity_av");
  assert.deepEqual({ operator: cuSpec.operator, threshold: cuSpec.threshold, unit: cuSpec.unit }, { operator: "<", threshold: 15, unit: "percent" });

  // Source-bound 1%/3%/5% composition context
  const composition = Object.fromEntries(first.evidence.composition_context.map((entry) => [entry.candidate, entry.value]));
  assert.deepEqual(composition, { "formula-01": 1, "formula-02": 3, "formula-03": 5 });

  // v1-compatible fact cards: 15 scoring + 3 rationale-support
  assert.equal(first.cards.schema_version, 1);
  assert.equal(first.cards.cards.length, 18);
  const scoring = first.bindings.bindings.filter((binding) => binding.binding_role === "scoring");
  const rationale = first.bindings.bindings.filter((binding) => binding.binding_role === "rationale_support");
  assert.equal(scoring.length, 15);
  assert.equal(rationale.length, 3);
  assert.ok(scoring.every((binding) => binding.kind === "observed_result"));
  assert.ok(rationale.every((binding) => binding.kind === "composition_context"));
  const cardIds = new Set(first.cards.cards.map((card) => card.id));
  assert.ok(first.bindings.bindings.every((binding) => cardIds.has(binding.card_id)));
  assert.ok(first.cards.cards.every((card) => typeof card.quote === "string" && card.quote.length >= 16));

  // Inventory fully reconciled; roles derived, never supplied
  assert.equal(first.reconciliation.record_count, 4);
  assert.deepEqual(first.reconciliation.exclusions, []);
  assert.ok(first.reconciliation.records.every((record) => record.status === "admitted"));
  const roles = first.reconciliation.derived_roles;
  assert.deepEqual(roles["03d71cae3495ddf6"], ["composition_context"]);
  assert.deepEqual(roles["1af35f108df257cd"], ["observed_result", "specification"]);
  assert.deepEqual(first.reconciliation.derived_roles, deriveRecordRoles(spike.receipts));

  // Package seals source / store / receipt-set hashes
  assert.equal(first.package.bound_hashes.source_document_sha256, spike.sourceHashes.source_document_sha256);
  assert.equal(first.package.bound_hashes.document_xml_sha256, spike.sourceHashes.document_xml_sha256);
  assert.equal(first.package.bound_hashes.store_records_sha256, spike.evidence["two-run-ingest-hashes.json"].first_store_sha256);
  assert.equal(first.package.bound_hashes.receipt_set_sha256, spike.evidence["go-no-go.json"].receipt_set_sha256);
  assert.equal(first.package.evidence_envelope_sha256, first.hashes.evidence_envelope_sha256);

  // Determinism: two builds produce byte-identical artifacts
  assert.equal(canonicalJson(first.evidence), canonicalJson(second.evidence));
  assert.equal(canonicalJson(first.cards), canonicalJson(second.cards));
  assert.equal(canonicalJson(first.bindings), canonicalJson(second.bindings));
  assert.equal(canonicalJson(first.reconciliation), canonicalJson(second.reconciliation));
  assert.equal(canonicalJson(first.package), canonicalJson(second.package));
  assert.equal(first.hashes.package_sha256, second.hashes.package_sha256);
});

test("G-01 rejects a directly-constructed scoring card bound to a specification", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const forged = [
    ...pkg.bindings.bindings,
    { card_id: pkg.cards.cards[0].id, evidence_id: "specification:dissolution", kind: "observed_result", binding_role: "scoring" },
  ];
  assert.throws(
    () => validateBindings({ bindings: forged, evidence: pkg.evidence, cards: pkg.cards, receipts: spike.receipts }),
    (error) => error.code === "E_SPEC_AS_RESULT",
  );
});

test("G-01 rejects a missing, extra or duplicated formula in the candidate set", async () => {
  const spike = await spikeEvidence();
  const invalid = [
    ["formula-01", "formula-02"],
    ["formula-01", "formula-02", "formula-03", "formula-04"],
    ["formula-01", "formula-01", "formula-02", "formula-03"],
  ];
  for (const formulaIds of invalid) {
    assert.throws(
      () => buildRealDataPackage({ ...inputs(spike), matrix: { ...spike.matrix, formula_ids: formulaIds } }),
      (error) => error.code === "E_EXACT_COHORT",
    );
  }
});

test("G-01 rejects an omitted inventory record", async () => {
  const spike = await spikeEvidence();
  const inventory = { ...spike.inventory, record_count: 3, records: spike.inventory.records.slice(0, 3) };
  assert.throws(
    () => buildRealDataPackage({ ...inputs(spike), inventory }),
    (error) => error.code === "E_INVENTORY_RECONCILIATION",
  );
});

test("G-01 rejects caller-supplied roles that downgrade an observed result to context", async () => {
  const spike = await spikeEvidence();
  const derived = deriveRecordRoles(spike.receipts);
  const downgraded = { ...derived, ["1af35f108df257cd"]: ["composition_context"] };
  assert.throws(
    () => buildRealDataPackage({ ...inputs(spike), recordRoles: downgraded }),
    (error) => error.code === "E_ROLE_OVERRIDE",
  );
});

test("G-01 rejects a binding that points at a wrong kind or a scorable composition card", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const observed = pkg.evidence.observed_results[0];
  const composition = pkg.evidence.composition_context[0];

  const wrongKind = [
    ...pkg.bindings.bindings,
    { card_id: pkg.cards.cards[0].id, evidence_id: observed.evidence_id, kind: "composition_context", binding_role: "scoring" },
  ];
  assert.throws(
    () => validateBindings({ bindings: wrongKind, evidence: pkg.evidence, cards: pkg.cards, receipts: spike.receipts }),
    (error) => error.code === "E_BINDING_AMBIGUOUS",
  );

  const scorableComposition = [
    ...pkg.bindings.bindings,
    { card_id: pkg.cards.cards[0].id, evidence_id: composition.evidence_id, kind: "composition_context", binding_role: "scoring" },
  ];
  assert.throws(
    () => validateBindings({ bindings: scorableComposition, evidence: pkg.evidence, cards: pkg.cards, receipts: spike.receipts }),
    (error) => error.code === "E_BINDING_AMBIGUOUS",
  );
});

test("G-01 rejects a bindings set that drops an adverse scoring binding", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const dropped = pkg.bindings.bindings.filter(
    (binding) => !(binding.binding_role === "scoring" && binding.evidence_id === "observed-result:dissolution-min:formula-01"),
  );
  assert.throws(
    () => validateBindings({ bindings: dropped, evidence: pkg.evidence, cards: pkg.cards, receipts: spike.receipts }),
    (error) => error.code === "E_BINDING_INCOMPLETE",
  );
});

test("G-01 rejects an ambiguous receipt-to-record join", async () => {
  const spike = await spikeEvidence();
  const receipts = [...spike.receipts, { ...spike.receipts[0] }];
  assert.throws(
    () => buildRealDataPackage({ ...inputs(spike), receipts }),
    (error) => error.code === "E_BINDING_AMBIGUOUS",
  );
});

test("G-01 rejects a caller-trimmed receipt and matching inventory with a recomputed hash", async () => {
  const spike = await spikeEvidence();
  const omittedReceiptId = "dissolution-min:formula-01";
  const receipts = spike.receipts.filter((receipt) => receipt.receipt_id !== omittedReceiptId);
  const inventory = {
    ...spike.inventory,
    records: spike.inventory.records.map((record) => ({
      ...record,
      receipt_ids: record.receipt_ids.filter((receiptId) => receiptId !== omittedReceiptId),
    })),
  };
  assert.throws(
    () => buildRealDataPackage({ ...inputs(spike), receipts, inventory, receiptSetSha256: sha256(canonicalJson(receipts)) }),
    (error) => error.code === "E_PACKAGE_HASH_BINDING",
  );
});

test("G-01 enforces the evidence schema for invalid value and source hash types", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const evidence = structuredClone(pkg.evidence);
  evidence.observed_results[0].value = "not-a-number";
  evidence.observed_results[0].source_document_sha256 = "not-a-sha256";
  assert.throws(
    () => validateEvidenceEnvelope(evidence),
    (error) => error.code === "E_EVIDENCE_SCHEMA",
  );
});

test("G-01 rejects evidence with substituted source, store or receipt provenance", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  for (const field of ["source_document_sha256", "store_records_sha256", "receipt_id"]) {
    const evidence = structuredClone(pkg.evidence);
    evidence.observed_results[0][field] = field === "receipt_id"
      ? "dissolution-min:formula-02"
      : "a".repeat(64);
    assert.throws(
      () => validateEvidenceEnvelope(evidence),
      (error) => error.code === "E_EVIDENCE_ENVELOPE",
    );
  }
});

test("G-01 rejects a fabricated card quote and offset that do not match bound receipt provenance", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const cards = structuredClone(pkg.cards);
  cards.cards[0].quote = "fabricated source quote";
  cards.cards[0].char_end += 1;
  assert.throws(
    () => validateBindings({ bindings: pkg.bindings.bindings, evidence: pkg.evidence, cards, receipts: spike.receipts }),
    (error) => error.code === "E_FACT_PROVENANCE",
  );
  const wrongSource = structuredClone(pkg.cards);
  wrongSource.cards[0].provenance.file = "inputs/fabricated.docx";
  assert.throws(
    () => validateBindings({ bindings: pkg.bindings.bindings, evidence: pkg.evidence, cards: wrongSource, receipts: spike.receipts }),
    (error) => error.code === "E_FACT_PROVENANCE",
  );
});

test("G-01 rejects coordinated evidence and card provenance mutation against trusted receipts", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const evidence = structuredClone(pkg.evidence);
  const cards = structuredClone(pkg.cards);
  const card = cards.cards[0];
  const binding = pkg.bindings.bindings.find((entry) => entry.card_id === card.id);
  const boundEvidence = [...evidence.observed_results, ...evidence.specifications, ...evidence.composition_context]
    .find((entry) => entry.evidence_id === binding.evidence_id);
  card.quote = "fabricated source quote";
  card.char_start = 0;
  card.char_end = card.quote.length;
  boundEvidence.quote_sha256 = sha256(card.quote);
  boundEvidence.char_start = card.char_start;
  boundEvidence.char_end = card.char_end;
  assert.throws(
    () => validateBindings({ bindings: pkg.bindings.bindings, evidence, cards, receipts: spike.receipts }),
    (error) => error.code === "E_FACT_PROVENANCE",
  );
});

test("G-01 rejects cyclic candidate mutation even when matching cards are changed", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const evidence = structuredClone(pkg.evidence);
  const cards = structuredClone(pkg.cards);
  const nextCandidate = { "formula-01": "formula-02", "formula-02": "formula-03", "formula-03": "formula-01" };
  for (const entry of evidence.observed_results) entry.candidate = nextCandidate[entry.candidate];
  for (const binding of pkg.bindings.bindings.filter((entry) => entry.binding_role === "scoring")) {
    const card = cards.cards.find((entry) => entry.id === binding.card_id);
    card.candidate = nextCandidate[card.candidate];
  }
  assert.throws(
    () => validateBindings({ bindings: pkg.bindings.bindings, evidence, cards, receipts: spike.receipts }),
    (error) => error.code === "E_FACT_PROVENANCE",
  );
});

test("G-01 rejects an observed statistic that does not match its receipt", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const evidence = structuredClone(pkg.evidence);
  evidence.observed_results.find((entry) => entry.evidence_id === "observed-result:dissolution-min:formula-01").statistic = "raw";
  assert.throws(
    () => validateBindings({ bindings: pkg.bindings.bindings, evidence, cards: pkg.cards, receipts: spike.receipts }),
    (error) => error.code === "E_FACT_PROVENANCE",
  );
});

test("G-01 rejects specification threshold and range mutation with updated hashes", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const mutations = [
    { measure: "dissolution", values: { operator: ">=", threshold: 65, unit: "percent" } },
    { measure: "assay", values: { operator: "range-inclusive", lower: 89, upper: 111, unit: "percent" } },
  ];
  for (const { measure, values } of mutations) {
    const evidence = structuredClone(pkg.evidence);
    const specification = evidence.specifications.find((entry) => entry.measure === measure);
    Object.assign(specification, values);
    specification.normalized_value_sha256 = sha256(canonicalJson(values));
    assert.throws(
      () => validateBindings({ bindings: pkg.bindings.bindings, evidence, cards: pkg.cards, receipts: spike.receipts }),
      (error) => error.code === "E_FACT_PROVENANCE",
    );
  }
});

test("G-01 rejects duplicate fact-card IDs before binding resolution", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const cards = structuredClone(pkg.cards);
  cards.cards[1].id = cards.cards[0].id;
  assert.throws(
    () => validateBindings({ bindings: pkg.bindings.bindings, evidence: pkg.evidence, cards, receipts: spike.receipts }),
    (error) => error.code === "E_BINDING_AMBIGUOUS",
  );
});

test("G-01 validates binding and package schema envelopes at runtime", async () => {
  const spike = await spikeEvidence();
  const pkg = buildRealDataPackage(inputs(spike));
  const malformedBindings = structuredClone(pkg.bindings.bindings);
  malformedBindings[0].unexpected = true;
  assert.throws(
    () => validateBindings({ bindings: malformedBindings, evidence: pkg.evidence, cards: pkg.cards, receipts: spike.receipts }),
    (error) => error.code === "E_BINDING_SCHEMA",
  );
  const malformedPackage = structuredClone(pkg.package);
  malformedPackage.bound_hashes.store_records_sha256 = "not-a-sha256";
  assert.throws(
    () => validateDataPackage(malformedPackage),
    (error) => error.code === "E_PACKAGE_SCHEMA",
  );
});
