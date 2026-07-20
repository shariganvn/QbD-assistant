# Brainstorm — từ QbD document pipeline đến domain workspace có kiểm chứng

- Ngày: 2026-07-18
- Trạng thái: **Đã được user duyệt — active design framework**
- Mục đích: khung duy trì quyết định sản phẩm/kiến trúc; không phải implementation plan
- Phạm vi: đối chiếu bài học Gemini Notebook với thiết kế QbD-assistant hiện tại

## 1. Problem statement

Các tính năng phổ thông như chat với tài liệu, tóm tắt PDF và hỏi đáp theo nguồn sẽ nhanh chóng
bị commoditize. Giá trị bền vững phải nằm ở workflow ngành, quyền truy cập, audit, output kiểm tra
được, template vận hành và khả năng biến research thành công việc thực tế.

Câu hỏi thiết kế cho QbD-assistant:

> Project nên học gì từ hướng Gemini Notebook mà không biến thành một generic notebook cạnh tranh
> trực tiếp với Google, OpenAI hoặc Anthropic?

## 2. Requirements chốt cho khung này

| Mục | Quyết định |
|---|---|
| Expected output | Một report so sánh + khung ra quyết định duy trì dự án |
| Acceptance | Chỉ rõ điểm mạnh, gap, target architecture và thứ tự Now/Next/Later |
| Scope boundary | Không code; không đổi active ingest plan; không thêm review UI/code sandbox vào MVP |
| Non-negotiable | Public/mock-only MVP; provenance; deterministic ingest/render; draft-only; FD review; fail-closed |
| Touchpoints tương lai | `docs/system-architecture.md`, `docs/project-roadmap.md`, Phase 4 output contract, Phase-2 `qbd_core` |

## 3. Kết luận điều hành

QbD-assistant hiện **không còn là app chat với tài liệu**. Thiết kế đã có moat đúng: workflow QbD
chuyên ngành, evidence-grounded reasoning, decision matrix, deterministic render và human review.

Tuy nhiên, project hiện vẫn chủ yếu là:

> **pipeline tạo hồ sơ có kiểm chứng**, chưa phải **persistent, permissioned, auditable QbD
> workspace**.

Định hướng chốt:

> Tiến hóa pipeline hiện tại thành domain workspace; giữ domain-first, không notebook-first. Chat
> chỉ là interaction surface. Evidence, decision, review state, artifact và audit event mới là
> source-of-truth.

## 4. So sánh cốt lõi

| Moat cần xây | Thiết kế hiện tại | Mức trưởng thành | Gap chính |
|---|---|---:|---|
| Workflow riêng cho ngành | Trial → decision matrix → chọn công thức → draft P.2.2/P.2.3 → FD review | Mạnh | Chưa đóng vòng task sau review |
| Quyền truy cập rõ ràng | Data classification, `citable`, cloud/internal boundary, egress gate | Trung bình | Có data authorization; chưa có actor/workspace authorization |
| Audit log | Provenance + evidence log; `audit_log` mới nằm ở target `qbd_core` | Thấp–TB | Thiếu actor/action/time/config/correction lineage trong MVP |
| Output kiểm tra được | Quote/page/offset, citation, matrix, rubric, deterministic DOCX | Khá mạnh | Thiếu stable claim ID, review state, run/artifact lineage; gate thật còn mở |
| Template vận hành | `SKILL.md`, P.2 template, rubric, pipeline steps | Khá mạnh | Chưa version/authority/migration hóa template |
| Research → việc thật | Evidence → quyết định công thức → dossier draft | Khá mạnh | Chưa có owner/task/checkpoint/stale-impact/rework loop |
| Giữ trạng thái/resume | Store và file output theo run | Thấp | Chưa có persistent workspace aggregate và pickup point |
| Code execution | Chưa có | N/A cho MVP | Chỉ đáng thêm cho DOE/statistics/unit checks có khả năng tái lập |

## 5. Những gì phải giữ nguyên

### 5.1 Domain workflow là moat

Workflow cốt lõi tiếp tục là:

1. Ingest nguồn/trial có phân loại.
2. Tạo evidence record có provenance.
3. Chuẩn hóa và so sánh công thức.
4. Lập decision matrix + rationale + TL;DR.
5. Draft P.2.2/P.2.3 chỉ từ evidence hợp lệ.
6. Render DOCX tất định.
7. FD review và quyết định.

Không đổi product thành notebook tổng quát. Mỗi workflow mới phải là workflow QbD cụ thể, ví dụ
QTPP/CQA, CMA/CPP, risk assessment, control strategy hoặc section CTD xác định.

### 5.2 Hai lớp deterministic tiếp tục bọc reasoning

