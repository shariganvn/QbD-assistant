# Red-Team Review — Assumption Destroyer (Phases 1–3)

Reviewer: code-reviewer (Fact Checker + Contract Verifier, Standard tier)
Target: `plans/260713-1034-qbd-p2-cowork-mvp/` — plan.md, phase-01, phase-02, phase-03
Date: 2026-07-13
Posture: hostile skeptic. Scope: phases 1–3 only. Every finding carries file:line or runtime evidence.

## Verification ledger (fact-check summary)

| Claim | Status | Evidence |
|-------|--------|----------|
| `lit` CLI exists / runs | VERIFIED | `npm run liteparse -- --help` → liteparse commands listed; package.json:9 `"liteparse":"lit"` |
| `@llamaindex/liteparse` pinned | VERIFIED | package.json (devDependencies `^2.5.0`) |
| liteparse extracts **tables** as structure | **FAILED** | `lit parse --help` has no table flag; parsed docx JSON page keys = `[page,width,height,text,textItems]`, no `table` object |
| liteparse gives docx page numbers | VERIFIED (but see F5) | parsed example docx → 32 pages, each with `page` int |
| OfficeCLI present / C# runtime available | **FAILED** | `which dotnet`→none; `~/.dotnet` = corefx/cryptography stubs only; `which mono`→none; no OfficeCLI binary on disk (only wiki note) |
| `qbd_core` code exists (reuse consumer) | **FAILED** | grep `qbd_core` → docs + plans only, zero source; ports are prose names (system-architecture.md:82-91) |
| Mock trial/formulation input data exists | **FAILED** | Phase 1 creates only empty `inputs/trials/.gitkeep`; no phase authors trial files; docs/raw has no bisoprolol comparison-table trial |
| docs/raw example files usable as trial evidence | **FAILED** | 135-00 forbidden (system-architecture.md:129-130); others are template/guidance/Q&A |

---

## Finding 1: liteparse does not extract table STRUCTURE — Layer A's core deliverable rests on a capability the tool lacks
- **Severity:** Critical
- **Location:** Phase 2, "Architecture" + "Implementation Steps" step 3 + "Success Criteria"
- **Flaw:** The plan says `lit` "extracts text + tables" and step 3 will "normalize formulation **comparison tables** (formulation × attribute) into a canonical structure the decision matrix (Phase 4) consumes." Empirically, liteparse returns no table objects. `lit parse --help` exposes only `--format json|text|markdown` with no table option. Parsing the real example docx to JSON yields page records with keys `[page, width, height, text, textItems]` — flat `text` plus x/y-positioned `textItems`. The 20 "table" substrings in the output are content words, not structure. Reconstructing a formulation×attribute grid from x/y glyph coordinates is an unsolved table-reconstruction problem that the plan hand-waves as "normalize."
- **Failure scenario:** Phase 2 ships a `.mjs` that emits records but cannot produce the "canonical decision-matrix input shape." Phase 4's decision matrix — the entire reason the kit exists — has no structured table to consume. The gap surfaces only when someone tries to wire Phase 4, after the 1.5d Phase 2 estimate is spent. Either scope explodes (build a coordinate-based table reconstructor) or the matrix is hand-entered, defeating the "deterministic Layer A" premise.
- **Evidence:** phase-02-ingest-and-store-layer-liteparse.md:20, :27, :44-45, :55; docs/liteparse-scout.md:1-27 (workflow shows only text extraction + screenshots, never tables); docs/code-standards.md:25; runtime: `lit parse --help` (no table flag) and parsed `docs/raw/P 2_form_Edit 29-09-2025-example.docx` JSON page keys `[page,width,height,text,textItems]`.
- **Suggested fix:** Before committing to Phase 2, run the spike-first pattern here too: parse one real formulation-comparison docx and prove a deterministic script can rebuild the table from `textItems`. If it can't, either (a) restrict Layer A to text+quote provenance and make the decision matrix a Phase-4 human/LLM structuring step, or (b) budget the table-reconstruction engine explicitly. Do not claim "normalize comparison tables" as deterministic Layer A output until proven.

