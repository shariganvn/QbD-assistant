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
(quality_gate), signing off (a person does), matching the visual style of the department sample (waits
for a readable copy).

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | HTML renderer, verifier, export buttons | User decision: the output is HTML with PDF and Word buttons | - |
