# Blindspot scan — Hermes-first + hexagon swappable cho QBD P.2 agent (2026-07-09)

## TL;DR
Ba điểm mù lớn nhất, không nằm trong brainstorm:
1. **Hermes bị strip mất thứ làm nó nhanh.** Rule audit của chính bạn ("memory chỉ giữ recipe, KHÔNG giữ facts") + SearchPort swappable đã gỡ bỏ 2 differentiator chính của Hermes (persistent memory + built-in search). Cái còn lại — agent loop + web_search — có thể phải wrap sau port, nên phần "tăng tốc MVP" có thể bị integration-friction ăn hết. Cần định lượng Hermes THẬT SỰ mua được gì.
2. **Golden 135-00 và form VN là HAI cây taxonomy khác nhau.** Golden = English CTD `3.2.P.2.x`; form đích = VN `P.2.x`. DocRenderPort phải làm crosswalk thủ công — đây là domain work chưa được tính, không phải map 1:1.
3. **Metric "sâu ngang golden" bất khả thi cho phần thực nghiệm.** Độ sâu của golden đến từ DoE/formulation study/scale-up = dữ liệu lab độc quyền, KHÔNG search được. Grounding rule "no evidence → no claim" đúng, nhưng nó mâu thuẫn trực tiếp với metric #4 "so độ sâu golden".

## Bối cảnh scan
- Không phải git repo → không mine được git footprint (touchpoint checklist rút từ cấu trúc docx + kiến trúc brainstorm thay thế).
- Nguồn đọc: `plans/reports/brainstorm-...-p2-report.md`, `docs/raw/P 2_form_Edit...docx` (1059 dòng, 32 bảng), `docs/raw/135-00-...docx` (2030 dòng), KBGMP index (491 docs qua qmd), `docs/liteparse-scout.md`.

