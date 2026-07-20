---
title: "QbD P.2 Cowork MVP kit (bisoprolol) — Phase 1 build"
description: "Claude Cowork kit that ingests trials, picks the best formulation, and drafts CTD P.2.2/P.2.3 in Vietnamese — grounded, cited, draft-only, on mock/public data."
status: in-progress
priority: P1
branch: ""
tags: [qbd, ctd-p2, cowork-kit, pharma, bisoprolol]
blockedBy: []
blocks: []
created: "2026-07-13T03:40:32.193Z"
createdBy: "ck:plan"
source: skill
---

# QbD P.2 Cowork MVP kit (bisoprolol) — Phase 1 build

## Overview

Build a Claude Cowork-runnable `cowork-p2-kit/` that reads 2–3 formulations + trial results,
reasons to pick the best-supported formulation (logical, defensible), and drafts **P.2.2
(formulation development)** + **P.2.3 (process development)** of the CTD "Phát triển dược học"
section in Vietnamese — grounded, cited, **draft-only** for the Trưởng phòng FD to review.
**Public / FD-modified MOCK data only.** Two deterministic layers (ingest via liteparse,
render via a Node `docx` library — .NET OfficeCLI as fallback) wrap Cowork's non-deterministic
reasoning; both deterministic layers are built to be reused by Phase-2 `qbd_core`. See
`docs/system-architecture.md`, `docs/project-roadmap.md`.

**Authorization:** MVP authorized to proceed now on the PO/FD body answers dated 12/07/2026;
the full `qbd_core` P0 gate is deferred to Phase 2. Residual sub-items (P0.2/P0.4/P0.5/P0.1
answer key) are carried as tracked risks, not blockers — see per-phase Risk sections and
`docs/project-roadmap.md`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Foundation — docs + scaffold + data-classification](./phase-01-foundation-docs-scaffold-data-classification.md) | ✅ Done |
| 2 | [Ingest and store layer (liteparse)](./phase-02-ingest-and-store-layer-liteparse.md) | ✅ Done |
| 3 | [Render spike and layer (Node docx; OfficeCLI fallback)](./phase-03-render-spike-and-layer-node-docx.md) | ✅ Done |
| 4 | [Reasoning SKILL — matrix + P.2.2/P.2.3 + citations](./phase-04-reasoning-skill-matrix-p-2-2-p-2-3-citations.md) | Pending |
| 5 | [Guardrails 3-layer + trial-logic Level-1](./phase-05-guardrails-3-layer-trial-logic-level-1.md) | Pending |
| 6 | [Acceptance — rubric + market-status + mock demo](./phase-06-acceptance-rubric-market-status-mock-demo.md) | Pending |
| 7 | [Phase-2 prep — local-LLM benchmark + tightening](./phase-07-phase-2-prep-local-llm-benchmark-tightening.md) | Pending |

## Dependencies

```
1 ─┬─► 2 ─┐
   └─► 3 ─┴─► 4 ─► 5 ─► 6      7 (planned; externally gated, parallelizable)
```

- Phase 2 and Phase 3 both depend on Phase 1 → can run in parallel **with file-ownership
  boundaries**: Phase 2 owns `cowork-p2-kit/store/**`, Phase 3 owns `cowork-p2-kit/render/**`.
  `package.json` is the one shared file — Phase 1 owns its `scripts` block (adds the
  `inputs:build`/`ingest`/`render` stubs, Phase 1 Step 6), Phase 2 never touches the file, and
  Phase 3 only adds the `docx` **dependency** in its Step 0. No two parallel phases write it.
- Phase 1 also authors the kit's inputs as **`.docx` generated from `.md` source** via headless
  LibreOffice (`npm run inputs:build`): liteparse **rejects `.md` outright** (verified), and only
  a real document carries the pages/`textItems` that Phase 2 anchors provenance to.
- Phase 3 is **Node-first** — render lives in the kit's existing `.mjs` runtime (the `docx`
  npm lib), so no .NET provisioning is on the primary path (verified: no .NET runtime installed).
  Its Step 0 just adds + pins the `docx` dependency; the .NET OfficeCLI binary is provisioned/
  pinned **only if** the Node spike fails a must-pass element.
