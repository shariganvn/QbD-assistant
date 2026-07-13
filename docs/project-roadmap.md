# Project Roadmap — QbD P.2 dossier kit

Status: active · Updated: 2026-07-13

Two phases. Phase 1 is buildable now; Phase 2 is the deploy target, gated on external
inputs (real corpus, procurement, ZDR contract, benchmark evidence) and **not** broken into
executable detail yet.

## Phase 1 — Cowork P.2 MVP kit  ·  state: active

**Goal:** a Claude Cowork-runnable `cowork-p2-kit/` that reads 2–3 formulations + trial
results, picks the best-supported formulation (logical, defensible), and drafts **P.2.2 +
P.2.3** in Vietnamese — grounded, cited, draft-only. **Public / FD-modified MOCK data only.**

Build phases (see `plans/260713-1034-qbd-p2-cowork-mvp/plan.md`):

1. Foundation — docs + kit scaffold + data-classification convention.
2. Ingest & store layer (liteparse + provenance).
3. Render spike & layer (OfficeCLI docx fidelity) — **P1.2 spike runs early, gates format.**
4. Reasoning SKILL — decision matrix + P.2.2/P.2.3 draft + citations/evidence-log.
5. Guardrails (3-layer design + content rules) + trial-logic Level-1.
6. Acceptance — rubric self-scoring + reference-product market-status + end-to-end mock demo.
7. Phase-2 prep — local-LLM 24 GB benchmark + production-tightening backlog.

**Exit / acceptance:** end-to-end mock run produces `p2-draft.docx` + `evidence-log.md` +
`formula-decision.md`; every claim sourced or marked "chờ dữ liệu"; self-scored against the
P0.1 rubric (true 90/100 scoring blocked on FD answer key — see Risks).

## Phase 2 — `qbd_core` full pipeline  ·  state: planned

**Goal:** standalone Python hexagonal pipeline (ports `LLMPort` / `SearchPort` /
`KnowledgeDBPort` / `EvidenceStorePort` / `DocRenderPort`), real corpus, **code-enforced**
egress control + data-access boundary, local-LLM internal-track worker (fail-closed).
Reuses the MVP's Layer A (ingest) and Layer C (render).

Gated on (all currently open): real corpus delivery + classification; hardware procurement
after 24 GB benchmark evidence; signed Anthropic ZDR (and/or confirmed OpenAI enterprise
ZDR); IT/Deputy-CEO approval for confidential data; production access-tightening (per-file
manifest + authority labels).

## Milestone gates

| Gate | Blocks | Owner |
|------|--------|-------|
| P1.2 OfficeCLI docx round-trip fidelity | output-format lock | Dev |
| P0.1 rubric answer key (leakage-free, adjudicated) | trustworthy 90/100 scoring | FD |
| P1.5 golden-set benchmark (24 GB tier) | local-model promotion + procurement | Dev + IT |
| Anthropic ZDR contract / provider evidence packet | internal-derived cloud processing | PO + IT |
| Real corpus delivery + classification | Phase 2 ingest against real data | FD |

## Tracked risks / to-confirm (carried from PO gate, not blockers for Phase 1)

- **P0.2** regulatory guideline not yet named (only "File Word template chuẩn") — the P.2
  template has no citable taxonomy source until FD names guideline/authority/version/date.
- **P0.4** consent approver unnamed ("PO vs FD") — confirm who signs consent for internal docs.
- **P0.5** data-retention answer self-contradictory — confirm retention window; MVP default =
  keep derived artifacts for project duration (conservative), configurable.
- **P0.1** no leakage-free adjudicated answer key yet — rubric runs as self-assessment only.
- "Thấy tất cả thông tin" = full P.2 heading coverage **with explicit missing-data states**
  (confirmed reading), not literally every field populated.

## Non-goals (MVP)

- No review UI — claim-level Accept/Edit/Reject lives in the output structure; UI deferred.
- No real confidential-data processing — mock/public only.
- No egress router / local-LLM worker implementation — Phase 2.
- No hardware procurement — 24 GB pilot benchmark is the only actionable hardware step.
