import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  assertFieldMap,
  assertMetadataCatalog,
  canonicalJson,
  sha256,
} from "../template-field-contract.mjs";
import { compileTemplateFieldMap } from "../template-field-map.mjs";
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
const templateSha256 = "c492532054d9ba04d2dbd5c3d03706c423534cce5329d2657b2588760e0087e0";

function expectCode(code) {
  return (error) => error?.code === code;
}

async function compileSynthetic(body, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "template-field-map-test-"));
  const document = documentXml(body);
  const bytes = await createDocx(document);
  const fixture = await writeFixture(root, "synthetic.docx", document);
  const contract = syntheticContract({
    bytes,
    document,
    tokens: options.tokens ?? ["PDS-180-CT02", "UOM-SPEC"],
    paragraphTokens: options.paragraphTokens ?? [],
  });
  try {
    return await compileTemplateFieldMap(fixture.path, {
      ...contract,
      outputPath: options.outputPath,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("official template compiles every declared anchor exactly once", async () => {
  const map = await compileTemplateFieldMap(officialTemplate);
  assertFieldMap(map);
  assert.equal(map.template_sha256, templateSha256);
  assert.equal(map.occurrence_count, 146);
  assert.equal(map.entries.length, 146);
  assert.equal(map.entries.filter((entry) => entry.owner.kind === "cell").length, 143);
  assert.equal(map.entries.filter((entry) => entry.owner.kind === "paragraph").length, 3);
  assert.equal(map.entries.filter((entry) => entry.owner.kind === "cell" && entry.owner.vertical_merge.state === "restart").length > 0, true);
  assert.equal(map.entries.find((entry) => entry.raw_source_token === "<PDS-180-CT02>")?.owner.kind, "cell");
  assert.equal(map.entries.find((entry) => entry.raw_source_token === "<EXPERIMENT-DESCRIPTION>")?.owner.kind, "paragraph");
  assert.equal(map.entries.find((entry) => entry.raw_source_token === "<CONCLUSION>")?.metadata.required, false);
});

test("split runs reconstruct one token and merged-cell continuation is rejected", async () => {
  const body = table(
    row(cell(paragraph(textRun("<PDS-180-"), textRun("CT02>")))),
    row(cell(paragraph(textRun("<UOM-SPEC>")), '<w:vMerge w:val="restart"/>')),
    row(cell(paragraph(textRun("<UOM-SPEC>")), "<w:vMerge/>")),
  );
  await assert.rejects(
    compileSynthetic(body, { tokens: ["PDS-180-CT02", "UOM-SPEC"] }),
    expectCode("E_MERGED_CONTINUATION"),
  );

  const validBody = table(row(cell(paragraph(textRun("<PDS-180-"), textRun("CT02>")))));
  const map = await compileSynthetic(validBody, { tokens: ["PDS-180-CT02"] });
  assert.equal(map.entries[0].raw_source_token, "<PDS-180-CT02>");
  assert.equal(map.entries[0].owner.kind, "cell");
});

test("approved paragraph owners are tagged and reference-only conclusion stays non-required", async () => {
  const body = paragraph(
    textRun("Thử nghiệm: <EXPERIMENT-DESCRIPTION> "),
    textRun("<BATCH-SIZE>.")
  ) + paragraph(textRun("Nhận xét: <CONCLUSION>"));
  const map = await compileSynthetic(body, {
    tokens: [],
    paragraphTokens: ["EXPERIMENT-DESCRIPTION", "BATCH-SIZE", "CONCLUSION"],
  });
  assert.deepEqual(map.entries.map((entry) => entry.owner.kind), ["paragraph", "paragraph", "paragraph"]);
  assert.equal(map.entries.find((entry) => entry.canonical_field_id === "CONCLUSION").metadata.required, false);
});

test("unknown, duplicate, malformed, and unapproved paragraph anchors fail closed", async () => {
  const unknown = table(row(cell(paragraph(textRun("<UNKNOWN>")))));
  await assert.rejects(compileSynthetic(unknown, { tokens: ["PDS-180-CT02"] }), expectCode("E_UNKNOWN_TOKEN"));

  const duplicate = table(row(
    cell(paragraph(textRun("<PDS-180-CT02>"))),
    cell(paragraph(textRun("<PDS-180-CT02>"))),
  ));
  await assert.rejects(compileSynthetic(duplicate, { tokens: ["PDS-180-CT02"] }), expectCode("E_DUPLICATE_TOKEN"));

  const malformed = table(row(cell(paragraph(textRun("<PDS-180-CT02")))));
  await assert.rejects(compileSynthetic(malformed, { tokens: ["PDS-180-CT02"] }), expectCode("E_MALFORMED_TOKEN"));

  const nested = table(row(cell(paragraph(textRun("<<PDS-180-CT02>>")))));
  await assert.rejects(compileSynthetic(nested, { tokens: ["PDS-180-CT02"] }), expectCode("E_MALFORMED_TOKEN"));

  const unapprovedParagraph = paragraph(textRun("<PDS-180-CT02>"));
  await assert.rejects(compileSynthetic(unapprovedParagraph, { tokens: ["PDS-180-CT02"] }), expectCode("E_UNAPPROVED_OWNER"));
});

test("metadata coverage, alias shape, and template drift are contract errors", async () => {
  const body = table(row(cell(paragraph(textRun("<PDS-180-CT02>")))));
  const root = mkdtempSync(join(tmpdir(), "template-field-map-contract-test-"));
  const document = documentXml(body);
  const bytes = await createDocx(document);
  const fixture = await writeFixture(root, "synthetic.docx", document);
  const contract = syntheticContract({ bytes, document, tokens: ["PDS-180-CT02"] });
  try {
    const missing = structuredClone(contract);
    missing.metadata.entries = [];
    await assert.rejects(compileTemplateFieldMap(fixture.path, missing), expectCode("E_METADATA_MISSING"));

    const surplus = structuredClone(contract);
    surplus.metadata.entries.push({
      source_token: "SURPLUS",
      canonical_field_id: "SURPLUS",
      type: "raw_text",
      unit: null,
      scope: "shared-context",
      required: true,
    });
    await assert.rejects(compileTemplateFieldMap(fixture.path, surplus), expectCode("E_METADATA_SURPLUS"));

    const drift = structuredClone(contract);
    drift.manifest.template.sha256 = "0".repeat(64);
    drift.grammar.template_sha256 = "0".repeat(64);
    drift.metadata.template_sha256 = "0".repeat(64);
    await assert.rejects(compileTemplateFieldMap(fixture.path, drift), expectCode("E_TEMPLATE_DRIFT"));

    assert.throws(() => assertMetadataCatalog(surplus.metadata, contract.grammar, contract.manifest), expectCode("E_METADATA_SURPLUS"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("map serialization and occurrence IDs are deterministic and schema-valid", async () => {
  const body = table(row(cell(paragraph(textRun("<PDS-180-CT02>")))));
  const first = await compileSynthetic(body, { tokens: ["PDS-180-CT02"] });
  const second = await compileSynthetic(body, { tokens: ["PDS-180-CT02"] });
  const firstBytes = Buffer.from(canonicalJson(first));
  const secondBytes = Buffer.from(canonicalJson(second));
  assert.deepEqual(firstBytes, secondBytes);
  assert.equal(createHash("sha256").update(firstBytes).digest("hex"), createHash("sha256").update(secondBytes).digest("hex"));
  assert.equal(first.entries[0].occurrence_id, second.entries[0].occurrence_id);
  assertFieldMap(JSON.parse(firstBytes.toString("utf8")));
});

test("map consumers require the authoritative metadata catalog", async () => {
  const body = table(row(cell(paragraph(textRun("<PDS-180-CT02>")))));
  const root = mkdtempSync(join(tmpdir(), "template-field-map-authority-test-"));
  const document = documentXml(body);
  const bytes = await createDocx(document);
  const fixture = await writeFixture(root, "synthetic.docx", document);
  const contract = syntheticContract({ bytes, document, tokens: ["PDS-180-CT02"] });
  try {
    const map = await compileTemplateFieldMap(fixture.path, contract);
    const forged = structuredClone(map);
    forged.entries[0].metadata.scope = "forged-scope";
    forged.field_map_sha256 = sha256(canonicalJson({ ...forged, field_map_sha256: null }));
    assertFieldMap(forged);
    assert.throws(() => assertFieldMap(forged, contract.metadata), expectCode("E_MAP_METADATA_AUTHORITY"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("compiler writes the isolated field-map artifact with a trailing newline", async () => {
  const body = table(row(cell(paragraph(textRun("<PDS-180-CT02>")))));
  const root = mkdtempSync(join(tmpdir(), "template-field-map-output-test-"));
  const outputPath = join(root, "template-field-map.v1.json");
  try {
    await compileSynthetic(body, { tokens: ["PDS-180-CT02"], outputPath });
    const bytes = readFileSync(outputPath);
    assert.equal(bytes.at(-1), 10);
    assertFieldMap(JSON.parse(bytes.toString("utf8")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
