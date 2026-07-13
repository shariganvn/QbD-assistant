# Red-Team Plan Review — Failure Mode Analyst (Murphy's Law lens)

**Reviewer role:** code-reviewer (hostile) · Fact Checker + Contract Verifier (Standard tier)
**Scope:** Phases 1–3 only of `plans/260713-1034-qbd-p2-cowork-mvp/`
**Date:** 2026-07-13
**Verdict:** REQUEST CHANGES — 2 Critical, 3 High, 1 Medium. The provenance contract is not enforceable via the documented ingest recipe, and the classification/admission interaction can silently either drop all inputs or leak internal-labeled content to the cloud model.

Codebase facts verified before review:
- `cowork-p2-kit/` does NOT exist (`ls` → no such directory). VERIFIED.
- `package.json` scripts = `{"liteparse":"lit","docs:check":"node scripts/check-docs-state.mjs"}`. VERIFIED (package.json:9-12).
- `dotnet` NOT installed → `dotnet: command not found`. VERIFIED.
- QbD PDF: 107 pages, **41 flag `needsOcr:true`** via `lit is-complex`. VERIFIED.
- `lit parse --format text` emits **0 form-feed / 0 page markers**; `--format json` carries per-page `page` field + `textItems` bbox. VERIFIED empirically.

---

## Finding 1: Fail-closed `unlabeled ⇒ internal` + public-only admission has no label-assignment mechanism → silent total drop OR silent egress leak

- **Severity:** Critical
- **Location:** Phase 1, "Implementation Steps" step 2; Phase 2, "Implementation Steps" step 4
- **Flaw:** The plan states two rules that only reconcile if a per-file labeling mechanism exists — and none is defined. Phase 1 step 2 (phase-01:44-46): labels `public/internal/internal-derived`, "unlabeled ⇒ internal (fail-closed); MVP admits `public`/mock only." Phase 2 step 4 (phase-02:46-48): "Apply classification per file from Phase 1 convention; default `internal` if unlabeled." But mock trial/reference files dropped into `inputs/trials/` and `inputs/reference/` are just raw `.docx`/`.pdf` — they carry no intrinsic `public` label. Phase 1 only defines what the labels *mean* and a JSON *shape*; it never defines *where a file declares its label* (sidecar manifest, frontmatter, folder convention). The assertion "MVP inputs are all public/mock" (phase-02:48) is a claim, not a mechanism.
- **Failure scenario:** End-to-end mock run. Every input file is unlabeled at rest → fail-closed default = `internal`. Then one of two silent bad outcomes, and the plan does not say which:
  (a) If Layer-A classification is the admission check as `system-architecture.md:52-54` states ("the classification step in Layer A is the admission check"), all `internal`-defaulted records are non-admitted → the store is empty → the P.2 draft is 100% "chờ dữ liệu" → Phase 1 acceptance "end-to-end mock run emits outputs/{p2-draft.docx…}" (plan.md:59) technically produces a file but it is vacuous, and the failure is silent (no error).
  (b) If ingest does NOT drop (egress router is "designed + documented only" in MVP per system-architecture.md:53), the `internal`-labeled mock records flow onward to Claude Cowork — the cloud track that must receive **public only** (system-architecture.md:73, code-standards.md:46 "Never send internal-labeled content to a non-cleared provider"). That is a silent egress-invariant violation.
- **Evidence:** phase-01-foundation-docs-scaffold-data-classification.md:44-46; phase-02-ingest-and-store-layer-liteparse.md:46-48; docs/system-architecture.md:52-54,73; docs/code-standards.md:46; plan.md:59
- **Suggested fix:** Define the label-assignment mechanism explicitly in Phase 1 (e.g., a `inputs/<folder>/manifest.json` or per-file `.label` sidecar, or a documented rule "everything under `inputs/` is `public` for MVP"). If you adopt a blanket "inputs = public" rule, state it and note it *overrides* fail-closed for the MVP input tree, so the two rules stop contradicting. Add an acceptance check that the store is non-empty after ingest and that record count > 0, so a silent total-drop fails loudly.

