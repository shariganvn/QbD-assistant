# Brainstorm — Cowork P.2 MVP kit (đọc trial → chọn công thức → viết P.2.2/P.2.3)

- Ngày: 2026-07-12
- Trạng thái: Design hội tụ, chờ `/ck:plan`
- Context: định hướng "Chọn Claude Cowork làm MVP" trong `plans/reports/po-guide-blockers-p0-p1-260711-non-tech.md` (§ĐỊNH HƯỚNG QUAN TRỌNG).
  Supersede *sequencing* của `brainstorm-solution-direction-260709-2225` (qbd_core vẫn là đích deploy, KHÔNG bỏ).
  Khớp `brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails` (Cowork = cloud track, chỉ chạy data public).
  Canonical: `docs/raw/phanhoi_1783672588171.md`.

## 1. Problem

MVP chứng minh giá trị cốt lõi TRƯỚC khi build qbd_core: đọc 2–3 công thức + kết quả thử nghiệm →
reasoning chọn công thức tốt nhất (logic, defensible) → viết P.2.2/P.2.3 tiếng Việt, cite được,
lấy thêm từ tài liệu chỉ định. Trị bẫy FD nêu: "đánh giá dữ liệu thử nghiệm chưa mang tính logic cao".

## 2. Quyết định user (260712, không tự đảo)

| Điểm | Chọn |
|---|---|
| MVP artifact | **Cowork kit đầy đủ**: folder structure + SKILL + template P.2 làm sạch + rubric |
| Mock data | FD/PO thả **docx/pdf thô**; Dev build pipeline lọc/lưu/chuẩn bị cho reasoning + citation |
| Scope P.2 | Trọng tâm **P.2.2 (phát triển công thức) + P.2.3 (phát triển quy trình)** |
| Cowork access | Đã có, chạy ngay |
| Output format | **.docx** (end-user friendly) — ứng viên `iOfficeAI/OfficeCLI` |
| Decision logic | **Ma trận + văn xuôi reasoning + TL;DR** (đầy đủ tốt hơn) |

## 3. Facts đã verify

- **OfficeCLI** (`github.com/iOfficeAI/OfficeCLI`): C# single-binary CLI cho AI agent; hỗ trợ
  footnotes / hyperlinks / TOC / tables / comments / content controls; v1.0.135 (2026-07-10, actively maintained);
  Apache-2.0; install one-line curl; .NET runtime embedded (không cần cài Office). Khớp yêu cầu FD
  (canonical: "đánh số và chú thích chân trang, kèm link"). **Verify docx round-trip fidelity ở P1.2 trước khi khoá.**
- **liteparse** đã là dep repo (`@llamaindex/liteparse`) → dùng cho ingest docx/pdf (không đọc trực tiếp = tránh tràn context).
- MVP mock data = public/non-confidential → Cowork cloud hợp lệ theo P0.6; data thật confidential →
  chuyển đường egress-controlled (đích qbd_core), ngoài scope MVP.

## 4. Kiến trúc — 2 lớp deterministic bọc Cowork reasoning

1. **Ingest/extract** (dev, deterministic): raw docx/pdf → liteparse → structured store (JSON/md tables)
   + provenance mỗi record (file, trang, quote) phục vụ citation. Đây là "lọc, lưu, chuẩn bị reasoning + citation".
2. **Reasoning** (Cowork, `SKILL.md`): đọc store + reference docs → ma trận quyết định (tiêu chí × công thức → điểm)
   + văn xuôi reasoning + TL;DR → chọn công thức → draft P.2.2/P.2.3 grounded + cited.
3. **Render** (OfficeCLI, deterministic): draft → .docx (footnote/link/TOC/bảng) → FD review gate.

Nguyên tắc: ingest + render tái dùng thẳng cho qbd_core; Cowork = runtime adapter tạm (khớp "LLMPort swappable").
MVP không phá đích A.

## 5. Cấu trúc kit