- Layer A: raw source → structured evidence store.
- Layer B: non-deterministic reasoning, bị ràng buộc bởi evidence contract.
- Layer C: structured draft → deterministic artifact.

LLM không trở thành source-of-truth và không trực tiếp tự phê duyệt output.

### 5.3 Security tiếp tục fail-closed

- Thiếu classification → internal.
- Không evidence ID → không claim.
- Cloud track không có credential chạm internal store.
- Không biến system prompt thành security boundary.

## 6. Những gì còn thiếu để thành workspace

### 6.1 Persistent workspace aggregate

Mỗi product/dossier cần một workspace ổn định, chứa tối thiểu:

- source set và source versions;
- assumptions/open questions;
- workflow runs và checkpoints;
- claims/decisions;
- review states;
- artifacts và versions;
- audit events;
- pickup point cho lần làm việc tiếp theo.

Chat history không phải aggregate root.

### 6.2 Actor authorization

Phải tách actor authorization khỏi data classification:

| Vai trò tối thiểu | Quyền định hướng |
|---|---|
| Author / FD contributor | Thêm nguồn, tạo draft, đề xuất sửa |
| FD reviewer | Accept/Edit/Reject claim kèm lý do |
| Approver | Chốt artifact version |
| Operator | Vận hành hệ thống; không mặc nhiên đọc confidential content |

Quyền phải scoped theo workspace/product và được chứng minh bằng negative tests.

### 6.3 Ba ledger riêng biệt

| Ledger | Câu hỏi phải trả lời |
|---|---|
| Evidence log | Claim dựa trên nguồn nào? |
| Decision log | Vì sao chọn/reject claim hoặc công thức? |
| Audit log | Ai làm gì, lúc nào, bằng model/tool/template/config nào? |

Append-only không đủ nếu thiếu correction/supersession lineage. Evidence sai phải được thay thế có
dấu vết, không được âm thầm overwrite hoặc tồn tại vĩnh viễn như sự thật hợp lệ.

### 6.4 Verifiable output contract

Phase 4 structured draft về sau phải mang đủ lineage để kiểm tra:

```text
artifact_version
  └── section_id
       └── claim_id
            ├── evidence_ids[]
            ├── rationale / decision_id
            ├── review_status
            ├── reviewer / reviewed_at
            ├── source_set_version
            └── generation_run_id
```

Footnote/link là presentation. Stable IDs và lineage mới là verification contract.

### 6.5 Research-to-work loop

Target loop:

```text
Source/trial
  → Evidence
  → Domain fact
  → Decision
  → Reviewed claim
  → Controlled artifact
  → Missing-data/rework task
  → Source mới
  → Affected output bị stale
  → Review lại
```

Một run không được coi là hoàn tất chỉ vì đã sinh DOCX. Nó hoàn tất khi output, evidence, review
state và việc còn mở đều truy vết được.

## 7. Approaches đã đánh giá

### A — Giữ batch pipeline thuần

**Ưu:** nhỏ, nhanh, phù hợp chứng minh MVP.
**Nhược:** trạng thái nằm rải trong file; khó resume, phân quyền, audit và mở rộng multi-user.
**Verdict:** hợp cho Now, không đủ làm product target.

### B — Pivot sang generic notebook

**Ưu:** UX quen thuộc; gom chat/source/code vào một bề mặt.
**Nhược:** cạnh tranh trực tiếp với platform lớn; scope nổ; làm loãng QbD moat; security/audit khó hơn.
**Verdict:** loại.

### C — Domain workspace bọc pipeline hiện tại

**Ưu:** giữ toàn bộ đầu tư ingest/reason/render; thêm state/access/audit đúng chỗ; workflow QbD
trở thành lợi thế; có thể mở rộng thêm template ngành.
**Nhược:** cần data model và lifecycle rõ; không thể chỉ dựa vào filesystem lâu dài.
**Verdict:** **khuyến nghị và đã được user duyệt**.

## 8. Quyết định kiến trúc duy trì dự án

1. **Domain-first, không notebook-first.**
2. **Pipeline hiện tại là execution core**, không bị thay bằng chat UI.
3. **Workspace/product là future aggregate root**, không phải chat session.
4. **Evidence/decision/review/artifact/audit là system-of-record.**
5. **MVP không thêm generic code sandbox.** Analysis runner chỉ mở khi có use case QbD bounded,
   reproducible và auditable.
6. **Template là governed artifact:** có ID/version/authority/input/output/gates/owner/migration.
7. **Source thay đổi phải có downstream stale-impact**, không âm thầm dùng artifact cũ.
8. **Không claim audit-ready/validated khi executable gate chưa có evidence.**

## 9. Now / Next / Later

