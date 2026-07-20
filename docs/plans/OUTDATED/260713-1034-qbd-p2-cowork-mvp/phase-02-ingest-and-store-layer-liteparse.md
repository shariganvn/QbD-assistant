---
phase: 2
title: "Ingest and store layer (liteparse)"
status: in-progress
priority: P1
effort: "1.75d"
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
spike** (Step 6) against one synthetic trial file; if a canonical table can't be rebuilt
deterministically, Layer A stops at text+quote records and table structuring moves to Phase 4.
Ingest **must run `--format json`** (page numbers + `textItems` exist only there; `--format
text` has no page markers, verified). Store = JSON/JSONL under `cowork-p2-kit/store/`. Provenance
is mandatory per record so Layer B can cite (numbered + footnote + link). See `docs/code-standards.md`.

Three contracts this layer pins, because "deterministic" fails without them:

- **Offset basis.** liteparse returns **no char offsets** — `char_start`/`char_end` are computed
  by ingest, and are offsets into **that page's `pages[i].text` string exactly as liteparse
  emitted it** (not the concatenated document, not the `textItem`). Every consumer and the Step-8
  round-trip check re-reads the same page `text` and asserts
  `page.text.slice(char_start, char_end) === quote`.
- **Tool pinning.** Ingest invokes the **repo-local** binary (`node_modules/.bin/lit` via
  `npm run liteparse`), never bare `lit` off `$PATH` — a global `lit` also exists here and the two
  can drift (local dep is `@llamaindex/liteparse@2.5.0`; both CLIs self-report `2.0.0`, so the
  version string cannot distinguish them). Record the resolved binary path + package version in
  the first line of every store run.
- **System deps.** liteparse shells out to **LibreOffice** for the DOCX path and **Ghostscript**;
  both are declared in Phase 1 and asserted before ingest, so a missing runtime fails loudly
  instead of producing a silently short parse.

## Related Code Files

- Create: `cowork-p2-kit/store/ingest.mjs` (or equivalent) — liteparse → records
- Create: `cowork-p2-kit/store/records.schema.json` — record shape (content, table?, provenance
  with char offsets, `confidence`, `{label, citable}`); portable reuse artifact for `qbd_core`.
- Create: `cowork-p2-kit/store/README.md` — how to run ingest, retention note, JSON-schema
  reuse note
- Read for context: `docs/liteparse-scout.md`
- **Ingest input = the generated `.docx` under `cowork-p2-kit/inputs/trials/` + `inputs/reference/`
  only** — never the `inputs/src/*.md` authoring source: **liteparse rejects `.md`** (verified:
  `conversion error: unsupported file format: .md`), and `.md` carries no page/textItem to anchor
  provenance to. Run `npm run inputs:build` (Phase 1) before ingest; a `.md` reaching the ingest
  input dir is a hard error, not a fallback. `docs/raw/*` is NOT an ingest source: `135-00*` is a
  cross-drug contaminated doc (arch forbids it as trusted evidence) and the rest are
  template/guidance. Round-trip verification (Step 8) runs against the synthetic
  `inputs/trials/*.docx`, not `docs/raw/`.

## Implementation Steps

1. Define the record schema: `{ id, source_type, content, table?,
   provenance:{file, page, char_start, char_end, quote, page_kind}, confidence,
   extraction_status, classification:{label, citable} }`. The schema **rejects any
   record missing `page`/offsets** so provenance cannot be silently null. **No `ingested_at`** in
   the record (removed per the remediation patch — run timing lives in a non-contract log so the
   store bytes stay deterministic).
2. **Admission gate (fail-closed, enforced):** assert the system deps (LibreOffice, Ghostscript)
   and the local `lit` binary resolve, then resolve each input file's
   `{label, citable, ocr_language}` from `inputs/classification-manifest.json`; a file absent from
   the manifest ⇒ `internal`. If `label ≠ public`, **abort ingest with a nonzero exit and write
   nothing** — the label is an action, not just a stored string. A manifest entry missing
   `ocr_language` is also fail-closed (abort), never a silent `eng` default. Reject any input
   whose extension liteparse cannot read (`.md` in particular). MVP inputs are all `{public}`.
