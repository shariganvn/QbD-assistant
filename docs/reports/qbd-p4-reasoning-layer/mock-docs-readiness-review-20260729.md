---
title: "Review — PO mock-document readiness"
date: 2026-07-29
workstream: qbd-cowork-mvp-po-pilot
review_type: readiness
status: ready-with-boundaries
related:
  - ./missing-data-human-approval-gap-review-20260729.md
  - ./po-junior-mock-package-preparation-guide-20260729.md
  - ../../decisions/D20260727-qbd-p4-reasoning-policy.md
---

# Review — PO mock-document readiness

## Kết luận

**GO** để nhận một bộ tài liệu **public/synthetic** từ PO và chạy thử trong môi trường cô lập.

**NO-GO** nếu mục tiêu là dùng kết quả để phê duyệt công thức, phát hành ra ngoài, hoặc để PO cài
và dùng như một quy trình production hoàn chỉnh.

Lần chạy đầu là một vòng **thử quy trình và tìm khoảng trống**. Nó cần trả lời ba câu:

1. Hệ thống có đọc đúng tài liệu PO giao không?
2. Mỗi số liệu có truy ngược đúng file, trang và công thức không?
3. Khi thiếu hoặc mâu thuẫn dữ liệu, hệ thống có dừng đúng chỗ và nói rõ cần người nào xử lý không?

## Phạm vi đã sẵn sàng

| Phần | Trạng thái hiện tại | Ý nghĩa cho lần chạy mock |
|---|---|---|
| Nhận DOCX/PDF public hoặc synthetic | Sẵn sàng trong phạm vi manifest | Có thể nhận đúng danh sách file PO giao; file ngoài danh sách bị chặn. |
| Trích xuất và lưu nguồn gốc | Sẵn sàng | Record giữ file, trang, đoạn trích và classification. |
| Gắn evidence với F-01/F-02/F-03 | Sẵn sàng ở mức prototype | Có thể phát hiện evidence sai công thức hoặc sai cohort. |
| So sánh theo rubric | Chỉ có rubric synthetic/test-only | Dùng để chứng minh cơ chế; không phải rubric FD được phép áp dụng thật. |
| Phát hiện thiếu/mâu thuẫn | Có một phần | Engine có thể trả `inconclusive`, nhưng chưa tạo danh sách công việc đầy đủ cho FD/PO. |
| Rationale cho người đọc | Có, nhưng luôn `internal_only` | Chỉ dùng để review nội bộ; không phải nội dung được duyệt để phát hành. |
| Human/FD approval | Chưa có workflow thực thi | Không có nút/lệnh approve, approval record, revoke hoặc production rubric pin. |
| Cài đặt trực tiếp cho PO | Chưa có UAT trên máy sạch của PO | Repo test pass chưa chứng minh quy trình cài đặt và vận hành độc lập. |

## Điều kiện nhận bộ mock

Chỉ bắt đầu khi đủ các mục sau:

- PO xác nhận toàn bộ file là public hoặc synthetic; không có dữ liệu nội bộ/confidential.
- Có danh sách **tên file chính xác**. Không chấp nhận “dùng folder này” hoặc “dùng bản mới nhất”.
- Mỗi file có công thức/hàm lượng liên quan, phiên bản hoặc ngày, và trạng thái “được trích” hay
  “chỉ tham khảo”.
- Có một câu hỏi pilot cụ thể, ví dụ: “F-01 và F-02 5 mg có đủ bằng chứng để đặt cạnh nhau không?”.
- Có người FD chịu trách nhiệm giải thích quy tắc khoa học và người PO điều phối.
- Có rubric draft hoặc ghi rõ `CHƯA CHỐT`. Nếu chưa chốt, kết quả đúng phải là `inconclusive`.
- Có expected result cho ít nhất ba tình huống: so sánh được, không được so sánh, và thiếu/mâu thuẫn.

Chi tiết file cần chuẩn bị nằm tại
[PO/junior mock-package preparation guide](./po-junior-mock-package-preparation-guide-20260729.md).

## Lần chạy mock được phép chứng minh gì?

Được phép kết luận:

- tài liệu có/không ingest được;
- record có đúng provenance và đúng formulation không;
- cohort có đúng không;
- số liệu nào có thể tạo fact card;
- nhánh nào trả selected **trong fixture synthetic** hoặc `inconclusive`;
- output có tái tạo được và có đủ bằng chứng để FD review không.

Không được phép kết luận:

- công thức nào được FD phê duyệt;
- rubric test là rubric sản phẩm thật;
- 5 mg và 10 mg được gộp nếu chưa có linear-formulation attestation;
- output được phép hiển thị ra ngoài;
- P.2.2/P.2.3 đã được soạn hoặc phê duyệt;
- hostile same-host TOCTOU trong D20260722 đã được đóng.

## GO/NO-GO cho bước kế tiếp

| Bước | Quyết định | Điều kiện |
|---|---|---|
| Nhận mock docs | GO | Đủ checklist intake và chỉ dùng public/synthetic. |
| Chạy thử cô lập | GO | Dùng bản sao dữ liệu, không ghi đè evidence lịch sử. |
| Sửa lỗi phát hiện từ mock | GO có kiểm soát | Mỗi symbol sửa phải có impact analysis, test và review. |
| Đánh giá readiness để PO cài | Chưa GO | Cần đóng gap xử lý dữ liệu thiếu/human approval và chạy install/UAT trên máy sạch. |
| Phát hành production | NO-GO | Chưa có FD-approved rubric, approval workflow và external-display authorization. |

## Evidence basis

- Input mẫu hiện tại gồm product profile và ba trial report:
  `cowork-p2-kit/inputs/src/`.
- Admission/classification contract:
  [`cowork-p2-kit/data-classification.md`](../../../cowork-p2-kit/data-classification.md).
- Bounded package rule:
  [`cowork-p2-kit/SKILL.md`](../../../cowork-p2-kit/SKILL.md).
- Current authority boundary:
  [`D20260727`](../../decisions/D20260727-qbd-p4-reasoning-policy.md).
- Rationale remains internal-only:
  [`cowork-p2-kit/RATIONALE-SKILL.md`](../../../cowork-p2-kit/RATIONALE-SKILL.md).