- Phase 3 runs the **P1.2 render fidelity spike first** (Node `docx`, timeboxed, with the .NET
  OfficeCLI / Pandoc fallback named) — it gates the output-format lock.
- Phase 7 is `planned`/deferred: the 24 GB local-LLM benchmark and production-tightening
  backlog are externally gated (procurement, ZDR contract, real corpus) and out of the MVP
  build path; the benchmark may begin any time a 24 GB box + golden set exist.

## Acceptance (Phase 1 exit)

- 2–3 synthetic bisoprolol trial files exist (`.md` source → generated `.docx`) and ingest
  produces a **non-empty** store whose records all round-trip
  (`page.text.slice(char_start, char_end) === quote`); a silent admission-gate total-drop fails
  this check.
- End-to-end mock run emits `outputs/{p2-draft.docx, evidence-log.md, formula-decision.md}`.
- Every claim is sourced (numbered + footnote + clickable link, anchored by char offset) or
  marked **"chờ dữ liệu"**; no fabricated lab numbers; only `citable:true` sources are cited.
- `formula-decision.md` defends the chosen formulation via a decision matrix + prose + TL;DR.
- Guardrails catch an unsourced claim; Level-1 trial-logic checker flags a seeded mechanical error.
- Draft self-scored against the P0.1 rubric (true 90/100 scoring blocked on FD answer key — tracked).

## Code Review Remediation Patch — 2026-07-16

**Trigger:** implementation review found that the happy-path scaffold runs, but Phase 2 does not
execute its OCR/fail-closed/determinism contracts and Phase 3 does not prove valid footnotes,
clickable citation links, or offline fidelity. Phase 1's scaffold and source-input convention
remain accepted; it is not re-opened for production-code changes.

**Goal:** restore the Phase-1 exit dependency chain without broadening MVP scope. Phase 4 remains
blocked until both deterministic layers pass the evidence-backed gates below.

| Workstream | Owner/files | Required outcome |
|---|---|---|
| Phase 1 fixture boundary | `cowork-p2-kit/inputs/**`, `README.md` (documentation only) | Markdown remains the reviewed source; generated `.docx`, store, and outputs remain disposable test artifacts. Negative tests must use a temporary input/store root, never mutate the canonical mock fixtures. |
| Phase 2 ingest | `cowork-p2-kit/store/{ingest.mjs,records.schema.json,README.md}` | Enumerate and reject unsupported inputs before writes; **detect** OCR need correctly (flag on text absence, never on the `needsOcr` heuristic — OCR execution reverted, Session 4); make record bytes reproducible; publish only a fully verified store. |
| Phase 3 render | `package.json`, `package-lock.json`, `cowork-p2-kit/render/**`, `reports/render-fidelity-spike.md` | Pin the renderer, emit valid footnotes with safe **public-URL** evidence links (local evidence stays plain text), and replace API-success claims with OOXML + viewer + isolated-network evidence. |

**Sequencing:** Phase 2 and Phase 3 may patch in parallel inside their existing ownership globs.
Phase 3 alone may modify the `docx` dependency. Both must add focused test fixtures/harnesses under
their owned directories. Review the combined diff, then re-run the Phase 1→2→3 workflow before
unblocking Phase 4.

**Non-negotiable gates:**

1. No output is replaced until ingest admission, OCR-detection, schema, and round-trip checks all
   pass. (OCR *execution* is reverted/deferred — Session 4.)
2. A deterministic re-run over unchanged source documents must produce byte-identical JSONL.
3. The renderer spike must prove OOXML relationships and footnote IDs, then be opened in a
   supported viewer; a library call that does not throw is not a fidelity pass.
4. “Offline” may be recorded as PASS only from a network-isolated/monitored command whose
   evidence is retained in the spike report.

## Red Team Review

