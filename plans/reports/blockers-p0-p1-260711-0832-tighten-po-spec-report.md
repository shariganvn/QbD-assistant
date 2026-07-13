# Blockers P0/P1 — Xiết spec với Product Owners cho pilot QbD P.2 VN

- Ngày: 2026-07-11
- Trạng thái: **Chờ PO/FD quyết định**
- Phạm vi: P.2 draft tiếng Việt, bisoprolol 5/10 mg viên nén bao phim, một sản phẩm
- Mục đích: biến các điểm mơ hồ thành quyết định kiểm chứng được trước `/ck:plan`
- Canonical business source: `docs/raw/phanhoi_1783672588171.md`
- Context source: `plans/reports/blindspot-260710-canonical-fd-handoff-qbd-p2.md`

## Cách dùng tài liệu

1. PO/FD điền trực tiếp phần **Quyết định** và **Owner / deadline** của từng P0.
2. Không chấp nhận câu trả lời “tương tự”, “đủ tốt”, “tùy trường hợp” nếu chưa có rubric hoặc rule đi kèm.
3. Một P0 chỉ được đóng khi đạt đầy đủ điều kiện **Gate resolved**.
4. P1 không dùng để trì hoãn quyết định business; P1 chỉ kiểm chứng tính khả thi hoặc cung cấp bằng chứng chọn kỹ thuật.
5. Chỉ chuyển `/ck:plan` khi toàn bộ P0 đã đóng. Không cần khóa provider, database, UI framework hoặc schema để đóng P0.

## Baseline không mở lại

- Pilot chỉ dựng bản nháp P.2 cho bisoprolol 5/10 mg, một sản phẩm.
- Tất cả subsection phải nhìn thấy; nội dung cần dữ liệu FD/lab phải hiện trạng thái thiếu dữ liệu rõ ràng.
- Agent không được tạo, suy diễn hoặc “điền cho đủ” dữ liệu thí nghiệm.
- Tài liệu nội bộ chỉ được dùng sau khi FD đồng ý.
- Review ở mức claim: Accept / Edit / Reject, kèm evidence.
- Citation hiển thị bằng số tham chiếu, footnote và link bấm được.
- Tài liệu nội bộ chỉ được gửi ra dịch vụ ngoài khi non-retention được chứng minh.
- Phải xử lý yêu cầu tình trạng lưu hành thuốc đối chứng và kiểm tra logic dữ liệu thử nghiệm.
- Hướng kỹ thuật vẫn là pipeline Python tự xây; Hermes đã loại.

---

# P0 — Business/spec blockers trước `/ck:plan`

## P0.1 — Định nghĩa “giống hồ sơ FDA 90%”

**Finding:** chưa rõ “hồ sơ FDA” là FDA QbD mock Acetriptan, 135-00, hay chuẩn chất lượng dossier nói chung. Text similarity với hai artifact này vừa sai sản phẩm vừa gây evaluation leakage.

**Khuyến nghị để PO duyệt:** dùng weighted dossier-readiness rubric:

| Dimension | Trọng số đề xuất |
|---|---:|
| Coverage cấu trúc và loại nội dung P.2 | 20% |
| Đúng fact của sản phẩm | 25% |
| Claim được evidence hỗ trợ trực tiếp | 20% |
| Provenance đầy đủ và truy xuất được | 10% |
| Trung thực với dữ liệu thiếu, không bịa | 10% |
| Logic QbD và tính nhất quán | 10% |
| Review/render usability | 5% |

**Hard gates đề xuất:** tổng ≥90%; không có wrong-product/fabricated critical fact; correctness, entailment và missing-data honesty mỗi mục ≥95%.

**PO/FD phải quyết định:** artifact tham chiếu; trọng số; ngưỡng; critical-error taxonomy; ai adjudicate test set.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** có rubric được ký duyệt, bộ test tách khỏi corpus sinh nội dung, cách tính điểm và zero-tolerance errors rõ ràng.

