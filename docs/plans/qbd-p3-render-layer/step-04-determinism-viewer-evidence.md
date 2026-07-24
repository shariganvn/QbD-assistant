# Step 4 — Prove Determinism and Viewer Fidelity

## Goal

Turn the renderer's deterministic and visual-fidelity claims into retained evidence.

The executable validation plan is
[`T20260723-qbd-p3-render-step-04.yaml`](../../test-plans/T20260723-qbd-p3-render-step-04.yaml).
The viewer-defect remediation is specified by the subordinate, executable detail plan
[`step-04-viewer-patch-implementation.md`](./step-04-viewer-patch-implementation.md); it depends
on this Step 4 plan and does not own gate or step status.

## Preconditions

- G-P3-03 and G-P3-04 are `pass`.
- `T20260723-qbd-p3-render-step-04.yaml` has been explicitly approved. While its status is
  `awaiting_approval`, do not create tests or fixtures, run preflight or render commands, write
  evidence, or change a plan/gate status.

## Post-implementation remediation — STRICTLY FOLLOW EVERY DETAIL

The 2026-07-23 review invalidated the prior claimed G-P3-05 result: the approval record was
missing, the viewer report described a pre-determinizer DOCX, and the implementation and its
tests did not meet this execution file. Treat every current Step 4 implementation artifact and
G-P3-05 record as **unverified**. This is a remediation of Step 4, not Step 5 and not an
authorization for a fallback renderer.

The phase owner has reset the canonical plan, gate, and test-plan status to unverified/
`awaiting_approval`. An implementer MUST NOT patch code, create/alter a fixture, run a render or
gate command, alter retained evidence, or change a status until a human records both
`approval.approved_at` and `approval.approved_by` in
`T20260723-qbd-p3-render-step-04.yaml`, changes its status from `awaiting_approval`, and runs
`rtk baton render-test-plan`. The generated `TEST_PLAN.md` fingerprint must equal the SHA-256 of
that YAML before the first TDD command. A chat assertion, a reviewer name in the checklist, or an
old Step 3 approval is not approval for this remediation.

After approval, the implementer MUST execute the ordered work below exactly. A red test is a
required retained development fact: do not skip it because the existing test happens to be green;
do not mark a finding fixed by weakening an assertion; do not hand-edit a passing gate JSON. If a
requirement below conflicts with an older sentence in this file, this remediation section wins.

## Viewer-defect patch addendum — 2026-07-23

### Evidence recorded

The review of `/home/nguyenhp/qbd-p3-decision-matrix-fixed.docx` found a viewer-visible fidelity
failure despite the package-level G-P3-03 assertions passing:

| Check | Review result |
|---|---|
| Four-column Decision Matrix | PASS — columns are equal width and fully readable. |
| Footnotes | FAIL — no footnote markers or footnote body are visible in the rendered document. |
| USP hyperlink | FAIL — no usable USP link is visible to the reader. |
| Local provenance | FAIL — source, page, and offset are not visible to the reader. |
| TOC | FAIL/unknown — only the `Mục lục` label is visible; the result of a normal refresh is not evidenced. |
| Headings | PASS — the title and content headings are present. |
| Reasoning content | Deferred — current content is basic English and requires later subject-matter completion. |

The existing `G-P3-05-viewer.md` PASS statements must be treated as superseded evidence for this
defect. Do not overwrite it, alter a gate status, or claim a replacement PASS until the patch and
fresh manual review below are complete.

### Patch goal

Make citations, approved USP links, local provenance, and the table of contents visible without a
field refresh or hidden OOXML-only structure, while retaining the current fixed-width Decision
Matrix and the existing citation-envelope/link-policy boundary. This is a renderer-output fix; it
does not authorize a fallback renderer, contract expansion, or substantive reasoning/translation.

### Planned implementation

1. In `cowork-p2-kit/render/document-builder.mjs`, retain the semantic footnote and its approved
   external relationship, but also emit a normal inline citation marker (`[1]`, `[2]`, …) next to
   every cited segment. Add a visible `Sources and provenance` section after the draft blocks.
   Each entry must show evidence ID, normalized relative source path, page/offset, and excerpt.
   An `evidenceLink` must render as a reader-visible `USP reference` HTTPS hyperlink; a local-only
   citation remains plain text and must not become a file hyperlink.
