# ADR — `qbd_core` module boundaries (DDD-lite + Hexagonal, business-capability split)

Status: **Proposed (draft — chờ user confirm)** · Date: 2026-07-20 · Scope: **Phase 2 `qbd_core` only**
Future canonical ID nếu confirm: `D1` (sẽ ghi lại tại `docs/decisions/D1-qbd-core-module-boundaries.md`, status `active`).

> **Không đụng Phase 1.** `cowork-p2-kit/` (Node.js MVP) và workstream đang active
> `docs/plans/qbd-p2-ingest-completion/` giữ nguyên cấu trúc theo layer kỹ thuật
> (A/B/C) như đã quyết trước đó — lý do: MVP là vài script chạy 1 lần, DDD/module-split chỉ
> có giá trị khi có ≥5 business capability thật + cần provider-swap, tức Phase 2.
>
> **Cảnh báo naming collision:** "Phase 2" trong tài liệu này = roadmap Phase 2 (`qbd_core`,
> Python, chưa bắt đầu). Đừng nhầm với "Phase 2" trong
> `docs/plans/qbd-p2-ingest-completion/plan.md` — đó là build-step #2 của MVP
> (ingest/store layer), một numbering nội bộ khác của `project-roadmap.md` §Phase 1.

## Context

`docs/system-architecture.md` §5 đã chốt `qbd_core` là "standalone Python hexagonal pipeline,
provider-swappable ports", với 5 port đặt tên: `LLMPort`, `SearchPort`, `KnowledgeDBPort`,
`EvidenceStorePort`, `DocRenderPort`. Đó là **port list**, chưa phải **module boundary** —
ADR này bổ sung phần còn thiếu: gom port + guardrail layer + eval gate nào vào chung 1 module
nghiệp vụ, đặt tên theo ubiquitous language, và quy định cách các module nói chuyện với nhau.

## Decision

### 1. Chia theo business capability, không theo layer kỹ thuật

6 module (trong khoảng 5–7 user yêu cầu). Tên module = ubiquitous noun, dùng snake_case
(bắt buộc cho Python package, không phải chỉ là style — hyphen làm `import` gãy).

| Module | Business capability | Port/guardrail sở hữu | Nguồn gốc |
|---|---|---|---|
| `evidence` | Biến raw docx/pdf thành record có provenance + classification | `KnowledgeDBPort`, `EvidenceStorePort` | Tái dùng gần nguyên xi từ `cowork-p2-kit/ingest/*` (MVP Layer A) |
| `dossier_drafting` | Decision matrix (criteria × formulation) + soạn P.2.2/P.2.3 có trích dẫn | `LLMPort`, `SearchPort` | MVP Layer B (`SKILL.md`) |
| `egress_gate` | Chính sách: classification label nào được đi provider nào, fail-closed khi thiếu nhãn | (mới — xem §3) | system-architecture.md §3.2 "Egress control" |
| `provider_access` | Cơ chế gọi provider thật: hợp đồng ZDR, danh sách model được duyệt, local-model fallback | (mới — wrap `LLMPort`) | system-architecture.md §4 "LLM provider gate" |
| `rendering` | Fill `.docx` xác định: footnote/hyperlink/TOC/table | `DocRenderPort` | MVP Layer C (OfficeCLI) |
| `quality_gate` | Chấm P0.1 dossier-readiness rubric + P1.5 golden-set | (mới — hiện là doc tĩnh `rubric/scoring-90-100.md`) | system-architecture.md §6 |

**Open question (cần bạn quyết trước khi promote sang `D1`):** `egress_gate` và
`provider_access` có tách hay gộp? Lý do đề xuất tách: `egress_gate` là **policy**
(compliance/FD review được — GAMP5/21 CFR Part 11), `provider_access` là **mechanism**
(dev-only, hợp đồng ZDR/model version). SPEC.md của 2 module sẽ có audience khác nhau. Nếu
gộp → còn 5 module, `SPEC.md` phải phục vụ cả 2 audience trong 1 file.

### 2. Kết nối module — DDD-lite + Hexagonal

- **DB dùng chung được** (không bắt buộc DB riêng/microservice) — mỗi module vẫn khai model
  riêng trong `models.py` của nó; module khác không được `import` thẳng model của module khác.
- **`shared/` chỉ chứa thứ THẬT SỰ dùng chung**: DB connection, auth, base types/schema
  primitives. Không chứa business logic.
- **Trao đổi giữa module = qua `api.py` của module đích, không đi tắt.** `api.py` là cổng
  vào/ra duy nhất — service.py/models.py là nội bộ, không import xuyên module.
- **Chia sẻ file (không qua `shared/`) phải có permission**: nếu module A cần đọc artifact
  của module B ngoài `api.py` (vd `evidence` cần đọc file tạm của `dossier_drafting`), phải
  khai rõ trong SPEC.md của module B dưới mục "Exposed to" + lý do — không có exception ngầm.
- Composition root `main.py` (~50 dòng): chỉ import + wire module lại, không chứa logic.

### 3. SDD — SPEC.md là nguồn sự thật

- Đổi hành vi = đổi `SPEC.md` **trước**, code theo sau. Quy trình: chốt spec → code nhanh →
  test xanh → review **spec-diff** (không chỉ code-diff) để chấp nhận PR.
