---
title: "FD/Owner response review — Bisoprolol pilot"
workstream: qbd-p4-reasoning-layer
status: canonicalized
date: 2026-07-26
audience: [Product Owner, Formulation Development, Engineering]
implementation_notes: /home/nguyenhp/.codex/artifacts/MODULE3-agent/impl-notes/qbd-p4-reasoning-layer.md
source:
  - "FD/Owner response received 2026-07-26"
  - "FD/Owner clarification received 2026-07-26 (FD-01 to FD-08)"
  - "docs/raw/phanhoi_1783672588171.md"
related:
  - ./fd-decision-pack-bisoprolol-pilot.md
  - ../../decisions/D20260724-qbd-p4-technical-prototype-fd-decision-pack.md
  - ../../plans/qbd-p4-reasoning-layer/plan.md
---

# Review phản hồi FD/Owner — Pilot Bisoprolol

> Agent tiếp theo phải đọc implementation note được khai báo trong metadata trước khi review hoặc
> sửa G-P4-02. Note ghi policy mới, độ lệch của code/gate evidence hiện tại, và checklist validate.

## Kết luận

Phản hồi mới và phần làm rõ sau đó đã được canonicalize bằng
`D20260726-P4-FD-MVP-ADMISSION`. Quyết định này thay đổi policy mục tiêu của G-P4-02; code và gate
evidence hiện tại vẫn thể hiện policy cũ cho đến khi được sửa và chạy lại.

## Các điểm khớp với phản hồi FD trước và contract hiện tại

| Nội dung phản hồi mới | Đối chiếu | Kết quả review |
|---|---|---|
| Pilot Bisoprolol 5 mg và 10 mg, viên nén bao phim; prototype hỗ trợ evidence, không phê duyệt công thức hoặc thay FD quyết định | Khớp Decision Pack và `D20260724-P4-PILOT`: technical prototype, không phải FD-approved decision service | Không mâu thuẫn |
| A: so sánh F01 và F02 của Bisoprolol 5 mg | Khớp cohort cùng hàm lượng trong `plan.md` | Không mâu thuẫn |
| B: không so sánh 5 mg và 10 mg khi chưa có xác nhận linear formulation | Khớp stop condition 3 trong `plan.md` | Không mâu thuẫn |
| C: dữ liệu thiếu hoặc mâu thuẫn trả `Cần FD xem`; liệt kê toàn bộ evidence, không tự chọn | Khớp nguyên tắc `inconclusive`/FD adjudication của plan và Decision Pack | Không mâu thuẫn |
| Loại draft chưa phê duyệt, sai formulation, file không rõ nguồn | Khớp evidence-admission và traceability boundary | Không mâu thuẫn |
| Cần nhận diện document version, ngày ban hành, người phê duyệt, quyền sử dụng | Khớp yêu cầu document approval trong Decision Pack | Không mâu thuẫn |
| Review thành công phải truy xuất evidence và không nhầm formulation | Khớp provenance/candidate-map controls | Không mâu thuẫn |

Phản hồi cũ còn xác nhận tài liệu phát triển là nội bộ, phải được FD đồng ý trước mỗi lần dùng, và
có thể có scan khó đọc. Điều này không mâu thuẫn với phản hồi mới, nhưng chưa được phép coi là
đường dữ liệu đã được implementation plan hiện tại hỗ trợ: P4 MVP hiện chỉ dùng public/mock records.

## Kết quả làm rõ FD-01 đến FD-08

| ID | Làm rõ của FD/Owner | Trạng thái sau review |
|---|---|---|
| FD-01 | Mr. Tiển đảm nhận FD, review, authorize trong MVP và post-production | Đóng; tên canonical là Mr. Tiển |
| FD-02 | Bộ pilot Bisoprolol sẽ kèm danh sách tài liệu; hiện chỉ là danh sách dự kiến. Ingest prototype sẽ điều chỉnh sau | Đóng cho MVP ở mức planned inventory; chưa được xem là admission list |
| FD-03 | MVP coi DMS, email và meeting minutes là nguồn approval ngang nhau, không ưu tiên | Đóng cho MVP; mỗi approval vẫn phải có record tham chiếu |
| FD-04 | Mr. Tiển cung cấp internal data chọn lọc vào P4 MVP; “cung cấp gì dùng đó”, kiểm soát nguồn sau | Đóng bằng `D20260726-P4-FD-MVP-ADMISSION`; document control là seam không-gating ở MVP |
| FD-05 | Có linear-formulation confirmation thì được phép so sánh tương đương | Đóng: attestation hợp lệ cho phép gộp điểm/xếp hạng chung và reasoning phải nêu rõ attestation |
| FD-06 | Project đề xuất và lý luận standard/rubric; FD review chi tiết sau khi có draft | Đóng về ownership: engineering draft, FD review/approval. Chưa có rubric approved nên runtime vẫn phải inconclusive |
| FD-07 | Như FD-01: Mr. Tiển chịu toàn bộ ma trận ban đầu; phân công cụ thể sau | Đóng cho MVP; không suy ra delegation cho người khác trước khi có phân công |
| FD-08 | Bản cũ là deprecated, giữ để tham chiếu, không dùng và không phát triển thêm tính năng liên quan trong MVP | Đóng; phù hợp với trace/audit retention |

## Các điểm đã được giải quyết khi canonicalize

| ID | Điểm chưa rõ hoặc chưa đủ bằng chứng | Vì sao chặn canonicalization | Xác nhận tối thiểu cần có |
|---|---|---|---|
| FD-09 | Tên được ghi là “Mr. Tiến” ở phản hồi đầu nhưng “Mr. Tiển” ở phần làm rõ | Canonical name: Mr. Tiển |
| FD-10 | FD-04 mở internal data cho P4 MVP và hoãn kiểm soát nguồn; P4 plan lại chỉ public/mock | `D20260726-P4-FD-MVP-ADMISSION` cho phép FD-selected package, giữ document-control variable như non-gating seam, và yêu cầu sửa/rerun G-P4-02 |
| FD-11 | FD-05 cho phép 5 mg/10 mg “so sánh tương đương” sau linear confirmation | Complete attestation cho phép merged score/common ranking; reasoning phải name attestation; current code/gate evidence cần revision |

## Không suy diễn trong lúc chờ xác nhận

- Không coi danh sách loại tài liệu là danh sách tài liệu được phép dùng.
- Không dùng linear formulation để gộp, chấm điểm, hoặc xếp hạng chung 5 mg và 10 mg nếu không có attestation hợp lệ.
- Không biến “Cần FD xem” thành pass/fail, score 0, hoặc tự chọn evidence thuận lợi.
- Không nhập tài liệu nội bộ vào P4 MVP public/mock, không gửi ra dịch vụ ngoài, và không suy ra
  rằng một email/biên bản bất kỳ đủ thay cho approval theo từng tài liệu.

## Canonical follow-through

The canonical policy is now in `D20260726-P4-FD-MVP-ADMISSION`. The old G-P4-02 outcome is not
evidence that implementation supports the new policy; Engineering must revise the code, tests, and
machine-produced gate evidence before making that claim.
