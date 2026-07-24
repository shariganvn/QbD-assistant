# Step 4 — Viewer-defect patch: detailed implementation plan

Status: completed (subordinate execution detail for
[`step-04-determinism-viewer-evidence.md`](./step-04-determinism-viewer-evidence.md))
Owning gates: G-P3-03 (fidelity) extended, G-P3-05 (viewer) — status owned by
[`gates.yaml`](./gates.yaml). This file changes no gate/step status.

## Why this plan exists

The 2026-07-23 validation found the viewer-defect patch described in the step-04 addendum
(§"Planned implementation") was never written. The working tree only fixed the Decision Matrix
grid (already PASS) and wired the determinizer. Verified gaps in `document-builder.mjs`:

| # | Required by addendum | Human-review defect | Current code |
|---|---|---|---|
| 1b | Inline `[n]` marker beside each cited segment | Footnotes FAIL | `buildParagraph` emits only `FootnoteReference` |
| 1c | Visible `Sources and provenance` section | Local provenance FAIL | not built |
| 1d | Reader-visible `USP reference` HTTPS link in body | USP hyperlink FAIL | link only inside invisible footnote |
| 2 | Static generated TOC list of heading1–3 labels | TOC FAIL | still `TableOfContents` field only |

This plan turns those four into red-first tasks. It does **not** authorize a fallback renderer,
contract change, or reasoning/translation, and it must not touch `buildTable`.

## Blocking preconditions (do not start until both clear)

1. **Human approval.** Per step-04 §17-32, an implementer MUST NOT patch code, add/alter a fixture,
   run a render/gate, or change status until a human records `approval.approved_at` and
   `approved_by` in `T20260723-qbd-p3-render-step-04.yaml`, changes its status off
   `awaiting_approval`, runs `rtk baton render-test-plan`, and the generated `TEST_PLAN.md`
   fingerprint equals the SHA-256 of that YAML.
2. **Resolve the test-file-map gap (decision required).** The new fidelity assertions naturally
   belong in `cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs` (it is the G-P3-03 command and the
   working tree already extended it for the table). But step-04's exact file map (§104-121) lists
   only `determinism`, `viewer-checklist`, and `gate-evidence.contract` test files — **not**
   `ooxml-fidelity.test.mjs`. Before implementation, the phase owner must either add
   `ooxml-fidelity.test.mjs` to the approved Step 4 test plan (update the YAML, regenerate
   `TEST_PLAN.md`) or nominate a different home for these assertions. Do not resolve this
   unilaterally.

## Scope

- Modify only `cowork-p2-kit/render/document-builder.mjs` for renderer output.
- Add red tests in the fidelity suite (see precondition 2) and extend
  `cowork-p2-kit/render/tests/determinism.test.mjs` for the new body hyperlink relationship.
- Reuse the existing fixture `tests/fixtures/fidelity/two-citation-draft.json` unchanged.
- Out of scope: `buildTable`/grid, input contract, `render-docx.mjs`, `render-spike.mjs`,
  fallback policy, English reasoning content, any new host.

## Ordered TDD work

### Task A — Inline citation markers

**Red test first (fidelity suite).** Using `renderAndInspect(t)`, read `word/document.xml`:
- assert a visible run `<w:t...>[1]</w:t>` and `<w:t...>[2]</w:t>` exist (marker is reader text,
  not only a superscript footnote mark);
- assert exactly two `w:footnoteReference` remain (retain existing behavior);
- assert each `[n]` marker run appears immediately before its matching `w:footnoteReference w:id="n"`.

Expected to FAIL on current builder (no `[n]` run).

**Minimal change.** In `buildParagraph`, switch `map` → `flatMap`; for a citation segment emit the
marker plus the retained footnote reference:

