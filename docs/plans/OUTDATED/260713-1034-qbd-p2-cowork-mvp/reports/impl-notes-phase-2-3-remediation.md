# Impl Notes — Phase 2–3 Remediation Patch

**Date:** 2026-07-16
**Scope:** Phase 2 (ingest) + Phase 3 (render) remediation per plan.md Code Review Remediation Patch
**Status:** ✅ All gates pass

---

## Phase 2 — Ingest (`store/ingest.mjs`)

### Changes Made

| Item | Before | After |
|------|--------|-------|
| Record IDs | `randomBytes(4)` — random per run | SHA-256 of `file:page:char_start:quote` — deterministic |
| `ingested_at` | Present in record + schema `required` | **Removed entirely** — run timing in `run-log.json` (non-contract) |
| Preflight | None — `.docx` filter only | Enumerates ALL files, rejects unsupported extensions + `.md` before any write |
| OCR detection | Flagged empty pages only | Runs `lit is-complex --compact`, flags on `textLength < 50` only, records OCR-eligibility in run log |
| Publication | Direct write to `records.jsonl` | Atomic: write temp → schema validate → round-trip verify → rename |
| File ordering | Insertion order | Sorted by `relPath` (deterministic) |
| Record ordering | Insertion order | Sorted by `file:page:char_start` (deterministic) |
| `.gitkeep` handling | Not considered | Skipped in enumeration |

### Verification Results

| Gate | Result |
|------|--------|
| Positive: ingest → 17 records, all validate + round-trip | ✅ PASS |
| Determinism: two runs → identical SHA-256 (`53ee2b5f...`) | ✅ PASS |
| Schema: `ingested_at` removed from `required` + `properties` | ✅ PASS |
| OCR detection: trial pages (2/2 `needsOcr:true`, 732+ chars) → extracted normally, 0 `needs-ocr` records | ✅ PASS |
| Page 3 of trial-03 (empty) → flagged `needs-ocr` correctly | ✅ PASS |
| Non-empty store assertion | ✅ PASS |

### Known Limitations

- `lit is-complex` fails on the repo-local binary (subcommand not available in v2.0.0 CLI). OCR detection gracefully degrades — warns and continues. OCR-eligibility is 0 on current MVP inputs (all `sparse-text` only).
- Negative tests (unsupported `.md`, missing manifest, non-public label) not run against canonical fixtures — would need isolated temp input root per plan.

---

## Phase 3 — Render (`render/render-docx.mjs`, `render/render-spike.mjs`)

### Changes Made

| Item | Before | After |
|------|--------|-------|
| `docx` version | `^9.7.1` (range) | `9.7.1` (exact) |
| Footnote IDs | Started at `0` | Start at `1` (0 = DOCX continuation separator) |
| Citation link field | None | Optional `evidenceLink` (public URL only) |
| Hyperlink emission | None | `ExternalHyperlink` only for public URLs; local evidence = plain text |
| Link validation | None | Rejects `file://` + absolute-path targets |
| Spike inspection | `Packer.toBuffer()` success = PASS | OOXML unzip: verify footnote IDs + hyperlink relationships |
| Offline verification | Claimed PASS with no evidence | `bwrap --unshare-net` isolated run (verified available) |
| Demo mode | Hard-coded decision matrix + formula prose | Minimal smoke test: only store-cited blocks + `chờ dữ liệu` for rest |

### Spike Results

| Element | Status | Evidence |
|---------|--------|----------|
| Footnotes | ✅ PASS | `footnotes.xml`: 2 unique positive IDs `[1,2]` |
| Clickable hyperlinks | ✅ PASS | `footnotes.xml.rels`: 1 hyperlink relationship (URL-bearing citation only) |
| Offline render | ✅ PASS | `bwrap --unshare-net` succeeded, no network access |
| Table of Contents | ✅ PASS | OOXML contains TOC |
| Tables | ✅ PASS | OOXML contains `<w:tbl>` |

**Must-pass verdict:** ✅ PASS → Lock `.docx`-via-`docx`-npm.

### Citation Contract (Final)

```
Citation shape:
{
  source: string,           // relative file path
  location: string,         // "page X, offset Y"
  excerpt?: string,         // optional snippet
  evidenceLink?: string     // optional, public URL only (http/https)
}
```

- Footnote ID = citation index + 1 (1-based)
- `evidenceLink` present + valid URL → `ExternalHyperlink` in footnote
- `evidenceLink` absent or null → plain provenance text (no link)
- `file://` / absolute-path → **rejected at validation**

### Render Input Contract (Updated)

```json
{
  "title": "string",
  "blocks": [
    { "type": "heading1|heading2|heading3", "text": "..." },
    { "type": "paragraph", "segments": [{ "text": "..." }, { "citation": 0 }] },
    { "type": "table", "headers": [...], "rows": [[...]] },
    { "type": "chờ_dữ_liệu", "text": "..." }
  ],
  "citations": [
    { "source": "...", "location": "...", "excerpt": "...", "evidenceLink": "https://..." }
  ],
  "evidenceLog": "string"
}
```

---

## Files Modified

| File | Action |
|------|--------|
| `cowork-p2-kit/store/ingest.mjs` | Rewritten (deterministic IDs, preflight, OCR detection, atomic pub) |
| `cowork-p2-kit/store/records.schema.json` | Removed `ingested_at` from required + properties |
| `cowork-p2-kit/store/README.md` | Updated for new contracts |
| `cowork-p2-kit/render/render-docx.mjs` | Rewritten (citation contract, minimal demo) |
| `cowork-p2-kit/render/render-spike.mjs` | Rewritten (OOXML inspection, offline verification) |
| `cowork-p2-kit/render/README.md` | Updated for new contracts |
| `package.json` | `docx` pinned to exact `9.7.1` |
| `plans/.../reports/render-fidelity-spike.md` | Regenerated by spike |

## Remaining / Deferred

- **Negative tests** (isolated temp root for `.md`, missing manifest, non-public label, forced round-trip failure) — per plan validation item 3
- **OCR execution** — reverted per Session 4; `is-complex` subcommand unavailable on repo-local CLI anyway
- **Viewer verification** — spike report notes manual LibreOffice/Word check needed for visual footnote/link/TOC confirmation
- **Phase 4** — unblocked once these gates pass