## P0.2 — Regulatory source-of-truth cho taxonomy P.2 VN

**Finding:** VN DOCX đang là structure candidate nhưng chứa nội dung chéo sản phẩm; workspace chưa có guideline/version chính thức làm chuẩn submission.

**PO/FD phải quyết định:** tên guideline/quy định; authority; version/effective date; ngôn ngữ ưu tiên; cách xử lý khi form nội bộ khác guideline.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** có bản guideline được định danh/version hóa và mapping P.2.1–P.2.7 được FD duyệt. VN DOCX chỉ còn vai trò layout/structure, không làm product truth.

## P0.3 — Pilot corpus và authoritative product profile

**Finding:** FD xác nhận corpus Word/PDF tồn tại nhưng chưa có manifest, readiness date hoặc nguồn truth sạch cho bisoprolol 5/10 mg. Các example hiện có đều contaminated/incomplete/mock.

**PO/FD phải cung cấp:**

- Manifest file pilot: ID, filename, revision/date, owner, classification.
- Product profile được FD xác nhận: active moiety/salt, strengths, dosage form, intended market, formulation/batch identity.
- Nhãn tài liệu: authoritative product evidence / supporting / methodology / evaluation-only / prohibited.
- Ít nhất một sample scan cũ và một tài liệu có bảng để spike extraction.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** manifest đóng version, product identity không mâu thuẫn, từng file có authority label và FD xác nhận đủ để chạy evaluation pilot.

## P0.4 — Consent granularity cho tài liệu nội bộ

**Finding:** “lúc nào máy cũng phải hỏi” chưa xác định hỏi theo file, run, batch, project hay time window.

**Các option:**

1. Per-document/per-run: kiểm soát mạnh, friction cao.
2. Versioned manifest + purpose + expiry: **khuyến nghị cho pilot**.
3. Standing project approval: nhanh nhưng rộng; chỉ dùng nếu FD chủ động chọn.

**PO/FD phải quyết định:** consent unit; approver; purpose; expiry; revocation; behavior khi manifest đổi; emergency stop.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** một run có thể trả lời rõ ai đã cho phép, cho phép dùng file nào, cho mục đích gì, trong thời gian nào và consent version nào.

## P0.5 — Retention của original và derived artifacts

**Finding:** parsed text, OCR, chunks, index, evidence quote, prompt, response và log đều có thể chứa nội dung nội bộ; chỉ nói về “file gốc” là chưa đủ.

**PO/FD phải quyết định theo từng artifact class:** có được tạo không; lưu ở đâu; retention bao lâu; ai truy cập; khi revoke thì delete hay giữ audit; backup/log có cùng policy không.

**Artifact classes bắt buộc:** original copy, OCR/parsed text, tables/images, chunks/index, evidence excerpt/snapshot, generated claims, prompts/responses, diagnostics, reviewer decisions.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** có retention matrix được FD/security/legal duyệt và không mâu thuẫn giữa deletion obligation với audit obligation.

## P0.6 — Tiêu chuẩn chứng minh external non-retention

**Finding:** “không dùng để train” không đồng nghĩa zero retention. Cần xét cả provider, gateway, logging, abuse monitoring và subprocessors.

**Tiêu chí pass đề xuất:** contractual retention; training/secondary use; logging; human access; subprocessors; data region/cross-border; deletion; incident handling; account settings; toàn bộ processing chain đều covered.

**Default đề xuất:** fail closed; nếu thiếu bằng chứng thì internal corpus chạy local-only hoặc không xử lý. Public web research có thể tách riêng nếu prompt không chứa nội dung nội bộ.

**PO/FD phải quyết định:** ai là compliance approver; bằng chứng nào đủ; redaction có được chấp nhận; local-only có phải hard fallback không.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** có checklist pass/fail, approver và fallback behavior; không cần chọn provider cụ thể ở gate này.

## P0.7 — Review accountability và workflow authority

