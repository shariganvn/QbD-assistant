# pharma-dev-draft

A standalone utility that turns one formulation/trial `.docx` file into an internal,
gap-flagged working draft of a CTD 3.2.P.2 "Pharmaceutical Development" Word document.

## Non-negotiable rules

- **This is not part of "the system."** `cowork-p2-kit/` (ingest → compare → rationale) has
  documented decisions that it must not draft P.2.2/P.2.3 dossier content
  (`docs/decisions/D20260727-qbd-p4-reasoning-policy.md`,
  `docs/decisions/D20260728-qbd-rationale-report-layer-boundary.md`). This tool exists precisely
  because it stays outside that boundary — see
  `docs/decisions/D20260825-pharma-dev-draft-tool-boundary.md`. **Never import anything from
  `cowork-p2-kit/` into this directory, and never import anything from this directory into
  `cowork-p2-kit/`.**
- Every rendered document always carries a fixed "internal draft, not FD-approved, not a dossier
  submission" notice (`render/builder.mjs`'s `SCOPE_NOTICE_*` constants) — this is not something a
  draft JSON can turn off.
- Every CTD outline section (`schemas/p2-outline.json`) that the source trial file doesn't cover
  must be marked `"status": "gap"` with a reason — never invent RMP data, process steps, packaging,
  microbiology results, QTPP targets, or numeric thresholds that aren't in the source. See
  `draft/checklist.md`.
- The outline's CTD taxonomy is sourced from `docs/raw/135-00-Pharmaceutical Development-example.docx`
  and, like `cowork-p2-kit/template/p2-template.md`, is **not yet FD/regulatory-affairs confirmed**
  — it is a working structure, not an authority.

## Usage

```bash
# Stage A — extract structured data from the source trial docx (deterministic)
node tools/pharma-dev-draft/extract/extract.mjs <input.docx> -o extracted.json

# Stage B — a human or a live Claude session reads extracted.json, schemas/p2-outline.json, and
# draft/checklist.md, and writes draft.json following schemas/p2-draft-contract.md.
# This step is NOT automatable end-to-end: table structure varies between trials, so deciding
# which extracted table answers which CTD question requires interpretation each time.
node tools/pharma-dev-draft/draft/validate-draft.mjs draft.json

# Stage C — render the validated draft to a .docx (deterministic)
node tools/pharma-dev-draft/render/render.mjs draft.json --output-root "$(pwd)/tools/pharma-dev-draft/output"

# Verify the rendered file (XSD structural validity + text sanity checks)
node tools/pharma-dev-draft/verify/verify.mjs tools/pharma-dev-draft/output/<file>.docx --draft draft.json
```

Or via the root `package.json` scripts: `npm run pharma-dev:extract -- ...`,
`npm run pharma-dev:validate -- ...`, `npm run pharma-dev:render -- ...`,
`npm run pharma-dev:verify -- ...`.

A fully worked example (the bisoprolol fumarate disintegrant-ratio screening trial this tool was
built from) is committed at `draft/example-draft.json` — run it through Stage C/verify to see the
expected output shape without needing a new source file.

## Why extraction defaults to direct XML walking, not LiteParse

Trial reports handed to this tool are native, text-based `.docx` files (not scanned/OCR input).
Reading the OOXML `<w:tbl>` structure directly (`extract/xml-walk.mjs`) is more exact for numeric
tables than LiteParse's text-flow/x-y-clustering table reconstruction, and it has no dependency on
`soffice`/LibreOffice being available (which is broken in some sandboxes — see that file's header
comment). `extract/liteparse-path.mjs` is kept as an opt-in alternate path (`--method liteparse`)
for future non-`.docx` or scanned input, but does not attempt table reconstruction.

## Directory map

| Path | Purpose |
|---|---|
| `schemas/p2-outline.json` | Canonical CTD 3.2.P.2 section list — the source of truth for both Stage B and Stage C. |
| `schemas/p2-draft-contract.md` | Stage B draft JSON shape and rules. |
| `extract/` | Stage A: docx → `extracted.json`. |
| `draft/` | Stage B: `extracted.json` → `draft.json` (checklist + structural validator + worked example). |
| `render/` | Stage C: `draft.json` → `.docx`. |
| `verify/` | Post-render checks. |
| `output/` | Generated `.docx` files — gitignored, not tracked deliverables. |
