---
title: "Gap review — missing-data handling and human approval"
date: 2026-07-29
workstream: qbd-cowork-mvp-missing-data-approval
review_type: gap-analysis
status: open-gaps
purpose: plan-and-test-input
related:
  - ./mock-docs-readiness-review-20260729.md
  - ./po-junior-mock-package-preparation-guide-20260729.md
  - ../../decisions/D20260727-qbd-p4-reasoning-policy.md
---

# Gap review — missing-data handling and human approval

## Kết luận

Project đã biết **dừng** khi một số dữ liệu thiếu, sai đơn vị, mâu thuẫn hoặc chưa được rubric cho
phép. Project chưa có vòng kín:

```text
phát hiện thiếu → giao đúng người bổ sung → nhận file mới → kiểm tra lại → human approve → lưu dấu vết
```

Vì vậy nhánh tiếp theo cần đóng phần **data-gap report + approval record + rerun lifecycle** trước khi
PO có thể dùng trực tiếp.

## Những gì đã có

- Engine kiểm tra rubric trước khi chấm điểm.
- Thiếu critical cell, sai unit/grammar, value mismatch, conflict, uncited result, hard-gate failure,
  tie hoặc sensitivity instability đều không được tự biến thành winner.
- Kết quả có thể là `inconclusive`, `winner: null`, kèm `fd_action` code.
- Evidence, decision và publication receipt có hash binding.
- Rationale có thể giải thích hai nhánh inconclusive đã được seal: rubric pin thiếu và tie/sensitivity.

## Gap register

| ID | Phần còn thiếu | Hiện trạng cụ thể | Vì sao cần đóng |
|---|---|---|---|
| MD-01 | Lý do thiếu chưa đủ cụ thể | Missing critical cell trả một code chung; không nói rõ `F-02 thiếu assay` hay nguồn nào cần bổ sung. | FD/PO không biết phải làm việc gì tiếp theo. |
| MD-02 | Mất chi tiết khi trả inconclusive sớm | `buildInconclusive()` xuất `matrix_cells: []` và `candidate_reviews: []`, kể cả khi engine đã đọc được một phần dữ liệu. | Người review không thấy phần nào đủ và phần nào thiếu. |
| MD-03 | Chưa có data-gap report | Không có artifact riêng chứa candidate, measure, lý do, nguồn mong đợi, owner, trạng thái và lịch sử xử lý. | Không theo dõi được gap qua nhiều lần bổ sung tài liệu. |
| MD-04 | Không tìm thêm dữ liệu | Skill cố ý coi supplied package là toàn bộ corpus và cấm search/retrieve thêm file. | Đây là boundary an toàn đúng, nhưng cần một bước human request thay vì tự search. |
| MD-05 | Rationale chưa hiểu mọi mã inconclusive | Causal mapping hiện chỉ nhận `E_RUBRIC_PIN_REQUIRED` và `E_TIE_OR_SENSITIVITY_UNSTABLE`; nhiều code khác sẽ không seal được. | Các lỗi thực tế như thiếu cell, sai unit hoặc uncited result chưa đi tới báo cáo dễ đọc. |
| MD-06 | Chưa có rubric approval thật | Schema hiện chỉ có `proposal` và `test-approved`; production pin vẫn `null`. | Không được phép áp dụng rubric thật hoặc chọn công thức thật. |
| MD-07 | Chưa có human approval artifact | Không có approve command, người duyệt/ngày/phạm vi/hash, trạng thái superseded/revoked. | Không chứng minh được ai đã duyệt chính xác version nào. |
| MD-08 | Chưa có vòng bổ sung và chạy lại | Chưa có case ID liên kết gap cũ với input mới và kết quả rerun. | Có thể đóng nhầm gap bằng file/rubric không liên quan. |
| MD-09 | Chưa có external-display gate | Rationale luôn `internal_only`; không có cách chuyển sang approved-for-display. | Đây là non-goal hiện tại và vẫn chặn phát hành cho người dùng ngoài phạm vi nội bộ. |

## Evidence trong code và contract