---

## Finding 2: Provenance `{file, page, quote}` is unenforceable via the documented ingest recipe — `--format text` emits no page numbers, and the plan never specifies `--format json`

- **Severity:** High
- **Location:** Phase 2, "Implementation Steps" step 2 ("attach provenance from liteparse output (file + page)")
- **Flaw:** The provenance contract requires a per-record `page` (phase-02:15,40; system-architecture.md:34). The only documented liteparse workflow (`docs/liteparse-scout.md:17,25`) is `lit parse … --format text --no-ocr -o /tmp/doc.txt` → a flat text blob. I verified this blob contains **zero page delimiters** (0 form-feed bytes, no "Page N" lines) on the QbD PDF. Page numbers are only available in `--format json` (per-page `page` field + `textItems`). Neither Phase 2 nor the scout doc specifies JSON. So an implementer following the documented recipe literally cannot populate `provenance.page`, and the "every claim sourced (numbered + footnote + clickable link)" acceptance criterion (plan.md:60) is not satisfiable as written.
- **Failure scenario:** Implementer follows the scout doc, parses to text, splits into records, and has no page field — either leaves `page` null (breaks the schema and downstream footnote/link rendering in Phase 3) or back-fills a guessed page, which is fabricated provenance in a regulatory dossier (violates ALCOA+ Attributable, glossary.md:15-18).
- **Evidence:** phase-02-ingest-and-store-layer-liteparse.md:40; docs/liteparse-scout.md:17,25; plan.md:60. Empirically verified: `--format text` on QbD PDF pages 1-3 → 9669 bytes, 0 form-feeds, 0 "Page" lines; `--format json` → per-page `page` int present.
- **Suggested fix:** Pin `--format json` in Phase 2 step 2 and in `docs/liteparse-scout.md`, and map each record's `provenance.page` from the JSON `pages[].page`. Add a schema-level `NOT NULL` on `provenance.page` and reject records without it.

---

## Finding 3: Quote-only provenance anchoring + repeated phrases → round-trip silently attaches the WRONG page/quote and still passes the "sourced" gate

- **Severity:** High
- **Location:** Phase 2, "Implementation Steps" step 6 ("Verify … every record round-trips to its source quote/page")
- **Flaw:** The record shape is `provenance:{file,page,quote}` (phase-02:40) with no character offset or block ID anchoring the quote to a location. Round-trip verification (phase-02:50) re-finds the quote string. Formulation comparison tables (the exact data Phase 2 step 3 normalizes) are full of repeated short tokens — "5 mg", "Magnesium stearate", "Loss on drying", "Complies". A quote string that occurs on multiple pages round-trips to the *first* match, not the true source page. The check passes (the quote *is* found somewhere) while the page is wrong.
- **Failure scenario:** A P.2.2 claim like "Formulation B showed 98.7% dissolution at 30 min" cites page 40, but the same phrase/number also appears in a summary table on page 12; the store anchored it to page 12. The rendered draft shows a clickable footnote to the wrong page. The FD reviewer clicks, lands on the wrong table, and either rejects the whole draft's credibility or — worse — approves it because the number happens to look right. Silent corruption of an audit-relevant citation; passes plan.md:60 "every claim sourced."
- **Evidence:** phase-02-ingest-and-store-layer-liteparse.md:40,50; plan.md:60; docs/system-architecture.md:64 (citations = numbered + footnote + clickable link)
- **Suggested fix:** Anchor provenance to a stable location, not just a string: store `{file, page, char_start, char_end}` (JSON `textItems` bbox / text offsets support this) or a per-page block index, and make round-trip verify the quote at that exact offset. Fail the ingest record if the quote is non-unique on its claimed page without a disambiguating offset.

---

## Finding 4: 41/107 pages of the primary QbD reference need OCR, but ingest uses `--no-ocr` and never runs `is-complex` — the "mark low-confidence" mitigation has no detection wiring

