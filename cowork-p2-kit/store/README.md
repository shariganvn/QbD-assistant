# Store — Layer A Ingest Output

## How to Run

```bash
# Prerequisites: .docx inputs must exist (run inputs:build first)
npm run inputs:build

# Run ingest
npm run ingest
```

## What It Does

1. **Admission gate** — verifies system deps (LibreOffice, Ghostscript, tessdata, repo-local `lit`), reads `classification-manifest.json`, rejects unlabeled/non-public/unreadable files.
2. **Preflight** — enumerates ALL files in input dirs; rejects unsupported extensions (`.md` in particular) before any write.
3. **Extract** — runs `lit parse --format json` on each admitted `.docx`, splits into per-segment records with provenance `{file, page, char_start, char_end, quote}`.
4. **OCR detection** — runs `lit is-complex --compact` to detect OCR-eligible pages. **No OCR is executed** (deferred). The modular pipeline reports this optional capability as `available`, `unsupported` (`E_CAPABILITY_UNSUPPORTED`), or `invalid` (`E_CAPABILITY_INVALID`); failed output never masquerades as an empty successful scan. Flag rule: `confidence:"low"`/`needs-ocr` ONLY when `textLength < 50` (extraction genuinely failed).
5. **Table spike** — attempts to reconstruct formulation×attribute tables by clustering `textItems` on x/y axes. If successful, records carry a `table` field; otherwise text-only.
6. **Round-trip verification** — re-parses each source file and asserts `page.text.slice(char_start, char_end) === quote` for every record.
7. **Atomic publication** — writes to temp file, validates against schema, round-trip verifies, then atomically replaces `records.jsonl`.

## Record Schema

See `records.schema.json` for the full JSON Schema. Key fields:

- `id` — deterministic hash of `file:page:char_start:quote` (stable across runs)
- `content` — extracted text (delimited untrusted data)
- `table` — reconstructed grid `{headers, rows}` or null
- `provenance` — mandatory anchor with char offsets into `pages[i].text`
- `classification` — `{label, citable}` from the manifest
- `confidence` — `high` (normal) or `low` (needs OCR)
- `extraction_status` — `ok` or `needs-ocr`

**No `ingested_at` field** — run timing lives in `run-log.json` (non-contract) so store bytes stay deterministic.

## Offset Basis

`char_start`/`char_end` are offsets into **that page's `pages[i].text` string exactly as liteparse emitted it** — not the concatenated document, not the `textItem`. The round-trip check verifies this mechanically.

## Tool Pinning

Ingest uses the **repo-local** `lit` binary (`node_modules/.bin/lit`), never bare `lit` off `$PATH`. The run log records the resolved binary path + package version.

## OCR Detection (Execution Deferred)

- `is-complex` pre-scan determines which pages are OCR-eligible.
- **`needsOcr:true` does NOT mean "scanned page"** — measured on this corpus it fires on clean text pages (verified: 41/107 ANDAs pages, all with 806+ chars).
- Flag rule: `confidence:"low"`/`needs-ocr` ONLY when `textLength < 50` (extraction genuinely failed).
- OCR-eligibility marker: `fullPageImage` OR `isGarbled` OR reason outside `{sparse-text, vector-text}`.
- **No OCR is executed** — no `--ocr-language` re-parse, no `TESSDATA_PREFIX` run.
- `ocr_language` stays required/fail-closed at the gate (dormant until OCR returns).

## Table Reconstruction Spike — Outcome

**Result: partial success; table structuring deferred to Phase 4.**

The spike attempted to rebuild formulation×attribute grids by clustering `textItems` on x (columns) and y (rows). On the synthetic trial `.docx` files, liteparse returned one `textItem` per cell with stable y-per-row, but x-alignment across columns is inconsistent (LibreOffice's markdown→DOCX conversion doesn't always produce evenly-spaced column x-positions). Records carry a `table` field when a cluster is detected, but column count is unreliable.

**Decision:** Layer A's primary output is **text+quote records with full provenance**. Phase 4's decision matrix rebuilds the grid from raw table `content` text if the `table` field is insufficient. The `table` field is retained as a best-effort hint — consumers should not rely on it for column-level accuracy.

## Determinism

Two clean runs against identical generated inputs produce **byte-identical JSONL**. The determinism gate hashes the raw JSONL line directly. IDs are deterministic (SHA-256 hash of `file:page:char_start:quote`).

## Retention

`store/` is kept for project duration (configurable; P0.5 tracked risk). Git-ignored to prevent committing extracted content. Use relative/sanitized `provenance.file`, never absolute paths.

## Reuse by qbd_core

The **JSON record schema** (`records.schema.json`) is the portable reuse artifact. `qbd_core` (Python) targets this schema — code reuse of the `.mjs` ingest is out of scope (cross-language).

## Notes

- `docs/raw/*` (including `135-00`) is NOT an ingest source — it's contaminated/cross-drug.
- Extracted text is treated as **delimited untrusted data** — Layer B must never execute instructions inside it.
