# System Architecture — QbD P.2 dossier kit

Status: active · Updated: 2026-07-23

## 1. Purpose & scope

An LLM-assisted kit that authors CTD dossier section **P.2 — "Phát triển dược học"
(Pharmaceutical Development)** for an ANDA using Quality-by-Design (QbD) methodology.
First product: **bisoprolol 5/10 mg film-coated tablet**. MVP scope = **P.2.2
(formulation development)** + **P.2.3 (process development)**.

Output is a **Vietnamese draft for a human reviewer to edit — never a final,
self-approved dossier.** The single approver for MVP + Phase 1 is the **Trưởng phòng FD**.

Two-phase build (see `project-roadmap.md`):

- **Phase 1 (MVP) — Cowork P.2 kit:** a Claude Cowork-runnable folder that reads 2–3
  formulations + trial results, reasons to pick the best-supported formulation, and
  drafts P.2.2/P.2.3 grounded + cited. Runs on **public / FD-modified MOCK data only.**
- **Phase 2 — `qbd_core`:** standalone Python hexagonal pipeline (provider-swappable
  ports), real corpus, code-enforced egress control. Still the deploy target; the MVP's
  ingest (Layer A) and render (Layer C) layers are built to be reused by `qbd_core`.

## 2. Pipeline — two deterministic layers wrap non-deterministic reasoning

```
raw docx/pdf ─► [A] Ingest/extract ─► structured store ─► [B] Cowork reasoning ─► [C] Render ─► p2-draft.docx
                 (DETERMINISTIC)        (+provenance)       (NON-DETERMINISTIC)     (DETERMINISTIC)
                 liteparse                                  SKILL.md                docx + OOXML post-processing
```

| Layer | Determinism | Role | Tool | Reused by qbd_core |
|-------|-------------|------|------|--------------------|
| **A — Ingest/extract** | Deterministic | raw docx/pdf → structured store, one record per extracted unit, each with provenance `{file, page, quote}` and a data-classification label | `liteparse` (`@llamaindex/liteparse`) | Yes → `KnowledgeDBPort` / `EvidenceStorePort` |
| **B — Reasoning** | Non-deterministic | decision matrix (criteria × formulation) + prose reasoning + TL;DR → Vietnamese draft P.2.2/P.2.3, grounded + cited | Claude Cowork `SKILL.md` | Replaced by `LLMPort` |
| **C — Render** | Deterministic | fill final `.docx` from structured draft; visible inline/footnote citations, approved external links, plain local provenance, static TOC, and tables | `docx@9.7.1` + deterministic OOXML post-processing (verified, G-P3-01 through G-P3-05 pass) | Yes → `DocRenderPort` |

**Invariant: the LLM never writes the final `.docx` directly.** Layer B emits structured
content + citations; Layer C renders deterministically.

## 3. Guardrails — three DISTINCT layers

These are separate mechanisms and must not be conflated. A system prompt saying
"don't use internal data" is **not** a security boundary.

1. **Data-access boundary — code-enforced (deterministic).** The cloud-track agent holds
   no credential or tool that can reach the internal store. Enforcement is structural, not
   behavioral. *(MVP: trivially satisfied — no internal store is wired in; real enforcement
   lands in Phase 2 `qbd_core`.)*
2. **Egress control — routing / taint (deterministic).** A router checks the
   data-classification label before **each** LLM call and **fails closed to
   default-internal when a record is unlabeled.** *(MVP: designed + documented here;
   implemented as code in Phase 2. In MVP only public/mock data is admitted, and the
   classification step in Layer A is the admission check.)*
3. **LLM guardrails — runtime probabilistic.** Grounding (no evidence ID → no claim),
   source-tier ranking, numeric/unit sanity, prompt-injection defense. *(MVP: implemented
   as content rules inside the SKILL + a Level-1 trial-logic checker.)*

### Content rules (MVP, enforced in Layer B)

- No source → **"chờ dữ liệu"** missing-data state; never leave a claim unsourced.
- **Never fabricate lab numbers.** Lab-experiment results stay blank/pending FD.
- Claim-level **Accept / Edit / Reject**, evidence rendered adjacent to each claim.
- Citations = **numbered inline marker + footnote**; approved external evidence also receives a
  clickable body link, while local-only provenance remains visible plain text.