### Now — bảo vệ và hoàn tất MVP

- Hoàn tất ingest và render gates hiện đang mở.
- Giữ public/FD-modified mock data.
- Hoàn thành reasoning workflow + ba artifact hiện có.
- Trước/khi làm Phase 4, chốt stable IDs và traceability fields trong output contract.
- Không mở review UI, RBAC production hoặc arbitrary code execution.

### Next — pipeline thành domain workspace

- Workspace/product aggregate.
- Versioned source set.
- Workflow run + checkpoint/pickup state.
- Claim/decision/review lifecycle.
- Workspace-scoped RBAC.
- Append-only audit event + correction lineage.
- Artifact versioning + stale-impact tracking.

### Later — mở rộng có điều kiện

- Review UI.
- Governed template registry cho workflow QbD tiếp theo.
- Search có policy/provenance.
- Bounded reproducible analysis runner cho DOE/statistics/risk/unit checks.
- Cross-surface access chỉ khi có business case và access boundary rõ.

## 10. Risks và countermeasures

| Risk | Countermeasure |
|---|---|
| Scope creep vì muốn bắt chước Gemini Notebook | Mọi feature phải chứng minh workflow QbD cụ thể và owner |
| Audit theater | Gate phải có actor, lineage, negative case và evidence artifact |
| Citation theater | Verify exact quote/entailment/source authority, không chỉ link tồn tại |
| Template drift | Version + authority + migration rule; không sửa template âm thầm |
| Workspace model quá sớm | MVP vẫn chạy file-based; chỉ freeze contract cần cho Phase 4 |
| Code execution tạo liability | Bounded task, pinned environment, input/code/output checksum, reproducible rerun |
| Source mới nhưng output cũ vẫn được dùng | Dependency graph + stale marker + mandatory re-review |

## 11. Success metrics và validation criteria

### MVP metrics hiện tại vẫn giữ

- Đọc 2–3 trial và tạo decision matrix có rationale.
- Mọi claim có evidence hoặc `chờ dữ liệu`.
- Zero fabricated lab numbers.
- DOCX + evidence log + formula decision được tạo và FD kiểm tra.

### Workspace target metrics

- 100% claim có stable ID và liên kết evidence/version/run.
- 100% review action có actor, timestamp, verdict và reason khi Edit/Reject.
- Source version đổi làm các dependent claim/artifact được đánh dấu stale.
- User quay lại workspace tiếp tục đúng checkpoint, không reconstruct bằng chat history.
- Negative authorization tests chứng minh cross-workspace access bị từ chối.
- Mỗi analysis run tái lập được từ input/code/runtime/config checksum.
- Không artifact nào được gọi final khi chưa qua reviewer/approver gate.

Các metric trên là **target**, không phải tuyên bố đã pass.

## 12. Maintenance checklist cho mọi feature mới

Trước khi đưa một feature vào roadmap, trả lời đủ:

1. Nó phục vụ workflow QbD cụ thể nào?
2. Actor/owner nào chịu trách nhiệm?
3. Input và output contract là gì?
4. Evidence/provenance được giữ ở đâu?
5. Quyền truy cập được enforce tại boundary nào?
6. Audit event nào phải ghi?
7. Output kiểm tra/reproduce thế nào?
8. Source/template thay đổi làm gì bị stale?
9. Negative path và fail-closed behavior là gì?
10. Có thể defer mà không phá MVP không?

Nếu không trả lời được các câu trên, feature chưa đủ chín để thành design decision.

## 13. Dependencies và next decision gates

- Phase 2 ingest + Phase 3 render phải đóng evidence-backed gates trước Phase 4.
- Phase 4 phải chốt structured draft lineage contract trước khi prose/output trở thành blob khó migrate.
- Real corpus, retention, ZDR/provider clearance và actor approval vẫn là external gates cho Phase 2.
- Workspace implementation cần brainstorm/plan riêng; report này chỉ giữ direction và invariants.

## 14. References

### Project sources

- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `cowork-p2-kit/SKILL.md`
- `cowork-p2-kit/store/records.schema.json`
- `plans/reports/brainstorm-260712-2329-cowork-p2-mvp-kit-direction-report.md`
- `plans/reports/brainstorm-solution-direction-260709-2225-qbd-dossier-agent-p2-report.md`

### External inspiration — fact vs inference

- Google đổi NotebookLM thành Gemini Notebook và tích hợp sâu hơn vào Gemini ecosystem:
  <https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/>
- Research/code execution rollout và source-grounded notebook direction:
  <https://blog.google/innovation-and-ai/products/notebooklm/better-research-notebooklm/>

Các product implication trong report là inference cho QbD-assistant, không phải requirement do
Google quy định.
