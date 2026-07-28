# Project Roadmap — QbD P.2 dossier kit

Status: active · Updated: 2026-07-28

Two phases. Phase 1 is buildable now; Phase 2 is the deploy target, gated on external
inputs (real corpus, procurement, ZDR contract, benchmark evidence) and **not** broken into
executable detail yet.

## Phase 1 — Cowork P.2 MVP kit  ·  state: active

**Goal:** a Claude Cowork-runnable `cowork-p2-kit/` that accepts an FD-selected,
evidence-bound formulation package, produces traceable fact cards and a frozen
decision/evaluation pair, and publishes an inspectable decision package. It does not
draft **P.2.2/P.2.3**, approve a formulation, or perform external egress.

Current executable work is tracked only by
`docs/plans/qbd-p4-reasoning-layer/plan.md` for Layer B; completed ingest and render work remains
in its respective plan/evidence records. The former seven-phase narrative plan is archived under
`docs/plans/OUTDATED/` and must not be used for status or execution.

Roadmap phases:

1. Foundation — docs + kit scaffold + data-classification convention.
2. Ingest & store layer (liteparse + provenance).
3. Render spike & layer (OfficeCLI docx fidelity) — **P1.2 spike runs early, gates format.**
4. Reasoning SKILL — bounded fact cards, evidence log, frozen decision/evaluation, and deterministic package publication.
5. Guardrails — package boundary, provenance, untrusted-content handling, and trial-logic controls.
6. Acceptance — gate-backed decision-package validation; dossier drafting remains separately authorized work.
7. Phase-2 prep — local-LLM 24 GB benchmark + production-tightening backlog.

**Exit / acceptance:** an FD-selected package produces a re-validatable decision package containing
canonical artifacts, deterministic Markdown derivatives, and a publication receipt. Any production
selection remains subject to FD approval; the test-only rubric cannot authorize a winner.

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

- No review UI — FD approval remains outside the decision package; UI is deferred.
- No autonomous corpus discovery, external egress, or general confidential-data route; Layer B accepts
  only the FD-selected package authorized by `D20260727`.
- No egress router / local-LLM worker implementation — Phase 2.
- No hardware procurement — 24 GB pilot benchmark is the only actionable hardware step.