3. **Complexity pre-scan — detect and flag; OCR execution is DEFERRED.** Run the local
   `lit is-complex <file> --compact` on every input. **`needsOcr:true` does NOT mean "scanned
   page"** — measured on this corpus it fires on clean text pages (see Risk). Never OCR (or flag)
   a page on `needsOcr` alone.

   **Verified `is-complex` contract** (measured, not assumed): stdout is a **JSON array**, one
   object per page, keyed **`pageNumber`** (not `page`), with
   `{needsOcr, reasons[], textLength, textCoverage, fullPageImage, isGarbled, hasSubstantialImages,
   imageBlockCount, pageArea}`. `--target-pages` takes `"1-5,10,15-20"`. Observed `reasons`
   vocabulary on this corpus: `sparse-text`, `vector-text`, `embedded-images`.

   **Flag rule (what makes a record `chờ dữ liệu`):** a page is stamped
   `confidence:"low", extraction_status:"needs-ocr"` **only when it yields no substantial text**
   (`textLength < 50`) — i.e. extraction actually failed. Record the page's `is-complex` `reasons`
   alongside. A page that carries text is **always** extracted normally, whatever `needsOcr` says —
   never discard extractable text.

   **OCR-eligibility marker (for the deferred OCR session, not acted on now):** mark a page
   OCR-eligible when `fullPageImage:true` OR `isGarbled:true` OR `reasons` contains a value outside
   the **verified-benign set `{sparse-text, vector-text}`** (e.g. `embedded-images`, or any unknown
   reason ⇒ mark, fail-loud). Benign-only pages are never OCR-eligible — verified: every page whose
   reasons are only `sparse-text`/`vector-text` carries 732–4867 chars of real text. Record the
   marker in the run log so the later OCR session has its target list.

   **Not executed now:** no `--ocr-language` pass, no `--target-pages` OCR re-parse, no
   `TESSDATA_PREFIX` OCR run. The manifest's `ocr_language` field stays required + fail-closed at
   the admission gate (Session 2 decision, untouched) but is **dormant** until OCR is re-enabled;
   the tessdata egress gate is deferred with it (it cannot fire while no OCR runs).
4. Implement ingest: run the local `lit ... --format json` (never bare `lit`; see Architecture)
   over the admitted inputs; split into records; attach provenance
   `{file, page, char_start, char_end, quote}` from the JSON `pages[]`/`textItems`. Treat
   extracted `content`/`quote` as **delimited untrusted data** (Layer B must never execute
   instructions inside it); note this in `store/README.md`.
5. Precise anchoring: compute `char_start`/`char_end` against the page's `pages[i].text` string
   (the pinned offset basis — liteparse emits no offsets of its own) and **reject a non-unique
   quote that lacks a disambiguating offset**, so round-trip cannot land on the wrong occurrence
   of a repeated phrase ("5 mg", "Complies"). For DOCX, mark `page_kind:"renderer-derived"` and
   prefer a stable locator (heading path + quote span); reserve exact `page_kind:"pdf"` numbers
   for PDFs.
6. Table handling: run the **reconstruction spike** on one synthetic trial file — rebuild the
   formulation×attribute grid by clustering `textItems` on x (columns) and y (rows). Evidence
   this is tractable: on a Phase-1-generated trial `.docx`, liteparse returned **one `textItem`
   per cell with a stable x per column and a stable y per row** (3×3 grid resolved cleanly), and
   the source `.docx` carries a genuine `<w:tbl>`. The spike still gates — real trial files have
   merged/wrapped cells the toy case lacks. If deterministic reconstruction works, emit the
   canonical `table` the Phase-4 matrix consumes; if not, restrict Layer A to text+quote records
   and hand raw table text to Phase 4 (record the decision in `store/README.md`).
7. Retention: write records to `store/`; `store/**` is git-ignored (Phase 1); honor the
   MVP-default retention (keep for project duration, configurable) — flag P0.5 in `store/README.md`.
   Use relative/sanitized `provenance.file`, never absolute internal paths.
8. Verify against the synthetic `inputs/trials/*.docx` that every record round-trips: re-parse the
   source with the same pinned command and assert
   `pages[record.provenance.page].text.slice(char_start, char_end) === record.provenance.quote`
   for every record — and that the store is **non-empty** post-ingest (a silent total-drop from
   the admission gate must fail the check, not pass with an empty store).

## Success Criteria

- [ ] Ingest runs the **repo-local** `lit` with `--format json` over `.docx` inputs and produces
      store records with full provenance `{file, page, char_start, char_end, quote}`; schema
      rejects null-page records; the run log records the resolved binary path + package version.
- [ ] Round-trip asserted mechanically: `page.text.slice(char_start, char_end) === quote` holds
      for **every** record (offsets are page-`text`-based).
- [ ] Admission gate enforced: a non-`public` input, a manifest entry missing `ocr_language`, or a
      liteparse-unreadable input (e.g. `.md`) each abort ingest (nonzero exit, nothing written);
      store is verified **non-empty** after a valid mock run.
- [ ] Comparison tables reconstructed to the canonical matrix shape via x/y `textItem` clustering
      — OR the spike's fallback decision (text+quote only, table structuring deferred to Phase 4)
      is recorded.
