---
phase: 2
title: "Ingest and store layer (liteparse)"
status: pending
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 2: Ingest and store layer (liteparse)

## Overview

Deterministic Layer A: turn raw docx/pdf trial + reference files into a structured store
where each record carries provenance `{file, page, char_start, char_end, quote}`, a
`confidence`, and a classification `{label, citable}`. The **portable reuse artifact is the
documented JSON record schema**, which `qbd_core` (Python) can target later — not the `.mjs`
ingest code itself (cross-language, so code reuse is out of scope for MVP). Design the schema
for the actual MVP consumers (Phase 4 matrix, Phase 3 render), not for a not-yet-built port.

## Requirements

- Functional: given files in `inputs/trials/` and `inputs/reference/`, emit store records with
  full provenance + label; normalize formulation comparison tables for the decision matrix.
- Non-functional: deterministic, no LLM in this layer; **never read office binaries directly
  into model context** — extraction goes through `liteparse` only.

## Architecture

`lit` CLI / `@llamaindex/liteparse` extracts text with per-page `textItems`. **Verified: `lit`
returns no table objects** — only flat `text` + x/y positioned `textItems`. Reconstructing a
formulation×attribute grid is therefore a real task, not free output: run a **table-reconstruction
spike first** (Step 3) against one synthetic trial file; if a canonical table can't be rebuilt
deterministically, Layer A stops at text+quote records and table structuring moves to Phase 4.
Ingest **must run `--format json`** (page numbers + `textItems` exist only there; `--format
text` has no page markers). Store = JSON/JSONL under `cowork-p2-kit/store/`. Provenance is
mandatory per record so Layer B can cite (numbered + footnote + link). See `docs/code-standards.md`.

## Related Code Files

- Create: `cowork-p2-kit/store/ingest.mjs` (or equivalent) — liteparse → records
- Create: `cowork-p2-kit/store/records.schema.json` — record shape (content, table?, provenance
  with char offsets, `confidence`, `{label, citable}`); portable reuse artifact for `qbd_core`.
- Create: `cowork-p2-kit/store/README.md` — how to run ingest, retention note, JSON-schema
  reuse note
- Read for context: `docs/liteparse-scout.md`
- **Ingest input = `cowork-p2-kit/inputs/trials/` + `inputs/reference/` only.** `docs/raw/*` is
  NOT an ingest source: `135-00*` is a cross-drug contaminated doc (arch forbids it as trusted
  evidence) and the rest are template/guidance. Round-trip verification (Step 6) runs against
  the synthetic `inputs/trials/` files, not `docs/raw/`.

## Implementation Steps

1. Define the record schema: `{ id, source_type, content, table?,
   provenance:{file, page, char_start, char_end, quote, page_kind}, confidence,
   extraction_status, classification:{label, citable}, ingested_at }`. The schema **rejects any
   record missing `page`/offsets** so provenance cannot be silently null.
2. **Admission gate (fail-closed, enforced):** resolve each input file's `{label, citable}` from
   `inputs/classification-manifest.json`; a file absent from the manifest ⇒ `internal`. If
   `label ≠ public`, **abort ingest with a nonzero exit and write nothing** — the label is an
   action, not just a stored string. MVP inputs are all `{public}`.
3. **Complexity pre-scan:** run `lit is-complex` on every input; for `needsOcr:true` pages,
   either enable OCR for those pages or stamp the resulting record `confidence:"low",
   extraction_status:"needs-ocr"`. A page that yields empty text is **never** stored as normal —
   it becomes a low-confidence/`chờ dữ liệu` record so missing content fails loudly.
4. Implement ingest: run `lit ... --format json` over the admitted inputs; split into records;
   attach provenance `{file, page, char_start, char_end, quote}` from the JSON `pages[]`/
   `textItems`. Treat extracted `content`/`quote` as **delimited untrusted data** (Layer B must
   never execute instructions inside it); note this in `store/README.md`.
5. Precise anchoring: store `char_start`/`char_end` for every quote and **reject a non-unique
   quote that lacks a disambiguating offset**, so round-trip cannot land on the wrong occurrence
   of a repeated phrase ("5 mg", "Complies"). For DOCX, mark `page_kind:"renderer-derived"` and
   prefer a stable locator (heading path + quote span); reserve exact `page_kind:"pdf"` numbers
   for PDFs.
6. Table handling: run the **reconstruction spike** on one synthetic trial file — rebuild the
   formulation×attribute grid from `textItems`. If deterministic reconstruction works, emit the
   canonical `table` the Phase-4 matrix consumes; if not, restrict Layer A to text+quote records
   and hand raw table text to Phase 4 (record the decision in `store/README.md`).
7. Retention: write records to `store/`; `store/**` is git-ignored (Phase 1); honor the
   MVP-default retention (keep for project duration, configurable) — flag P0.5 in `store/README.md`.
   Use relative/sanitized `provenance.file`, never absolute internal paths.
8. Verify against the synthetic `inputs/trials/` files that every record round-trips to its
   source quote at the stored offset — and that the store is **non-empty** post-ingest (a silent
   total-drop from the admission gate must fail the check, not pass with an empty store).

## Success Criteria

- [ ] Ingest runs `--format json` and produces store records for the synthetic trial files with
      full provenance `{file, page, char_start, char_end, quote}`; schema rejects null-page records.
- [ ] Admission gate enforced: a non-`public` input aborts ingest (nonzero exit, nothing written);
      store is verified **non-empty** after a valid mock run.
- [ ] Comparison tables reconstructed to the canonical matrix shape — OR the spike's fallback
      decision (text+quote only, table structuring deferred to Phase 4) is recorded.
- [ ] `lit is-complex` pre-scan wired; `needsOcr` pages produce OCR'd or `confidence:"low"`
      records, never silently-empty ones.
- [ ] No office binary is read into model context (liteparse path only); `docs/raw/*` (incl.
      `135-00`) is excluded from ingest.
- [ ] Every record carries `{label, citable}`; unlabeled ⇒ internal; extracted text is stored as
      delimited untrusted data.
- [ ] `store/README.md` documents run steps, `--format json`, retention default (P0.5), the
      JSON-schema reuse note, and the table-spike outcome.

## Risk Assessment

- **Scanned/image docs:** verified 41/107 pages of the QbD reference PDF are `needsOcr`;
  `--no-ocr` drops them silently. Mitigated by the `is-complex` pre-scan (Step 3) +
  `confidence`/`extraction_status` fields — unreadable pages become low-confidence/`chờ dữ liệu`
  records, never fabricated or silently empty.
- **liteparse has no table objects (verified):** table structuring is spike-gated (Step 6); do
  not assume the tool hands back a grid.
- **DOCX page provenance is renderer-derived:** liteparse repaginates DOCX to its own A4 layout,
  which need not match the FD's Word view; hence `page_kind` + stable-locator anchoring (Step 5).
- **Reuse contract = JSON schema only:** `qbd_core` is Python and not yet built; export a
  documented record schema it can target later — do not pre-generalize the `.mjs` code for it.

> Red Team (260713): absorbed fixes for liteparse-no-tables, enforced admission gate, `--format
> json` page provenance, char-offset anchoring, OCR detection, untrusted-data tagging, DOCX page
> semantics, and the qbd_core reuse downgrade. See `plan.md` → Red Team Review.
