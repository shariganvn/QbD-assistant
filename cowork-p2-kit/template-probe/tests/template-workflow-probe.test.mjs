import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileTemplateFieldMap } from "../template-field-map.mjs";
import {
  extractTemplateCellReceipt,
  MVP_FIELD_IDS,
  selectTemplateFieldMap,
} from "../template-record-extractor.mjs";
import { assertCellReceipt } from "../template-cell-receipt.mjs";
import {
  canonicalJson,
  sha256,
  writeCanonicalJsonAtomic,
} from "../template-field-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const kitRoot = resolve(repoRoot, "cowork-p2-kit");
const templatePath = resolve(kitRoot, "inputs/reference/official-placeholder-template-v3-040826.docx");
const mockPath = resolve(kitRoot, "inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx");
const canonicalInputs = resolve(kitRoot, "inputs");
const canonicalStore = resolve(kitRoot, "store");

const expectedValues = {
  "PDS-180-CT02": "29,08",
  "UOM-SPEC": "± 5% ",
  "API-NAME": "bisoprolol fumarate 90",
  "ASSAY-SPEC": "110%",
  "BATCH-SIZE": "1.000 viên",
};

function snapshotTree(root) {
  const entries = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) entries.push({
        path: path.slice(root.length + 1),
        sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
      });
    }
  }
  walk(root);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function snapshotFile(path) {
  return {
    path: path.slice(repoRoot.length + 1),
    sha256: sha256(readFileSync(path)),
  };
}

function snapshotCanonicalState() {
  return {
    template: snapshotFile(templatePath),
    mock: snapshotFile(mockPath),
    inputs: snapshotTree(canonicalInputs),
    store: snapshotTree(canonicalStore),
  };
}

function assertOutsideCanonicalRoots(root) {
  for (const canonicalRoot of [canonicalInputs, canonicalStore]) {
    assert.equal(root !== canonicalRoot && !root.startsWith(`${canonicalRoot}/`), true, `${root} must be outside ${canonicalRoot}`);
  }
}

function assertReceiptSlice(receipt, selectedMap) {
  assertCellReceipt(receipt, selectedMap);
  assert.equal(receipt.occurrence_count, MVP_FIELD_IDS.length);
  assert.deepEqual(receipt.entries.map((entry) => entry.canonical_field_id).sort(), [...MVP_FIELD_IDS].sort());
  assert.ok(receipt.entries.every((entry) => entry.record_id === null));
  assert.deepEqual(receipt.record_projection, {
    status: "not_available",
    reason_code: "E_PAGE_PROVENANCE_UNAVAILABLE",
    record_count: 0,
  });
  for (const entry of receipt.entries) {
    assert.equal(entry.raw_value, expectedValues[entry.canonical_field_id]);
    assert.equal(entry.cell_round_trip.status, "pass");
    assert.equal(entry.cell_round_trip.raw_value_sha256, entry.raw_value_sha256);
  }
}

async function runIsolatedProbe(root) {
  assertOutsideCanonicalRoots(root);
  const fullMap = await compileTemplateFieldMap(templatePath);
  const selectedMap = selectTemplateFieldMap(fullMap);
  const selectedMapPath = join(root, "field-map", "template-field-map.selected.v1.json");
  writeCanonicalJsonAtomic(selectedMap, selectedMapPath, "E_SELECTED_MAP_WRITE");
  const receiptPath = join(root, "receipt", "template-cell-receipt.v1.json");
  const receipt = await extractTemplateCellReceipt(selectedMap, mockPath, {
    ownerFieldMap: fullMap,
    templateSourcePath: templatePath,
    outputPath: receiptPath,
  });
  assertReceiptSlice(receipt, selectedMap);
  const selectedMapBytes = readFileSync(selectedMapPath);
  const receiptBytes = readFileSync(receiptPath);
  return {
    selectedMap,
    receipt,
    selectedMapBytes,
    receiptBytes,
    selectedMapBytesSha256: sha256(selectedMapBytes),
    receiptBytesSha256: sha256(receiptBytes),
    selectedMapCanonicalBytes: Buffer.from(canonicalJson(selectedMap)),
    receiptCanonicalBytes: Buffer.from(canonicalJson(receipt)),
    files: snapshotTree(root).map((entry) => entry.path),
  };
}

test("two isolated receipt-only runs are deterministic and preserve canonical state", async () => {
  const before = snapshotCanonicalState();
  const firstRoot = mkdtempSync(join(tmpdir(), "template-workflow-probe-run-1-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "template-workflow-probe-run-2-"));
  assert.notEqual(firstRoot, secondRoot);
  try {
    const first = await runIsolatedProbe(firstRoot);
    const second = await runIsolatedProbe(secondRoot);
    assert.deepEqual(first.selectedMapCanonicalBytes, second.selectedMapCanonicalBytes);
    assert.deepEqual(first.receiptCanonicalBytes, second.receiptCanonicalBytes);
    assert.equal(first.selectedMap.field_map_sha256, second.selectedMap.field_map_sha256);
    assert.equal(first.receipt.receipt_sha256, second.receipt.receipt_sha256);
    assert.equal(first.selectedMapBytesSha256, second.selectedMapBytesSha256);
    assert.equal(first.receiptBytesSha256, second.receiptBytesSha256);
    assert.equal(existsSync(join(firstRoot, "receipt", "template-cell-receipt.v1.json")), true);
    assert.equal(existsSync(join(secondRoot, "receipt", "template-cell-receipt.v1.json")), true);
    for (const files of [first.files, second.files]) {
      assert.deepEqual(files, [
        "field-map/template-field-map.selected.v1.json",
        "receipt/template-cell-receipt.v1.json",
      ]);
    }
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
  assert.deepEqual(snapshotCanonicalState(), before);
});