- Reviewer check: hành vi code thay đổi mà `SPEC.md` không có diff tương ứng → reject (spec
  drift). `SPEC.md` đổi mà không có rationale/version note → reject.
- Đây không phải ý tưởng mới cho project này — `RULE-BRAINSTORM-PLAN.md` đã bắt mọi
  requirement có gate Invariant/Boundary/Fixture/Command/Evidence. `SPEC.md` per module là
  áp dụng rule đó ở cấp module thay vì cấp plan.

### 4. Repo layout

```text
qbd_core/
├── modules/
│   ├── evidence/
│   │   ├── SPEC.md          # nguồn sự thật duy nhất của module này
│   │   ├── service.py       # logic nghiệp vụ
│   │   ├── models.py        # bảng DB riêng của module
│   │   ├── api.py           # cổng vào/ra duy nhất — module khác chỉ gọi qua đây
│   │   └── tests/
│   ├── dossier_drafting/    # (y hệt cấu trúc trên)
│   ├── egress_gate/
│   ├── provider_access/
│   ├── rendering/
│   └── quality_gate/
├── shared/                  # auth, db connection, base types — KHÔNG chứa business logic
└── main.py                  # lắp ráp module, ~50 dòng, không chứa logic
```

### Appendix — SPEC.md template

```markdown
# SPEC — <module_name>

## Purpose
1-2 câu: module này chịu trách nhiệm nghiệp vụ gì.

## Ubiquitous nouns owned
Danh từ nghiệp vụ module này là nguồn sự thật (đồng bộ với docs/glossary.md).

## API contract (api.py)
Input/output của từng hàm public — đây là hợp đồng module khác được phép gọi.

## Invariants
Điều tuyệt đối phải đúng, bất kể implementation đổi thế nào.

## Data owned (models.py)
Bảng/entity module này sở hữu. Module khác không được query thẳng.

## Exposed to (file-share ngoài api.py, nếu có)
Module nào, file gì, lý do, ai duyệt.

## Dependencies
Module khác mà module này gọi qua api.py của họ.

## Non-goals
Rõ ràng cái KHÔNG làm, để tránh scope creep khi code nhanh theo SDD.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
```

## Consequences

- **Được:** mỗi module test độc lập, spec-diff làm review nhanh hơn (đọc SPEC.md thay vì
  toàn bộ diff), swap provider trong `provider_access` không đụng `dossier_drafting`.
- **Đánh đổi:** thêm ceremony (6 SPEC.md, 6 `api.py`) so với 1 pipeline script — chấp nhận
  được vì đây là roadmap Phase 2, mục tiêu vốn là deploy target lâu dài, không phải MVP chạy
  1 lần.
- **Rủi ro:** `egress_gate` là trust boundary compliance-critical — nếu lỡ gộp vào
  `provider_access` và sau này cần audit riêng (GAMP5), phải tách lại giữa chừng. Đây là lý do
  open question ở §1 cần chốt sớm, trước khi có code phụ thuộc vào layout.

## Thứ tự implement (đề xuất)

1. **CLAUDE.md + glossary** (lớp 1, user yêu cầu) — làm trong turn này.
2. **SPEC.md template + scaffold rỗng cho cả 6 module** (chỉ thư mục + SPEC.md trống, chưa
   code) — validate boundary trước khi viết logic.
3. **`shared/` contract** — định nghĩa chính xác cái gì được vào `shared/` (db connection, auth)
   trước khi module đầu tiên cần dùng nó, tránh việc "tạm nhét vào shared/" rồi thành nợ.
4. **Vertical slice đầu tiên: `evidence`** — ít rủi ro nhất vì đã có triển khai tham chiếu
   (`cowork-p2-kit/ingest/*`), dùng để kiểm chứng layout + spec-diff workflow trước khi nhân
   rộng ra 5 module còn lại.
5. **Spec-diff review tooling** — ít nhất 1 checklist thủ công (chưa cần CI) cho reviewer đối
   chiếu SPEC.md diff với code diff.
6. **5 module còn lại theo thứ tự phụ thuộc:** `provider_access` → `egress_gate` (cần
   provider_access tồn tại để test) → `dossier_drafting` (cần evidence + egress_gate +
   provider_access) → `rendering` → `quality_gate` (chấm sau khi có draft + render).
7. **`main.py`** composition root + integration gate cuối cùng.

Khi bắt đầu code (bước 4 trở đi), nên chuyển "Thứ tự implement" này thành plan có gate đầy đủ
theo `RULE-BRAINSTORM-PLAN.md` (Invariant/Boundary/Fixture/Command/Evidence per gate) — ADR
này chỉ ghi quyết định + outline, không thay thế plan thực thi.

## Open questions

1. `egress_gate` tách hay gộp `provider_access`? (§1)
2. `quality_gate` chấm rubric bằng code thật hay vẫn LLM-assisted self-score? Ảnh hưởng
   `dossier_drafting` có phải expose thêm gì cho `quality_gate` không.
3. DB dùng chung — Postgres schema-per-module (namespaced) hay 1 flat schema? ADR này chỉ
   chốt "DB dùng chung được", chưa chốt schema-per-module.
