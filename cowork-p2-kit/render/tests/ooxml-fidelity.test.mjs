import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";

import { buildDocumentBuffer } from "../document-builder.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const fixturePath = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json");
const spikeScript = join(repoRoot, "cowork-p2-kit/render/render-spike.mjs");

function renderAndInspect(t) {
  const outputRoot = join(tmpdir(), `ooxml-fidelity-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const reportRoot = join(tmpdir(), `ooxml-report-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });

  t.after(() => {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(reportRoot, { recursive: true, force: true });
  });

  // Render through the spike script
  execFileSync(process.execPath, [
    spikeScript,
    "--draft", fixturePath,
    "--output-root", outputRoot,
    "--report-root", reportRoot,
  ], { cwd: repoRoot, encoding: "utf8", timeout: 30_000 });

  // Find the output DOCX
  const outputFiles = readdirSync(outputRoot);
  const docxFile = outputFiles.find((f) => f.endsWith(".docx"));
  assert.ok(docxFile, "Output DOCX must exist");

  const docxPath = join(outputRoot, docxFile);

  // Unzip for inspection
  const inspectDir = join(tmpdir(), `ooxml-inspect-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(inspectDir, { recursive: true });

  t.after(() => {
    rmSync(inspectDir, { recursive: true, force: true });
  });

  execFileSync("unzip", ["-o", docxPath, "-d", inspectDir], {
    encoding: "utf8",
    timeout: 10_000,
  });

  return { inspectDir, outputRoot, reportRoot };
}

test("G-P3-03: footnotes have unique positive IDs matching citation count", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const footnotesPath = join(inspectDir, "word", "footnotes.xml");
  assert.ok(existsSync(footnotesPath), "footnotes.xml must exist");

  const footnotesXml = readFileSync(footnotesPath, "utf-8");

  // Extract all footnote IDs
  const idMatches = [...footnotesXml.matchAll(/w:id="(\d+)"/g)];
  const allIds = idMatches.map((m) => parseInt(m[1], 10));

  // Filter to positive IDs (exclude separator continuation IDs which are 0)
  const positiveIds = allIds.filter((id) => id > 0);
  const uniqueIds = new Set(positiveIds);

  // We expect exactly 2 unique positive IDs (one per citation)
  assert.equal(uniqueIds.size, 2, `Expected 2 unique positive footnote IDs, got ${uniqueIds.size}`);
  assert.equal(positiveIds.length, 2, `Expected 2 positive footnote IDs total, got ${positiveIds.length}`);

  // Verify IDs are sequential starting from 1
  const sortedIds = [...uniqueIds].sort((a, b) => a - b);
  assert.deepEqual(sortedIds, [1, 2], "Footnote IDs should be 1 and 2");
});

test("G-P3-03: inline footnote references match footnote IDs", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const docPath = join(inspectDir, "word", "document.xml");
  assert.ok(existsSync(docPath), "document.xml must exist");

  const docXml = readFileSync(docPath, "utf-8");

  // Extract inline footnote references
  const refMatches = [...docXml.matchAll(/w:footnoteReference\s+w:id="(\d+)"/g)];
  const refIds = refMatches.map((m) => parseInt(m[1], 10));

  // We expect exactly 2 inline references with IDs 1 and 2
  assert.equal(refIds.length, 2, `Expected 2 inline footnote references, got ${refIds.length}`);
  assert.deepEqual(refIds.sort((a, b) => a - b), [1, 2], "Inline references should match footnote IDs");
});

test("G-P3-03: exactly one external hyperlink relationship for approved URL", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const footnoteRelsPath = join(inspectDir, "word", "_rels", "footnotes.xml.rels");
  assert.ok(existsSync(footnoteRelsPath), "footnotes.xml.rels must exist");

  const relsXml = readFileSync(footnoteRelsPath, "utf-8");

  // Find all hyperlink relationships
  const hyperlinkRels = [...relsXml.matchAll(/Type="[^"]*relationships\/hyperlink"[^>]*>/g)];

  // We expect exactly 1 hyperlink (citation 0 has URL, citation 1 is local-only)
  assert.equal(hyperlinkRels.length, 1, `Expected 1 hyperlink relationship, got ${hyperlinkRels.length}`);

  // Verify TargetMode="External" is present
  assert.ok(relsXml.includes('TargetMode="External"'), "Hyperlink must have TargetMode=\"External\"");

  // Verify the approved URL is present
  assert.ok(relsXml.includes("https://www.usp.org/search?query=bisoprolol"), "Approved URL must be in hyperlink target");
});

test("G-P3-03: local-only citation has no hyperlink relationship", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const footnoteRelsPath = join(inspectDir, "word", "_rels", "footnotes.xml.rels");
  const relsXml = readFileSync(footnoteRelsPath, "utf-8");

  // The second citation (local-only) should not have a hyperlink
  // We verify by checking there's only one hyperlink and it's for the first citation
  const hyperlinkTargets = [...relsXml.matchAll(/Target="([^"]+)"/g)];
  const targetUrls = hyperlinkTargets.map((m) => m[1]);

  // Should only have the approved URL, not a file:// or local path
  assert.equal(targetUrls.length, 1, "Should have exactly one hyperlink target");
  assert.ok(targetUrls[0].startsWith("https://"), "Hyperlink target must be HTTPS");
});

test("G-P3-03: document XML contains TOC field", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const docPath = join(inspectDir, "word", "document.xml");
  const docXml = readFileSync(docPath, "utf-8");

  // TOC field should be present (TableOfContents generates fldChar elements)
  assert.ok(docXml.includes("TOC"), "Document must contain TOC field");
});

test("G-P3-03: cited segments expose visible inline markers before their retained footnotes", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const documentXml = readFileSync(join(inspectDir, "word", "document.xml"), "utf-8");

  for (const id of [1, 2]) {
    const markerThenReference = new RegExp(
      `<w:r[^>]*><w:t[^>]*>\\[${id}\\]</w:t></w:r><w:footnoteReference w:id="${id}"/>`,
    );
    assert.match(documentXml, markerThenReference, `citation ${id} must show [${id}] immediately before its footnote reference`);
  }
  assert.equal([...documentXml.matchAll(/w:footnoteReference\s+w:id="\d+"/g)].length, 2, "semantic footnote references must remain");
});

test("G-P3-03: document body exposes source provenance and only the approved USP link", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const documentXml = readFileSync(join(inspectDir, "word", "document.xml"), "utf-8");
  const documentRels = readFileSync(join(inspectDir, "word", "_rels", "document.xml.rels"), "utf-8");
  const draft = JSON.parse(readFileSync(fixturePath, "utf8"));

  assert.ok(documentXml.includes("Sources and provenance"), "a visible Sources and provenance heading is required");
  for (const citation of draft.citations) {
    for (const value of [citation.evidenceId, citation.source, citation.location, citation.excerpt]) {
      assert.ok(documentXml.includes(value), `body must expose citation provenance: ${value}`);
    }
  }

  const hyperlinkRels = [...documentRels.matchAll(/<Relationship\s+Id="([^"]+)"[^>]*Type="[^"]*relationships\/hyperlink"[^>]*Target="([^"]+)"[^>]*TargetMode="([^"]+)"[^>]*\/>/g)];
  assert.equal(hyperlinkRels.length, 1, "the body must contain exactly one external hyperlink relationship");
  assert.equal(hyperlinkRels[0][2], "https://www.usp.org/search?query=bisoprolol");
  assert.equal(hyperlinkRels[0][3], "External");
  assert.match(documentXml, new RegExp(`<w:hyperlink[^>]*r:id="${hyperlinkRels[0][1]}"[^>]*>[\\s\\S]*?<w:t[^>]*>USP reference</w:t>`));
  assert.ok(!documentRels.includes("formulation-trial-02.docx"), "local-only provenance must not create a body link");
  assert.ok(!documentRels.includes("file:"), "local-only provenance must never create a file URL");
});

test("G-P3-03: static TOC labels are visible without refreshing the native field", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const documentXml = readFileSync(join(inspectDir, "word", "document.xml"), "utf-8");

  assert.ok(documentXml.includes("TOC"), "the native TOC field remains available");
  assert.equal((documentXml.match(/<w:t[^>]*>Mục lục<\/w:t>/g) ?? []).length, 1, "Mục lục must not be repeated as a static entry");
  for (const label of ["P.2.2 Formulation Development", "Decision Matrix"]) {
    const first = documentXml.indexOf(label);
    assert.ok(first >= 0, `${label} must appear in the static TOC`);
    assert.ok(documentXml.indexOf(label, first + label.length) > first, `${label} must also remain in the draft body`);
  }
});

test("G-P3-03: Decision Matrix uses a fixed, full-width four-column grid", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const docPath = join(inspectDir, "word", "document.xml");
  const docXml = readFileSync(docPath, "utf-8");

  const table = docXml.match(/<w:tbl>.*?<\/w:tbl>/)?.[0];
  assert.ok(table, "Decision Matrix table markup must exist");
  assert.match(table, /<w:tblW[^>]*w:type="dxa"[^>]*w:w="9000"/, "table must be 9000 twips wide");
  assert.match(table, /<w:tblLayout[^>]*w:type="fixed"/, "table layout must be fixed");

  const gridWidths = [...table.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((match) => Number(match[1]));
  assert.deepEqual(gridWidths, [2250, 2250, 2250, 2250], "table grid must have four equal columns");

  const cellWidths = [...table.matchAll(/<w:tcW[^>]*w:type="dxa"[^>]*w:w="(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(cellWidths, Array(12).fill(2250), "every header and body cell must match the fixed grid");
});

test("G-P3-03: fixed table widths partition the full grid for any validated column count", async () => {
  const draft = JSON.parse(readFileSync(fixturePath, "utf8"));
  const headers = Array.from({ length: 7 }, (_, index) => `Column ${index + 1}`);
  draft.blocks = [{
    type: "table",
    headers,
    rows: [headers.map((_, index) => `Value ${index + 1}`)],
  }];

  const zip = await JSZip.loadAsync(await buildDocumentBuffer(draft));
  const documentXml = await zip.file("word/document.xml").async("string");
  const table = documentXml.match(/<w:tbl>.*?<\/w:tbl>/)?.[0];
  assert.ok(table, "table markup must exist");

  const gridWidths = [...table.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((match) => Number(match[1]));
  const cellWidths = [...table.matchAll(/<w:tcW[^>]*w:type="dxa"[^>]*w:w="(\d+)"/g)].map((match) => Number(match[1]));
  assert.equal(gridWidths.length, headers.length, "grid must have one width per header");
  assert.ok(gridWidths.every((width) => width > 0), "every grid width must be positive");
  assert.equal(gridWidths.reduce((sum, width) => sum + width, 0), 9000, "grid widths must total 9000 twips");
  assert.deepEqual(cellWidths, [...gridWidths, ...gridWidths], "header and body cells must use the grid widths");
});
