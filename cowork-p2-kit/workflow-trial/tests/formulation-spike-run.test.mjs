import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import JSZip from "jszip";
import { createLiteparseAdapter } from "../../ingest/liteparse-adapter.mjs";
import { canonicalJson, deriveFormulaColumns, locateFormulaOwnership, parseFormulaTables, parseQuoteSpecification, parseSourceSpecification, reconcileFormulaReceipts, sha256 } from "../formula-cell-receipt.mjs";
import { assertIsolatedConfig, assertIsolatedManifest, runFormulationSpike, verifyFrozenSource } from "../formulation-spike-run.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const expected = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/expected-formula-matrix.json"), "utf8"));

function cell(text, span = 1) {
  return `<w:tc><w:tcPr>${span === 1 ? "" : `<w:gridSpan w:val="${span}"/>`}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

function compositionTable() {
  return `<w:tbl><w:tr>${cell("STT")}${cell("Thành phần")}${cell("Công thức 01", 2)}${cell("Công thức 02", 2)}${cell("Công thức 03", 2)}</w:tr><w:tr>${cell("")}${cell("")}${cell("Hàm lượng 1 viên (mg)")}${cell("Tỷ lệ (%)")}${cell("Hàm lượng 1 viên (mg)")}${cell("Tỷ lệ (%)")}${cell("Hàm lượng 1 viên (mg)")}${cell("Tỷ lệ (%)")}</w:tr></w:tbl>`;
}

function resultsTable(headers = ["Công thức 01", "Công thức 02", "Công thức 03"]) {
  return `<w:tbl><w:tr>${cell("STT")}${cell("Chỉ tiêu")}${headers.map((header) => cell(header)).join("")}</w:tr></w:tbl>`;
}

test("G-00 runs two source-pinned isolated ingests and binds every critical cell once", async () => {
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-g00-test-"));
  try {
    const first = await runFormulationSpike({ outDir: join(root, "first") });
    const second = await runFormulationSpike({ outDir: join(root, "second") });
    assert.deepEqual(first.matrix, expected);
    assert.deepEqual(second.matrix, expected);
    assert.equal(first.receipts.length, 21);
    assert.ok(first.receipts.every((entry) => entry.record_binding?.status === "exact"));
    assert.match(first.receipts.find((entry) => entry.receipt_id === "specification:dissolution").record_binding.quote, /≥\s*80%/);
    assert.ok(first.receipts.every((entry) => entry.classification.citable === false));
    assert.deepEqual(first.evidence["two-run-ingest-hashes.json"], second.evidence["two-run-ingest-hashes.json"]);
    assert.equal(first.evidence["go-no-go.json"].verdict, "GO");
    for (const name of ["template-field-map.v1.json", "template-cell-receipt.v1.json", "source-hashes.json", "isolated-config-receipt.json", "formula-evidence-matrix.json", "result-inventory.json", "formula-cell-receipts.json", "two-run-ingest-hashes.json", "go-no-go.json"]) {
      assert.equal(existsSync(join(root, "first", name)), true, `${name} was not emitted`);
    }
    assert.equal(first.templateBinding.fieldMap.occurrence_count, 146);
    assert.equal(first.templateBinding.receipt.occurrence_count, 146);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-00 rejects a changed frozen hash before an ingest configuration can be used", async () => {
  await assert.rejects(
    () => verifyFrozenSource({ expectedPins: { source_document_sha256: "0".repeat(64), document_xml_sha256: "0".repeat(64) } }),
    (error) => error.code === "E_SOURCE_HASH",
  );
  await assert.rejects(
    () => verifyFrozenSource({ expectedPins: { source_document_sha256: "01fe95607f4733e2b47a4c46f8dad5817d6014cc40f69a08631977c9d890cd8f", document_xml_sha256: "0".repeat(64) } }),
    (error) => error.code === "E_DOCUMENT_HASH",
  );
});

test("G-00 rejects an isolated manifest that omits the frozen filled mock", () => {
  assert.throws(() => assertIsolatedManifest({}), (error) => error.code === "E_ISOLATED_MANIFEST");
});

test("G-00 forbids canonical ingest roots", () => {
  assert.throws(
    () => assertIsolatedConfig({
      kitDir: resolve(repoRoot, "cowork-p2-kit"),
      inputsRoot: resolve(repoRoot, "cowork-p2-kit/inputs"),
      storeRoot: resolve(repoRoot, "cowork-p2-kit/store"),
    }),
    (error) => error.code === "E_CANONICAL_INGEST",
  );
  assert.throws(
    () => assertIsolatedConfig({
      kitDir: resolve(repoRoot, "cowork-p2-kit/inputs/spike"),
      inputsRoot: resolve(repoRoot, "cowork-p2-kit/inputs/spike/inputs"),
      storeRoot: resolve(repoRoot, "cowork-p2-kit/inputs/spike/store"),
    }),
    (error) => error.code === "E_CANONICAL_INGEST",
  );
});

test("G-00 does not bind a raw value from an unrelated record", () => {
  const receipt = {
    schema_version: "formula-cell-receipt/v1",
    receipt_id: "croscarmellose-sodium:formula-01",
    formula_id: "formula-01",
    evidence_kind: "composition_context",
    source_file: "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx",
    source_document_sha256: "a".repeat(64),
    document_xml_sha256: "b".repeat(64),
    owner: { table_index: 1, table_signature_sha256: "c".repeat(64), row: 6, row_key: "croscarmellose-sodium", formula_column_header: "Công thức 01", physical_cell: 4, logical_column_start: 4, logical_column_end: 4, grid_span: 1, vertical_merge: "none" },
    raw_cell_text: "1,00",
    raw_cell_sha256: sha256("1,00"),
    raw_cell_xml_sha256: sha256("<w:p><w:r><w:t>1,00</w:t></w:r></w:p>"),
    normalized_value: { value: 1, unit: "percent" },
    normalized_value_sha256: sha256(canonicalJson({ value: 1, unit: "percent" })),
    classification: { label: "public", citable: false },
  };
  const unrelated = [{
    id: "wrong-record",
    content: "unrelated table has 1,00",
    provenance: { file: receipt.source_file, page: 99, char_start: 0, char_end: 22, quote: "unrelated table has 1,00" },
    classification: { label: "public", citable: false },
    extraction_status: "ok",
  }];
  assert.throws(
    () => reconcileFormulaReceipts({ receipts: [receipt], records: unrelated, storeRecordsSha256: sha256(Buffer.from(`${JSON.stringify(unrelated[0])}\n`)) }),
    (error) => error.code === "E_RECEIPT_JOIN_CARDINALITY",
  );
});

test("G-00 rejects protected and symlinked output roots before writing", async () => {
  await assert.rejects(
    () => runFormulationSpike({ outDir: resolve(repoRoot, "cowork-p2-kit/outputs") }),
    (error) => error.code === "E_SPIKE_OUTPUT",
  );
  const root = mkdtempSync(join(tmpdir(), "qbd-p221-output-symlink-"));
  const link = join(root, "link");
  symlinkSync(tmpdir(), link, "dir");
  try {
    await assert.rejects(
      () => runFormulationSpike({ outDir: join(link, "child") }),
      (error) => error.code === "E_SPIKE_OUTPUT",
    );
  } finally {
    unlinkSync(link);
    rmSync(root, { recursive: true, force: true });
  }
});

test("G-00 derives the unique formula headers and composition percent leaves from OOXML", () => {
  const composition = parseFormulaTables(`<w:document>${compositionTable()}${resultsTable()}${resultsTable()}</w:document>`)[0];
  assert.deepEqual(
    Object.fromEntries(Object.entries(deriveFormulaColumns(composition, "composition")).map(([id, column]) => [id, column.logical_column])),
    { "formula-01": 4, "formula-02": 6, "formula-03": 8 },
  );
  const mergedLeaf = parseFormulaTables(`<w:document>${compositionTable().replace(cell("Tỷ lệ (%)"), cell("Tỷ lệ (%)", 2))}${resultsTable()}${resultsTable()}</w:document>`)[0];
  assert.throws(() => deriveFormulaColumns(mergedLeaf, "composition"), { code: "E_FORMULA_HEADER" });
  const swapped = parseFormulaTables(`<w:document>${compositionTable()}${resultsTable(["Công thức 02", "Công thức 01", "Công thức 03"])}${resultsTable()}</w:document>`)[1];
  assert.throws(() => deriveFormulaColumns(swapped, "results"), { code: "E_FORMULA_HEADER" });
});

test("G-00 parses OOXML symbols and rejects source or quote specification drift", () => {
  assert.deepEqual(parseSourceSpecification("assay", '<w:p><w:r><w:t>Định lượng: 90 </w:t></w:r><w:r><w:sym w:font="Symbol" w:char="F02D"/></w:r><w:r><w:t> 110%</w:t></w:r></w:p>'), { operator: "range-inclusive", lower: 90, upper: 110, unit: "percent" });
  assert.deepEqual(parseSourceSpecification("dissolution", "<w:p><w:r><w:t>Độ hòa tan: ≥ 80%</w:t></w:r></w:p>"), { operator: ">=", threshold: 80, unit: "percent" });
  assert.throws(() => parseSourceSpecification("assay", '<w:p><w:r><w:sym w:font="Symbol" w:char="FFFF"/></w:r></w:p>'), { code: "E_OOXML_SYMBOL" });
  assert.deepEqual(parseQuoteSpecification("dissolution", "Độ hòa tan: = 80% bisoprolol"), { operator: "=", threshold: 80, unit: "percent" });
});

test("G-00 fidelity restoration never rewrites an already-correct composite operator", () => {
  const adapter = createLiteparseAdapter({
    litBinary: "/absolute/lit", fileOps: { existsSync: () => true }, textFidelityReplacements: [{ from: "=", to: "≥", context: "80%" }],
    runProcess: () => ({ status: 0, stdout: JSON.stringify({ pages: [{ page: 1, text: "Độ hòa tan >= 80%" }] }) }),
  });
  assert.throws(() => adapter.parse("/absolute/mock.docx"), { code: "E_PARSE" });
});

test("G-00 rejects a quote that has correct anchors but a different specification operator", () => {
  const receipt = {
    schema_version: "formula-cell-receipt/v1", receipt_id: "specification:dissolution", formula_id: null, evidence_kind: "specification", source_file: "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx", source_document_sha256: "a".repeat(64), document_xml_sha256: "b".repeat(64), owner: { table_index: 3, table_signature_sha256: "c".repeat(64), row: 16, row_key: "dissolution-specification", formula_column_header: null, physical_cell: 2, logical_column_start: 2, logical_column_end: 2, grid_span: 1, vertical_merge: "none" }, raw_cell_text: "Độ hòa tan: ≥ 80%", raw_cell_sha256: sha256("Độ hòa tan: ≥ 80%"), raw_cell_xml_sha256: sha256("<w:t>Độ hòa tan: ≥ 80%</w:t>"), normalized_value: { operator: ">=", threshold: 80, unit: "percent" }, normalized_value_sha256: sha256(canonicalJson({ operator: ">=", threshold: 80, unit: "percent" })), classification: { label: "public", citable: false }, record_binding: null,
  };
  const record = { id: "actual-liteparse-quote", content: "D6 hoa tan (%): = 80% (Q) bisoprolol", provenance: { file: receipt.source_file, page: 2, char_start: 0, char_end: 38, quote: "D6 hoa tan (%): = 80% (Q) bisoprolol" }, classification: { label: "public", citable: false }, extraction_status: "ok" };
  assert.throws(() => reconcileFormulaReceipts({ receipts: [receipt], records: [record], storeRecordsSha256: sha256(Buffer.from(`${JSON.stringify(record)}\n`)) }), { code: "E_RECEIPT_SPECIFICATION_PROJECTION" });
});

test("G-00 rejects duplicate criterion rows in the source table", async () => {
  const source = readFileSync(resolve(repoRoot, "cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx"));
  const zip = await JSZip.loadAsync(source); const xml = await zip.file("word/document.xml").async("string");
  const row = [...xml.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map((match) => match[0]).find((value) => value.includes("hòa") && value.includes("tan") && value.includes("80%"));
  assert.ok(row, "frozen source must contain the dissolution criterion row");
  assert.throws(() => locateFormulaOwnership(parseFormulaTables(xml.replace(row, `${row}${row}`))), { code: "E_FORMULA_ROW" });
});
