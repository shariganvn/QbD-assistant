# Glossary — QbD P.2 domain terminology

Status: reference · Updated: 2026-07-20

Use these terms precisely and consistently across code, docs, and drafts.

## Regulatory / dossier

- **QbD (Quality by Design)** — methodology framing the whole pilot; method source = FDA
  "Quality-by-Design for ANDAs" (`docs/raw/Quality-by-Design-for-ANDAs.pdf`).
- **CTD** — Common Technical Document; the dossier structure P.2 belongs to.
- **ANDA** — Abbreviated New Drug Application; the pilot's regulatory context.
- **P.2 — "Phát triển dược học" / Pharmaceutical Development** — the CTD section this kit authors.
- **P.2.2 — formulation development** — MVP drafting scope (công thức bào chế).
- **P.2.3 — process development** — MVP drafting scope (phát triển quy trình).
- **ALCOA+** — data-integrity principles (Attributable, Legible, Contemporaneous, Original,
  Accurate, +Complete/Consistent/Enduring/Available).

## Product / evidence

- **Bisoprolol 5/10 mg film-coated tablet** — first (and only, for MVP) product.
- **Reference / comparator product** — the marketed drug used for comparison; market status
  checked via DAV (VN) + EMA (EU) + USP (US), monthly recheck, FD confirms suitability.
- **Source / trust tier** — evidence ranking: pharmacopoeia, FDA/EMA labels, public
  assessment reports, peer-reviewed Q1–Q3 journals rank above general web; any source needs
  a retrievable link.
- **135-00** — an English CTD/QbD example doc. **Reference only** — contaminated /
  anonymized / cross-drug; never ingested as trusted product evidence or as a golden target.
- **Golden set** — the leakage-free adjudicated claim set the P0.1 rubric scores against;
  does not exist yet (FD to produce).

## System / architecture

- **Cowork kit** — the MVP deliverable: a Claude Cowork-runnable folder (`cowork-p2-kit/`)
  = SKILL + templates + rubric that reads trials, reasons, and drafts P.2.2/P.2.3.
- **`qbd_core`** — the eventual standalone Python hexagonal pipeline (deploy target) with
  swappable ports (`LLMPort` / `SearchPort` / `KnowledgeDBPort` / `EvidenceStorePort` /
  `DocRenderPort`).
- **liteparse** — `@llamaindex/liteparse` (`lit` CLI); deterministic docx/pdf/xlsx ingest
  without direct LLM reads.
- **OfficeCLI** — `iOfficeAI/OfficeCLI` (C#, Apache-2.0); candidate deterministic `.docx`
  renderer (footnotes/hyperlinks/TOC/tables); fidelity gated by the P1.2 spike.
- **Decision matrix** — criteria × formulation scoring table driving the formulation choice,
  paired with prose reasoning + a TL;DR.

## Module architecture (`qbd_core`, Phase 2 — proposed)

> Draft, không canonical — xem `docs/architecture/ADR-qbd-core-module-boundaries.md`. Chưa
> áp dụng cho `cowork-p2-kit/` (Phase 1 MVP).

- **`evidence`** — module biến raw docx/pdf thành record có provenance + classification;
  sở hữu `KnowledgeDBPort` + `EvidenceStorePort`.
- **`dossier_drafting`** — module dựng decision matrix + soạn prose P.2.2/P.2.3 có trích
  dẫn; sở hữu `LLMPort` + `SearchPort`.
- **`egress_gate`** — module chính sách: classification label nào được đi provider nào,
  fail-closed khi thiếu nhãn (business-module hóa của guardrail layer 2 "Egress control").
- **`provider_access`** — module cơ chế gọi provider thật: hợp đồng ZDR, danh sách model
  được duyệt, local-model fallback.
- **`rendering`** — module fill `.docx` xác định (footnote/hyperlink/TOC/table); sở hữu
  `DocRenderPort`.
- **`quality_gate`** — module chấm P0.1 dossier-readiness rubric + P1.5 golden-set.
- **`SPEC.md`** — nguồn sự thật duy nhất của một module; đổi hành vi phải đổi `SPEC.md`
  trước khi code (xem SDD trong ADR).
- **Spec-diff** — review đối chiếu diff của `SPEC.md` với diff của code; spec đổi mà code
  không đổi (hoặc ngược lại) không tương ứng ⇒ reject.
- **`api.py`** — cổng vào/ra duy nhất của một module; module khác không được import thẳng
  `service.py`/`models.py` nội bộ.
- **`shared/`** — thư mục chỉ chứa thứ thật sự dùng chung giữa các module (auth, db
  connection, base types); không chứa business logic.

## Security / data governance

- **ZDR (Zero Data Retention)** — org-level **contractual** config with an LLM provider
  guaranteeing no retention. A contract config, **not** a gateway/aggregator claim.
- **Data-access boundary** — code-enforced isolation: the cloud agent has no
  credential/tool reaching the internal store. (Guardrail layer 1.)
- **Egress control** — router checks a data-classification label before each LLM call,
  fail-closed default-internal when unlabeled. (Guardrail layer 2.)
- **LLM guardrails** — runtime probabilistic checks: grounding, source tier, numeric/unit
  sanity, injection defense. (Guardrail layer 3.)
- **Consent manifest** — versioned, purpose + expiry-scoped approval list for internal
  documents; relaxed for MVP (whole designated folder of FD-modified mock data).
- **"chờ dữ liệu"** — the explicit missing-data state emitted when no source supports a claim.
- **Data-classification label** — `public` / `internal` / `internal-derived`; drives egress
  control; unlabeled ⇒ internal (fail-closed).