2. Replace the blank-on-open TOC experience with a static, generated list of the draft's
   `heading1`–`heading3` labels. Keep the native TOC field only if it remains harmless and the
   package-level G-P3-03 invariant continues to hold. `Mục lục` itself must not be included as an
   entry. The static list is the display contract; no viewer field refresh may be required to see
   it.
3. Do not alter `buildTable` or the 9000-twip fixed four-column grid. Preserve its existing PASS
   result.
4. Do not translate or invent the English reasoning in the fidelity fixture. Record that content
   work as a later, separately approved subject-matter task.

### Validation and dependencies

1. Add focused red tests before the builder change. They must prove that the generated document
   has visible inline markers, a visible source/provenance section, an external USP link only for
   the approved citation, plain local provenance for the local-only citation, and static TOC
   entries. Retain the existing structural tests for positive footnotes, relationship ownership,
   and the equal table grid.
2. Extend the viewer-fidelity test/checklist schema and the fresh manual review so the observation
   describes what is visible in LibreOffice or Word, not merely what appears in `document.xml` or
   `footnotes.xml.rels`. A headless conversion is diagnostic evidence only; the final PASS still
   requires the declared interactive viewer and the exact freshly rendered DOCX.
3. Run the frozen G-P3-01 through G-P3-04 regressions, the focused red/green tests, and one fresh
   `npm run verify:render`. Replace viewer evidence only with the exact newly opened file's hashes
   and observations. Then run GitNexus change detection before any commit.
4. This addendum stays within the approved Node `docx` candidate, but any change that requires
   altering the frozen G-P3-03 contract, `gates.yaml`, or files outside the approved Step 4 test
   plan must first update `T20260723-qbd-p3-render-step-04.yaml`, regenerate `TEST_PLAN.md`, and
   obtain the required approval.

## Exact file map

- Modify `cowork-p2-kit/render/{document-builder,determinize-ooxml,normalize-ooxml}.mjs`; do not
  change `render-docx.mjs`, `render-spike.mjs`, the input contract, or the fallback-renderer policy.
- Modify `cowork-p2-kit/render/tests/{determinism,viewer-checklist,gate-evidence.contract}.test.mjs`,
  `run-gate.mjs`, `gate-evidence-validator.mjs`, and `verify-render.mjs`. A small extracted pure
  evidence-validation helper is allowed only if both `verify-render.mjs` and its contract test use it.
- Add `cowork-p2-kit/render/tests/fixtures/normalization/{with-media.docx,with-media.expected.json}`.
- Add the blank committed template
  `docs/reports/qbd-p3-render-layer/gates/G-P3-05-viewer.template.md`; the final, filled evidence
  is `G-P3-05-viewer.md` in the same directory.
- Add a direct, pinned `jszip` production dependency only if the retained post-processor continues
  to import it; update both `package.json` and `package-lock.json`. Do not rely on a transitive,
  hoisted package as a direct production import.
- After G-P3-05 passes, update exactly `cowork-p2-kit/render/README.md`,
  `docs/system-architecture.md`, `DEPENDENCIES.md`, and
  `docs/reports/qbd-p3-render-layer/README.md`. No other architecture or dependency document is
  in scope.

## Normalization contract

`normalize-ooxml.mjs` exports `normalizeOoxml(docxPath)`. It must invoke the absolute binary
`/usr/bin/unzip` through argument arrays only: first `['-Z1', docxPath]` to list entries, then one
`['-p', docxPath, readPath]` for every listed entry. `readPath` is the exact argv string actually
passed to `/usr/bin/unzip`; it must escape unzip glob metacharacters when necessary (notably
`[Content_Types].xml`) so exactly one listed entry is read. `commands` MUST record those actual
arrays, never a display-only unescaped version. The manifest key remains the original listed entry
path. It must reject an unreadable ZIP, nonzero child result, empty/absolute/traversal entry path,
and duplicate entry path; it must not extract to the repository or canonical evidence directory.