### Session — 2026-07-13 (Phases 1–3)
**Scope:** Phases 1–3 only. **Reviewers:** 3 hostile lenses (Security Adversary, Assumption
Destroyer, Failure Mode Analyst), Standard verification tier (Fact Checker + Contract Verifier).
**Findings:** 19 raw → 14 after dedup, all evidence-backed (many verified empirically against the
real `lit`/`dotnet` environment) — **14 accepted, 0 rejected**.
**Severity breakdown:** 5 Critical, 7 High, 2 Medium.
**Reviewer reports:** `reports/from-code-reviewer-to-planner-red-team-{security-adversary,assumption-destroyer,failure-mode-analyst}-plan-review-report.md`.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Classification+admission underspecified — no label-assignment mechanism nor enforcement ⇒ silent starvation or egress leak | Critical | Accept | Phase 1, 2 |
| 2 | Contaminated cross-drug `135-00` can become citable; label set lacked a do-not-cite axis | Critical | Accept | Phase 1, 2 |
| 3 | No phase authored the mock trial data the kit reasons over | Critical | Accept | Phase 1 |
| 4 | liteparse extracts no table STRUCTURE (verified) — Layer A deliverable rested on missing capability | Critical | Accept | Phase 2 |
| 5 | OfficeCLI spike gates format-lock but .NET absent (verified) + no fallback/timebox/threshold | Critical | Accept | Phase 3, plan |
| 6 | OfficeCLI unpinned 3rd-party binary; spike never checked network egress/integrity | High | Accept | Phase 3 |
| 7 | No prompt-injection handling at the Layer-A ingest boundary | High | Accept | Phase 2 |
| 8 | Provenance `page` unpopulatable via documented `--format text` (page nums only in `--format json`) | High | Accept | Phase 2 |
| 9 | DOCX `page` is a liteparse layout artifact ≠ FD's Word page | High | Accept | Phase 2 |
| 10 | Quote-only anchoring → round-trip attaches wrong page for repeated phrases | High | Accept | Phase 2 |
| 11 | 41/107 QbD-ref pages need OCR (verified) but `--no-ocr` + no `is-complex` wiring ⇒ silent loss | High | Accept | Phase 2 |
| 12 | "Reuse by qbd_core" designed for a non-existent Python consumer while ingest is Node `.mjs` | High | Accept | Phase 2 |
| 13 | Store persists verbatim quotes + absolute paths with no erasure/`.gitignore` | Medium | Accept | Phase 1, 2 |
| 14 | Phase 2/3 parallel with no file-ownership globs; shared `package.json` lost-update | Medium | Accept | plan, Phase 3 |

### Whole-Plan Consistency Sweep
Re-read `plan.md` + all 7 phase files after applying findings. Decision deltas propagated to the
downstream (unreviewed) phases so no stale claim survives:

- **Phase 4** — dropped the assumption that Phase-2 hands over already-`normalized comparison
  tables` (now spike-gated; Phase 4 may rebuild the grid from raw table text). Citations
  restricted to `citable:true`; the "135-00 reference-only" risk re-expressed as the enforced
  `citable:false` rule.
- **Phase 5** — egress/admission reworded: the block is now **enforced at ingest** (Phase 2),
  not a passive label check; grounding guardrail also rejects claims citing `citable:false`
  records.
- **Phase 7** — `qbd_core` reuse clarified: Layer A reused as its **JSON schema** (Python port
  can't import Node `.mjs`); Layer C reused via **shell invocation** of the render binary.
- **Phase 6** — no change needed; its end-to-end mock demo is now satisfied by the synthetic
  trial data authored in Phase 1.

**Result:** no unresolved contradictions across the plan. Provenance shape
(`{file,page,char_start,char_end,quote,page_kind}` + `confidence`), the two-axis classification
(`{label,citable}`), the liteparse table-spike gate, and the JSON-only qbd_core reuse are now
consistent in every phase that references them.

## Validation Log

### Session 1 — 2026-07-13 (Phases 1–3)
**Trigger:** `/ck:plan --validate phase 1-3`. Red Team (same day) had already closed the
correctness gaps; this session interviewed the user on the remaining planner-default / spike-
gated forks. Verification pass skipped per the validate guard (Red Team section present, no
`[UNVERIFIED]` tags in Phases 1–3). Grounded with an environment check: `dotnet`/`mono` absent,
Node 22 + `lit` present.
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture/Scope]** Phase 3 renderer: keep OfficeCLI (.NET, not installed) as primary,
   or invert to Node-first since the whole kit is Node `.mjs`?
   - Options: Node-first (Recommended) | Keep OfficeCLI-first | Pandoc-based
   - **Answer:** Node-first
   - **Rationale:** Removes a second runtime + a young 3rd-party binary from the confidential-
     dossier path; the `docx` npm lib supports footnotes/hyperlinks/TOC in-runtime and offline.
     Provisioning cost is deferred to a fallback that fires only if the Node spike fails.

