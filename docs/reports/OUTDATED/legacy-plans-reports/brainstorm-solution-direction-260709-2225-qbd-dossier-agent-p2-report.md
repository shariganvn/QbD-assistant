# Brainstorm — Hệ thống AI Agent dựng hồ sơ đăng ký thuốc QbD (P.2 pilot)

- Ngày: 2026-07-09
- Domain: Regulated pharma dossier generation (QbD/ICH/CTD)
- Trạng thái: Design đã hội tụ, chờ chuyển `/ck:plan`

---

## 1. Problem statement

Đơn vị RD cần hệ thống AI agent hỗ trợ nhân viên FD dựng bộ hồ sơ đăng ký thuốc theo chuẩn QbD.
Luồng: search thông tin (Google/nguồn uy tín/sách chuyên môn/DB nội bộ) có trích dẫn kiểm chứng →
lưu DB sản phẩm → điền nội dung "PHÁT TRIỂN DƯỢC HỌC" vào form Word.

## 2. Requirements đã chốt (5 điểm)

1. **Output vòng 1**: điền form VN `docs/raw/P 2_form_Edit 29-09-2025-example.docx` (PHÁT TRIỂN DƯỢC HỌC)
   cho thuốc mẫu = **bisoprolol fumarate 5/10 mg film-coated tablet** (Concor generic),
   kèm citation inline + evidence log. Bản draft.
2. **Acceptance**: nội dung P.2 đạt độ sâu/đúng ~ golden example `135-00`; mọi luận điểm có citation
   kiểm chứng được; giữ nguyên cấu trúc form; FD review/sửa được.
3. **Scope boundary**: chỉ P.2 (VN), chỉ thuốc mẫu, chỉ draft. Module 3 (EN) + platform đa sản phẩm = vòng sau.
4. **Ràng buộc cứng**: Python; runtime/LLM provider swappable;
   DB + evidence + templating + guardrails tách rời & audit-ready; không đọc docx/pdf trực tiếp (liteparse);
   output tiếng Việt.
5. **Touchpoints**: 2 docx trong `docs/raw/` + `Quality-by-Design-for-ANDAs.pdf` (method ref) +
   corpus nội bộ (docx/pdf/excel ingest) + web search (Tavily / Google CSE, swappable qua SearchPort).

**Ưu tiên demo pilot (user nhấn mạnh):** agent search được → bỏ vào DB phù hợp → **audit được**.
Đây là vertical slice phải chứng minh TRƯỚC; điền docx đến sau.

## 3. Quyết định của user (không tự đảo)

| Điểm          | User chọn                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core system     | **Pipeline tự dựng Python** (`qbd_core` standalone) — runtime/LLM provider swappable qua adapters, không phụ thuộc framework agent cụ thể. |
| Scope vòng 1   | 1 sản phẩm end-to-end (pilot)                                                                                                                                                                  |
| Autonomy        | Draft cho người duyệt (human-in-the-loop)                                                                                                                                                     |
| Internal DB     | Có sẵn dạng file (docx/pdf/excel) → cần ingest                                                                                                                                              |
| Pilot drug      | Dùng thuốc trong file mẫu (bisoprolol fumarate FCT 5/10 mg)                                                                                                                                   |
| Runtime/LLM     | Python; LLM provider configurable qua `LLMPort`; yêu cầu decoupled + swappable + audit-ready                                                                                                   |
| Section vòng 1 | P.2 (VN) trước                                                                                                                                                                                 |
| Citation        | Inline + evidence log đầy đủ                                                                                                                                                                 |
| Build order     | Đích A, build theo B                                                                                                                                                                           |
| Search          | Web search qua SearchPort (swappable: Tavily / Google CSE); giữ provenance đầy đủ                                                                                                                |

## 4. Approaches đã đánh giá

- **A — Hexagonal target**: `qbd_core` Python standalone, orchestrate qua adapter ports. Đúng đích, khớp yêu cầu audit/swappable.
- **B — Pipeline-first**: dựng `qbd_core` standalone điền xong P.2 trước, sau gắn runtime adapter (có thể dùng LangGraph / CrewAI / custom loop). De-risk nhanh nhất.
- **C — Framework-native skills**: mỗi section = 1 agent skill/workflow, dựa nhiều vào memory của framework. Nhanh demo nhưng coupling chặt, rủi ro audit cao → loại cho regulated.

**Chốt: đích = A, build theo thứ tự B.**

## 5. Giải pháp khuyến nghị