- [ ] `lit is-complex --compact` pre-scan wired against the **verified** contract (JSON array,
      `pageNumber` key). A page becomes a `confidence:"low"`/`needs-ocr` record **only when
      `textLength < 50`** (extraction actually failed); pages carrying text are always extracted,
      never discarded on a `needsOcr` flag. OCR-eligibility (non-benign reason /
      `fullPageImage` / `isGarbled`) is **recorded in the run log only** — not executed.
- [ ] No OCR is executed (reverted; see Validation Session 4). No `--ocr-language` re-parse, no
      `TESSDATA_PREFIX` OCR run. `ocr_language` stays required/fail-closed at the gate but dormant.
      The ingest zero-egress OCR gate is **deferred with OCR** to the follow-up session.
- [ ] No office binary is read into model context (liteparse path only); `docs/raw/*` (incl.
      `135-00`) is excluded from ingest.
- [ ] Every record carries `{label, citable}`; unlabeled ⇒ internal; extracted text is stored as
      delimited untrusted data.
- [ ] `store/README.md` documents run steps, `--format json`, retention default (P0.5), the
      JSON-schema reuse note, and the table-spike outcome.

## Risk Assessment

- **CORRECTED — `needsOcr` is a complexity heuristic, not a scan detector (re-measured 260716):**
  the earlier claim *"41/107 QbD-ref pages need OCR; `--no-ocr` would drop them silently"* read the
  number right and its meaning wrong. Full 107-page re-scan: 41 `needsOcr:true` — but
  **`fullPageImage:true` on 0/107**, **`isGarbled:true` on 0/107**, **0/107 pages with
  `textLength < 50`**, **min `textLength` = 806**. The 41 flags are `vector-text` (23),
  `sparse-text` (16), `embedded-images` (2). **Nothing would be dropped by `--no-ocr`** — every page
  yields text. The synthetic trial `.docx` are likewise flagged **2/2 `needsOcr:true`
  (`sparse-text`, 732/914 chars)** despite being clean born-digital text, so the old note *"trials
  are born-digital and need no OCR"* was also wrong about the flag (right about the text). Acting on
  `needsOcr` verbatim would have OCR'd every clean page and replaced good text with Tesseract
  output. Hence the Step-3 split: flag on **text absence**, mark OCR-eligibility on **non-benign
  reasons only**.
- **No scanned document exists in this corpus:** 0/107 ANDAs pages and 0/2 trial pages lack
  extractable text, so no available file can exercise a real OCR-recovery path. Proving OCR would
  require a synthetic rasterized fixture — **dropped by user decision** (Validation Session 4);
  OCR execution + its proof are deferred to a dedicated follow-up session.
- **OCR model resolution is an egress risk (verified, DEFERRED):** `TESSDATA_PREFIX` is unset by
  default and the bundled Tesseract 5.3.4 embeds a `tessdata_best` GitHub raw URL — an unpinned OCR
  run can reach the network while parsing a confidential dossier. Real, but **cannot fire while no
  OCR executes**; this gate returns with OCR in the follow-up session.
- **OCR language is not inferable (dormant):** `--ocr-language` defaults to `eng`; VN pages OCR'd as
  `eng` yield plausible garbage that still passes a non-empty check. `ocr_language` therefore stays
  a required, fail-closed manifest field (Session 2 decision, untouched) even though no OCR consumes
  it yet.
- **Toolchain drift (verified):** a global `lit` (`~/.npm-global/bin/lit`) and the repo-local
  `@llamaindex/liteparse@2.5.0` both resolve, and **both self-report CLI version `2.0.0`** — the
  version string cannot tell them apart. A "deterministic" layer that invokes bare `lit` is at the
  mercy of `$PATH`; Step 4 pins the local binary and logs its resolved path.
- **Undeclared system deps:** liteparse's DOCX path shells out to LibreOffice (and Ghostscript for
  some conversions). Both verified present and now declared in Phase 1; ingest asserts them at the
  gate so absence fails loudly instead of yielding a short parse.
- **liteparse has no table objects (verified):** table structuring is spike-gated (Step 6); do
  not assume the tool hands back a grid.
- **DOCX page provenance is renderer-derived:** liteparse repaginates DOCX to its own A4 layout,
  which need not match the FD's Word view; hence `page_kind` + stable-locator anchoring (Step 5).
- **Reuse contract = JSON schema only:** `qbd_core` is Python and not yet built; export a
  documented record schema it can target later — do not pre-generalize the `.mjs` code for it.

> Red Team (260713): absorbed fixes for liteparse-no-tables, enforced admission gate, `--format
> json` page provenance, char-offset anchoring, OCR detection, untrusted-data tagging, DOCX page
> semantics, and the qbd_core reuse downgrade. See `plan.md` → Red Team Review.