2. **[Assumption/Scope]** Phase 2 OCR: MVP ingest inputs are the clean synthetic `.md` trials
   (reference PDFs excluded). Real OCR now, or detect-and-flag only?
   - Options: Detect + flag only (Recommended) | Enable OCR now
   - **Answer:** Enable OCR now *(user override of the recommendation)*
   - **Rationale:** User wants the scanned-file path executed, not deferred — so any reference
     file added later is OCR'd on ingest, not silently flagged. OCR is default-on in liteparse
     and scoped via `--target-pages` to the `is-complex`-flagged pages to avoid clean-page cost.

3. **[Risk]** Phase 1 P0.2 — regulatory template taxonomy (no named guideline yet).
   - Options: Layout-only + caveat (Recommended) | I'll name it now | Block until FD answers
   - **Answer:** Layout-only + caveat
   - **Rationale:** Keeps P0.2 a tracked risk, not a Phase-1 blocker; no invented taxonomy.

4. **[Risk]** Phase 1 P0.5 — retention for extracted `store/` + rendered `outputs/`.
   - Options: Keep for project duration (Recommended) | Ephemeral / wipe per run | Fixed window
   - **Answer:** Keep for project duration
   - **Rationale:** Confirms the MVP-default (configurable, both dirs git-ignored); final policy
     confirmed with FD later.

#### Confirmed Decisions
- **Renderer = Node `docx` (primary); .NET OfficeCLI = named fallback** — spike verifies Node
  fidelity first; OfficeCLI provisioned only on a must-pass failure.
- **OCR = executed, not just detected** — default-on, scoped via `--target-pages`;
  `confidence:low`/`needs-ocr` reserved for pages still empty **after** OCR.
- **P0.2 template = layout-only + caveat** (tracked risk).
- **P0.5 retention = keep for project duration, configurable, git-ignored** (tracked risk).

#### Impact on Phases
- **Phase 3:** rewritten to Node-first — Overview, Architecture, Related Code Files, Steps 0–5,
  Success Criteria, Risks; OfficeCLI moved to fallback; spike report renamed
  `reports/render-fidelity-spike.md`; effort trimmed 1.5d→1d (no .NET provisioning on primary path).
- **Phase 2:** Step 3 + matching Success Criteria + Risk note upgraded from OCR-detect to
  OCR-execute (default-on, `--target-pages`-scoped).
- **Phase 1:** P0.2 / P0.5 defaults confirmed (no content change; marker added).
- **Phase 7:** Layer C reuse restated — Node `docx` script (OfficeCLI fallback) reused by
  node-subprocess shell/CLI invocation, not Python import.
- **Phase 4 / 5 / 6:** no change — render input contract is renderer-agnostic; no OCR/OfficeCLI refs.
- **plan.md:** Overview + Dependencies prose updated to Node-first.

#### Whole-Plan Consistency Sweep
Re-read `plan.md` + all 7 phase files after propagation. Swept for `officecli`/`.net`/`dotnet`/
`--no-ocr`/`render via`/`render binary` — no stale primary-OfficeCLI or OCR-detect-only claims
survive in forward-looking prose. The Red Team findings table (#5 `.NET absent`, #6 unpinned
binary) is left intact as a **historical record**; its concerns are now satisfied more directly
by the Node-first primary (in-runtime, offline, no 3rd-party binary unless the fallback fires).
**Result:** no unresolved contradictions. Plan eligible for implementation (Verification
Failures: 0).