**Finding:** FD chọn claim-level review nhưng câu hỏi ai duyệt cuối/ký vẫn chưa được trả lời.

**PO/FD phải quyết định:** roles; ai được Accept/Edit/Reject; có cần dual review không; ai resolve conflict; edit có cần evidence mới không; ai sign off draft/export; trạng thái nào được phép xuất.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** có role/authority matrix và state-transition rules; hệ thống không bao giờ tự final/sign.

## P0.8 — Scope của trial-logic checking

**Finding:** “dữ liệu thử nghiệm chưa logic” có thể trải từ arithmetic consistency đến scientific validity. Nếu không chặn scope, pilot sẽ biến thành hệ thống phán quyết chuyên môn.

**Khuyến nghị pilot:** chỉ Level 1 mechanical consistency: unit/total, batch/trial IDs, missing result nhưng có conclusion, risk change không có evidence, result/conclusion ngược chiều, wrong product/substance, absent table/reference.

**Ngoài pilot:** scientific plausibility chỉ khi có FD-approved rulebook; regulatory sufficiency luôn do người có chuyên môn quyết định.

**PO/FD phải quyết định:** rule list; severity; false-positive tolerance; owner disposition; `CANNOT ASSESS` behavior.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** rulebook v1 có sample pass/warn/fail, escalation owner và tuyên bố rõ checker chỉ advisory.

## P0.9 — Reference-product market-status policy

**Finding:** market status thay đổi theo thời gian và jurisdiction; “được cấp phép”, “đang bán”, “ngừng kinh doanh” và “withdrawn vì safety” không tương đương.

**PO/FD phải quyết định:** target jurisdiction(s); official authority; comparator role; freshness/recheck interval; xử lý khi status conflict/unverified; ai xác nhận comparator suitability.

**Minimum record:** product, active substance, strength/form, MAH, authorization ID, jurisdiction, claimed role, official status terminology, relevant dates/reason, official source, retrieved/source-updated dates, next review.

**Quyết định:** _Chưa điền_

**Owner / deadline:** _Chưa điền_

**Gate resolved khi:** có jurisdiction/source/freshness policy và trạng thái `UNVERIFIED`; không mặc định Concor là reference product chỉ vì xuất hiện trong example.

---

# P1 — Spikes/evidence gates trước chọn kỹ thuật hoặc chốt acceptance

## P1.1 — OCR và document extraction

**Giả thuyết:** pipeline local có thể trích text, bảng và locator đủ để tạo evidence từ corpus pilot.

**Spike set:** native Word/PDF, scan cũ, rotated/blurred page, multilingual table, footnote.

**Output bắt buộc:** accuracy theo loại content; OCR confidence; failure modes; tỷ lệ cần human correction; mapping evidence về page/table/cell.

**Pass/fail cần PO/FD đặt:** _Chưa điền_

## P1.2 — DOCX/render/review fidelity

**Giả thuyết:** có thể giữ taxonomy, numbering, tables, footnotes, clickable links và claim review lineage trong output chấp nhận được.

**Output bắt buộc:** golden render sample; visual diff; link/footnote test; round-trip Edit behavior; danh sách format không support.

**Pass/fail cần PO/FD đặt:** _Chưa điền_

## P1.3 — Claim–evidence quality

**Giả thuyết:** system có thể tạo claim atomic và evidence trực tiếp entail claim, không chỉ cùng chủ đề.

**Output bắt buộc:** FD-adjudicated test pack; precision/recall hoặc rubric tương đương; unsupported/wrong-product/conflict rates; error taxonomy.

**Pass/fail đề xuất:** zero critical fabrication/wrong-product; entailment floor khớp P0.1.

## P1.4 — External-processing compliance

**Giả thuyết:** ít nhất một processing path có thể chứng minh đáp ứng checklist P0.6.

**Output bắt buộc:** evidence packet theo toàn processing chain; gaps; account settings; contractual versus technical controls; local-only comparison.

