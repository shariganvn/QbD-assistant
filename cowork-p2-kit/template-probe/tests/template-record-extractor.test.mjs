import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileTemplateFieldMap } from "../template-field-map.mjs";
import { assertCellReceipt } from "../template-cell-receipt.mjs";
import { canonicalJson, deriveOccurrenceId } from "../template-field-contract.mjs";
import {
  extractTemplateCellReceipt,
  MVP_FIELD_IDS,
  selectTemplateFieldMap,
} from "../template-record-extractor.mjs";
import {
  cell,
  createDocx,
  documentXml,
  paragraph,
  row,
  syntheticContract,
  table,
  textRun,
  writeFixture,
} from "./fixtures/template-field-map/synthetic-docx.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const officialTemplate = resolve(repoRoot, "cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx");
const officialMock = resolve(repoRoot, "cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx");

function expectCode(code) {
  return (error) => error?.code === code;
}

function rehashFieldMap(fieldMap, entries) {
  const next = {
    ...fieldMap,
    occurrence_count: entries.length,
    entries: [...entries].sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id)),
    field_map_sha256: null,
  };
  next.field_map_sha256 = createHash("sha256").update(canonicalJson(next)).digest("hex");
  return next;
}

async function syntheticDocuments(root, filledBody = null) {
  const templateBody = table(
    row(
      cell(paragraph(textRun("<PDS-180-CT02>"))),
      cell(paragraph(textRun("Độ đồng đều: <UOM-SPEC>")), '<w:vMerge w:val="restart"/>'),
    ),
    row(cell(paragraph(textRun("Không có trường"))), cell(paragraph(textRun("")), '<w:vMerge/>')),
  ) + table(row(cell(paragraph(textRun("Định lượng: <API-NAME>  <ASSAY-SPEC>")))))
    + paragraph(textRun("Thử nghiệm: <EXPERIMENT-DESCRIPTION>."))
    + paragraph(textRun("Cỡ lô: <BATCH-SIZE>."));
  const filled = filledBody ?? table(
    row(
      cell(paragraph(textRun("28,11"))),
      cell(paragraph(textRun("Độ đồng đều: ± 5% ")), '<w:vMerge w:val="restart"/>'),
    ),
    row(cell(paragraph(textRun("Không có trường"))), cell(paragraph(textRun("")), '<w:vMerge/>')),
  ) + table(row(cell(paragraph(textRun("Định lượng: bisoprolol  90%")))))
    + paragraph(textRun("Thử nghiệm: khảo sát."))
    + paragraph(textRun("Cỡ lô: 1.000."));
  const templateXml = documentXml(templateBody);
  const filledXml = documentXml(filled);
  const template = await writeFixture(root, "synthetic-template.docx", templateXml);
  const filledFile = await writeFixture(root, "synthetic-filled.docx", filledXml);
  const contract = syntheticContract({
    bytes: template.bytes,
    document: templateXml,
    tokens: ["PDS-180-CT02", "UOM-SPEC", "API-NAME", "ASSAY-SPEC"],
    paragraphTokens: ["EXPERIMENT-DESCRIPTION", "BATCH-SIZE"],
  });
  contract.manifest.public_mock = {
    source_path: "synthetic-filled.docx",
    immutable: true,
    sha256: createHash("sha256").update(filledFile.bytes).digest("hex"),
    document_xml_sha256: createHash("sha256").update(filledXml).digest("hex"),
  };
  const map = await compileTemplateFieldMap(template.path, contract);
  return { template, filled: filledFile, contract, map };
}