### Session 2 — 2026-07-16 (Phases 1–3 readiness check)

**Trigger:** user asked whether Phases 1–3 were deterministic/unambiguous enough to start.
Every environment claim in the plan was re-verified empirically rather than trusted.

**Claims re-verified — all held:** 41/107 QbD-ref pages `needsOcr` ✓ · `lit` returns no table
objects (`pages[].{page,width,height,text,textItems}` only) ✓ · `--format text` has no page
markers, so `--format json` is mandatory ✓ · no `dotnet`/`mono` ✓ · Node 22 + `lit` present ✓ ·
`npm run docs:check` OK ✓.

**Blocker found (missed by Red Team + Session 1): Phase 1 authored `.md` inputs, but liteparse
rejects `.md`** — `conversion error: unsupported file format: .md` (verified). Phase 2 admits
liteparse-only extraction from `inputs/trials/`, so ingest would have died on file 0 → empty
store → the Phase-1 exit criterion ("non-empty store") unreachable, blocking Phases 4/6. `.md`
also has no page/offset concept, contradicting the schema's own reject-null-page rule and the
`page_kind` enum (`pdf` | `renderer-derived`).

**Resolution (user-chosen): author `.md` source → generate `.docx` via headless LibreOffice.**
Verified end-to-end before adopting: `soffice --headless --convert-to docx` on a markdown table
produces a **genuine Word table** (`<w:tbl>` present), and `lit parse --format json` on the result
returns **one `textItem` per cell with stable x per column / y per row** — so provenance anchoring
and the Phase-2 table-reconstruction spike both have real material to work on. Keeps the
"liteparse only" contract intact, keeps `.md` as the reviewable git artifact, and needs no `docx`
npm dep in Phase 1.

**Four ambiguities pinned (user chose: fix in plan before coding):**

1. **Offset basis** — liteparse emits no char offsets; `char_start`/`char_end` are now defined as
   offsets into `pages[i].text` exactly as emitted, with a mechanical round-trip assertion.
   Previously Step 5 mandated offsets and Step 8 verified them without ever saying what they
   indexed into.
2. **OCR language** — `--ocr-language` defaults to `eng`; VN pages OCR'd as `eng` return
   plausible garbage that survives a non-empty check. `ocr_language` is now a required,
   fail-closed manifest field (`vie`/`eng`; both traineddata verified present).
3. **OCR egress** — `TESSDATA_PREFIX` is unset by default and the bundled Tesseract 5.3.4 embeds
   a `tessdata_best` GitHub URL, so an unpinned first OCR could fetch models over the network
   mid-dossier. Now pinned to the local tessdata, with the same zero-egress gate Phase 3 already
   applies to render (the posture was inconsistent between the two deterministic layers).
4. **Toolchain + system deps** — a global `lit` and the repo-local `@llamaindex/liteparse@2.5.0`
   both resolve and **both self-report CLI `2.0.0`**, so bare `lit` made Layer A `$PATH`-dependent;
   ingest now pins the repo-local binary and logs it. LibreOffice + Ghostscript (both verified
   present) were undeclared load-bearing deps and are now asserted at the admission gate.

**Plan-vs-phase contradiction fixed:** `plan.md` claimed Phase 1 adds the `ingest`/`render`
script stubs as the Phase-2‖3 lost-update guard, but Phase 1 never mentioned `package.json`. The
guard now exists (Phase 1 Step 6), with explicit key ownership: Phase 1 owns `scripts`, Phase 3
owns the `docx` dependency, Phase 2 owns nothing there.

