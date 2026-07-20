# Render — Layer C Deterministic .docx Output

## Renderer Choice

**Primary:** `docx` npm library (v9.7.1, pure-JS OOXML writer, MIT) — same Node runtime as ingest, no second toolchain, offline by construction.

**Fallback (named, not provisioned):** .NET OfficeCLI (`iOfficeAI/OfficeCLI`, Apache-2.0) — only if the Node spike fails a must-pass element. Not installed; would require .NET runtime provisioning.

## P1.2 Spike Results

| Element | Status | Evidence |
|---------|--------|----------|
| Footnotes | ✅ PASS | `FootnoteReference` + inline citation; unique positive IDs verified in OOXML |
| Clickable hyperlinks | ✅ PASS | `ExternalHyperlink` for URL-bearing citations; OOXML relationship count verified |
| Offline render | ✅ PASS | `bwrap --unshare-net` isolated run succeeded |
| Table of Contents | ✅ PASS | `TableOfContents` with heading range 1-3 |
| Tables | ✅ PASS | Table with headers + data rows |

**Must-pass** (footnotes + hyperlinks + offline): ✅ PASS
**Nice-to-have** (TOC + tables): ✅ PASS

**Gate decision:** Lock `.docx`-via-`docx`-npm. No .NET provisioning needed.

The historical spike report is quarantined under `docs/plans/OUTDATED/` and is not an active
execution or status source. Re-run the spike before relying on it for a new renderer change.

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
```

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
      "source": "file path",
      "location": "page X, offset Y",
      "excerpt": "...",
      "evidenceLink": "https://..."  // optional, public URL only
    }
  ]
}
```

### Citation Contract

- **Footnote IDs start at 1** (not 0 — 0 conflicts with DOCX continuation separator)
- **`evidenceLink`** is optional. When present:
  - Must be a **public URL** (`http://` or `https://`)
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

The `docx` library is pure-JS with no network calls. Render runs fully in-process and offline. No third-party binary on the dossier path. Verified with `bwrap --unshare-net` isolated run.