test("extractor preserves exact raw values, joins by occurrence_id, and records unavailable page provenance", async () => {
  const root = mkdtempSync(join(tmpdir(), "template-record-extractor-test-"));
  try {
    const { template, filled, contract, map } = await syntheticDocuments(root);
    const receipt = await extractTemplateCellReceipt(map, filled.path, {
      manifest: contract.manifest,
      grammar: contract.grammar,
      metadata: contract.metadata,
      templateSourcePath: template.path,
      filledDocumentExpectation: contract.manifest.public_mock,
    });
    assertCellReceipt(receipt, map);
    assert.equal(receipt.occurrence_count, map.occurrence_count);
    assert.equal(receipt.record_projection.status, "not_available");
    assert.equal(receipt.record_projection.reason_code, "E_PAGE_PROVENANCE_UNAVAILABLE");
    assert.equal(receipt.entries.find((entry) => entry.raw_source_token === "<PDS-180-CT02>").raw_value, "28,11");
    assert.equal(receipt.entries.find((entry) => entry.raw_source_token === "<UOM-SPEC>").raw_value, "± 5% ");
    assert.equal(receipt.entries.find((entry) => entry.raw_source_token === "<API-NAME>").raw_value, "bisoprolol");
    assert.equal(receipt.entries.find((entry) => entry.raw_source_token === "<ASSAY-SPEC>").raw_value, "90%");
    assert.equal(receipt.entries.find((entry) => entry.raw_source_token === "<BATCH-SIZE>").raw_value, "1.000");
    assert.ok(receipt.entries.every((entry) => entry.record_id === null));

    const malformedReceipt = structuredClone(receipt);
    malformedReceipt.entries[0].owner = { kind: "untrusted" };
    malformedReceipt.receipt_sha256 = createHash("sha256").update(canonicalJson({ ...malformedReceipt, receipt_sha256: null })).digest("hex");
    assert.throws(() => assertCellReceipt(malformedReceipt), expectCode("E_RECEIPT_SCHEMA"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fixed MVP selector emits five entries and rejects missing or surplus selections", async () => {
  const root = mkdtempSync(join(tmpdir(), "template-record-selector-test-"));
  try {
    const { map } = await syntheticDocuments(root);
    const selected = selectTemplateFieldMap(map);
    assert.equal(selected.occurrence_count, MVP_FIELD_IDS.length);
    assert.deepEqual(
      new Set(selected.entries.map((entry) => entry.canonical_field_id)),
      new Set(MVP_FIELD_IDS),
    );
    assert.notEqual(selected.field_map_sha256, map.field_map_sha256);
    assert.equal(map.occurrence_count, 6, "selector must not mutate the full map");
    const selectedEntry = selected.entries[0];
    const authoritativeEntry = map.entries.find((entry) => entry.occurrence_id === selectedEntry.occurrence_id);
    selectedEntry.metadata.scope = "mutated-selection-only";
    assert.notEqual(authoritativeEntry.metadata.scope, "mutated-selection-only", "selected entries must not alias the full map");

    const missing = rehashFieldMap(
      map,
      map.entries.filter((entry) => entry.canonical_field_id !== "PDS-180-CT02"),
    );
    assert.throws(() => selectTemplateFieldMap(missing), expectCode("E_SELECTION_MISSING"));

    const duplicateSource = map.entries.find((entry) => entry.canonical_field_id === "BATCH-SIZE");
    const duplicate = {
      ...duplicateSource,
      canonical_field_id: "PDS-180-CT02",
      raw_source_token: "<SURPLUS-TOKEN>",
    };
    duplicate.occurrence_id = deriveOccurrenceId(map.template_sha256, duplicate.raw_source_token, duplicate.owner);
    const duplicated = rehashFieldMap(map, [...map.entries, duplicate]);
    assert.throws(() => selectTemplateFieldMap(duplicated), expectCode("E_SELECTION_DUPLICATE"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("two receipt extractions are byte-identical", async () => {
  const root = mkdtempSync(join(tmpdir(), "template-record-determinism-test-"));
  try {
    const { template, filled, contract, map } = await syntheticDocuments(root);
    const options = {
      manifest: contract.manifest,
      grammar: contract.grammar,
      metadata: contract.metadata,
      templateSourcePath: template.path,
      filledDocumentExpectation: contract.manifest.public_mock,
    };
    const first = await extractTemplateCellReceipt(map, filled.path, options);
    const second = await extractTemplateCellReceipt(map, filled.path, options);
    assert.deepEqual(Buffer.from(canonicalJson(first)), Buffer.from(canonicalJson(second)));
    assert.equal(first.receipt_sha256, second.receipt_sha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("required blank values fail closed and official v3 extracts exact paragraph values", async () => {
  const root = mkdtempSync(join(tmpdir(), "template-record-negative-test-"));
  try {
    const emptyBody = table(
      row(cell(paragraph(textRun(""))), cell(paragraph(textRun("Độ đồng đều: ± 5% ")), '<w:vMerge w:val="restart"/>')),
      row(cell(paragraph(textRun("Không có trường"))), cell(paragraph(textRun("")), '<w:vMerge/>')),
    ) + table(row(cell(paragraph(textRun("Định lượng: bisoprolol  90%")))))
      + paragraph(textRun("Thử nghiệm: khảo sát."))
      + paragraph(textRun("Cỡ lô: 1.000."));
    const { template, filled, contract, map } = await syntheticDocuments(root, emptyBody);
    await assert.rejects(
      extractTemplateCellReceipt(map, filled.path, {
        manifest: contract.manifest,
        grammar: contract.grammar,
        metadata: contract.metadata,
        templateSourcePath: template.path,
        filledDocumentExpectation: contract.manifest.public_mock,
      }),
      expectCode("E_REQUIRED_VALUE"),
    );

    const officialMapValue = await compileTemplateFieldMap(officialTemplate);
    const officialReceipt = await extractTemplateCellReceipt(officialMapValue, officialMock, {
      templateSourcePath: officialTemplate,
    });
    assert.equal(officialReceipt.occurrence_count, 146);
    assert.equal(
      officialReceipt.entries.find((entry) => entry.canonical_field_id === "EXPERIMENT-DESCRIPTION")?.raw_value,
      "Khảo sát tỷ lệ tá dược rã",
    );
    assert.equal(
      officialReceipt.entries.find((entry) => entry.canonical_field_id === "BATCH-SIZE")?.raw_value,
      "1.000 viên",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("absent filled document fails closed with the required-document message, not a directory read", async () => {
  const root = mkdtempSync(join(tmpdir(), "template-record-missing-filled-test-"));
  try {
    const { template, contract, map } = await syntheticDocuments(root);
    const { public_mock, ...manifestWithoutFilled } = contract.manifest;
    await assert.rejects(
      extractTemplateCellReceipt(map, undefined, {
        manifest: manifestWithoutFilled,
        grammar: contract.grammar,
        metadata: contract.metadata,
        templateSourcePath: template.path,
      }),
      (error) => error?.code === "E_DOCUMENT_READ" && /a filled public\/mock DOCX is required/.test(error.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