**Impact on phases:** Phase 1 — `inputs/src/` + `build-inputs.mjs` + `inputs:build`, manifest
gains `ocr_language`, package.json stubs, system-dep declaration, effort 0.5d→0.75d. Phase 2 —
offset/tool/dep contracts pinned in Architecture, Steps 2–6 + 8 and Success Criteria tightened,
stale "`.md` trials need no OCR" note corrected, effort 1.5d→1.75d. Phase 3 — no change (already
deterministic; its Step 0 dep-add is now explicitly its own key). Phases 4–7 — no change; the
ingest input format is internal to Layer A and the record schema is unchanged.

**Result:** Phases 1–3 deterministic and unblocked. Total Phase 1–3 effort 3d→3.5d.

### Session 3 — 2026-07-16 (Code Review Remediation Patch, Phases 2–3)

**Trigger:** `/ck:plan --validate` on the 2026-07-16 remediation patch. Every patch claim was
traced to live code and held: P2 random IDs (`ingest.mjs:42-45`), wall-clock `ingested_at`
(`:203,243`), `.docx`-only collection silently ignoring stray files (`:98`), no OCR execution,
write-before-round-trip (`:349` precedes `:353`); P3 unconditional PASS (`render-spike.mjs:216-219`),
footnote ID `0` (`:39,117` / `render-docx.mjs:61-62`), footnote with no link field (`:67`), uncited
hard-coded demo matrix/prose (`render-docx.mjs:286-296`), offline PASS with no isolated run (spike
report `:29`). **Environment re-verified:** `bwrap 0.11.1` + `unshare` present → both
isolated-network gates run for real (no "unavailable" degradation); `docx` is `^9.7.1` → pin exact;
`records.schema.json:6` still REQUIREs `ingested_at`; `docs/raw/Quality-by-Design-for-ANDAs.pdf`
present (41/107 `needsOcr`).
**Questions asked:** 4

#### Questions & Answers
1. **[Scope/Test]** OCR fixture source — **Answer: a 2–3-page excerpt carved from the existing
   ANDAs PDF**, committed as a small test fixture (`label:public`, `ocr_language:eng`) under a
   test/temp input root isolated from the canonical trials; `docs/raw/*` itself stays out of the
   main ingest. Real scanned content, cheap, exercises the real admission→`is-complex`→OCR path.
   ("Enable OCR now" from Session 1 is unchanged — this only picks the fixture.)
2. **[Contract]** `ingested_at` — **Answer: remove entirely** from the record and from
   `records.schema.json` (`required` + `properties`); run timing moves to a non-contract run log,
   and the determinism gate hashes the raw JSONL line directly.