## Finding 2: No phase creates the mock trial/formulation data the whole kit reasons over; the only tabular docx is forbidden from ingestion
- **Severity:** Critical
- **Location:** Phase 2, "Requirements" + "Implementation Steps" steps 2 & 6; Phase 1, "Related Code Files"
- **Flaw:** The kit's premise is "reads 2–3 formulations + trial results." Phase 2 runs `lit` over `inputs/trials/` and `inputs/reference/` and (step 6) will "verify on the example files that every record round-trips." But Phase 1 only seeds `inputs/product-profile.md` and creates empty `inputs/trials/.gitkeep` / `inputs/reference/.gitkeep`. A grep across all seven phases shows no phase authors mock trial files with formulation comparison tables. The only docx containing tables in `docs/raw/` is `135-00`, which system-architecture.md §9 explicitly bars: "never ingested as trusted product evidence or as a 'golden' scoring target." The remaining raw files are a blank P.2 form template, FDA QbD guidance, and a business Q&A markdown — none are bisoprolol trial data.
- **Failure scenario:** Phase 2 executes against an empty `inputs/trials/`, produces zero trial records, and its "verify on example files" step can only run against forbidden or irrelevant sources. Phase 4's decision matrix and Phase 6's "end-to-end mock demo on bisoprolol mock trials" have no admissible input. The plan silently assumes trial data will materialize; ownership is unassigned and it is the critical-path input.
- **Evidence:** phase-01-foundation-docs-scaffold-data-classification.md:33, :47; phase-02-ingest-and-store-layer-liteparse.md:20, :42, :50, :54; docs/system-architecture.md:129-130; docs/docs-state.yaml:84-92 (all raw files `state: reference`); runtime `ls docs/raw/` = {135-00 docx, P2 form docx, QbD PDF, phanhoi md}. Note internal contradiction: docs-state.yaml:86 titles 135-00 "Golden example P.2" while architecture forbids golden use.
- **Suggested fix:** Add an explicit Phase-1 (or Phase-2 pre-step) deliverable: author 2–3 synthetic bisoprolol formulation trial files (with a real comparison table) as `public`/mock, and name the owner. Until that data exists, Phases 2/4/6 cannot be executed or accepted.

## Finding 3: OfficeCLI / .NET toolchain is absent; the P1.2 spike that GATES the whole output-format lock cannot run, and no phase provisions it
- **Severity:** Critical
- **Location:** Phase 3, "Implementation Steps" steps 1–2 + "Risk Assessment" (Toolchain)
- **Flaw:** Phase 3 runs the fidelity spike "FIRST" because it gates format lock, and the risk note says "ensure the runtime is available in the dev/CI environment or document the setup." There is no evidence any toolchain or binary exists: `which dotnet`→none, `~/.dotnet` contains only `corefx/`+`cryptography/` stubs (no `dotnet` executable), `which mono`→none, and no OfficeCLI binary is anywhere on disk — only a wiki note at `/home/nguyenhp/wiki/entities/officecli.md`. That note also shows the plan's framing is wrong: OfficeCLI is a **.NET 10 self-contained binary**, so "ensure C# runtime available" is a non-issue; the real, unassigned dependency is fetching/verifying the ~single binary and confirming it runs headless here.
- **Failure scenario:** Phase 3 step 1 blocks immediately — no binary to run the spike. Because the spike gates the format lock, and Phases 4–6 target the render contract, the entire back half of the plan is blocked behind an unprovisioned external tool. The 1.5d estimate covers spike + build but excludes provisioning and the genuine risk that a self-described "world's first" tool round-trips footnotes+hyperlinks+TOC+nested tables imperfectly. Phase 2 and 3 are declared parallelizable (both dep=[1]), but Phase 3 has an unmet dependency Phase 1 does not satisfy.
- **Evidence:** phase-03-render-spike-and-layer-officecli.md:38-42, :59-60; docs/project-roadmap.md:45 (P1.2 gate blocks output-format lock); docs/system-architecture.md:36, :119; runtime: `which dotnet`/`which mono` absent, `~/.dotnet` stub dirs, no on-disk OfficeCLI; `/home/nguyenhp/wiki/entities/officecli.md` (.NET 10 self-contained, created 2026-03-15, ~11.4K stars — young tool).
- **Suggested fix:** Add a Phase-1 provisioning task: download/pin the OfficeCLI binary, record version + checksum, and prove `view`/`merge` run headless in this environment. Restate the toolchain risk as "binary provisioning + fidelity" not "C# runtime." Keep a fallback renderer named up front (the plan already gestures at this) with its own trigger criteria.

