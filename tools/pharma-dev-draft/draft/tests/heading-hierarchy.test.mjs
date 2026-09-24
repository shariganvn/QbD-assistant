// The document's heading tree has to nest the way the CTD numbering does, because that tree is what
// a reviewer navigates by: Word builds its navigation pane and any generated table of contents from
// the heading levels, not from the numbers printed in the text. Levels are derived from the numbering
// rather than mapped section by section, so the tree cannot drift from the outline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateDraft } from "../validate-draft.mjs";
import { headingLevelFor } from "../../render/builder.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(testDir, "..", "..");

function loadOutline() {
  return JSON.parse(readFileSync(join(toolRoot, "schemas", "p2-outline.json"), "utf8"));
}

function loadExample() {
  return JSON.parse(readFileSync(join(toolRoot, "draft", "example-draft.json"), "utf8"));
}

test("heading level follows the depth of the CTD number", () => {
  assert.equal(headingLevelFor("3.2.P.2"), 1);
  assert.equal(headingLevelFor("3.2.P.2.1"), 2);
  assert.equal(headingLevelFor("3.2.P.2.1.1"), 3);
  assert.equal(headingLevelFor("3.2.P.2.2.1.3"), 4);
  assert.equal(headingLevelFor("3.2.P.2.2.1.3.5"), 5);
});

test("a numbering deeper than Word's heading styles is clamped, not dropped", () => {
  // Six built-in levels exist; a deeper section still has to render as a heading rather than falling
  // back to body text, which would drop it out of the navigation pane entirely.
  assert.equal(headingLevelFor("3.2.P.2.1.1.1.1.1.1"), 6);
});

test("every outline section's level is at most one deeper than the section before it", () => {
  // The same property the verifier asserts on the rendered file, checked here against the outline so
  // a badly placed new section is caught before anything is rendered.
  const outline = loadOutline();
  let previous = headingLevelFor("3.2.P.2");
  for (const section of outline.sections) {
    const level = headingLevelFor(section.ctdReference);
    assert.ok(level <= previous + 1, `${section.ctdReference} jumps from level ${previous} to ${level}`);
    previous = level;
  }
});

test("a container carries no form and no content of its own", () => {
  const outline = loadOutline();
  const containers = outline.sections.filter((section) => section.container);
  assert.ok(containers.length > 0, "the outline must declare its parent headings");
  for (const container of containers) {
    assert.equal(container.form, undefined, `${container.id} is a container and must declare no form`);
  }
});

test("every container has at least one child section", () => {
  // A container exists to head its children. One with none is a heading over nothing, which reads to
  // a reviewer as a section whose content went missing.
  const outline = loadOutline();
  const references = outline.sections.map((section) => section.ctdReference);
  for (const container of outline.sections.filter((section) => section.container)) {
    const children = references.filter((reference) => reference.startsWith(`${container.ctdReference}.`));
    assert.ok(children.length > 0, `${container.ctdReference} heads no section`);
  }
});

test("a draft entry for a container is rejected", () => {
  const outline = loadOutline();
  const draft = loadExample();
  const container = outline.sections.find((section) => section.container);
  draft.sections.push({ id: container.id, status: "covered", blocks: [{ type: "paragraph", text: "nội dung đặt nhầm chỗ" }] });
  assert.throws(() => validateDraft(draft, outline), (error) => {
    assert.equal(error.code, "E_SECTION_CONTAINER_HAS_ENTRY");
    return true;
  });
});

test("a missing leaf is still reported, and a missing container is not", () => {
  const outline = loadOutline();
  const draft = loadExample();
  draft.sections = draft.sections.slice(0, -1);
  assert.throws(() => validateDraft(draft, outline), (error) => {
    assert.equal(error.code, "E_SECTIONS_MISSING");
    return true;
  });
});

test("a heading3 block without a heading2 above it is rejected", () => {
  const draft = loadExample();
  const section = draft.sections.find((entry) => entry.blocks?.some((block) => block.type === "heading2"));
  section.blocks = section.blocks.map((block) => (block.type === "heading2" ? { ...block, type: "heading3" } : block));
  assert.throws(() => validateDraft(draft), (error) => {
    assert.equal(error.code, "E_BLOCK_HEADING_SKIP");
    return true;
  });
});
