# Blindspot scan — pre-plan decisions QbD P.2 (Cowork MVP) — 2026-07-13

## TL;DR
The plan author is treating the P0 business gate as settled, but it is in a genuine self-contradiction: the PO doc's *body* has dated "ĐÃ CHỐT" answers (12/07/2026) while that same doc's *summary table* and the companion tech doc's *decision sheet* both still read all-9-OPEN — so whether the project is even authorized to `/ck:plan` is itself unresolved (`po-guide-...non-tech.md:70-72` vs `:404-412`; `blockers-...0832...report.md:253-263`). Second blind spot: even the answered P0s carry unresolved sub-items (no named regulatory guideline, self-contradictory retention answer, unnamed consent approver) that the plan will silently inherit as assumptions.

## Touchpoint checklist (for the PROJECT PLAN + docs init)
- [ ] **P0-authorization gate reconciliation** — plan MUST open by confirming which P0 record is truth (body vs tables) before phasing anything; both exit-criteria sections forbid planning until all 9 closed — source: `po-guide-blockers-p0-p1-260711-non-tech.md:414-425`; `blockers-p0-p1-260711-0832-tighten-po-spec-report.md:16,265-275`
- [ ] **P.2.2 + P.2.3 drafting workflow (5 steps)** — ingest→normalize comparison tables → decision matrix + prose + TL;DR → write P.2.2/P.2.3 in Vietnamese grounded in trial+reference docs → guardrails → self-score rubric → emit draft.docx + evidence-log.md + formula-decision.md — source: `brainstorm-260712-2329-cowork-p2-mvp-kit-direction-report.md:69-77`
- [ ] **Cowork kit scaffold shape** — `cowork-p2-kit/` = SKILL.md + README.md + inputs/{product-profile.md,trials/,reference/} + template/p2-template.* + rubric/scoring-90-100.md + store/ + outputs/{p2-draft.docx,evidence-log.md,formula-decision.md} — source: `brainstorm-260712-2329-cowork-p2-mvp-kit-direction-report.md:48-67`
- [ ] **2-layer deterministic architecture wrapping Cowork** — ingest (liteparse, provenance per record) + render (OfficeCLI) are deterministic and meant to be reused by qbd_core later; Cowork = temporary non-deterministic reasoning adapter — source: `brainstorm-260712-2329-cowork-p2-mvp-kit-direction-report.md:37-46,105-108`
- [ ] **.docx output via OfficeCLI — P1.2 fidelity spike FIRST** — `iOfficeAI/OfficeCLI` (C#, Apache-2.0, footnotes/hyperlinks/TOC/tables); round-trip fidelity NOT yet verified and explicitly gates the output-format decision, so schedule the spike before locking format — source: `brainstorm-260712-2329-cowork-p2-mvp-kit-direction-report.md:24,29-32,100,119`
- [ ] **Hybrid LLM provider gate — implemented as CODE, not prompt** — cloud track (Anthropic direct, ZDR, Opus 4.8/Sonnet 5 — NOT Fable 5) receives public data only; local model = internal-track worker + fail-closed fallback, never a user-facing model picker; a system-prompt "don't use internal data" is explicitly NOT a security boundary — source: `brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails-report.md:15,24,26,30-34`
- [ ] **3-layer guardrail naming kept distinct in architecture doc** — data-access boundary (code-enforced) ≠ egress control (routing/taint, fail-closed default-internal when unlabeled) ≠ LLM guardrails (runtime probabilistic: grounding/source-tier/numeric-sanity/injection-defense) — source: `brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails-report.md:30-34`
- [ ] **Content guardrails** — no source → "chờ dữ liệu"/missing-data state; never fabricate lab numbers; claim-level Accept/Edit/Reject with evidence adjacent; citation = numbered + footnote + clickable link; draft-only (nothing final without human) — source: `docs/raw/phanhoi_1783672588171.md:41-47,56-62,65-71`; `brainstorm-260712-2329-...report.md:69-77`
- [ ] **Single-approver sign-off (MVP + Phase 1)** — Trưởng phòng FD approves everything; actual review UI deferred to "vòng sau", MVP ships without it — source: `po-guide-blockers-p0-p1-260711-non-tech.md:260-261`; `brainstorm-260712-2329-...report.md:88`
- [ ] **TWO separate eval gates — do not conflate** — (a) P0.1 dossier-readiness rubric for FD acceptance (weighted: coverage 20/product-fact 25/evidence 20/provenance 10/no-fab 10/logic 10/usability 5; min 90; zero critical errors); (b) P1.5 golden-set gate for local-model promotion (faithfulness 30/extraction 20/citation 15/drafting 15/structured 10/latency 5/stability 5; hard disqualifiers) — source: `po-guide-blockers-p0-p1-260711-non-tech.md:54-72`; `research-260711-local-llm-model-hardware-windows-server-report.md:165-197`
- [ ] **Local-LLM / hardware track = 24 GB pilot tier only, benchmark-gated** — `Qwen3-14B` vs `Gemma 3 12B IT` vs `Gemma 4 12B` on 24 GB; 48/96 GB tiers require benchmark evidence first; runtime = llama.cpp + CUDA, GGUF, llama-server OpenAI-compatible, Windows Service; procurement NOT approved — source: `research-260711-local-llm-model-hardware-windows-server-report.md:13-16,139-149,198-205`
- [ ] **Reference-product market-status task** — DAV (VN) + EMA (EU) + USP (US), monthly recheck, FD confirms comparator suitability — source: `po-guide-blockers-p0-p1-260711-non-tech.md:320-323`
- [ ] **Trial-logic checking = Level-1 mechanical only** — unit/total mismatch, missing-result-with-conclusion, wrong product/substance; must not silently expand — source: `po-guide-blockers-p0-p1-260711-non-tech.md:267-285`; `blockers-p0-p1-260711-0832-tighten-po-spec-report.md:149-163`
- [ ] **Two-phase roadmap explicit** — Phase 1 = Cowork P.2 MVP kit (P.2.2+P.2.3, bisoprolol, mock/modified public data); Phase 2 = qbd_core hexagonal pipeline (LLMPort/SearchPort/KnowledgeDBPort/EvidenceStorePort/DocRenderPort, real corpus, egress control) — source: `docs/docs-state.yaml:16-24`; `brainstorm-260712-2329-...report.md:105-108`; `brainstorm-solution-direction-260709-2225-...report.md:61-67`
- [ ] **Canonical docs to scaffold** — `docs/system-architecture.md` (2-layer + 3-guardrail + Phase-2 ports), `docs/code-standards.md`, `docs/project-roadmap.md` (2-phase), and a **domain glossary** (QbD/CTD/ANDA/P.2.2/P.2.3/ZDR/Cowork kit/qbd_core/trust-tier/consent-manifest); update `docs/docs-state.yaml` with each new doc per its own maintenance rule — source: `docs/docs-state.yaml:8`; `.claude/rules/documentation-management.md`

## Unknown unknowns
- **The "answered" P0.2 has no actual regulatory standard behind it.** Decision is "B: dùng hướng dẫn chính thức, Word chỉ layout" but the recorded answer names only "File Word template chuẩn" — no guideline name/authority/version/effective-date, which is exactly the gate condition (`blockers-...0832...report.md:70`). The plan will scaffold a P.2 template with **no citable regulatory taxonomy source** and not notice — evidence: `po-guide-blockers-p0-p1-260711-non-tech.md:100-102` vs `blockers-p0-p1-260711-0832-tighten-po-spec-report.md:60-70`
- **"Thấy tất cả thông tin" is unreconciled with the lab-blank rule.** FD wants to see "mọi thông tin" yet also accepts lab-derived content stays blank/pending. If the planner reads "all info" literally it will design an agent that fabricates to fill fields — the opposite of the hard non-goal — evidence: `docs/raw/phanhoi_1783672588171.md:24-25` vs `:41-47`; `blindspot-260710-canonical-fd-handoff-qbd-p2.md:115`
- **No leakage-free golden/adjudicated claim set exists.** The P0.1 rubric presumes FD prepares "một bộ đáp án và nguồn đã kiểm tra"; both 135-00 and the VN form are contaminated/incomplete. The rubric is unrunnable until that answer key is produced — planner may schedule scoring with nothing to score against — evidence: `po-guide-...non-tech.md:64`; `blindspot-260710-canonical-fd-handoff-qbd-p2.md:124`; `docs-state.yaml:60-66`
- **Real (non-mock) corpus is entirely unspecified.** MVP runs on FD-modified mock docx/pdf; the real shared-folder files, delivery date, access mechanism, classification, and a representative sample are all absent — the ingest pipeline is being designed against data nobody has seen — evidence: `blindspot-260710-canonical-fd-handoff-qbd-p2.md:119`; `brainstorm-260712-2329-...report.md:21`

## Potholes
- **P0 status contradiction (the #1 trap).** Non-tech BODY answers are dated/ĐÃ CHỐT (`po-guide-...non-tech.md:70-72,100-102`) but the SAME doc's summary table shows all 9 "MỞ" (`:404-412`) and the tech doc's decision sheet shows all 9 "OPEN" (`blockers-...0832...report.md:253-263`). `docs-state.yaml:30-36` marks both docs `active` without flagging the conflict. A planner reading only the tables concludes "not authorized"; one reading only the body concludes "go". Both cannot be right — evidence: as cited.
- **`/ck:plan` readiness whiplash.** Three docs say do NOT plan until all P0 closed (`blockers-...0832...report.md:16,275`; `blindspot-260710-...md:250`; `brainstorm-260711-1524-...report.md:4` = "KHÔNG mở `/ck:plan` — toàn bộ P0 còn OPEN"), yet the latest brainstorm status is "Design hội tụ, **chờ `/ck:plan`**" (`brainstorm-260712-2329-...report.md:4`). The MVP-scope reduction may legitimately clear a *lower* bar than the full qbd_core P0 gate — but that authorization has never been written down — evidence: as cited.
- **P0.5 retention answer is internally self-contradictory.** "chọn C" (keep everything for project duration) but the following sentence describes deleting intermediate data — matches a different option. Ingest/store layer retention behavior is undefined — evidence: `po-guide-blockers-p0-p1-260711-non-tech.md:198`
- **P0.4 consent approver is a placeholder, not a role.** Recorded as "PO vs FD" — either-or, joint, or unfilled is unclear; the consent-manifest step has no owner — evidence: `po-guide-blockers-p0-p1-260711-non-tech.md:168`
- **135-00 downgrade must not regress.** It was once the acceptance benchmark, later found contaminated/anonymized/cross-drug; it stays `reference` only and must never be ingested as trusted product evidence. A plan that wires it as a "golden example" input reintroduces leakage — evidence: `blindspot-260710-canonical-fd-handoff-qbd-p2.md:77-83`; `docs-state.yaml:60-62`
- **Fable 5 is disqualified on the cloud track.** The current session model itself fails ZDR (400 on every request); only Opus 4.8 / Sonnet 5 pass. A plan that assumes "whatever model is running" for cloud drafting is wrong by construction — evidence: `brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails-report.md:15`
- **Consent/retention is intentionally relaxed for MVP** (whole designated folder, FD-modified mock data). If the plan doesn't label this pilot-only with explicit production-tightening follow-up, it silently becomes the production posture — evidence: `po-guide-blockers-p0-p1-260711-non-tech.md:137,167`

## Open questions (for the human — decide BEFORE planning)
- **AUTHORIZATION GATE:** Is the Cowork MVP plan authorized to proceed on its reduced MVP-scoped decisions (per the non-tech body answers dated 12/07/2026), *independent* of the full qbd_core P0 gate — OR must all 9 P0 be marked RESOLVED in both tracking tables first? The body says answered; both summary tables say OPEN; both exit-criteria forbid planning. The scan cannot resolve a process/sign-off question. Decide: (a) MVP proceeds now on body answers, full gate deferred to Phase 2; (b) reconcile tables to RESOLVED first; (c) hybrid — proceed but list the still-open sub-items as pilot risks.
- **P0.2:** What is the actual regulatory guideline (name / authority / version / effective date) that defines the P.2 taxonomy? "File Word template chuẩn" is not a citable standard. Decide before the template is scaffolded.
- **P0.5:** Retention for MVP — keep all derived artifacts for project duration, or delete intermediates/evidence? The recorded answer says both.
- **P0.1 answer key:** Who produces the leakage-free adjudicated claim set the 90/100 rubric scores against, and by when? Rubric is unrunnable without it.
- **"Thấy tất cả thông tin":** full P.2 heading coverage with explicit missing-data states (compatible with lab-blank), or literally every field populated (incompatible)? Confirm the former.
- **P0.4:** Who is the single named consent approver for internal-doc use — PO, FD, or both jointly?

## A Better Prompt
```
Create a PROJECT PLAN and initiate project docs for the MODULE3-agent pilot:
an LLM-assisted kit that authors CTD dossier section P.2 (Pharmaceutical
Development / "Phát triển dược học") for an ANDA, using Quality-by-Design (QbD)
methodology. First product = bisoprolol 5/10 mg film-coated tablet. Output is a
Vietnamese draft for a human reviewer to edit — never a final, self-approved
dossier.

=== PRECONDITION — CONFIRM WITH USER BEFORE PHASING ANYTHING ===
The P0 business-decision gate is in a CONTRADICTORY state and must be reconciled
before you plan:
- plans/reports/po-guide-blockers-p0-p1-260711-non-tech.md — BODY has dated
  "ĐÃ CHỐT" PO/FD answers (12/07/2026) for P0.1–P0.9, BUT its own summary table
  (:404-412) and exit criteria (:414-425) still read all-9 "MỞ" (OPEN).
- plans/reports/blockers-p0-p1-260711-0832-tighten-po-spec-report.md — decision
  sheet (:253-263) reads all-9 "OPEN" and states "only /ck:plan when all P0
  closed" (:16,275).
Ask the user explicitly: is this MVP authorized to proceed NOW on the body's
MVP-scoped answers (full qbd_core P0 gate deferred to Phase 2), or must all 9 P0
be reconciled to RESOLVED first? Do NOT assume. Also surface these still-open
sub-items as risks even if authorized: P0.2 has no named regulatory guideline
(only "File Word template chuẩn"); P0.5 retention answer is self-contradictory;
P0.4 consent approver is unnamed ("PO vs FD"); the P0.1 90/100 rubric has no
leakage-free adjudicated answer key yet.

=== CONFIRMED DECISIONS — DO NOT RELITIGATE ===
Scope: Phase 1 MVP = a "Claude Cowork kit" (folder + SKILL.md + cleaned P.2
template + rubric) that reads 2–3 formulations + trial results, reasons to pick
the best-supported formulation (logical, defensible), and drafts P.2.2
(formulation development) + P.2.3 (process development) in Vietnamese, grounded
and cited, pulling extra context from designated reference docs. MVP runs on
public / FD-modified MOCK data only. Phase 2 = qbd_core (standalone Python
hexagonal pipeline, provider-swappable ports: LLMPort/SearchPort/KnowledgeDBPort/
EvidenceStorePort/DocRenderPort, real corpus, egress control) — still the deploy
target, NOT dropped; the Cowork kit's ingest + render layers are built to be
reused by qbd_core.
Architecture: 2 deterministic layers wrap Cowork's non-deterministic reasoning —
(1) ingest/extract via liteparse (@llamaindex/liteparse), raw docx/pdf →
structured store with per-record provenance (file/page/quote) for citation;
(2) Cowork reasoning (SKILL.md) → decision matrix (criteria × formulation) +
prose reasoning + TL;DR → draft P.2.2/P.2.3; (3) deterministic render to .docx —
LLM never writes the final file directly.
Output: .docx via candidate iOfficeAI/OfficeCLI (C#, Apache-2.0, footnotes/
hyperlinks/TOC/tables). Schedule a P1.2 docx round-trip fidelity spike EARLY —
it gates the output-format lock; do not assume fidelity.
Kit scaffold: cowork-p2-kit/{SKILL.md, README.md, inputs/{product-profile.md,
trials/, reference/}, template/p2-template.*, rubric/scoring-90-100.md, store/,
outputs/{p2-draft.docx, evidence-log.md, formula-decision.md}}.
LLM provider gate (IMPLEMENT AS CODE, not a prompt instruction): cloud track =
Anthropic direct under a signed ZDR contract, Opus 4.8 or Sonnet 5 ONLY (Fable 5
is disqualified — 400 under org ZDR), receives PUBLIC data only. Local model =
internal-track worker (extraction/retrieval/bounded drafting on approved corpus)
+ fail-closed fallback; never a user-facing model picker. No Vercel AI Gateway
(SDK as code abstraction only). A system prompt saying "don't use internal data"
is NOT a security boundary.
Guardrails, three DISTINCT layers (keep named separately in the architecture
doc): (1) data-access boundary = code-enforced (cloud agent has no
credential/tool touching the internal store); (2) egress control = router checks
a data-classification label before each LLM call, fail-closed default-internal
when unlabeled; (3) LLM guardrails = runtime probabilistic (grounding, source
tier, numeric/unit sanity, injection defense). Content rules: no source →
"chờ dữ liệu" missing-data state; never fabricate lab numbers; claim-level
Accept/Edit/Reject with evidence adjacent; citations numbered + footnote +
clickable link; draft-only. Standards to map: OWASP LLM Top 10 2025 + OWASP
Agentic AI, NIST AI RMF/AI 600-1, ISO/IEC 42001/23894, MITRE ATLAS; pharma
GAMP 5 2nd ed., 21 CFR Part 11 / EU Annex 11, ALCOA+.
Sign-off: single approver = Trưởng phòng FD for MVP + Phase 1 (Accept/Edit/Reject
at claim level). A real review UI is deferred ("vòng sau"); MVP ships without it.
Two SEPARATE eval gates — do NOT conflate: (a) P0.1 dossier-readiness rubric for
FD acceptance = weighted (coverage 20 / product-fact 25 / evidence-support 20 /
provenance 10 / no-fabrication 10 / logic-consistency 10 / usability 5), min
90/100, zero critical errors; (b) P1.5 golden-set gate for local-model promotion
= faithfulness 30 / extraction 20 / citation 15 / drafting 15 / structured-output
10 / latency 5 / stability 5, hard disqualifiers = fabrication, filling missing
evidence, schema noncompliance, following injected instructions, sending internal
content to a non-cleared provider.
Local-LLM/hardware track: only the 24 GB VRAM pilot tier is currently actionable
(Qwen3-14B vs Gemma 3 12B IT vs Gemma 4 12B); 48/96 GB tiers and any procurement
require benchmark evidence first. Runtime = llama.cpp + CUDA, GGUF, llama-server
(OpenAI-compatible) as a Windows Service.
Trial-logic checking (pilot) = Level-1 mechanical consistency ONLY (unit/total
mismatch, missing-result-with-conclusion, wrong product/substance); do not expand.
Reference-product market-status = DAV (VN) + EMA (EU) + USP (US), monthly
recheck, FD confirms comparator suitability.
135-00 stays REFERENCE only — contaminated/anonymized/cross-drug; never ingest as
trusted product evidence or as a "golden" scoring target.

=== TOUCHPOINTS THE PLAN MUST PHASE ===
P0-gate confirmation (above) → data classification of every input incl. the seed
product profile → ingest/store layer (liteparse, provenance, retention per P0.5
once resolved) → P.2.2/P.2.3 reasoning + decision-matrix SKILL → guardrails
(3 layers) → citation/evidence-log → P1.2 OfficeCLI docx-fidelity spike →
P0.1 rubric scoring (needs FD answer key) → single-FD review gate →
reference-product market-status task → local-LLM 24 GB benchmark (P1.5 golden set)
→ explicit "production tightening" follow-up list (manifest/per-file authority
labels, IT/Deputy-CEO approval for confidential data, OpenAI ZDR confirmation).

=== DOCS TO INITIATE (align to docs/docs-state.yaml states: canonical / active /
planned / deprecated / reference) ===
Create and register in docs/docs-state.yaml: docs/system-architecture.md
(2 deterministic layers + Cowork reasoning + 3 guardrail layers + Phase-2 qbd_core
ports) [active]; docs/code-standards.md [active]; docs/project-roadmap.md
(2-phase: Cowork MVP → qbd_core) [active/planned]; docs/glossary.md — domain
terminology: QbD, CTD, ANDA, P.2 / P.2.2 / P.2.3, ZDR, Cowork kit, qbd_core,
trust/source tier, consent manifest, golden set / 135-00, OfficeCLI, liteparse
[reference/active]. Canonical business source stays docs/raw/phanhoi_1783672588171.md
[canonical]. Update docs-state.yaml for every new doc per its maintenance rule.

Terminology must be used precisely throughout (P.2 = "Phát triển dược học" /
Pharmaceutical Development; P.2.2 = formulation development; P.2.3 = process
development; ZDR = Zero Data Retention contractual config, not a gateway claim).
Do not invent decisions not listed above; anything unlisted is an open question
for the user, not a settled choice.
```

---
Sources of confirmed decisions: `docs/raw/phanhoi_1783672588171.md`; `plans/reports/brainstorm-260712-2329-cowork-p2-mvp-kit-direction-report.md`; `plans/reports/brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails-report.md`; `plans/reports/brainstorm-solution-direction-260709-2225-qbd-dossier-agent-p2-report.md`; `plans/reports/research-260711-local-llm-model-hardware-windows-server-report.md`; `plans/reports/po-guide-blockers-p0-p1-260711-non-tech.md`; `plans/reports/blockers-p0-p1-260711-0832-tighten-po-spec-report.md`; `docs/docs-state.yaml`. P0 contradiction verified directly in this scan.