**Lưu ý:** spike có thể kết luận “không provider nào pass”; đó là kết quả hợp lệ và kích hoạt local-only.

## P1.5 — Local-only feasibility

**Giả thuyết:** extraction, retrieval và bounded drafting trên approved corpus đạt chất lượng/latency tối thiểu mà không gửi nội dung nội bộ ra ngoài.

**Output bắt buộc:** representative workload; hardware assumptions; quality; latency; operational burden; unsupported cases.

**Pass/fail cần PO/FD đặt:** thời gian tối đa/run, quality floor và manual fallback.

## P1.6 — Market-status source accessibility

**Giả thuyết:** official sources cho jurisdiction mục tiêu có thể truy xuất, định vị, lưu provenance và refresh theo policy.

**Output bắt buộc:** 3–5 representative lookups; source stability; status vocabulary mapping; freshness; conflict/unavailable cases.

**Không được làm:** dùng pharmacy listing thay official evidence khi official status chưa rõ.

## P1.7 — Trial-logic rule validation

**Giả thuyết:** Level 1 checks tìm được lỗi hữu ích mà không tạo quá nhiều false positives.

**Output bắt buộc:** anonymized historical trial set; rule-by-rule findings; false-positive/false-negative review; severity calibration; FD disposition time.

**Pass/fail cần PO/FD đặt:** acceptable false-positive rate, critical miss tolerance và max review burden.

## P1.8 — Source rights và durable provenance

**Giả thuyết:** hệ thống được phép lưu đủ excerpt/snapshot/locator để audit citation từ pharmacopoeia, licensed và paywalled sources.

**Output bắt buộc:** source-class rights matrix; được lưu gì; retention; redisplay constraints; fallback nếu chỉ được lưu locator.

**Pass/fail:** citation vẫn kiểm chứng được mà không vi phạm license/copyright/access control.

---

# PO decision sheet — bản rút gọn cho buổi làm việc

| ID | PO/FD phải chốt | Owner | Deadline | Status |
|---|---|---|---|---|
| P0.1 | Rubric và hard gates cho “FDA 90%” |  |  | OPEN |
| P0.2 | Regulatory guideline/version |  |  | OPEN |
| P0.3 | Pilot manifest + product profile |  |  | OPEN |
| P0.4 | Consent unit, expiry, revocation |  |  | OPEN |
| P0.5 | Derived-data retention matrix |  |  | OPEN |
| P0.6 | Non-retention proof + local fallback |  |  | OPEN |
| P0.7 | Reviewer/signer authority |  |  | OPEN |
| P0.8 | Trial-rule scope v1 |  |  | OPEN |
| P0.9 | Market jurisdiction/source/freshness |  |  | OPEN |

## Exit criteria để handoff sang `/ck:plan`

- Tất cả P0 có status `RESOLVED`, decision, owner và dated approval.
- Không còn conflict giữa consent, retention, audit và external-processing policy.
- Có pilot corpus manifest và clean evaluation pack tách khỏi generation corpus.
- P.2 taxonomy đã map theo regulatory source-of-truth.
- “90%” có công thức tính, hard gates và người adjudicate.
- Trial checking và market-status đều có bounded scope.
- P1 nào ảnh hưởng feasibility cốt lõi đã có kết quả; P1 còn lại có owner và acceptance threshold.

Nếu chưa đạt các điều kiện trên: tiếp tục refinement/spike, **không tạo implementation plan**.

## Non-goals giữ nguyên

- Không bịa hoặc suy diễn lab/experimental data.
- Không dùng example/mock/scaffold làm target-product truth.
- Không tự phê duyệt, ký hoặc quyết định regulatory sufficiency.
- Không ingest corpus thiếu recorded consent.
- Không mặc định external provider compliant.
- Không mở rộng full Module 3, nhiều sản phẩm hoặc production platform.
- Không khóa provider, database, vector store, UI framework hoặc schema trước bằng chứng.

