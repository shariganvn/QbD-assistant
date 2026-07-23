import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

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

test("G-P3-03: document XML contains table markup", (t) => {
  const { inspectDir } = renderAndInspect(t);
  const docPath = join(inspectDir, "word", "document.xml");
  const docXml = readFileSync(docPath, "utf-8");

  // Table markup should be present
  assert.ok(docXml.includes("<w:tbl"), "Document must contain table markup (w:tbl)");
});