```js
function buildParagraph(block) {
  const children = Object.hasOwn(block, "segments")
    ? block.segments.flatMap((segment) => (Object.hasOwn(segment, "citation")
      ? [new TextRun(`[${segment.citation + 1}]`), new FootnoteReference(segment.citation + 1)]
      : [new TextRun(segment.text)]))
    : [new TextRun(block.text)];
  return new Paragraph({ children });
}
```

### Task B — `Sources and provenance` section + body USP link

**Red test first (fidelity suite).** Read `word/document.xml` and `word/_rels/document.xml.rels`:
- assert a visible heading run `Sources and provenance` exists;
- assert body (`document.xml`, not `footnotes.xml`) contains, for each citation: `evidenceId`,
  `source`, `location`, and `excerpt` substrings;
- assert the exact local provenance substring
  `inputs/trials/formulation-trial-02.docx — page 1, offset 150` appears as plain text;
- assert `document.xml.rels` has **exactly one** external hyperlink relationship, `TargetMode`
  `External`, target `https://www.usp.org/search?query=bisoprolol`, and that `document.xml`
  contains a visible `USP reference` run;
- assert the local-only citation creates **no** body hyperlink (no `file:` target, no relationship
  targeting `inputs/trials/formulation-trial-02.docx`).

Expected to FAIL on current builder (no section, no body link).

**Minimal change.** Add a pure helper and append its output after the draft blocks:

```js
function buildSourcesSection(citations) {
  const heading = new Paragraph({
    children: [new TextRun({ text: "Sources and provenance", bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_1,
  });
  const entries = citations.map((citation, index) => {
    const runs = [
      new TextRun({ text: `[${index + 1}] `, bold: true }),
      new TextRun(`${citation.evidenceId} — ${citation.source} — ${citation.location} — "${citation.excerpt}"`),
    ];
    if (citation.evidenceLink) {
      runs.push(new TextRun("  "), new ExternalHyperlink({
        children: [new TextRun({ text: "USP reference", style: "Hyperlink" })],
        link: citation.evidenceLink,
      }));
    }
    return new Paragraph({ children: runs });
  });
  return [heading, ...entries];
}
```

`evidenceLink` is only present on citable, allowlisted citations (guaranteed by the frozen
contract), so no link-policy re-check is needed here. Local-only citations keep plain provenance
text — never a file hyperlink.

### Task C — Static TOC list (keep native field)

**Red test first (fidelity suite).** Read `word/document.xml`:
- assert visible runs for each draft heading label exist (`P.2.2 Formulation Development`,
  `Decision Matrix`) in the TOC region between the `Mục lục` heading and the first body block —
  i.e. present without a field refresh;
- assert the native TOC field is still present (existing `contains TOC field` test must keep
  passing);
- assert `Mục lục` is not emitted as a generated list entry (the label appears as the section
  heading only, not duplicated in the static list).

Expected to FAIL on current builder (no static list).

**Minimal change.** Build the static list from draft headings and insert it right after the native
TOC field, before the body blocks:

```js
const tocLevels = { heading1: 1, heading2: 2, heading3: 3 };
const staticToc = draft.blocks
  .filter((block) => block.type in tocLevels)
  .map((block) => new Paragraph({
    children: [new TextRun(block.text)],
    indent: { left: (tocLevels[block.type] - 1) * 360 },
  }));

children.push(
  new Paragraph({ children: [new TextRun({ text: "Mục lục", bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
  new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }),
  ...staticToc,
);
children.push(...draft.blocks.map(buildBlock));
children.push(...buildSourcesSection(draft.citations));
```

`Mục lục` is a hardcoded heading, never a draft block, so it can never enter `staticToc`.

### Task D — Determinism cross-cut (extend `determinism.test.mjs`)

The body USP link adds a hyperlink relationship to `word/_rels/document.xml.rels` that did not
exist before (previously the only external hyperlink lived in `footnotes.xml.rels`).

