import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import JSZip from "jszip";

import { normalizeOoxml } from "../normalize-ooxml.mjs";
import { buildDocumentBuffer } from "../document-builder.mjs";
import { determinizeDocx } from "../determinize-ooxml.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const renderSpike = join(repoRoot, "cowork-p2-kit/render/render-spike.mjs");
const fixtureDraft = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json");
const mediaFixture = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/normalization/with-media.docx");
const expectedManifestPath = join(repoRoot, "cowork-p2-kit/render/tests/fixtures/normalization/with-media.expected.json");

// Import viewer-checklist test so G-P3-05 validates both automated and manual evidence
import "./viewer-checklist.test.mjs";

describe("G-P3-05 deterministic output", () => {
  it("normalizer enumerates every ZIP entry with explicit unzip argument arrays", () => {
    const result = normalizeOoxml(mediaFixture);

    // Must have manifest, manifest_sha256, and commands
    assert.ok(result.manifest, "manifest must exist");
    assert.ok(result.manifest_sha256, "manifest_sha256 must exist");
    assert.ok(Array.isArray(result.commands), "commands must be an array");

    // First command is the list command
    const listCmd = result.commands[0];
    assert.deepEqual(listCmd[0], "-Z1");
    assert.ok(listCmd[1].endsWith("with-media.docx"), "list command targets the DOCX");

    // Remaining commands are per-entry reads
    for (let i = 1; i < result.commands.length; i++) {
      assert.deepEqual(result.commands[i][0], "-p");
      assert.ok(result.commands[i][1].endsWith("with-media.docx"));
      assert.ok(typeof result.commands[i][2] === "string" && result.commands[i][2].length > 0);
    }
  });

  it("media-bearing fixture contains XML, relationship, and media entries", () => {
    const result = normalizeOoxml(mediaFixture);
    const entries = Object.keys(result.manifest);

    const hasXml = entries.some((e) => e.endsWith(".xml"));
    const hasRels = entries.some((e) => e.endsWith(".rels"));
    const hasMedia = entries.some((e) => e.startsWith("word/media/") && !e.endsWith("/"));

    assert.ok(hasXml, "must contain at least one XML entry");
    assert.ok(hasRels, "must contain at least one relationship entry");
    assert.ok(hasMedia, "must contain at least one word/media/ entry");
  });

  it("expected manifest matches actual normalization", () => {
    const expected = JSON.parse(readFileSync(expectedManifestPath, "utf8"));
    const actual = normalizeOoxml(mediaFixture);

    assert.deepEqual(actual.manifest, expected.manifest, "manifest must match expected");
    assert.equal(actual.manifest_sha256, expected.manifest_sha256, "manifest_sha256 must match expected");
  });

  it("two renders of the same input produce identical normalized manifests", () => {
    const outRoot1 = mkdtempSync(join(tmpdir(), "render-det-1-"));
    const outRoot2 = mkdtempSync(join(tmpdir(), "render-det-2-"));
    const reportRoot1 = mkdtempSync(join(tmpdir(), "report-det-1-"));
    const reportRoot2 = mkdtempSync(join(tmpdir(), "report-det-2-"));

    try {
      // Render twice with different output roots
      const result1 = spawnSync(process.execPath, [renderSpike, "--draft", fixtureDraft, "--output-root", outRoot1, "--report-root", reportRoot1], {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 60000,
      });
      assert.equal(result1.status, 0, `first render failed: ${result1.stderr}`);

      const result2 = spawnSync(process.execPath, [renderSpike, "--draft", fixtureDraft, "--output-root", outRoot2, "--report-root", reportRoot2], {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 60000,
      });
      assert.equal(result2.status, 0, `second render failed: ${result2.stderr}`);

      // Find the rendered DOCX in each output root
      const docx1 = join(outRoot1, "p2-draft.docx");
      const docx2 = join(outRoot2, "p2-draft.docx");

      // Normalize both
      const norm1 = normalizeOoxml(docx1);
      const norm2 = normalizeOoxml(docx2);

      // Compare complete manifests
      assert.deepEqual(norm1.manifest, norm2.manifest, "normalized manifests must be identical");

      // Compute raw hashes for diagnostic purposes
      const raw1 = createHash("sha256").update(readFileSync(docx1)).digest("hex");
      const raw2 = createHash("sha256").update(readFileSync(docx2)).digest("hex");

      if (process.env.GATE_SNAPSHOT_FILE) {
        writeFileSync(process.env.GATE_SNAPSHOT_FILE, `${JSON.stringify({
          fixture_sha256: createHash("sha256").update(readFileSync(fixtureDraft)).digest("hex"),
          render_1_raw_sha256: raw1,
          render_2_raw_sha256: raw2,
          render_1_manifest_sha256: norm1.manifest_sha256,
          render_2_manifest_sha256: norm2.manifest_sha256,
          render_1_commands: norm1.commands,
          render_2_commands: norm2.commands,
        }, null, 2)}\n`);
      }

      // Emit TAP diagnostics
      console.log("# deterministic render diagnostics");
      console.log(`# render 1 exit: ${result1.status}`);
      console.log(`# render 2 exit: ${result2.status}`);
      console.log(`# raw output 1 hash: ${raw1}`);
      console.log(`# raw output 2 hash: ${raw2}`);
      console.log(`# manifest 1 hash: ${norm1.manifest_sha256}`);
      console.log(`# manifest 2 hash: ${norm2.manifest_sha256}`);
      console.log(`# normalizer commands (render 1):`);
      for (const cmd of norm1.commands) {
        console.log(`#   ${JSON.stringify(cmd)}`);
      }
      console.log(`# normalizer commands (render 2):`);
      for (const cmd of norm2.commands) {
        console.log(`#   ${JSON.stringify(cmd)}`);
      }
    } finally {
      rmSync(outRoot1, { recursive: true, force: true });
      rmSync(outRoot2, { recursive: true, force: true });
      rmSync(reportRoot1, { recursive: true, force: true });
      rmSync(reportRoot2, { recursive: true, force: true });
    }
  });

  it("two citations with the same approved URL deduplicate each relationship part while preserving references", async () => {
    const draft = JSON.parse(readFileSync(fixtureDraft, "utf8"));
    draft.citations[1].evidenceLink = draft.citations[0].evidenceLink;
    const zip = await JSZip.loadAsync(await buildDocumentBuffer(draft));
    const rels = await zip.file("word/_rels/footnotes.xml.rels").async("string");
    const footnotes = await zip.file("word/footnotes.xml").async("string");
    const relationshipIds = [...rels.matchAll(/<Relationship\s+Id="([^"]+)"/g)].map((match) => match[1]);
    const references = [...footnotes.matchAll(/r:id="([^"]+)"/g)].map((match) => match[1]);

    assert.equal(relationshipIds.length, 1, "equal footnote URLs must deduplicate within footnotes.xml.rels");
    assert.equal(references.length, 2, "both footnotes must retain their hyperlink references");
    for (const reference of references) {
      assert.ok(relationshipIds.includes(reference), `footnote reference ${reference} must resolve in footnotes.xml.rels`);
    }
  });

  it("body USP links resolve to one stable relationship per relationship part", async () => {
    const draft = JSON.parse(readFileSync(fixtureDraft, "utf8"));
    const first = await JSZip.loadAsync(await buildDocumentBuffer(draft));
    const second = await JSZip.loadAsync(await buildDocumentBuffer(draft));
    const [documentXml, documentRels, secondDocumentRels] = await Promise.all([
      first.file("word/document.xml").async("string"),
      first.file("word/_rels/document.xml.rels").async("string"),
      second.file("word/_rels/document.xml.rels").async("string"),
    ]);
    const bodyLinks = [...documentRels.matchAll(/<Relationship\s+Id="([^"]+)"[^>]*Type="[^"]*relationships\/hyperlink"[^>]*Target="https:\/\/www\.usp\.org\/search\?query=bisoprolol"[^>]*TargetMode="External"[^>]*\/>/g)];

    assert.equal(bodyLinks.length, 1, "one approved body link must own exactly one document relationship");
    assert.match(documentXml, new RegExp(`<w:hyperlink[^>]*r:id="${bodyLinks[0][1]}"[^>]*>`), "body hyperlink reference must resolve");
    assert.match(secondDocumentRels, new RegExp(`Id="${bodyLinks[0][1]}"`), "the body relationship ID must be deterministic across renders");

    draft.citations[1].evidenceLink = draft.citations[0].evidenceLink;
    const sameUrlZip = await JSZip.loadAsync(await buildDocumentBuffer(draft));
    const [sameUrlDocument, sameUrlRels] = await Promise.all([
      sameUrlZip.file("word/document.xml").async("string"),
      sameUrlZip.file("word/_rels/document.xml.rels").async("string"),
    ]);
    const sameUrlIds = [...sameUrlRels.matchAll(/<Relationship\s+Id="([^"]+)"[^>]*Type="[^"]*relationships\/hyperlink"/g)].map((match) => match[1]);
    const sameUrlReferences = [...sameUrlDocument.matchAll(/<w:hyperlink\b[^>]*r:id="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(sameUrlIds.length, 1, "equal body URLs must deduplicate within document.xml.rels");
    assert.equal(sameUrlReferences.length, 2, "both source entries must retain body hyperlink references");
    assert.ok(sameUrlReferences.every((id) => id === sameUrlIds[0]), "every body hyperlink reference must resolve to the single relationship");
  });

  it("does not cross-rewrite equal old IDs between relationship parts", async () => {
    const source = new JSZip();
    source.file("word/_rels/document.xml.rels", '<Relationships><Relationship Id="rId1" Type="document" Target="document-target"/></Relationships>');
    source.file("word/document.xml", '<root r:id="rId1"/>');
    source.file("word/_rels/footnotes.xml.rels", '<Relationships><Relationship Id="rId1" Type="footnote" Target="footnote-target"/></Relationships>');
    source.file("word/footnotes.xml", '<root r:id="rId1"/>');
    source.file("docProps/core.xml", '<coreProperties><dcterms:created>now</dcterms:created><dcterms:modified>now</dcterms:modified></coreProperties>');

    const output = await JSZip.loadAsync(await determinizeDocx(await source.generateAsync({ type: "nodebuffer" })));
    const documentRels = await output.file("word/_rels/document.xml.rels").async("string");
    const footnoteRels = await output.file("word/_rels/footnotes.xml.rels").async("string");
    const documentId = documentRels.match(/Id="([^"]+)"/)[1];
    const footnoteId = footnoteRels.match(/Id="([^"]+)"/)[1];

    assert.notEqual(documentId, footnoteId, "relationship-part path must scope deterministic IDs");
    assert.match(await output.file("word/document.xml").async("string"), new RegExp(`r:id="${documentId}"`));
    assert.match(await output.file("word/footnotes.xml").async("string"), new RegExp(`r:id="${footnoteId}"`));
  });

  it("normalizer commands use the actual escaped readPath for bracket entries", () => {
    const result = normalizeOoxml(mediaFixture);
    // The [Content_Types].xml entry requires bracket escaping for unzip
    const contentTypesCmd = result.commands.find((cmd) => cmd[2] === "\\[Content_Types\\].xml");
    assert.ok(contentTypesCmd, "commands must include escaped [Content_Types].xml entry");
    // The command argv must use the escaped form for unzip
    const listResult = spawnSync("/usr/bin/unzip", ["-Z1", mediaFixture], { encoding: "utf8" });
    const entries = listResult.stdout.split("\n").filter((l) => l.trim().length > 0);
    // Commands count = 1 list + N reads
    assert.equal(result.commands.length, 1 + entries.length, "commands must include list + one read per entry");
  });

  it("manifest keys are always in lexical order regardless of archive listing order", () => {
    const result = normalizeOoxml(mediaFixture);
    const keys = Object.keys(result.manifest);
    const sorted = [...keys].sort();
    assert.deepEqual(keys, sorted, "Object.keys(manifest) must already be lexical order");
  });

  it("rejects terminal traversal paths and hashes glob metacharacter entries literally", async () => {
    const root = mkdtempSync(join(tmpdir(), "normalizer-paths-"));
    try {
      const traversalPath = join(root, "traversal.docx");
      const traversalArchive = new JSZip();
      traversalArchive.file("a/..", "unsafe");
      writeFileSync(traversalPath, await traversalArchive.generateAsync({ type: "nodebuffer" }));
      assert.throws(() => normalizeOoxml(traversalPath), /traversal entry path/);

      const globPath = join(root, "glob.docx");
      const globArchive = new JSZip();
      globArchive.file("word/a*.txt", "literal-star");
      globArchive.file("word/axy.txt", "wildcard-neighbor");
      writeFileSync(globPath, await globArchive.generateAsync({ type: "nodebuffer" }));
      const normalized = normalizeOoxml(globPath);
      const literalHash = createHash("sha256").update("literal-star").digest("hex");
      assert.equal(normalized.manifest["word/a*.txt"], literalHash, "wildcard entry must be read literally");
      assert.ok(normalized.commands.some((command) => command[2] === "word/a\\*.txt"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects duplicate original relationship IDs before rewriting", async () => {
    const source = new JSZip();
    source.file("word/_rels/document.xml.rels", '<Relationships><Relationship Id="rId1" Type="document" Target="one"/><Relationship Id="rId1" Type="document" Target="two"/></Relationships>');
    const buffer = await source.generateAsync({ type: "nodebuffer" });
    await assert.rejects(
      () => determinizeDocx(buffer),
      /duplicate relationship ID/,
    );
  });
});
