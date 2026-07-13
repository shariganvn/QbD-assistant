# Brainstorm — Hybrid LLM provider (cloud ZDR + local) & agent data guardrails

- Ngày: 2026-07-11
- Trạng thái: Design đã chốt (3 quyết định user bên dưới); feeds P0.6/P1.4/P1.5. **KHÔNG mở `/ck:plan`** — toàn bộ P0 còn OPEN (exit criteria blockers doc).
- Context: `plans/reports/brainstorm-solution-direction-260709-2225-qbd-dossier-agent-p2-report.md` (LLMPort swappable), `plans/reports/blockers-p0-p1-260711-0832-tighten-po-spec-report.md`, canonical `docs/raw/phanhoi_1783672588171.md`

## 1. Problem

Pilot ghi nhận hướng chạy local LLM, nhưng local đánh đổi reasoning/writing — điểm ăn tiền của P.2 drafting. User muốn thêm option provider uy tín (Anthropic/OpenAI) với ZDR. Kèm câu hỏi: chặn agent tiếp cận dữ liệu nội bộ (dữ liệu thí nghiệm, tài liệu bản quyền) có phải "LLM agent guardrail" không, quy chuẩn nào áp dụng.

## 2. Facts đã verify

- "Local-only" trong project = **fallback fail-closed** (P0.6), không phải mandate. FD canonical cho phép external nếu chứng minh non-retention (`phanhoi_1783672588171.md:76`).
- P0.6 đã dự liệu split-path: *"Public web research có thể tách riêng nếu prompt không chứa nội dung nội bộ"* → hướng hybrid không đảo quyết định FD nào.
- Anthropic: ZDR là org-level config có thật; **Claude Fable 5 KHÔNG khả dụng dưới ZDR** (yêu cầu 30-day retention; org ZDR → 400 mọi request); **Opus 4.8 / Sonnet 5 dùng được dưới ZDR**. Nguồn: docs Anthropic qua claude-api skill 260711 — re-verify trong P1.4.
- OpenAI ZDR = enterprise approval-based — cần evidence ở P1.4, không mặc định có.
- **Vercel không cấp ZDR**; AI Gateway = thêm subprocessor vào chain mà P0.6 yêu cầu cover toàn bộ.
- FD chốt: máy chỉ điền phần tra cứu public (dược điển, nhãn FDA/EMA, paper), lab data để trống → cloud track cover phần lớn giá trị drafting pilot **mà không chạm internal data**.

## 3. Quyết định user (260711, không tự đảo)

| Điểm | Chọn |
|---|---|
| Routing policy | **Conditional gate**: hard wall mặc định (cloud chỉ nhận public data); provider pass checklist P0.6 với evidence packet → được promote xử lý internal-derived content |
| Vercel | **AI SDK làm code abstraction; key + contract ZDR ký thẳng provider** (không gateway) — chain subprocessor ngắn nhất |
| Local model | **Internal-track worker** (extraction/retrieval/bounded drafting trên approved corpus, scope P1.5) + fail-closed fallback; không phơi ra end-user như option chọn model |

## 4. Kiến trúc 3 lớp (trả lời câu hỏi "guardrail")

1. **Data access boundary** — deterministic, code-enforced: cloud-track agent *không có tool/credential* chạm internal store. Map: P0.3 (classification), P0.4 (consent manifest), P0.5 (retention). Đây là access control / data governance, KHÔNG phải "guardrail".
2. **Egress control** — router kiểm data-classification label trước mỗi LLM call; internal-derived content → chỉ đi local hoặc provider đã pass P0.6. Taint rule: prompt chứa nội dung derived từ internal doc = internal; thiếu label = mặc định internal (fail-closed).
3. **LLM guardrails đúng nghĩa** (runtime, probabilistic, defense-in-depth): grounding/citation enforcement, source tier, numeric sanity, injection defense — đã có trong brainstorm 260709 §5.

Nguyên tắc: system-prompt "cấm dùng internal data" **không phải security boundary** — boundary thật nằm ở lớp 1.

## 5. Standards map

- **LLM/agent security**: OWASP Top 10 for LLM Applications 2025 (LLM01 Prompt Injection, LLM02 Sensitive Info Disclosure, LLM06 Excessive Agency, LLM08 Vector/Embedding Weaknesses), OWASP GenAI Agentic AI Threats & Mitigations, MITRE ATLAS.
- **AI governance**: NIST AI RMF 1.0 + AI 600-1 (GenAI Profile), ISO/IEC 42001 (AIMS), ISO/IEC 23894 (AI risk).
- **Pharma**: GAMP 5 2nd ed. (computerized systems + AI), 21 CFR Part 11 / EU Annex 11 (audit trail, e-records), ALCOA+ data integrity, FDA draft guidance 01/2025 (AI hỗ trợ regulatory decision-making).
- **Patterns**: dual-LLM privileged/quarantined (Willison), CaMeL (DeepMind 2025), consent manifest + append-only audit (đã có trong design).

## 6. Approaches đã đánh giá

- **A — Conditional gate (CHỌN)**: ship giá trị cloud ngay trên public track, mở đường internal khi P0.6 pass.
- **B — Hard wall vĩnh viễn**: compliance đơn giản nhất nhưng tự giới hạn roadmap (drafting từ evidence nội bộ, P.3+, multi-product).
- **C — Redaction path**: loại — redaction dữ liệu R&D dược không chứng minh được sạch; P0.6 yêu cầu FD duyệt riêng.

## 7. Tác động lên blockers (input cho PO, không tự sửa blockers doc)

- **P0.6**: thêm input — đường cloud đề xuất = direct Anthropic (Opus 4.8 dưới ZDR) hoặc OpenAI enterprise ZDR, không gateway. Approver + checklist vẫn chờ PO điền.
- **P1.4**: evidence packet thu hẹp scope về 2 provider direct; phải gồm: contract ZDR, model availability dưới ZDR (Fable 5 bị loại), logging/abuse-monitoring, subprocessors, data region, deletion.
- **P1.5**: giữ nguyên — local internal-track vẫn phải spike (quality/latency/hardware).
- **P0.3**: seed product profile phải được classify — không mặc định "public" (việc phát triển generic bisoprolol có thể là trade secret).

## 8. Risks

- ZDR enterprise cần hợp đồng/approval → timeline ngoài kiểm soát dev; mitigate: public track không phụ thuộc gate này.
- Taint tracking sai → internal leak qua cloud track; mitigate: default-internal khi thiếu label + egress test tự động.
- Model dưới ZDR yếu hơn Fable 5; chấp nhận: Opus 4.8 vẫn frontier-class cho writing/reasoning.

## 9. Success criteria

- Egress test: prompt chứa evidence internal-derived **không bao giờ** đến provider chưa pass gate (fail-closed, test tự động).
- Cloud track điền được các mục public P.2.2.1/P.2.3.1 với citation đầy đủ, độ sâu so golden `135-00`.
- Audit log ghi `provider + data-classification + consent version` mỗi LLM call.

## 10. Next steps

1. Mang report này vào buổi PO decision sheet — đóng P0.6 (approver, checklist, local fallback).
2. P1.4 spike: evidence packet cho Anthropic direct ZDR + OpenAI enterprise ZDR.
3. Toàn bộ P0 đóng → mới chuyển `/ck:plan` (exit criteria blockers doc giữ nguyên).

## Unresolved questions

- Ai là compliance approver cho evidence packet? (P0.6 — PO chưa điền)
- OpenAI ZDR có available cho org này không? (cần enterprise contact)
- Pass/fail floor cho local track (thời gian/run, quality) — P1.5, PO chưa điền.
