---
title: "Template to DOCX — Content Demo (synthetic, watermarked)"
description: "Fill one representative P.2 dossier slice with visibly-synthetic content + footnoted citations through the existing five-stage chain, so a reviewer can judge content and format. Review-only; never citable, never promoted."
status: completed
priority: P1
effort: "2-3d"
issue: null
branch: master
tags: [feature, experimental, demo, backend]
blockedBy: []
blocks: []
created: 2026-08-05
---

# Template to DOCX — Content Demo (synthetic, watermarked)

## Why this exists

The end-to-end spike proved the pipe connects but rendered an empty skeleton on
purpose: it fed `rubricPin: null` so the decision engine exits at
`E_RUBRIC_PIN_REQUIRED` before building any scoring matrix
(`cowork-p2-kit/reasoning/decision-engine.mjs:130`). The renderer already
supports headings, paragraphs, tables, footnoted citations, and a Sources
section (`cowork-p2-kit/render/document-builder.mjs`). This demo makes the same
five-stage chain produce a **filled**, clearly synthetic representative slice a
Product Owner can review for content and format.

## What "demo with content" means here

- Reuse the five existing stages on the **real** template + filled mock the chain
  already consumes. Add an **approved + pinned synthetic rubric**, a
  store-bound synthetic comparator, selected-rationale authoring, a pure content
  adapter, and a sandboxed render with a hard synthetic watermark.
- Chosen shape (user, 2026-08-05): **full body + footnoted citations**, on a
  **representative slice** — one formulation-selection section (P.2.2.1-style),
  not the whole P.2 form.
- Real vs synthetic (user decision, 2026-08-05): **citations quote real ingested
  excerpts from the filled mock**. The real candidate's admitted fact cards are
  record-bound; the comparator records/cards, rubric, scores, and decision are
  synthetic and visibly labeled. The citation lane is separate from the scoring
  lane: it contains exactly the three byte-exact receipt-to-record joins; the
  two `unmapped` fields are excluded and never become `chờ_dữ_liệu` blocks.

## Trust lanes

- **Real evidence lane:** copied filled mock → ingest records → real-candidate
  fact cards. No record ID, quote, page, or offset is invented.
- **Synthetic comparison lane:** deterministic comparator records + fact cards
  exist only in the isolated run store and carry a `demo-comparator` marker.
  They never enter canonical state.
- **Citation lane:** an exact, ambiguity-rejecting join checks all five receipt
  values against real ingest records. Exactly three `exact` entries become
  citations; two `unmapped` entries remain null and are excluded from render.
- **Presentation lane:** a sealed, validated selected rationale becomes generic
  decision prose and synthetic score tables. Citation footnotes demonstrate
  source/provenance format; they are not presented as scientific support for
  the synthetic decision.

## Inputs (already wired, real)

- Template: `cowork-p2-kit/inputs/reference/official-placeholder-template-v3-040826.docx`
- Filled mock: `cowork-p2-kit/inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`

These are the exact files the spike runner consumes
(`cowork-p2-kit/workflow-trial/spike-e2e-run.mjs:55,59`) and feed Stage 1
(template-probe) and Stage 2 (ingest). No new input is required.

## Safety invariant (non-negotiable)

- The first text in the DOCX is the exact title/banner `SYNTHETIC / DEMO — không
  dùng để nộp hoặc trích dẫn`. The adapter sets this as `draft.title`; the
  rendered-text gate proves it appears before `Mục lục`.
- Citations quote **real excerpts** from the public filled mock (via ingest), so
  quotes and locations are genuine — not fabricated. But the mock is classified
  `citable:false` and the scores/decision are synthetic, so the artifact as a
  whole is **never** promoted to canonical state and **never** externally
  displayed as a real dossier.
- This deliberately reverses the trial's "zero-fact / citable=false" guard only
  for three demo citation envelopes. The underlying mock remains
  `citable:false`. Any output missing the leading watermark is a hard fail.

## Scope

- In: approved+pinned synthetic rubric; real-candidate fact cards; isolated,
  store-bound synthetic comparator records/cards; exact five-entry join with a
  strict 3/2/0 baseline; a selected decision; sealed and validated selected
  rationale; a pure adapter to the existing draft contract; exactly three
  footnoted real excerpts; leading watermark; Bubblewrap-isolated deterministic
  render; plan-scoped evidence; and a retained ignored review artifact.
- Out: real FD rubric/profile, real scientific correctness, canonical
  admission/promotion, external display, full P.2 form mirror, five-of-five
  field provenance, and any change to the render draft/citation contract.
- Assumption: success means a reviewable content+format demo. It does **not**
  make the mock citable or establish scientific correctness.