```
cowork-p2-kit/
├── SKILL.md                  # quy trình đọc-reasoning-viết cho Claude
├── README.md                 # PO chạy thế nào (3 bước)
├── inputs/
│   ├── product-profile.md    # bisoprolol FCT 5/10mg, FD xác nhận
│   ├── trials/               # FD thả 2–3 file docx/pdf kết quả thử nghiệm
│   └── reference/            # tài liệu chỉ định (dược điển extract, nhãn FDA/EMA, QbD PDF)
├── template/
│   └── p2-template.*         # P.2.2 + P.2.3 làm sạch (chỉ cấu trúc, bỏ nội dung ví dụ)
├── rubric/
│   └── scoring-90-100.md     # rubric P0.1-C tự chấm mỗi lần chạy
├── store/                    # output ingest: structured tables + provenance
└── outputs/
    ├── p2-draft.docx         # bản nháp (render OfficeCLI)
    ├── evidence-log.md       # mỗi claim → nguồn
    └── formula-decision.md   # ma trận + văn xuôi + TL;DR chọn công thức
```

## 6. Quy trình SKILL (5 bước)

1. Ingest chạy trước → đọc structured store + product-profile → chuẩn hoá bảng so sánh
   (thành phần công thức, thông số quy trình, kết quả test: độ hoà tan, độ ổn định, hàm lượng, độ cứng, độ mài mòn…).
2. **Ma trận quyết định**: tiêu chí × công thức → điểm → lý do từng ô. Kèm văn xuôi reasoning + TL;DR.
   Lựa chọn phải truy vết được (trị bẫy "reasoning chưa logic").
3. Viết P.2.2 + P.2.3 tiếng Việt, grounded vào trial + reference.
4. Guardrails: không nguồn → "chờ dữ liệu"; không bịa số liệu lab; citation số + footnote + link; draft-only.
5. Tự chấm rubric → xuất draft .docx + evidence log + decision file.

## 7. Guardrails (carry-over brainstorm 260709 §5)

Grounding (no evidence → no claim); source tier (dược điển/nhãn FDA-EMA/PAR/paper Q1-Q3 > web thường);
numeric/units sanity-check; output tiếng Việt thuật ngữ đúng; human gate (draft only).

## 8. Scope boundary

- **Trong**: P.2.2 + P.2.3; 1 thuốc (bisoprolol FCT 5/10mg); mock public data; draft .docx; self-score rubric.
- **Ngoài**: P.2.1 / P.2.4+; Module 3 EN; multi-product; confidential/internal data; qbd_core full pipeline;
  UI review Đồng ý/Sửa/Bỏ (vòng sau); provider egress gate (dùng Cowork sẵn có).

## 9. Acceptance / success metrics

- Đọc 2–3 trial → decision matrix + rationale truy vết được → chọn 1 công thức + TL;DR.
- P.2.2/P.2.3 draft .docx: mọi claim có citation (số + footnote + link); mục thiếu lab data ghi "chờ dữ liệu";
  zero số liệu bịa.
- Tự chấm rubric P0.1-C ≥ 90/100 và **zero lỗi nghiêm trọng** (nhầm thuốc / bịa kết quả thử nghiệm).
- OfficeCLI render giữ footnote/link/TOC mở lại được (FD verify).

## 10. Risks & mitigation

- OfficeCLI docx fidelity chưa verify → P1.2 spike gate; fallback python-docx / template docx fill.
- Cowork reasoning non-deterministic → decision matrix + rubric làm auditable; chấp nhận chưa audit-grade như qbd_core (MVP).
- Trial mock data phi thực tế → FD cung cấp/duyệt file modify (đúng tinh thần P0.3).
- Citation sai provenance từ ingest → giữ raw quote + trang từ liteparse, không để LLM tự chế nguồn.

## 11. Quan hệ với qbd_core (đích A)

Lớp ingest + lớp render = component tái dùng cho qbd_core. Cowork thay pipeline reasoning tạm.
Khi chuyển deploy thật: gắn egress control + evidence store append-only + swap Cowork sang LLMPort. Không rework từ đầu.

## 12. Next steps

1. `/ck:plan` cho kit build (greenfield, không --tdd).
2. P1.2 spike: verify OfficeCLI docx fidelity (footnote + link + TOC round-trip).
3. FD cung cấp 2–3 file trial modify + confirm product profile.

## Unresolved questions

- Bộ tiêu chí + trọng số của ma trận quyết định ai duyệt? (FD — liên quan P0.8).
- OfficeCLI verify footnote + link round-trip chưa (P1.2) — nếu fail thì fallback nào chốt.
- Reference docs cụ thể nào đưa vào `inputs/reference/` vòng đầu?