3. **[Contract]** Clickable evidence link — **Answer: URL-only, else plain text.**
   `ExternalHyperlink` only when a citation carries an approved public URL; local-only evidence
   renders as plain provenance text (no `file://`/absolute-path link, which would not resolve on the
   FD's machine). `file://`/absolute-path link targets are rejected.
4. **[Architecture]** Demo/no-input mode — **Answer: minimal smoke test.** Render only blocks
   provably cited from `store/records.jsonl` + `chờ dữ liệu` for the rest; DROP the hard-coded
   decision matrix and formula-selection prose (that is Phase 4's LLM output, not Layer C). Layer C
   stays a pure renderer.

#### Impact on Phases
- **Phase 2 patch:** OCR-fixture validation item pinned to the ANDAs excerpt under a test root;
  `ingested_at` removal made explicit (record + schema `required`/`properties`); determinism hash is
  the raw JSONL line.
- **Phase 3 patch:** citation link field is optional/URL-only; `ExternalHyperlink` emitted only for
  public-URL citations, local evidence as plain text; footnote-inspection test asserts a hyperlink
  relationship only for URL-bearing citations; demo reduced to the minimal store-cited smoke test
  with the hard-coded matrix/prose removed; the "missing link fails" validation dropped (a missing
  link is now valid = plain text).
- **plan.md:** remediation-table Phase 3 outcome reworded to public-URL-only linking.
- **Phases 1, 4–7:** no change — the fixture is a Phase-2-internal test asset; the render input
  contract gains only an optional URL field; Phase 4 already owns the reasoning the demo stops faking.

#### Whole-Plan Consistency Sweep
Re-read `plan.md` + all 7 phase files. Swept for "clickable evidence links" / "hard-coded demo" /
`ingested_at` / OCR-fixture references. Reconciled the remediation table and the render outcome
wording with the URL-only link decision; no phase still promises a clickable link for every citation
or a faked demo, and `ingested_at` now appears only as a removed field. Two extra stale spots the
sweep caught and fixed: **Phase 2 Step 1** still listed `ingested_at` in the schema field set (now
dropped, matching the removal), and **Phase 3 Step 4** said "clickable links" unqualified (now
URL-only-or-plain-text). **Medium note (no change needed):** Phase 4's emit contract and the
`evidence-log.md` (`plan.md` acceptance + phase-04) keep "clickable link" because that artifact is
**markdown**, where a relative link resolves in a viewer — the URL-only rule is specific to the
**docx footnote** (a `file://` link there would not resolve on the FD's machine). Phase 4 still emits
provenance + an optional public URL; Layer C decides link-vs-text per Session 3 Q3. **Result:** no
unresolved contradictions.
**Open risk (verify at implement-time, not a blocker):** determinism gate #2 assumes
LibreOffice→liteparse text is byte-identical across runs — run two conversions and diff the JSONL
before locking the determinism contract.

> **SUPERSEDED IN PART by Session 4 (below):** Session 3 Q1 (the ANDAs OCR fixture) rested on the
> premise that `needsOcr` marks scanned pages. Re-measurement disproved it; the fixture and OCR
> execution are dropped. Q2/Q3/Q4 of Session 3 stand unchanged.

### Session 4 — 2026-07-16 (OCR premise re-verified; Session 1 decision reverted by user)

**Trigger:** user asked whether the plan was complete — "no guess, no ambiguous?". Instead of
asserting, every OCR claim was re-measured against the real corpus. **A load-bearing premise, repeated
by the Red Team, Sessions 1–3, and this session's own Q1, turned out to be false.**

**Finding — `needsOcr` is a complexity heuristic, NOT a scan detector.** Measured with the pinned
repo-local `lit`:

| Measurement | Result |
|---|---|
| ANDAs PDF `needsOcr:true` | **41/107** — the plan's number reproduces exactly |
| …but `fullPageImage:true` | **0/107** |
| …`isGarbled:true` | **0/107** |
| …pages with `textLength < 50` | **0/107** (min `textLength` = **806**) |
| …`reasons` behind the 41 | `vector-text` ×23, `sparse-text` ×16, `embedded-images` ×2 — none means "scan" |
| Trial `.docx` (born-digital) | **2/2 `needsOcr:true`**, `reasons:["sparse-text"]`, 732/914 chars |

**Consequences:** (a) the patch as written would have **OCR'd every clean trial page** and 41
text-bearing ANDAs pages, replacing good born-digital text with Tesseract output and anchoring
provenance to OCR artifacts — the opposite of the plan's stated intent ("scope `--target-pages` to
avoid OCR'ing clean pages"); (b) **Session 3 Q1's ANDAs fixture proves nothing** — those pages carry
806+ chars, so OCR'ing them tests no recovery path; (c) **Red Team finding #11** ("41/107 need OCR
but `--no-ocr` ⇒ silent loss") **is not real as stated** — `--no-ocr` drops nothing; every page
yields text. The row is kept in the findings table as a historical record, corrected here and in
Phase 2's Risk section. Root cause: the number `41/107` was verified; **what it meant never was**.

**Questions asked:** 2

1. **[Architecture]** OCR trigger rule — **Answer: reason-allowlist.** OCR/eligibility keys off
   `fullPageImage` / `isGarbled` / a reason outside the verified-benign `{sparse-text, vector-text}`
   (e.g. `embedded-images`); the benign heuristics alone never qualify.
2. **[Scope — user reverses their own Session 1 decision]** OCR proof fixture — **Answer: drop the
   OCR proof and revert the Session 1 "Enable OCR now" override; user will open a dedicated
   adjustment session later.**

**Reversal trail (explicit, user-initiated):** Session 1 Q2 recorded *"Enable OCR now (user override
of the recommendation)"* — OCR executed, not deferred. Session 4 **returns to the original
detect-and-flag recommendation** at the user's explicit instruction, on new evidence: no document in
this corpus has an un-extractable page (0/107 + 0/2), so nothing available can exercise or prove an
OCR recovery path. OCR execution, its fixture, `--ocr-language` re-parse, the `TESSDATA_PREFIX` pin,
and the ingest zero-egress gate are **deferred together** to that follow-up session. Session 2's
`ocr_language` required/fail-closed manifest field is **untouched** — it stays enforced at the
admission gate, dormant until OCR returns.

**Role split applied (flagged to user, not silently merged):** the allowlist was asked as an *OCR
trigger*; with execution reverted it would become a *flag* rule and would mark the 2 `embedded-images`
ANDAs pages (806+ chars) as `chờ dữ liệu`, **discarding good text** — the very outcome the user
rejected. So the two roles are separated: **flagging** keys on genuine text absence
(`textLength < 50`); the **allowlist** only records OCR-eligibility in the run log as the target list
for the deferred session. On current MVP inputs neither fires (trials are `sparse-text`-only).

**Also pinned this session (previously unstated, implementer would have guessed):**
- **`is-complex` contract measured:** stdout is a **JSON array**, page key is **`pageNumber`** (not
  `page`), fields `{needsOcr, reasons[], textLength, textCoverage, fullPageImage, isGarbled,
  hasSubstantialImages, imageBlockCount, pageArea}`; `--target-pages` = `"1-5,10,15-20"`. Guessing
  `page` would have made OCR/flagging silently never fire — a vacuous gate.
- **Exit-code claim still UNVERIFIED:** the patch asserts `is-complex` exits `1` when `needsOcr`
  pages exist. Not proven (the measurement was invalidated by a shell pipe). Verify before relying on it.
- **No JSON-schema validator exists and Phase 2 may not add one** (lock has only
  `@llamaindex/liteparse`, `js-yaml`, `docx`; Phase 2 owns no `package.json` edits) ⇒ schema
  validation must be **hand-rolled** in `ingest.mjs`.
- **OOXML unzip needs no new dep:** `jszip@^3.10.1` is already in the lock transitively via `docx`,
  and `/usr/bin/unzip` exists ⇒ Phase 3's inspection test must not add `adm-zip` (would breach
  "Phase 3 only adds the `docx` dependency").
- Still free-choice (low risk, implementer's call): `id` hash algorithm/format, the
  "forced round-trip failure" injection method, the evidence-link field name, and the supported-
  extension allowlist (implied `{.docx, .pdf}`). **Undefined and worth pinning later:** what makes a
  public URL "approved" (no scheme rule or allowlist exists).

#### Impact on Phases
- **Phase 2:** Step 3 rewritten (detect-only + measured `is-complex` contract + flag-on-text-absence
  + eligibility marker); patch OCR bullet, validation item 4, two Success Criteria, and three Risk
  bullets corrected; the false "41/107 ⇒ silent loss" and "trials need no OCR" claims replaced with
  the measurements.
- **plan.md:** remediation table Phase 2 outcome + non-negotiable gate #1 reworded to OCR-*detection*.
- **Phase 3:** no change — untouched by the OCR premise.
- **Phases 4–7:** no change — `needs-ocr` records still surface as `chờ dữ liệu`; on current inputs
  none are produced.

#### Whole-Plan Consistency Sweep
Re-read `plan.md` + all 7 phase files; swept `ocr`, `needsOcr`, `41/107`, `tessdata`, `--target-pages`.
No forward-looking prose still claims OCR executes, that `needsOcr` marks scans, that `--no-ocr`
drops content, or that trial pages need no OCR. Red Team #11 and Session 1 Q2 remain as historical
records, each annotated with the correction/reversal above. **Result:** no unresolved contradictions.
**Deferred backlog (owner: user's follow-up session):** OCR execution + synthetic rasterized fixture
+ `--ocr-language` wiring + `TESSDATA_PREFIX` pin + ingest zero-egress gate.