- **Severity:** High
- **Location:** Phase 2, "Risk Assessment" bullet 1 ("old scans may be unreadable; ingest must mark such records low-confidence, not fabricate")
- **Flaw:** The mitigation assumes degraded pages are detectable at ingest, but the ingest path as documented cannot detect them. `lit is-complex` on `docs/raw/Quality-by-Design-for-ANDAs.pdf` (the QbD method reference, glossary.md:9-10) flags **41 of 107 pages `needsOcr:true`** — 38%, not a rare "old scan." The documented parse recipe uses `--no-ocr` (liteparse-scout.md:17,25), which silently omits image-embedded text on those pages and returns partial text with *no in-band signal* that it is incomplete. Phase 2's ingest steps (phase-02:40-44) never call `is-complex`, so nothing surfaces the `needsOcr` flag to "mark low-confidence." The mitigation is unimplementable as written.
- **Failure scenario:** A QbD figure/table on page 40 (needsOcr) contains the design-space rationale. `--no-ocr` extracts only the surrounding caption. Ingest stores the caption as a normal high-confidence record; the reasoning layer treats the partial extraction as complete and drafts a claim from it, or the true content is silently missing and the claim is never made — either way, no "low-confidence" flag was ever attached because detection was never wired.
- **Evidence:** phase-02-ingest-and-store-layer-liteparse.md:40-44,63; docs/liteparse-scout.md:17,25; docs/glossary.md:9-10. Verified: `lit is-complex` → needsOcr pages [15,17,19,20,23,29,31,38,40,41,42,46,48,51,52,55,56,58,62,63,64,65,68,69,70,72,74,76,77,78,80,81,82,83,85,87,89,90,96,98,103] (41 pages).
- **Suggested fix:** Run `lit is-complex` as a mandatory pre-step in ingest; for any `needsOcr:true` page, either enable OCR (`--ocr-server-url`/drop `--no-ocr`) or stamp the resulting records `confidence:"low"` in the schema. Add an acceptance check that no record from a `needsOcr` page is stored without a low-confidence flag.

---

## Finding 5: OfficeCLI fidelity spike gates the critical path but names no fallback, no timebox, no fidelity threshold — and the required .NET runtime is not installed

- **Severity:** High
- **Location:** Phase 3, "Implementation Steps" step 2 + "Success Criteria" + "Risk Assessment"
- **Flaw:** Phase 3 is the gate for the output-format lock that Phase 4 render target depends on (plan.md:52). Its escape hatch is undefined on every axis: (a) fallback renderer is only "evaluate a fallback renderer" (phase-03:42) / "OfficeCLI or documented fallback" (phase-03:51) — no candidate is ever named (grep confirms no pandoc/libreoffice/docx-templates/python-docx anywhere in the plan). (b) No timebox on the spike (grep: no timebox/deadline/hours). (c) No fidelity acceptance threshold — is partial pass (e.g., footnotes + tables OK, TOC broken) go or no-go? Undefined. (d) Toolchain: OfficeCLI is C#/.NET (phase-03:59-60, glossary.md:41) and **`dotnet` is not installed** in this environment — the spike fails at step 1 before any fidelity is measured.
- **Failure scenario:** Dev starts the spike, hits `dotnet: command not found`, spends unbounded time provisioning .NET; or OfficeCLI runs but TOC round-trip fails. With no named fallback and no timebox, Phase 3 stalls the critical path (Phases 4-6 all sit behind the format lock). If a fallback is chosen ad hoc under pressure and it can't do clickable footnote links, the citation contract (system-architecture.md:64) silently degrades and plan.md:60 ("clickable link") fails at acceptance.
- **Evidence:** plan.md:52; phase-03-render-spike-and-layer-officecli.md:41-42,51,59-60; docs/system-architecture.md:64; docs/glossary.md:41. Verified: `dotnet` not found; no fallback/timebox strings in the phase.
- **Suggested fix:** Name a concrete fallback renderer and its known limits (e.g., LibreOffice headless / a docx library) before starting. Add a timebox (e.g., 0.5d) and an explicit fidelity rubric: which of footnotes/hyperlinks/TOC/tables are must-pass vs nice-to-have. Add a Phase-3 pre-req task "verify .NET runtime available or document install steps in render/README.md" so the toolchain gap surfaces before the spike, not during it.

