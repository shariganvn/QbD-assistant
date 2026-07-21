import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(testDir, "fixtures/contract");
const fixtureBytes = readFileSync(resolve(fixtureDir, "records.jsonl"));
const records = fixtureBytes.toString("utf8").trim().split("\n").map(JSON.parse);
const pagePrefixes = JSON.parse(readFileSync(resolve(fixtureDir, "page-prefixes.json"), "utf8"));
const schema = JSON.parse(
  readFileSync(resolve(testDir, "../../store/records.schema.json"), "utf8"),
);

const expectedRequired = [
  "id",
  "source_type",
  "content",
  "provenance",
  "confidence",
  "extraction_status",
  "classification",
];
const expectedProvenance = ["file", "page", "char_start", "char_end", "quote", "page_kind"];

function recordSortKey(record) {
  return [
    record.provenance.file,
    String(record.provenance.page).padStart(8, "0"),
    String(record.provenance.char_start).padStart(12, "0"),
  ].join("\0");
}

test("reviewed JSONL fixture and required fields remain frozen", () => {
  assert.equal(
    createHash("sha256").update(fixtureBytes).digest("hex"),
    "ea04ad7f7adbaed2d0092ecb4163926f904b810a2bb2ca2bd986c3c2b8889579",
  );
  assert.deepEqual(schema.required, expectedRequired);
  assert.deepEqual(schema.properties.provenance.required, expectedProvenance);
  assert.deepEqual(schema.properties.classification.required, ["label", "citable"]);

  for (const record of records) {
    for (const field of expectedRequired) assert.notEqual(record[field], undefined);
    for (const field of expectedProvenance) assert.notEqual(record.provenance[field], undefined);
    assert.equal(record.ingested_at, undefined);
    assert.ok(schema.properties.source_type.enum.includes(record.source_type));
    assert.ok(schema.properties.confidence.enum.includes(record.confidence));
    assert.ok(schema.properties.extraction_status.enum.includes(record.extraction_status));
    assert.ok(schema.properties.provenance.properties.page_kind.enum.includes(record.provenance.page_kind));
    assert.ok(schema.properties.classification.properties.label.enum.includes(record.classification.label));
    assert.equal(typeof record.classification.citable, "boolean");
  }
});
test("IDs, relative paths, offsets, and record order remain deterministic", () => {
  const sortedKeys = records.map(recordSortKey).toSorted((left, right) => left.localeCompare(right));
  assert.deepEqual(records.map(recordSortKey), sortedKeys);

  for (const record of records) {
    const provenance = record.provenance;
    const idInput = `${provenance.file}:${provenance.page}:${provenance.char_start}:${provenance.quote}`;
    const expectedId = createHash("sha256").update(idInput).digest("hex").slice(0, 16);

    assert.equal(record.id, expectedId);
    assert.equal(isAbsolute(provenance.file), false);
    assert.equal(provenance.file, posix.normalize(provenance.file));
    assert.equal(provenance.file.includes("\\"), false);
    assert.equal(
      pagePrefixes[record.id].slice(provenance.char_start, provenance.char_end),
      provenance.quote,
    );
  }
});