- Missing critical cell và uncited result:
  [`decision-engine.mjs`](../../../cowork-p2-kit/reasoning/decision-engine.mjs#L239).
- Early inconclusive làm rỗng matrix/reviews:
  [`decision-engine.mjs`](../../../cowork-p2-kit/reasoning/decision-engine.mjs#L378).
- Supplied package là toàn bộ corpus, không tự tìm thêm:
  [`SKILL.md`](../../../cowork-p2-kit/SKILL.md#L3).
- Production rubric approval vẫn deferred:
  [`D20260727`](../../decisions/D20260727-qbd-p4-reasoning-policy.md#L50).
- Rationale causal mapping chỉ hỗ trợ tập đóng hẹp:
  [`step-01-packet-contract-and-sealer.md`](../../plans/qbd-rationale-report-layer/step-01-packet-contract-and-sealer.md#causal_evidence).
- Không có approve command, output luôn internal-only:
  [`step-04-publication-receipt-and-skill.md`](../../plans/qbd-rationale-report-layer/step-04-publication-receipt-and-skill.md#display-boundary).

## Kết quả tối thiểu nhánh mới phải tạo được

Report này chưa chọn schema hoặc UI. Plan sau phải bảo đảm hành vi sau:

1. Khi thiếu dữ liệu, output nói rõ:
   - công thức nào;
   - chỉ tiêu nào;
   - dữ liệu hiện có;
   - dữ liệu còn cần;
   - vì sao cần;
   - ai cần trả lời;
   - trạng thái `open | supplied | accepted | rejected`.
2. Không tự search file hoặc internet. Hệ thống chỉ tạo yêu cầu bổ sung cho human.
3. Khi có file mới, rerun phải tạo store/package hash mới và giữ liên kết với gap cũ.
4. Không chấm điểm nếu rubric chưa được đúng người duyệt hoặc hash không khớp.
5. Approval phải ghi rõ người duyệt, ngày, phạm vi, version/hash và kết luận.
6. Approval không được thay đổi evidence hoặc winner; nó chỉ xác nhận artifact đã review.
7. Rationale phải diễn giải được mọi outcome code được engine phép tạo.
8. Mọi output vẫn `internal_only` cho đến khi có decision riêng cho external display.

## Test seeds cho plan sau

| Test | Input | Kết quả bắt buộc |
|---|---|---|
| Missing critical | Xóa assay của F-02 | Gap ghi đúng `F-02 / assay`, không có winner. |
| Unit mismatch | Đưa dissolution bằng unit không được rubric cho phép | Gap ghi unit nhận được và unit cần; không tự quy đổi. |
| Conflicting results | Hai trial của cùng candidate/measure vượt tolerance | Liệt kê cả hai record/source; yêu cầu FD review. |
| Uncited result | Có result record nhưng không có fact card sử dụng | Ghi đúng record chưa được dùng; không bỏ qua im lặng. |
| Rubric proposal | Rubric chưa duyệt | Không tạo matrix/score/winner; yêu cầu rubric approval. |
| Stale rubric approval | Approval hash không khớp rubric | Fail closed; nói rõ version/hash mismatch. |
| Supplement and rerun | Bổ sung đúng tài liệu cho một gap mở | Gap cũ được liên kết với evidence mới; không sửa lịch sử. |
| Wrong supplement | File mới thuộc sai formulation/strength | Gap không được đóng; record bị loại với lý do. |
| Human approval | FD duyệt đúng artifact/version | Approval record được bind; không làm thay đổi decision bytes. |
| External display attempt | Yêu cầu đổi `internal_only` | Bị từ chối cho đến khi có decision/plan riêng. |

## Decision cần có trước implementation

Plan mới phải xin một quyết định rõ cho:

- ai có quyền duyệt rubric và decision package;
- approval là file ký/hash-bound hay một hệ thống ngoài repo;
- cách supersede/revoke approval;
- liệu nhánh này chỉ đóng internal PO pilot hay bao gồm external display.

Không dùng test-approved rubric hiện tại để trả lời thay các câu hỏi này.