---

## Finding 6: Phase 2 and Phase 3 declared "can run in parallel" with no file-ownership declaration; both need `package.json` script wiring (shared-config lost-update)

- **Severity:** Medium
- **Location:** plan.md, "Dependencies" ("Phase 2 and Phase 3 both depend only on Phase 1 (scaffold) → can run in parallel")
- **Flaw:** The repo's own orchestration protocol requires clear file ownership and forbids parallel edits to shared config (`.claude/rules/orchestration-protocol.md`). The plan asserts parallelism (plan.md:51) but declares no ownership globs. The subfolders differ (`store/` vs `render/`), so those don't collide — but both layers are specified as CLI-runnable (`ingest.mjs` phase-02:33; render "runnable from CLI in the kit workflow" phase-03:22) and the repo wires runnable tools through `package.json` scripts (currently only `liteparse`/`docs:check`, package.json:9-12). Two parallel agents each adding a script to the same `scripts` block is a lost-update/merge hazard on a single shared file. Additionally, Phase 1 scaffolds `store/.gitkeep` and `outputs/.gitkeep` but not `render/` (phase-01:36), so Phase 3 must create `render/` itself — fine, but it means "start from Phase 1 scaffold" is not literally true for Phase 3.
- **Failure scenario:** Two teammates run Phases 2 and 3 concurrently, both edit `package.json` scripts, second write clobbers the first's script entry; the missing script isn't noticed until the end-to-end run, where one layer is silently unrunnable.
- **Evidence:** plan.md:51; phase-02-ingest-and-store-layer-liteparse.md:33; phase-03-render-spike-and-layer-officecli.md:22; package.json:9-12; .claude/rules/orchestration-protocol.md (file-ownership requirement)
- **Suggested fix:** Add explicit file-ownership globs to Phases 2 and 3 (`cowork-p2-kit/store/**` vs `cowork-p2-kit/render/**`). Decide up front who owns `package.json` script additions — either the lead adds both script entries during Phase 1 scaffold, or serialize the two `package.json` edits. State that `render/` is created by Phase 3, not Phase 1.

---

## Verification summary

| Claim in plan | Status |
|---|---|
| liteparse emits `{file, page}` provenance | UNVERIFIED via documented recipe — `--format text` has no page markers; only `--format json` does (plan/scout doc don't specify JSON) |
| Provenance `{file,page,quote}` contract enforceable | FAILED as specified — quote-only anchoring is non-unique; no offset (Finding 3) |
| "every claim sourced or 'chờ dữ liệu'" acceptance | AT RISK — silent-drop/leak (F1), null page (F2), wrong-page (F3) all pass this gate while broken |
| Phase 2/3 no file-ownership overlap | Partially true — distinct subfolders, but shared `package.json` + undeclared ownership (F6) |
| OfficeCLI runnable | FAILED — `dotnet` not installed; no fallback named (F5) |
| Scanned pages "marked low-confidence" | FAILED — 41/107 pages needsOcr, no detection wired, `--no-ocr` in recipe (F4) |
| `cowork-p2-kit/` exists | VERIFIED absent (expected — Phase 1 creates it) |

---

Status: DONE
Summary: Red-teamed Phases 1-3. 6 findings (2 Critical, 3 High, 1 Medium), each with file:line evidence and empirical liteparse/dotnet verification. Core breaks: label/admission interaction silently drops-or-leaks inputs; provenance contract unenforceable via documented recipe + wrong-page corruption; OCR detection unwired on 38% of the reference PDF; OfficeCLI spike has no fallback/timebox and no .NET runtime.
Concerns: Findings 2-4 all touch the liteparse ingest path but are distinct failure modes (contract gap / silent corruption / detection gap) — do not collapse them. Phases 4-7 not reviewed except where Phase 1-3 acceptance binds them.