- Non-goal: the exact citations do not validate or causally support the
  synthetic rubric, comparator, score, or selected outcome.

## Phases

| # | Phase | Status | Depends on |
|---|---|---|---|
| 1 | [Discovery: reach a selected decision and inventory renderable content](./phase-01-discovery-conclusive-decision.md) | Completed | — |
| 2 | [Build the demo data pack — real ingest excerpts + synthetic scoring](./phase-02-synthetic-demo-data-pack.md) | Completed | 1 |
| 3 | [Content adapter → rich watermarked draft](./phase-03-content-adapter-rich-draft.md) | Completed | 2 |
| 4 | [Render, prove determinism/isolation, retain review artifact](./phase-04-render-determinism-review.md) | Completed | 3 |

Progress: 4/4 phases complete; 7/7 exit criteria checked from plan-scoped evidence.

## Success criteria (exit acceptance)

- [x] One command runs the demo end-to-end and exits `0`, writing one DOCX to a
      controller-owned run root.
- [x] The decision engine reaches `selected` from the approved+pinned synthetic
      rubric, real-candidate cards, and store-bound synthetic comparator cards.
- [x] The first DOCX text is the exact watermark, before `Mục lục`; the body has
      the representative heading, ≥2 paragraphs, ≥1 synthetic-score table, and
      a populated "Sources and provenance" section with exactly three
      footnoted citations from the three `exact` joins.
- [x] The DOCX contains **no** `⏳ Chờ dữ liệu` block.
- [x] Two runs produce equal normalized OOXML; raw DOCX hash recorded
      diagnostically only.
- [x] Render runs through the existing Bubblewrap no-network wrapper with no
      unsandboxed fallback.
- [x] Canonical `cowork-p2-kit/{inputs,store,outputs}` roots and the baseline set
      of pre-existing dirty tracked files are byte-identical before/after. The
      plan-owned report directory and ignored artifact root are authorized
      outputs and are excluded from this immutable set.

## Gates

Each phase file carries testable gates (G-01..G-06, plus the cross-cutting
G-EX watermark gate) in the `RULE-BRAINSTORM-PLAN.md` template. No gate result
is duplicated in reports.

## Code-artifact rule

Plan IDs, phase numbers, and gate labels stay in these plan docs only. New
`.mjs`/test files describe behavior directly (e.g. "watermark banner present"),
never `G-EX` or `phase-3` in code comments or test names.

## Dependencies

- Reuses: template-probe, P2 ingest, P4 reasoning, rationale, and P3 render
  modules under `cowork-p2-kit/`.
- The spike runner `cowork-p2-kit/workflow-trial/spike-e2e-run.mjs` is the
  working reference for stage wiring. Its render call is **not** the isolation
  authority; `cowork-p2-kit/render/run-isolated-spike.mjs` owns Bubblewrap.
- Runtime: Node 22, LiteParse, Bubblewrap, and the existing render toolchain.
  Missing dependency is a hard failure; no network install or unsandboxed
  fallback.
- Format reference (optional, read via liteparse only):
  `docs/raw/P 2_form_Edit 29-09-2025-example.docx`.

## Open questions

None blocking after the 2026-08-06 validation choices. Real rubric/profile,
native provenance, canonical promotion, and external display remain future
PO/FD decisions.

## Validation Log

### Session 1 — 2026-08-06

**Trigger:** `$ak:plan --validate plans/260805-1815-template-docx-content-demo/plan`
**Questions asked:** 6

#### Verification Results

- **Tier:** Standard (4 phases; Fact Checker + Contract Verifier)
- **Claims checked:** 40
- **Verified:** 31 | **Failed:** 8 | **Unverified:** 1
- Baseline tests: reasoning 42/42, rationale 4/4, render 34/34 passed.
- CLI structure check: `ak plan validate` returned `valid:true`.

Failures resolved by the decisions below:

1. The test-approved rubric requires two eligible candidates, but the plan did
   not define store-bound comparator records/cards.
2. `createTruthfulFactCard` is file-local in `spike-e2e-run.mjs` and produces
   one spike card; it is not a reusable multi-measure API.
3. The plan claimed a three-exact/two-unmapped citation boundary without owning
   an exact join in this plan.
4. The five-stage claim omitted a selected-rationale author/seal/publish seam
   from the planned files and steps.
5. `buildDocumentBuffer` renders `title` and `Mục lục` before `blocks[0]`, so a
   watermark paragraph at `blocks[0]` cannot open the document.
6. `spike-e2e-run.mjs` renders in-process; it has no Bubblewrap isolation
   posture to reuse.
7. Evidence paths under `docs/reports/` were not plan-scoped and conflicted with
   the claim that report roots remain immutable.
