# SPEC - rendering

## Purpose
Turn a valid `draft.json` into one self-contained HTML file with export buttons, after the Stage B
validator of tools/pharma-dev-draft accepted it.

## Ubiquitous nouns owned
RenderedDocument, RenderFailed.

## API contract (api.py)
- `render_draft(draft, output_dir, name="p2-orientation-draft.html", *, tool_root, node, timeout)
  -> RenderedDocument` (path, size, sha256 of the page and of the draft). Order: run
  `validate-draft.mjs` (subprocess) on the draft; build the page; verify it; write it in a staging folder
  inside `output_dir`; replace `output_dir/name` in one step. The staging folder is always removed.
- `verify_html(page, draft) -> list[str]`: failures, empty when the page passes (see Invariants).
- `RenderFailed.code`: `E_OUTPUT_NAME` (not a plain `*.html` name), `E_TOOL_MISSING` (node not found),
  `E_RENDER_TIMEOUT`, `E_BLOCK_UNSUPPORTED` (a `figure` or `image` block, which the page cannot draw yet),
  `E_VERIFY_FAILED`, or the `E_*` code the validator printed (a contract violation).
- Command line: `python -m qbd_core render --draft draft.json --out-dir dir` (exit 6 on any failure).

## Page content
Title and the fixed status line; the scope notice (internal draft, not FD-approved, not a submission,
provenance sentence); a facts table; every outline section in order (containers as headings, gap sections
as a marked box, covered sections as their blocks); a section status table; the data-request register
grouped by experiment; the decision register; the sign-off table with three blank rows. Markers are
highlighted. Registers are derived from the draft's own markers.

## Format (from `docs/reports/qbd-core-p2-autodraft/sample-format-spec.md`)
Applied, all visible in the sample rendering: `P.2.n` is H2 and each further number one level deeper
(capped at H5, H1 is the chapter title); in-section unnumbered headings are H6; a header strip
`Sản phẩm | Module | Ngày` under the title; the abbreviation list (`meta.abbreviations`, sorted, two
columns, no header row) directly before the first section; tables the outline marks `headerless` print no
header row; a section that does not apply is a plain sentence (`Không áp dụng: ...`), not a gap box, and
is not a data request. Kept on purpose although the sample has none: the status line, scope notice, facts
table, registers and blank sign-off table (the SOP needs the draft label).
Measured from the real .docx (`docs/reports/qbd-core-p2-autodraft/sample-docx/README.md`) and applied:
Arimo 10 pt (fallback Arial), justified, 1.5 line spacing, headings bold at body size, `P.2.n` with a
1.25 cm hanging indent, Table Grid 0.5 pt black borders, grey `#A6A6A6` header cells, risk cells green
`#00B050` / yellow `#FFFF00` / red `#FF0000` (lowest, middle, highest level of the outline's scale),
A4 with left 2.5 cm, right 1.5 cm, bottom 3 cm, a one-line header and the page number at the bottom
right. Checked in headless Chromium: computed styles match, the PDF is A4 with a 2.5 cm left margin,
the header text and the page number.
Not applied yet: table and figure captions (`Table N.` bold above, `Figure N.` italic below; table blocks
have no caption field in the Stage B contract, which belongs to tools/pharma-dev-draft), figure drawing,
merged group cells, the sample's two-table header block, landscape sections and forced page breaks. Captions
need a contract change; the rest has no marker in the draft.

## Export buttons
- **PDF**: `window.print()`; a print stylesheet hides the toolbar. The user picks "Save as PDF".
- **Word**: downloads `p2-orientation-draft.doc` (the page body as HTML with Word namespaces). Word opens
  it; it is not a native `.docx`.
- One fixed inline script implements both. Checked in a headless browser: the download works, carries the
  notice, excludes the toolbar, and the page prints to PDF with no page error.

## Invariants
- Self-contained and offline: no external resource, no `img`, `iframe`, `link`, `form`; the only script is
  the constant `SCRIPT`, which contains no network API. All draft text is HTML-escaped.
- The scope notice and the status line appear once; the three sign-off rows are blank; every paragraph and
  gap reason of the draft appears in the page. A page that fails these checks is never published.
- Same draft: byte-identical page (no timestamp is written).
- Any failure leaves the previous output byte-identical and no staging folder behind.
- A draft with class-B, class-C or unclassified text is rendered to a local file only.

## Data owned (models.py)
`RenderedDocument`. No persistence.

## Exposed to (file-share outside api.py)
None.

## Dependencies
Node and `tools/pharma-dev-draft/draft/validate-draft.mjs` (run as a subprocess, never imported) and the
outline `tools/pharma-dev-draft/schemas/p2-outline.json` (read as data). Without node nothing renders.

## Non-goals
Native `.docx`, figures and images (stop the render until drawn), judging whether a draft is good enough
(quality_gate), signing off (a person does), the sample's company header block, landscape sections and forced page breaks.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | HTML renderer, verifier, export buttons | User decision: the output is HTML with PDF and Word buttons | - |
| 2026-10-21 | Structure follows the P.2 sample | Heading levels, abbreviations, headerless tables, not-applicable text | - |
