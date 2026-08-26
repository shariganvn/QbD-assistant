# P.2 Draft Contract (Stage B)

This document defines the JSON shape a "P.2 draft" file must follow before `render/render.mjs`
(Stage C) can turn it into a `.docx`. It is validated structurally (shape only) by
`draft/validate-draft.mjs` — that validator cannot and does not judge whether a table was mapped
to the *correct* CTD section; that judgment call is made by whoever authors the draft (a human or
a live Claude session), following `draft/checklist.md`.

This contract is intentionally **not** shaped like `cowork-p2-kit/render/contract.mjs`'s
`validateDraft()` (no `citations`, `evidenceLink`, `classification`, `citable` fields). That
contract encodes the rationale pipeline's public-citation approval semantics; a P.2 draft has
nothing external to cite — every fact traces back to exactly one supplied internal trial file,
named once in `meta.sourceFile`.

## Top-level shape

```jsonc
{
  "schemaVersion": "1.0",
  "meta": {
    "productName": "string — e.g. \"Bisoprolol fumarate 10 mg film-coated tablet\"",
    "apiName": "string — the active ingredient name",
    "sourceFile": "string — filename of the trial docx this draft was built from",
    "draftDate": "YYYY-MM-DD",
    "preparer": "string — free text, e.g. \"Claude (session ...)\" or a person's name",
    "extractionMethod": "xml-walk | liteparse — from Stage A's extracted.json"
  },
  "sections": [ /* see below — one entry per id in schemas/p2-outline.json, in that order */ ]
}
```

## `sections[]` — one entry per `schemas/p2-outline.json` id

```jsonc
{
  "id": "P.2.2.1.3",                 // must match an id in schemas/p2-outline.json exactly
  "status": "covered" | "gap",
  "gapReason": "string",             // REQUIRED iff status === "gap"; FORBIDDEN iff status === "covered"
  "blocks": [ /* ... */ ]            // REQUIRED (non-empty) iff status === "covered"; FORBIDDEN iff "gap"
}
```

Rules enforced by `validate-draft.mjs`:

1. `sections` must contain exactly one entry per id listed in `schemas/p2-outline.json`, no more,
   no fewer, no duplicates, no unknown ids.
2. `status: "gap"` → `gapReason` must be a non-empty string; `blocks` must be absent or empty.
3. `status: "covered"` → `blocks` must be a non-empty array; `gapReason` must be absent.
4. Every block's `type` must be one of: `heading2`, `heading3`, `paragraph`, `table`.

Rules **not** enforced by the validator (judgment calls — see `draft/checklist.md`):

- Whether a table was assigned to the *right* section.
- Whether `blocks` content is a verbatim copy of the source (vs. paraphrased or invented) — the
  checklist requires verbatim copying, but the validator cannot check this against the original
  docx automatically.

## Block types

```jsonc
{ "type": "heading2", "text": "string" }
{ "type": "heading3", "text": "string" }
{ "type": "paragraph", "text": "string", "italic": false, "bold": false }   // italic/bold optional, default false
{ "type": "table",
  "headers": ["string", "..."],
  "rows": [["string", "..."], "..."],
  "columnWidths": [520, 1680, "..."],          // optional, see below
  "columnAlign": ["center", "left", "..."] }   // optional, see below
```

Every `rows[i]` must have the same length as `headers`. Cell values are always strings (format
numbers exactly as they appear in the source — e.g. `"98,64"` for Vietnamese comma-decimal, not
`98.64`).

A `\n` inside a cell value renders as a line break within that cell, so a cell can carry a short
bullet list (write the bullet character into the text yourself, e.g. `"• Điểm chảy: …"`).

`columnWidths` and `columnAlign` are both optional and both must have exactly one entry per
header when present:

- `columnWidths` — positive integers in DXA units that must sum to `10000` (the renderer's page
  width budget). Omit it and the renderer gives the first column 34% and splits the rest evenly,
  which suits short label/number tables but not tables with several prose columns.
- `columnAlign` — `"left"` or `"center"` per column. Omit it and the first column is left-aligned
  with the rest centred; centring is unreadable for long prose, so set it explicitly on any table
  with paragraph-length cells.

## What Stage C always adds regardless of the draft (not part of this contract)

`render/builder.mjs` unconditionally prepends a scope-notice box and appends a sign-off table —
these are fixed constants in the renderer, not settable through the draft JSON. See
`tools/pharma-dev-draft/README.md` for why this is non-negotiable.