8. The no-mutation gate did not distinguish immutable canonical roots from
   authorized evidence/artifact outputs.

The retained-artifact lifetime was previously unverified; the chosen ignored
artifact root resolves it.

Post-propagation result: all eight failed claims and the one unverified claim
have an explicit owner, contract, gate, and output boundary in the revised
phases. Remaining validation blockers: 0.

#### Questions & Answers

1. **[Architecture/Contract]** Engine yêu cầu tối thiểu 2 candidate. Comparator nên được tạo thế nào?
   - Options: A. Thêm synthetic comparator records + fact cards vào isolated store, gắn nhãn rõ ràng | B. Tạo rubric demo chỉ cần 1 candidate | C. Cho phép kết quả `inconclusive`
   - **Answer:** A
   - **Rationale:** Preserves a real selected path through the existing rubric while keeping synthetic evidence isolated and explicit.
2. **[Scope/Traceability]** Boundary “3 exact fields” nên được chứng minh thế nào?
   - Options: A. Thêm exact join trong Phase 2; citation chỉ lấy từ 3 field exact | B. Cho phép citation từ bất kỳ real ingest record nào | C. Chờ hardened trial triển khai join trước
   - **Answer:** A
   - **Rationale:** Makes every rendered citation traceable without blocking this demo on the queued hardened trial.
3. **[Architecture]** Plan có tiếp tục chạy đủ rationale stage không?
   - Options: A. Thêm bước author, seal, validate và publish selected rationale; adapter chỉ nhận rationale đã xác thực | B. Bỏ rationale stage, adapter nhận decision trực tiếp | C. Dùng rationale fixture có sẵn, không cùng run lineage
   - **Answer:** A
   - **Rationale:** Keeps the five-stage claim truthful and preserves same-run packet binding.
4. **[Safety/UX]** Renderer chèn title và mục lục trước `blocks[0]`. Watermark đầu tài liệu nên xử lý thế nào?
   - Options: A. Dùng chính `draft.title` làm watermark và enforce giá trị tuyệt đối | B. Thay renderer để hỗ trợ banner riêng trước mục lục | C. Chấp nhận watermark xuất hiện sau mục lục
   - **Answer:** A
   - **Rationale:** Satisfies the leading-watermark invariant without changing the public render contract.
5. **[Security/Scope]** Mức network isolation cho render?
   - Options: A. Dùng Bubblewrap wrapper hiện có cho riêng render stage | B. Render in-process; chỉ cam kết code không gọi network | C. Để sandboxing cho hardened trial
   - **Answer:** A
   - **Rationale:** Reuses the existing no-network authority and forbids a silent weaker fallback.
6. **[Artifacts/Isolation]** Lưu evidence và DOCX ở đâu?
   - Options: A. Markdown trong `plans/.../reports/`; DOCX trong ignored `artifacts/template-docx-content-demo/` | B. Tất cả trong `/tmp` | C. Commit cả Markdown và DOCX vào plan directory
   - **Answer:** A
   - **Rationale:** Keeps durable review notes with the plan and large generated binaries out of Git while retaining them for local review.

#### Confirmed Decisions

- Comparator: deterministic synthetic records/cards, isolated-store only.
- Citation boundary: exact 3/2/0 join; only the three exact entries render.
- Rationale: same-run selected packet is authored, validated, and published.
- Watermark: exact `draft.title`, verified as first rendered text.
- Render: Bubblewrap no-network wrapper, fail closed when unavailable.
- Outputs: plan-scoped reports plus ignored retained DOCX artifacts.

#### Impact on Phases

- Phase 1: prove the two-candidate selected shape and inventory rationale inputs.
- Phase 2: own comparator/store augmentation plus the exact 3/2/0 citation join.
- Phase 3: author and validate selected rationale; enforce title watermark and
  keep citations presentation-only relative to the synthetic decision.
- Phase 4: invoke Bubblewrap, separate authorized outputs from immutable roots,
  and retain the watermarked DOCX under the ignored artifact root.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, `phase-01-discovery-conclusive-decision.md`,
  `phase-02-synthetic-demo-data-pack.md`,
  `phase-03-content-adapter-rich-draft.md`, and
  `phase-04-render-determinism-review.md`.
- Decision deltas checked: 6.
- Reconciled stale references: 14 (candidate count/store binding, file-local fact
  helper, exact-join ownership, rationale stage, watermark location, sandbox
  owner, evidence paths, citation count, immutable roots, artifact lifetime,
  selected terminology, render ordering, authorized outputs, and negative cases).
- Unresolved contradictions: 0.

<!-- slug: template-docx-content-demo -->