## Touchpoint checklist (rút từ cấu trúc docx + kiến trúc)
- [ ] `docs/raw/P 2_form_Edit 29-09-2025-example.docx` — template đích, DocRenderPort phải giữ nguyên 32 bảng + heading VN. Cấu trúc: P.2.1 → P.2.2.1 (dược chất: vật lý dòng 63, sinh học dòng 117) → P.2.2.2 (tá dược: lý hóa 136, tương kỵ 149) → P.2.3.1 (tiền công thức 231, nghiên cứu công thức 392).
- [ ] `docs/raw/135-00-...docx` — golden benchmark, KHÔNG dùng làm ingest seed (xem Pothole circular-eval).
- [ ] `EvidenceStorePort` + `audit_log` — vertical slice #1 phụ thuộc port này chạy TRƯỚC; đây là thứ phải chứng minh đầu tiên, không phải docx fill.
- [ ] `SearchPort` adapter (Hermes web_search/web_extract) — điểm rủi ro provenance cao nhất (xem Unknown #2).
- [ ] Crosswalk EN-CTD ↔ VN taxonomy — artifact domain mới, chưa có trong brainstorm.
- [ ] Ingest pipeline (liteparse) — OCR sách VN scan + diacritics (rủi ro chất lượng).

## Unknown unknowns

- **Hermes còn lại gì sau khi bị strip?** — evidence: brainstorm dòng 71 ("memory chỉ giữ quy trình, KHÔNG giữ dữ kiện") + dòng 64 (SearchPort swappable). Hai quyết định này đúng cho audit, nhưng gỡ mất memory-as-state và search-as-builtin. Còn lại chủ yếu agent loop. Câu hỏi chưa trả lời: một custom loop mỏng (LLM API + tool dispatch) có nhanh hơn học + wrap + deploy Hermes không? "Tăng tốc MVP" là giả định chưa đo.

- **Provenance qua Hermes web_extract có đạt citation-grade không?** — evidence: brainstorm dòng 107 tự nhận "web_extract nén nội dung → phải bắt raw url+quote+timestamp TRƯỚC khi nén". Nhưng nếu API Hermes chỉ trả bản đã nén (không có quote nguyên văn + URL ổn định + timestamp), thì SearchPort-qua-Hermes KHÔNG thể tạo evidence record đạt chuẩn — mà đó chính là success metric #1 (dòng 98). Đây là mâu thuẫn: "Hermes để nhanh" vs "provenance audit-grade là slice #1 phải chứng minh". Rủi ro: buộc swap Tavily/CSE ngay ngày 1 → Hermes chưa từng là đường nhanh.

- **Golden ≠ form: crosswalk taxonomy** — evidence: golden dùng `3.2.P.2.1.1.1 Physicochemical properties` (dòng 43 golden), form VN dùng `P.2.2.1.1 Đặc tính vật lý` (dòng 63 form). Golden có QTPP/CQA/DoE/scale-up (dòng 51-62 golden) mà form VN cấu trúc khác hẳn. Map golden→form KHÔNG 1:1, phải xây bảng đối chiếu domain. Brainstorm coi hai doc là "cùng thuốc, so độ sâu" (dòng 101) — bỏ qua rằng chúng khác cây mục lục.

- **Metric #4 mâu thuẫn metric #2** — evidence: metric #2 (dòng 99) đã thu hẹp đúng về P.2.2.1 + P.2.3.1 tiền công thức (phần literature-derivable). Nhưng metric #4 (dòng 101) lại đòi "so độ sâu golden" — mà golden sâu nhờ formulation study/DoE (dòng 52) = data lab độc quyền, agent search không ra. Hai metric xung đột; cần bỏ/hạ metric #4 hoặc tách rõ subsection nào "search được" vs "cần data lab".

- **Internal DB thực chất không tồn tại cho pilot** — evidence: Open Q#4 (dòng 115) tự nhận corpus chưa có, đề xuất seed bằng `135-00` + QbD PDF. KBGMP index (491 docs, qmd) là project GMP inspection findings — bisoprolol chỉ xuất hiện như đối tượng anonymize (`kbgmp/data/raw/data/Defeciences-ANONYM.md:171`), KHÔNG phải nguồn QbD development. Nghĩa là "internal DB có sẵn" (quyết định user dòng 39) chưa có nội dung dùng được cho P.2. Pilot phụ thuộc web search nhiều hơn brainstorm giả định.

## Potholes

- **Circular eval: seed evidence store bằng golden 135-00** — evidence: Open Q#4 (dòng 115) đề xuất "ingest 135-00 làm seed". Nhưng 135-00 chính là benchmark acceptance (dòng 20, 101). Nếu agent "research" fact từ chính document nó bị đem so → chất lượng ảo cao, không đo được khả năng generalize. Giữ 135-00 làm held-out, KHÔNG ingest.

- **Ordering không nhất quán: 3 quyết định không cùng đúng** — evidence: (a) "Hermes ưu tiên tăng tốc" (dòng 36), (b) build order B = "pipeline standalone trước, cắm Hermes sau" (dòng 50, 53), (c) vertical slice #1 = search→DB→audit phải chứng minh trước (dòng 29-30). Nếu SearchPort default = Hermes, thì slice #1 cần Hermes-search chạy SỚM → phá "cắm Hermes sau" của order B. Chọn 2/3 được, không phải cả 3. Cần chốt: build B bằng adapter non-Hermes (Tavily) trước rồi thêm Hermes sau (→ Hermes không phải accelerator, là deferred), HAY tích hợp Hermes sớm (→ không thật sự theo order B).

- **YAGNI drift trên hexagon** — evidence: brainstorm §5 liệt 5 ports + append-only versioned store + audit_log + vector store + SQLite→Postgres cho 1 thuốc / 1 section / bản draft. LƯU Ý: đây là quan sát, KHÔNG phải khuyến nghị cắt — user đã chốt "decoupled + swappable + audit-ready" là ràng buộc cứng (dòng 24, requirement #4), và EvidenceStore/audit_log được justify bởi yêu cầu audit. Điểm cần cân nhắc: LLMPort + SearchPort + full scaffolding NGÀY 1 có thể hoãn; chỉ 2 port audit-critical (EvidenceStore, DocRender) là bắt buộc cho slice #1. Grow phần còn lại khi swap thật xảy ra.

- **OCR sách VN scan + diacritics** — evidence: risk #2 (dòng 106) "sách chuyên môn scan → OCR". liteparse hỗ trợ OCR (`docs/liteparse-scout.md:19`), nhưng chất lượng OCR tiếng Việt có dấu + danh pháp hóa học chưa kiểm chứng. Fact sai từ OCR lỗi vẫn được ghi evidence store với vẻ "có nguồn" → nguy hiểm hơn không có fact.

- **Hermes deployment phụ thuộc subscription** — evidence: Open Q#3 (dòng 114) chưa rõ local dev hay VPS, có Nous Portal/Firecrawl managed không. Nếu web_search Hermes cần managed subscription → external dep + cost + auth chưa giải quyết; "đường nhanh" có thể bị chặn ngay ở setup.

## Open questions (cho human)
1. Hermes web_search/web_extract có trả **quote nguyên văn + URL ổn định + timestamp** không? (quyết định SearchPort default có khả thi hay phải Tavily ngày 1).
2. Chốt ordering: SearchPort đầu tiên chạy bằng Hermes hay Tavily? (giải mâu thuẫn Hermes-first vs order-B vs slice-#1).
3. Subsection nào của P.2 là literature-derivable (agent làm được) vs cần data lab FD (agent không tạo ra)? → định lại metric acceptance.
4. Crosswalk EN-CTD (golden) ↔ VN taxonomy (form): ai xây bảng đối chiếu, khi nào?
5. Hermes chạy ở đâu, có Nous Portal/Firecrawl subscription không?
6. Nếu strip memory + wrap search, Hermes còn mua được gì so với custom loop mỏng? (justify lại lựa chọn runtime).

## A Better Prompt

```
Plan MVP pilot cho AI agent dựng P.2 (Phát triển dược học, VN form) cho bisoprolol
fumarate FCT 5/10 mg. Kiến trúc: hexagon (ports & adapters), đích = Hermes orchestrate
qbd_core decoupled; build order = pipeline-first (B). Nhưng TRƯỚC khi lock Hermes làm
runtime + SearchPort default, plan phải giải quyết các ràng buộc sau:

1. SPIKE Hermes provenance TRƯỚC (trước mọi thứ khác): xác minh web_search/web_extract
   trả được quote nguyên văn + URL ổn định + timestamp đạt citation-grade. Nếu KHÔNG →
   SearchPort default = Tavily/CSE, Hermes hạ xuống runtime-only hoặc bỏ. Đây là gate
   quyết định, không phải giả định.

2. Vertical slice #1 = search→EvidenceStore→audit_log truy vết được, dùng adapter search
   nào PASS spike ở bước 1 (không mặc định Hermes). qbd_core chạy standalone, không phụ
   thuộc Hermes cho slice này.

3. Xây crosswalk taxonomy: golden 135-00 dùng English CTD (3.2.P.2.x, có QTPP/CQA/DoE),
   form đích dùng VN (P.2.2.1 dược chất / P.2.2.2 tá dược / P.2.3.1 tiền công thức).
   DocRenderPort map theo cây VN, KHÔNG copy cây golden.

4. Phân loại subsection P.2 thành: (a) literature-derivable — agent search+ground được
   (đặc tính vật lý/sinh học dược chất, BCS, tương kỵ tá dược từ tài liệu tham khảo);
   (b) experiment-derived — cần data lab FD (formulation study, DoE, dissolution method
   dev, scale-up). Agent CHỈ cam kết (a). Metric acceptance chỉ đo (a); bỏ metric "sâu
   ngang golden" cho phần (b).

5. KHÔNG ingest 135-00 vào evidence store — giữ làm held-out benchmark (tránh circular eval).
   Pilot corpus seed = QbD-for-ANDAs PDF (method ref) + web search; KBGMP index KHÔNG chứa
   QbD development data (là GMP inspection findings).

6. Scope hexagon ngày 1: chỉ 2 port audit-critical (EvidenceStorePort append-only versioned,
   DocRenderPort deterministic). LLMPort + SearchPort thêm khi cần; giữ interface nhưng
   không over-build adapter chưa dùng. SQLite pilot; audit_log từ đầu (không hoãn).

7. Guardrails bắt buộc slice #1: grounding (no evidence ID → no claim), source tier
   whitelist, numeric/unit sanity, human review gate. OCR fact (sách VN scan) đánh dấu
   trust_tier thấp + cần verify.

Deliverable plan: phase spike-provenance → phase evidence-slice → phase docx-crosswalk-fill,
với gate quyết định Hermes ở cuối phase spike.
```

## Handoff
Đây là brainstorm evaluation read-only. Paste **A Better Prompt** vào `ck:plan` (hướng đã rõ, chỉ cần chốt 6 open question ở trên trước hoặc trong lúc plan). Điểm phải quyết trước khi code: kết quả spike provenance Hermes (open Q#1) — nó quyết định toàn bộ SearchPort + việc Hermes có xứng là "đường nhanh" không.

---

## Quyết định chốt (2026-07-09) — BỎ Hermes, xây pipeline tự dựng

**Chốt:** loại Hermes agent khỏi kiến trúc. Lý do: rule audit ("memory chỉ giữ recipe, KHÔNG giữ facts") + SearchPort swappable đã gỡ cả 2 differentiator của Hermes (memory-as-state + built-in search); phần còn lại chỉ là agent loop, tự viết mỏng hơn được. Bỏ Hermes còn xoá luôn rủi ro provenance (Unknown #2).

**Kiến trúc thay thế (hexagon giữ nguyên, chỉ đổi 3 adapter — `qbd_core` không đổi 1 dòng):**
- Runtime → **Python pipeline thuần** (DAG tất định trên danh sách trường P.2; vòng lặp research per-field ~100 dòng, KHÔNG cần agent framework). LangGraph chỉ thêm nếu loop phức tạp lên.
- `SearchPort` → **Tavily** (trả `url + quote + timestamp` citation-grade → giải provenance), swap CSE/Serper sau.
- `LLMPort` → **LiteLLM** (provider-swappable, library không framework).
- DB → **SQLite** pilot.

**UX (tách rời runtime):** KHÔNG chat-first. Pipeline = batch job đổ vào store; UI ngồi trên store. Bậc thang: **CLI + HTML audit report (slice #1) → Streamlit review app (slice #2, FD accept/reject từng claim kèm evidence) → web Next.js (production, vòng sau)**.

**TODO:** cập nhật lại file brainstorm `plans/reports/brainstorm-...-p2-report.md` theo quyết định này (§3 bảng quyết định user, §4 approaches, §5 kiến trúc runtime, §7 risks). Chưa làm — để sau.
```
