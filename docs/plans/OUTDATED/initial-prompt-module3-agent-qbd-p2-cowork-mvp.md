<!-- Initial prompt for the PROJECT PLAN + docs-init session.
     Source: plans/reports/blindspot-260713-1008-pre-plan-decisions-qbd-p2-cowork-mvp-report.md
     P0 authorization RESOLVED by user 2026-07-13: MVP proceeds now. Paste the block below into /ck:plan. -->

# Initial prompt — MODULE3-agent (QbD P.2 Cowork MVP)

Create a PROJECT PLAN and initiate project docs for the MODULE3-agent pilot:
an LLM-assisted kit that authors CTD dossier section P.2 (Pharmaceutical
Development / "Phát triển dược học") for an ANDA, using Quality-by-Design (QbD)
methodology. First product = bisoprolol 5/10 mg film-coated tablet. Output is a
Vietnamese draft for a human reviewer to edit — never a final, self-approved
dossier.

=== AUTHORIZATION — RESOLVED 2026-07-13 (do not re-gate) ===
The P0 business-decision gate is CLOSED for MVP: the user (with PO) authorized
this MVP to proceed NOW. All 9 P0 items are treated as decided on the MVP-scoped
answers in the BODY of plans/reports/po-guide-blockers-p0-p1-260711-non-tech.md
(dated 12/07/2026). The stale "MỞ/OPEN" summary tables in that doc (:404-412) and
in plans/reports/blockers-p0-p1-260711-0832-tighten-po-spec-report.md (:253-263)
are OUTDATED — they lag the body answers; do NOT treat them as blocking, and do
NOT re-open this gate. The full qbd_core P0 gate is deferred to Phase 2. Planner:
proceed straight to phasing.
Residual gaps the user will fill after a follow-up PO meeting — carry these as
tracked risks / to-confirm items in the plan, NOT as blockers:
- P0.2: regulatory guideline not yet named (only "File Word template chuẩn").
- P0.4: consent approver unnamed ("PO vs FD") — confirm who signs.
- P0.5: data-retention answer still self-contradictory — confirm retention window.
- P0.1: the 90/100 rubric has no leakage-free adjudicated answer key yet — needs
  an FD-provided key before rubric scoring is trustworthy.

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
Data classification of every input incl. the seed product profile → ingest/store
layer (liteparse, provenance, retention per P0.5 once confirmed) → P.2.2/P.2.3
reasoning + decision-matrix SKILL → guardrails (3 layers) → citation/evidence-log
→ P1.2 OfficeCLI docx-fidelity spike → P0.1 rubric scoring (needs FD answer key)
→ single-FD review gate → reference-product market-status task → local-LLM 24 GB
benchmark (P1.5 golden set) → explicit "production tightening" follow-up list
(manifest/per-file authority labels, IT/Deputy-CEO approval for confidential data,
OpenAI ZDR confirmation).

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