**Red/assertion additions.**
- assert `document.xml.rels` contains a hyperlink relationship whose `rId` resolves to a
  `r:id`/`w:hyperlink` reference in `document.xml`;
- assert two renders of the same input yield identical relationship IDs for that body link
  (deterministic), reusing the existing two-render normalized-manifest equality;
- extend the existing same-URL dedup case (currently sets
  `draft.citations[1].evidenceLink = draft.citations[0].evidenceLink`) so that per-part scoping
  holds for **body** links too: identical URLs in `document.xml.rels` collapse to one relationship
  and every reference still resolves.

Confirm `determinizeDocx` already rewrites `document.xml.rels` hyperlink IDs (it replaces `r:id`,
`r:embed`, `r:link` across all `.xml` parts and IDs across all `.rels`); if the body-link case
exposes a gap, fix it inside `determinize-ooxml.mjs` per step-04 §3 (per-`.rels`-part scoping,
never a global `oldId → newId` map).

## Verify and close (after red→green)

1. Focused fidelity + determinism tests: observe red, then green.
2. Full regressions: `node --test` for G-P3-01..G-P3-04 suites (contract, output-preservation,
   ooxml-fidelity, isolated-network) — all pass, no skipped/todo/timed-out.
3. Exactly one `npm run verify:render`; confirm five gate JSONs share one suite UUID and the
   G-P3-05 snapshot is present.
4. Fresh manual viewer review per step-04 §148-179: render via `render-spike.mjs` into fresh
   absolute temp roots, open the exact DOCX through `\\wsl$` in LibreOffice or Word, and record the
   five PASS observations (positive footnotes, exact USP link, local plain provenance, `Mục lục`
   TOC, four-column table) into `G-P3-05-viewer.md`. No headless conversion substitutes for it.
5. `git diff --check` + GitNexus `detect-changes`; run `gitnexus_impact` upstream on
   `buildDocumentBuffer` (and `determinizeDocx` if touched) before editing, report HIGH/CRITICAL.
6. Only then set G-P3-05 → pass, Step 4 → completed, regenerate `TEST_PLAN.md`, handoff.

## Success criteria

- [x] Each new negative/red test demonstrably fails on the pre-patch builder before the fix.
- [x] `document.xml` shows visible `[1]`/`[2]` markers, a `Sources and provenance` section, a
      `USP reference` body hyperlink for the approved citation only, plain local provenance, and
      static TOC labels visible without refresh.
- [x] Existing G-P3-03 assertions (footnote IDs, footnotes.xml.rels single external link,
      local-only no footnote link, native TOC field, fixed four-column grid) still pass.
- [x] Determinism holds: identical inputs → identical normalized manifest, including the new body
      hyperlink relationship.
- [x] Fresh manual viewer checklist records five PASS observations bound to the freshly rendered
      DOCX hashes.
- [x] `npm run verify:render` green with one shared suite UUID; GitNexus change detection reports
      only the expected renderer flow at MEDIUM risk (no HIGH/CRITICAL finding).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `ooxml-fidelity.test.mjs` not in approved file map | Resolve precondition 2 before coding; update test plan YAML if approved there. |
| Body hyperlink breaks determinism | Task D asserts stable, resolving body-link IDs; fix `determinize-ooxml.mjs` per-part if needed. |
| Static list + native field conflict / double `Mục lục` | Keep native field for G-P3-03; static list built only from draft headings; assert no duplicate `Mục lục` entry. |
| Accidental `buildTable` regression | Do not edit `buildTable`; keep the passing grid tests as-is. |
| Marker count double-counted by Sources prefixes | Scope inline-marker assertions to body paragraphs (marker precedes `w:footnoteReference`), not a global `[n]` count. |

## Rollback

Revert `document-builder.mjs`, the fidelity-suite additions, and `determinism.test.mjs`; the fixture
is unchanged, so blast radius is limited to the renderer output and its tests. No gate JSON or
schema rollback is required if statuses were not advanced.
