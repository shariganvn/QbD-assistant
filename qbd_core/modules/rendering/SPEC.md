# SPEC - rendering

## Purpose
Turn a valid `draft.json` into a `.docx` by running the existing renderer and verifier of
tools/pharma-dev-draft as command-line programs. This module never builds a document itself.

## Ubiquitous nouns owned
RenderedDocument, RenderFailed.

## API contract (api.py)
- `render_draft(draft, output_dir, name="p2-orientation-draft.docx", *, tool_root, node, timeout)
  -> RenderedDocument` (path, size, sha256 of the docx, `content_sha256`, sha256 of the draft).
  Order: render in a staging folder inside `output_dir`; run the tool's verifier on the staged file; only
  then replace `output_dir/name` in one step. The staging folder is always removed.
- `RenderFailed.code`: `E_OUTPUT_NAME` (name is not a plain `*.docx` file name), `E_TOOL_MISSING` (node or
  the tool not found), `E_RENDER_TIMEOUT`, `E_RENDER_NO_OUTPUT`, `E_OUTPUT_INVALID` (the output is not a zip), `E_VERIFY_FAILED`, `E_RENDER_FAILED`, or
  the `E_*` code the tool printed (for example a Stage B contract violation).

## Invariants
- The docx is produced only by the Node renderer; this module only invokes it (no import either way).
- Any failure leaves the previous output byte-identical and leaves no staging folder behind.
- A document that fails the verifier is never published.
- Same draft, same tool version: same `content_sha256`. The raw docx bytes are NOT identical, because the
  Node tool writes the wall-clock time into `docProps/core.xml` (created and modified). `content_sha256`
  hashes every part and neutralises only those two stamps; any other change in any part changes it.

## Data owned (models.py)
`RenderedDocument`. No persistence.

## Exposed to (file-share outside api.py)
None.

## Dependencies
Node 22 and the tool under `tools/pharma-dev-draft` (`render/render.mjs`, `verify/verify.mjs`). The
verifier needs the docx skill's `validate.py` (or `DOCX_SKILL_VALIDATE_PY`); without it verification fails
and nothing is published. Figures need Chromium (the tool says so itself).

## Non-goals
Building or editing document content, deciding whether a draft is good enough (quality_gate), and
signing off (a person does).

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Staged render and verify | Failure never replaces a good output | - |
| 2026-10-21 | Content hash | Raw bytes differ by two timestamps; repeatability needs a defined comparison | - |