## Finding 4: "Reused by qbd_core" is a contract designed against an imaginary, different-language consumer
- **Severity:** High
- **Location:** Phase 2, "Overview" + "Risk Assessment" (Reuse contract); Phase 3, "Overview" + step 5; plan.md:24-25
- **Flaw:** Both layers are justified as "built to be reused by `qbd_core` (`KnowledgeDBPort`/`EvidenceStorePort`/`DocRenderPort`)," and Phase 2 asks to "keep the store schema provider-neutral so `qbd_core` can adopt it without rework." But `qbd_core` has zero code — grep finds it only in docs as a `planned` design target, and its ports are prose names (system-architecture.md:82-91), not schemas. Worse, `qbd_core` is a **Python** pipeline while Layer A ingest is authored as `.mjs` (Node). Cross-language code reuse is impossible — only a JSON schema is portable. The render layer (a C# binary) can plausibly be shell-invoked from Python, but the ingest `.mjs` cannot be "reused"; it would be re-implemented. The architecture table's "Reused by qbd_core: Yes" for Layer A overstates this.
- **Failure scenario:** The team spends MVP effort generalizing the store schema to satisfy guessed Python-port requirements (append-only, versioned `EvidenceStorePort`) that don't exist yet. When `qbd_core` is actually built, its real port contract differs and the schema is reworked anyway — the up-front generalization was YAGNI cost with no payoff. Meanwhile the MVP carries abstraction it doesn't need. This directly conflicts with the repo's YAGNI-first mandate.
- **Evidence:** phase-02-ingest-and-store-layer-liteparse.md:16, :33 (ingest is `.mjs`), :64-65; phase-03-render-spike-and-layer-officecli.md:16, :46; plan.md:24-25; docs/system-architecture.md:20-22, :34, :36, :82-91; docs/glossary.md:36-38; docs/code-standards.md:6 (YAGNI first); runtime grep `qbd_core` = docs/plans only, no source.
- **Suggested fix:** Downgrade the reuse claim to "emit a documented JSON schema `qbd_core` can target later"; drop any schema generalization not needed by the MVP itself. Design the schema for the MVP's actual consumers (Phase 4 matrix, Phase 3 render) and treat qbd_core alignment as a future migration, not a current constraint.

## Finding 5: DOCX "page" provenance is a liteparse layout artifact, not the page an FD reviewer sees
- **Severity:** High
- **Location:** Phase 2, "Implementation Steps" steps 1–2 + "Success Criteria" ("every record round-trips to its source quote/page")
- **Flaw:** The record schema mandates provenance `{file, page, quote}` for every record, and citations are "numbered + footnote + clickable link" to the source page. For DOCX there is no intrinsic fixed pagination — page breaks are computed at render time from fonts, margins, and page size. liteparse paginated the example docx into 32 pages using its own A4 layout (observed page `width≈595pt × height≈842pt`). That page number is liteparse's rendering, not necessarily the page the FD sees in MS Word with their fonts/zoom/track-changes. The "round-trip verify" (step 6) will pass against liteparse's own pagination while silently diverging from the authoritative document.
- **Failure scenario:** A footnote cites "p.7"; the FD opens their Word copy and the quote is on p.6 or p.9. The citation looks fabricated or sloppy — which is fatal for a grounding-and-provenance product whose entire trust proposition is verifiable citations. The defect is invisible in automated checks (they use liteparse's page numbers on both sides) and only appears in human review.
- **Evidence:** phase-02-ingest-and-store-layer-liteparse.md:40-41, :50; docs/code-standards.md:36; docs/system-architecture.md:34 (provenance `{file,page,quote}`); runtime: parsed example docx → 32 pages, each carrying liteparse-derived `width`/`height` layout, `page` int.
- **Suggested fix:** For DOCX sources, prefer a stable locator (heading path / section + quote span) over a rendered page number, or explicitly label page provenance as "renderer-derived, approximate" in the citation. Reserve exact `page` provenance for PDFs, which have fixed pagination. Decide this before Phase 2 locks the record schema, since it changes the provenance shape.

## Finding 6: The fail-closed classification rule has no labeling mechanism — under the plan as written, every record defaults to `internal` and nothing is admitted to reasoning
- **Severity:** Medium
- **Location:** Phase 1, "Implementation Steps" step 2; Phase 2, step 4; Phase 5 admission check
- **Flaw:** Phase 1 defines labels + the rule "unlabeled ⇒ internal (fail-closed)" and asks only for "a one-line JSON shape for the label." Phase 2 step 4 says "apply classification per file from Phase 1 convention; default `internal` if unlabeled." But no phase defines *how* a file or record acquires the `public` label — there is no manifest, folder convention, or front-matter mechanism specified, and liteparse cannot infer it. Phase 5 then admits "only `public`/mock records" to reasoning. If nothing assigns `public`, the fail-closed default makes every record `internal`, and the MVP has no internal store to hold them (system-architecture.md §3.1: "no internal store is wired in"). Also note per-record (Phase 1) vs per-file (Phase 2) classification granularity is stated inconsistently.
- **Failure scenario:** Ingest runs, every record fails closed to `internal`, the admission check rejects all of them, reasoning receives an empty set, and the pipeline emits nothing — while every automated success check that only asserts "records have a label" passes. The fail-closed default silently starves the pipeline.
- **Evidence:** phase-01-foundation-docs-scaffold-data-classification.md:44-46; phase-02-ingest-and-store-layer-liteparse.md:47; phase-05-guardrails-3-layer-trial-logic-level-1.md:31, :54; docs/system-architecture.md:48-49.
- **Suggested fix:** Specify the labeling mechanism concretely in Phase 1 (e.g., a `classification.json` manifest mapping input paths → label, or per-file front-matter), and define what happens to a fail-closed-`internal` record in the MVP (quarantine + skip, since there is no internal store). Reconcile per-file vs per-record granularity.

---

## Unresolved questions
1. Who authors the 2–3 mock bisoprolol formulation trial files (with a real comparison table), and in which phase? (Finding 2)
2. Has anyone confirmed OfficeCLI runs headless in this Linux env, or is the .NET 10 self-contained binary assumed available? (Finding 3)
3. Is "reuse by qbd_core" meant as code reuse or schema reuse? The Python/Node split makes code reuse of Layer A impossible. (Finding 4)
4. For DOCX citations, is renderer-derived page provenance acceptable to the FD, or is a heading/section locator required? (Finding 5)