Its result has exactly these values:

- `manifest`: an object constructed by iterating lexically sorted ZIP entry paths, where each value
  is the lowercase SHA-256 of that entry's uncompressed bytes. `Object.keys(manifest)` MUST already
  be lexical order, independent of archive listing order;
- `manifest_sha256`: lowercase SHA-256 of the UTF-8 bytes of `JSON.stringify(Object.entries(manifest))`;
- `commands`: the complete argument arrays used for listing and every entry read, in execution order.

No XML, relationship, media, or other payload may be rewritten, canonicalized, excluded, or
compared from raw DOCX container bytes. `with-media.docx` must contain at least one
`word/media/` entry, one relationship entry, and one XML entry; `with-media.expected.json` is the
complete expected manifest. Its test proves all of those paths are present and hashed, so the media
requirement is not vacuous.

## Viewer-evidence schema and manual procedure

Before production code, add the blank template with these exact Markdown fields and no optional
required-field aliases: `Reviewer`, `Review date`, `Viewer product`, `Viewer version`, `Host
baseline`, `Fixture SHA-256`, `Opened DOCX SHA-256`, `Normalized manifest SHA-256`, and
`Opened DOCX path`. The five required observation keys are `positive_footnotes`, `usp_link`,
`local_provenance`, `toc`, and `table_layout`; each has a verdict of exactly `PASS` and a non-empty
observation. The test rejects a missing field, duplicate field, blank value, non-`PASS` verdict,
unknown observation key, or extra required observation key.

`viewer-checklist.test.mjs` additionally requires a non-empty reviewer and version; a real
`YYYY-MM-DD` calendar date; viewer product exactly `LibreOffice` or `Microsoft Word`; host baseline
exactly `Windows host + WSL2 Ubuntu`; an absolute opened-DOCX path; and lowercase 64-hex hashes.
It parses each field and observation exactly once, rejects duplicates and unknown keys, and rejects
uppercase hash characters and calendar rollovers. It recomputes the fixture hash, then renders the
committed fixture into test-owned fresh temporary output/report roots and normalizes that output.
The fresh manifest hash MUST equal the checklist's `Normalized manifest SHA-256`; the raw opened-DOCX
hash is format-checked only because ZIP container metadata is not a determinism criterion. The
temporary roots are removed in `finally`. Do not make the test rely on a persistent `/tmp` viewer
file.

For the manual run, create fresh absolute temporary output and report roots outside the repository,
then execute `render-spike.mjs` with the committed
`tests/fixtures/fidelity/two-citation-draft.json` and those two roots. Open its one
`p2-draft.docx` through `\\wsl$` in the declared viewer; do not use `npm run render`, a headless
conversion, or a fallback renderer. Record the raw opened-file hash and the normalizer's manifest
hash before deleting only those temporary roots. The reviewer must confirm, without navigating to
the network: exactly two positive footnote markers; an active UI hyperlink with target
`https://www.usp.org/search?query=bisoprolol`; the non-link provenance
`inputs/trials/formulation-trial-02.docx — page 1, offset 150`; a visible `Mục lục` TOC after the
viewer’s ordinary field refresh; and a fully visible four-column table with one header and two body
rows at 100% zoom, with no overlap or clipped cell text.

## Ordered remediation work

1. **Baseline and impact.** Before changing each existing production symbol, run GitNexus upstream
   impact analysis for `buildDocumentBuffer`, `determinizeDocx`, `normalizeOoxml`, and
   `validateGateEvidence`; inspect `run-gate.mjs` and `verify-render.mjs` before changing their
   script control flow. Report any HIGH/CRITICAL result before editing. Preserve unrelated dirty
   `AGENTS.md` and `CLAUDE.md` changes. Record the currently invalid viewer/gate artifacts as
   superseded; do not delete them until replacement evidence is retained.
