# Render — Layer C Deterministic .docx Output

## Phase 3 status

`docx@9.7.1` is the Phase 3 candidate, not a selected fallback decision. The historical spike is
quarantined and cannot satisfy a current gate. G-P3-01 (contract/link policy) and G-P3-02
(fail-closed publication) pass; G-P3-03 through G-P3-06 remain unverified. Do not provision or name an alternative renderer without a
separately approved plan after a must-pass gate fails.

## Version Pinning

| Item | Value |
|------|-------|
| Package | `docx` |
| Version | `9.7.1` (exact, not range) |
| Type | Pure-JS OOXML writer |
| License | MIT |
| Lockfile | `package-lock.json` |

## How to Run

```bash
# Demo mode (reads from store/records.jsonl — minimal smoke test)
npm run render

# With structured draft input
npm run render -- path/to/draft.json

# Use an existing absolute output root (the only output-root override)
npm run render -- path/to/draft.json --output-root /absolute/path/to/outputs
```

`--output-root` is optional, must be an absolute path, and never reads an environment variable.
The renderer validates the complete draft before it creates the default output directory or opens an
injected output root for publication.

## Input Contract

The renderer accepts a structured JSON draft (from Phase 4 SKILL output):

```json
{
  "title": "CTD P.2 — Phát triển dược học — Bisoprolol 5/10 mg",
  "blocks": [
    { "type": "heading1", "text": "P.2.2 ..." },
    { "type": "paragraph", "segments": [
      { "text": "claim text" },
      { "citation": 0 }
    ]},
    { "type": "table", "headers": [...], "rows": [[...]] },
    { "type": "chờ_dữ_liệu", "text": "missing data description" }
  ],
  "citations": [
    {
      "evidenceId": "stable Phase 2 record id",
      "source": "relative/provenance.docx",
      "location": "page X, offset Y",
      "excerpt": "...",
      "classification": { "label": "public", "citable": true },
      "evidenceLink": "https://www.usp.org/..."  // optional, exact approved HTTPS host only
    }
  ]
}
```

### Citation Contract

- **Footnote IDs start at 1** (not 0 — 0 conflicts with DOCX continuation separator)
- **`evidenceLink`** is optional. When present:
  - Must be HTTPS without credentials or a port, and its exact host must be `www.usp.org` or `dav.gov.vn`
  - Renders as `ExternalHyperlink` inside the numbered footnote
  - `file://` and absolute-path targets are **rejected**
- **Local-only evidence** (no `evidenceLink`): renders as **plain provenance text** (source + location)
- Inline `citation` index is 0-based; renderer maps to footnote ID = index + 1

### Block Types

`heading1`, `heading2`, `heading3`, `paragraph`, `table`, `chờ_dữ_liệu`.

`chờ_dữ_liệu` blocks are highlighted orange for "waiting for data".

## Demo Mode

When no input file is provided, the renderer builds a **minimal smoke test** from `store/records.jsonl`:

- Renders only blocks provably cited from real store records
- Decision matrix and formula-selection prose render as `chờ_dữ_liệu` (Phase 4's LLM output, not Layer C)
- No hard-coded numbers or fabricated data

## Reuse by qbd_core

The render script is reusable via **shell/CLI invocation** from Python (`node render-docx.mjs draft.json`). The input contract (structured JSON) is the portable interface.

## Offline Guarantee

The `docx` library is pure-JS, but an offline claim requires fresh G-P3-04 evidence from the approved
Bubblewrap isolation wrapper. A host-level installation or historical report is not proof.