<!-- Updated: Validation Session 1 - OCR upgraded from detect-and-flag to ACTUAL execution (default-on, scoped via --target-pages); confidence:low reserved for pages still empty AFTER OCR. -->
<!-- Updated: Validation Session 2 - ingest input is .docx (liteparse rejects .md, verified). Pinned three previously-ambiguous contracts: offset basis = page-level pages[i].text; tool = repo-local lit (global/local both report 2.0.0); system deps asserted at the gate. OCR gains required --ocr-language from manifest + TESSDATA_PREFIX pin + zero-egress gate. Table spike keeps its gate but now carries per-cell x/y textItem evidence. Effort 1.5d -> 1.75d. -->

## Code Review Remediation Patch — 2026-07-16

**Why re-opened:** current happy-path ingest creates 17 records, but it neither executes the
planned OCR route nor rejects unsupported files that sit beside valid `.docx` inputs. It also uses
random IDs and wall-clock timestamps, so unchanged input produces different JSONL bytes.

### Patch scope

- **Preflight before any write:** enumerate every regular file in the admitted trial/reference
  roots (not only `.docx`). Reject unsupported extensions, missing manifest entries, non-public
  labels, invalid `citable`/`ocr_language`, and duplicate normalized paths. The preflight must
  finish before creating/replacing `records.jsonl`.
- **OCR detection only — execution reverted (Validation Session 4):** run the repo-local
  `lit is-complex <file> --compact` and parse its **JSON array** (`pageNumber` key). **Do not act on
  `needsOcr` verbatim** — measured, it fires on clean text pages (2/2 trial pages; 41/107 ANDAs
  pages, all with 806+ chars). Emit `needs-ocr`/low confidence **only for a page with
  `textLength < 50`** (extraction genuinely failed); always extract a page that carries text.
  Record each page's `reasons` plus an **OCR-eligibility marker** (`fullPageImage` OR `isGarbled` OR
  a reason outside the verified-benign `{sparse-text, vector-text}`) in the run log as the target
  list for the deferred OCR session. **No OCR re-parse, no `--ocr-language`, no `TESSDATA_PREFIX`
  run, no OCR server URL.** Its exit-code behaviour (`1` when `needsOcr` pages exist) is **still
  unverified** — if the implementation reads that exit code, verify it first rather than assume.
- **Deterministic store contract:** derive `id` from a stable hash of relative file path, page,
  offsets, and quote. **Remove `ingested_at` entirely** — from the record AND from
  `records.schema.json` (`required` + `properties`); run timing moves to a non-contract run log, and
  the determinism gate hashes the raw JSONL line directly. Update `store/README.md` alongside. Sort
  files and records by stable keys.
- **Atomic publication:** write records to a temporary sibling file, validate every record against
  the JSON schema, re-parse and round-trip all non-empty records, assert a non-empty store, then
  atomically replace `records.jsonl`. Any failure leaves the prior store untouched.

### Required validation

1. Positive: rebuild inputs; ingest returns zero; every record validates and round-trips.
2. Determinism: two clean runs against identical generated inputs have identical JSONL hashes.
3. Negative, isolated from canonical fixtures: unsupported `.md`, absent manifest entry,
   non-public label, invalid/missing `ocr_language`, and a forced round-trip failure each exit
   nonzero and leave the previously published store byte-identical.
4. OCR detection (execution + its fixture **dropped** — Validation Session 4): assert that the three
   canonical trial `.docx` — all `needsOcr:true`, `reasons:["sparse-text"]`, 732/914 chars — are
   **extracted in full and produce ZERO `needs-ocr` records**. This is the regression that matters:
   it proves ingest no longer treats a complexity flag as a scan and cannot silently swap clean text
   for OCR output. Also assert the run log records each page's `reasons` + OCR-eligibility marker.
   No OCR is invoked, so no OCR fixture and no ingest egress evidence are required in this patch.

<!-- Updated: Validation Session 3 - ingested_at removed from record + schema required/properties, determinism hashes the raw JSONL line. (Session 3's ANDAs OCR fixture is SUPERSEDED by Session 4.) -->
<!-- Updated: Validation Session 4 - needsOcr re-measured: it is a complexity heuristic, NOT a scan detector (ANDAs 41/107 needsOcr but 0/107 fullPageImage, 0/107 isGarbled, 0/107 textLength<50, min 806 chars; trials 2/2 needsOcr on clean 732/914-char text). OCR EXECUTION REVERTED to detect-and-flag at user instruction (reverses their Session 1 override); OCR fixture dropped; execution + --ocr-language + TESSDATA_PREFIX + ingest zero-egress gate deferred to a follow-up session. Flag now keys on textLength<50 (real text absence), never on needsOcr; reason-allowlist only records OCR-eligibility in the run log. is-complex contract pinned: JSON array, pageNumber key, --target-pages "1-5,10,15-20". ocr_language stays required/fail-closed (Session 2, untouched) but dormant. -->