2. **Write and observe focused red tests first.** Add failing cases for: (a) two approved citations
   with the same USP URL produce unique relationship IDs and every XML relationship reference
   resolves within its owning `.rels` part; (b) the same old relationship ID in two different
   `.rels` parts cannot cross-rewrite either owner; (c) a non-lexical media fixture produces lexical
   manifest keys and `commands` equal the actual escaped unzip argv; (d) duplicate/unsafe ZIP entry
   paths reject; (e) duplicate checklist fields/observations, unknown keys, uppercase hashes, and
   `2026-02-30` reject; (f) the current checklist hash disagrees with a fresh render and rejects;
   (g) missing, malformed, non-pass, and mismatched-suite evidence make the post-G-P3-05 verifier
   fail; and (h) missing or malformed G-P3-05 diagnostics make its gate evidence fail.
3. **Repair deterministic production output without corrupting OOXML.** Relationship IDs are scoped
   per `.rels` part. Derive each replacement deterministically from the relationship-part path,
   relationship type, target, target mode, and that relationship's stable ordinal among otherwise
   identical relationships. Apply a mapping only to the owner XML part of that `.rels` file; never
   use a global `oldId -> newId` map across packages. Preserve a one-to-one relationship/reference
   mapping and assert relationship-ID uniqueness after rewriting. Normalize only the two core
   property timestamps to the fixed UTC value. Do not rewrite any payload in `normalizeOoxml`.
4. **Repair normalization and evidence transport.** Sort validated original entry paths before
   populating the manifest. Use the escaped `readPath` in both `spawnSync` and `commands`; hash only
   each child process's uncompressed stdout bytes. For G-P3-05, make `run-gate.mjs` create a
   test-owned snapshot path just as G-P3-04 does. `determinism.test.mjs` MUST write exactly one
   structured snapshot containing the fixture SHA-256, two raw DOCX SHA-256 values, two identical
   manifest SHA-256 values, and complete actual normalizer command arrays for both renders. The
   G-P3-05 validator MUST require and validate this one snapshot; an empty `snapshots` array fails.
5. **Repair manual-evidence binding and rerun manual review.** Make the strict checklist test render
   the committed fixture fresh and compare its normalized manifest to the report. Only after it is
   green, create a new manual DOCX through `render-spike.mjs` in fresh absolute temp output/report
   roots, open that exact file through `\\wsl$` in LibreOffice or Word, and complete every required
   observation without network navigation. Its normalized manifest must equal the fresh test render.
   Do not reuse the current viewer report or its pre-determinizer DOCX.
6. **Make suite postcondition testable.** Extract only the post-write evidence validation into a
   pure helper or inject its filesystem dependencies; unit-test each fail case against test-owned
   files, then call the same helper from `verify-render.mjs` after G-P3-05. The integration path
   MUST reject absent JSON, malformed JSON, schema failure, non-pass status, and a suite UUID other
   than the UUID created by that invocation. It must never accept stale prior gate records.
7. **Verify and close only after evidence.** Run focused tests red then green, then the Step 1–3
   regression commands, then exactly one `npm run verify:render`. Confirm five newly written JSON
   records share its UUID and G-P3-05 includes the required snapshot. Only then update the four
   allowed documentation files, set G-P3-05 to `pass`, Step 4 and this test plan to completed, and
   regenerate `TEST_PLAN.md`. Run `git diff --check` and GitNexus change detection before handoff.
   Step 5 remains forbidden until a fresh review finds no blocking issue.

## Required validation record

- Retain the focused red output, focused green output, all required G-P3-05 snapshot fields, the
  renewed viewer checklist, five schema-valid gate records, and one shared suite UUID.
- A green focused test is insufficient unless its new negative case demonstrably failed before the
  smallest fix. `npm run verify:render` is insufficient unless post-write validation succeeds on
  its own newly written records.

## Stop conditions

- A missing, partial, or failed viewer checklist blocks completion.
- A relationship-ID collision, cross-part reference rewrite, undeclared direct dependency,
  normalization error, non-lexical manifest, command/evidence mismatch, missing media fixture
  assertion, nonmatching fresh viewer manifest, nonmatching suite UUID, empty G-P3-05 snapshot,
  or stale/malformed prior-gate evidence file blocks completion.
- Do not claim a fallback renderer was evaluated or selected without its own evidence.