- **Draft-only** — nothing is final without human review.

## 4. LLM provider gate (implement as CODE, not a prompt instruction)

- **Cloud track:** Anthropic **direct** under a signed **ZDR** (Zero Data Retention)
  contract. **Opus 4.8 or Sonnet 5 ONLY** — Fable 5 is disqualified (400 under org ZDR;
  requires 30-day retention). Receives **PUBLIC data only.**
- **Local model:** internal-track worker (extraction / retrieval / bounded drafting on the
  approved corpus) **+ fail-closed fallback.** Never surfaced as a user-facing model picker.
- **No Vercel AI Gateway.** The Vercel AI SDK is used only as a code abstraction; the ZDR
  key/contract is signed directly with the provider (a gateway adds a subprocessor hop and
  does not itself grant ZDR).
- Routing is a **conditional gate**: cloud track only ever receives public data by default;
  a provider that passes the P0.6 checklist with an evidence packet may be promoted to
  process internal-derived content. This gate is a **Phase 2** deliverable — in the Cowork
  MVP, Claude Cowork *is* the model and the only admitted data is public/mock.

## 5. Phase-2 `qbd_core` ports (design target)

Standalone Python pipeline, provider/runtime swappable via adapters, not tied to any agent
framework. Ports:

- `LLMPort` — provider-swappable model calls (behind the egress gate).
- `SearchPort` — external search (default Tavily).
- `KnowledgeDBPort` — the structured store (Layer A output).
- `EvidenceStorePort` — append-only, versioned evidence records with provenance.
- `DocRenderPort` — deterministic `.docx` fill (Layer C).

Build order for Phase 2: target = hexagonal `qbd_core`; sequence = pipeline-first
(de-risk fast).

## 6. Eval gates — TWO separate gates, do not conflate

- **P0.1 — dossier-readiness rubric (FD acceptance).** Weighted: coverage 20 / product-fact
  25 / evidence-support 20 / provenance 10 / no-fabrication 10 / logic-consistency 10 /
  usability 5. Threshold **min 90/100, zero critical errors.** Approver = Trưởng phòng FD.
  *Blocked on an FD-provided leakage-free adjudicated answer key (tracked risk).*
- **P1.5 — golden-set gate (local-model promotion).** Weighted: faithfulness 30 /
  extraction 20 / citation 15 / drafting 15 / structured-output 10 / latency 5 / stability
  5. Hard disqualifiers: fabrication, filling missing evidence, schema noncompliance,
  following injected instructions, sending internal content to a non-cleared provider.

## 7. Standards mapped

- **AI/security:** OWASP LLM Top 10 (2025) + OWASP Agentic AI, NIST AI RMF / AI 600-1,
  ISO/IEC 42001 & 23894, MITRE ATLAS.
- **Pharma:** GAMP 5 (2nd ed.), 21 CFR Part 11 / EU Annex 11, ALCOA+.

## 8. MVP vs Phase-2 responsibility split

| Concern | Phase 1 (Cowork MVP) | Phase 2 (`qbd_core`) |
|---------|----------------------|----------------------|
| Ingest Layer A (liteparse + provenance + labels) | Build | Reuse |
| Reasoning Layer B | Cowork SKILL | `LLMPort` adapter |
| Render Layer C (`docx@9.7.1` + deterministic OOXML post-processing) | Build (verified, including deterministic output and manual viewer fidelity in G-P3-05) | Reuse |
| Data-access boundary | N/A (no internal store) | Code-enforced |
| Egress control router | Design + document only | Implement as code |
| Local-LLM internal worker | Benchmark only (24 GB tier) | Deploy (fail-closed) |
| Content guardrails | Implement in SKILL | Port into pipeline |
| Real confidential corpus | Out of scope (mock only) | In scope + approvals |

## 9. Data references

- Canonical business source: `docs/raw/phanhoi_1783672588171.md`.
- `135-00` example stays **reference only** — contaminated / anonymized / cross-drug; never
  ingested as trusted product evidence or as a "golden" scoring target.