### Kiến trúc (ports & adapters)

- **Runtime adapter (swappable)**: Agent loop (Python native, có thể swap sang LangGraph/CrewAI sau) — gọi tool, giữ *recipe* cách điền section.
  KHÔNG giữ product facts.
- **`qbd_core`** (Python package, thuần domain, không phụ thuộc framework agent cụ thể) expose PORTS:
  - `LLMPort` — provider swappable (OpenAI / Anthropic / Gemini / local).
  - `SearchPort` — adapter mặc định = Tavily web search (giữ quote nguyên văn);
    code bắt provenance (`url, title, quote, retrieved_at`) ghi EvidenceStore. Swap Google CSE sau nếu cần.
  - `KnowledgeDBPort` — product/drug_substance/formulation.
  - `EvidenceStorePort` — append-only, versioned.
  - `DocRenderPort` — điền docx tất định (không để LLM sinh thẳng vào file cuối).

### Nguyên tắc audit then chốt

Recipe/pipeline chỉ giữ **quy trình**, KHÔNG giữ **dữ kiện sản phẩm**.
Source of truth = `EvidenceStore` + `KnowledgeDB` (append-only, versioned) → đổi runtime/LLM/search provider vẫn tái lập & truy vết.

### Pipeline điền P.2 (5 bước)

1. **Intake** — product profile seed (bisoprolol fumarate FCT 5/10 mg).
2. **Research (tool)** — mỗi trường P.2 (độ tan, pKa, đa hình, BCS, tương kỵ tá dược…) → search web + intra-file corpus → fact + metadata nguồn.
3. **Evidence store** — lưu từng fact (`claim, value, unit, source, url/sách+trang, retrieved_at, quote, trust_tier, confidence`). Append-only.
4. **Section generation** — LLM soạn prose/bảng P.2 CHỈ từ evidence records (grounded), chèn marker citation → evidence ID.
5. **Deterministic docx fill** — map vào template P.2 giữ cấu trúc + phụ lục evidence log → **review gate**.

### Data model (SQLite pilot → Postgres sau)

`products`, `drug_substances`, `attributes(field,value,unit,evidence_id)`, `formulations`, `batches`,
`evidence(id,claim,source_type,source_ref,url,page,retrieved_at,quote,trust_tier)` (append-only),
`documents` (corpus ingest, chunk + vector), `audit_log(actor,action,target,ts)`.

### Guardrails

- Grounding: không evidence ID → không được viết claim (chống ảo giác).
- Source tier: whitelist/xếp hạng nguồn (dược điển, nhãn FDA/EMA, peer-review > web thường).
- Numeric/units sanity-check.
- Ngôn ngữ: output tiếng Việt, thuật ngữ dược đúng.
- Human gate: không mục nào "final" nếu chưa review.

## 6. Success metrics

- Vertical slice: 1 truy vấn thực → ≥1 evidence record đầy đủ provenance ghi vào DB → truy vết lại được từ audit_log. (ưu tiên #1)
- P.2 draft điền được ≥ các mục P.2.2.1 (vật lý + sinh học) và P.2.3.1 (tiền công thức) với mọi claim có citation.
- Đổi LLM provider / search backend → `qbd_core` vẫn chạy (test standalone) → chứng minh decoupling.
- Nội dung so được với golden `135-00` (cùng thuốc) về độ sâu.

## 7. Risks & mitigation

- Agent loop tự cải thiện vs audit → recipe/pipeline chỉ giữ quy trình, facts ở append-only store. Cần kỷ luật xuyên suốt.
- "Sách chuyên môn" dạng scan → cần OCR (liteparse hỗ trợ).
- Search provenance: web search API có thể nén/rút gọn nội dung → phải bắt raw url+quote+timestamp trước khi qua processing.
- Chi phí/nguồn search: giữ SearchPort swappable.

## 8. Open questions (chốt ở bước plan)

1. DB tech pilot: SQLite (khuyến nghị) hay Postgres ngay?
2. Vector store cho corpus ingest: pgvector / sqlite-vss / Chroma?
3. Runtime agent loop: custom Python loop hay dùng LangGraph / CrewAI? Deploy local dev hay VPS?
4. Corpus nội bộ thật: khi nào có? Pilot tạm ingest `135-00` + QbD PDF làm seed.
5. Web search API: Tavily (khuyến nghị) hay Google CSE? Cần đánh giá citation-grade.
6. Định dạng citation marker trong docx VN (số [1] hay footnote?).
