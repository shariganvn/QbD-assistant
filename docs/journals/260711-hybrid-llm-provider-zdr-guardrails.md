# Hybrid LLM Provider (Cloud ZDR + Local) & Agent Data Guardrails

- Ngày: 2026-07-11
- Loại: brainstorm / architecture decision (chưa implement)

## Điều đã làm

Brainstorm hướng LLM provider cho QbD P.2 pilot. User muốn thêm option cloud provider uy tín (Anthropic/OpenAI, reasoning/writing mạnh) bên cạnh hướng local, kèm câu hỏi về guardrail chặn agent tiếp cận dữ liệu nội bộ.

Output: `plans/reports/brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails-report.md` (đã đăng ký `active` trong docs-state.yaml, `docs:check OK — 12 docs`).

## Quyết định chính (user chốt, không tự đảo)

- **Routing = conditional gate**: hard wall mặc định (cloud chỉ nhận public data); provider pass checklist P0.6 với evidence packet → được promote xử lý internal-derived content.
- **Vercel = AI SDK abstraction only**: key + contract ZDR ký thẳng provider, không dùng AI Gateway (gateway = thêm subprocessor vào chain P0.6).
- **Local model = internal-track worker + fail-closed fallback** (scope P1.5), không phơi ra end-user như option chọn model.

## Insight quan trọng

- Scout xác nhận: "chạy local" trong project là **fallback fail-closed**, không phải mandate — FD canonical cho phép external nếu non-retention chứng minh được (`phanhoi:76`). Hybrid không đảo quyết định FD nào.
- **Sửa misconception**: Vercel không cấp ZDR — ZDR là org-level config/contract với chính provider.
- Verified qua docs Anthropic: **Claude Fable 5 không khả dụng dưới ZDR** (yêu cầu 30-day retention); Opus 4.8 / Sonnet 5 dùng được → nếu ZDR là hard requirement, ceiling là Opus 4.8.
- Phân tầng đúng tên gọi: (1) data access boundary = deterministic access control, (2) egress control = routing + taint tracking, (3) LLM guardrails = runtime checks. System-prompt "cấm dùng internal data" không phải security boundary.
- Standards map: OWASP LLM Top 10 2025, OWASP Agentic AI, NIST AI RMF/AI 600-1, ISO 42001/23894, MITRE ATLAS; pharma: GAMP 5 2nd ed, 21 CFR Part 11, Annex 11, ALCOA+.

## Còn mở

- Không mở `/ck:plan` — toàn bộ P0 còn OPEN (exit criteria blockers doc giữ nguyên).
- P0.6 cần PO điền approver + checklist; P1.4 spike evidence packet (Anthropic direct ZDR, OpenAI enterprise ZDR); OpenAI ZDR availability chưa rõ.
- Seed product profile phải classify trong P0.3 (không mặc định public).
