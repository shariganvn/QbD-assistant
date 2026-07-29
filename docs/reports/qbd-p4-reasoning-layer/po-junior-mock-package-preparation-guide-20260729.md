---
title: "PO and junior engineer guide — prepare the public/synthetic mock package"
date: 2026-07-29
workstream: qbd-cowork-mvp-po-pilot
document_type: preparation-guide
status: ready-for-use
audience: [Product Owner, Formulation Development, Junior Engineer]
related:
  - ./mock-docs-readiness-review-20260729.md
  - ./missing-data-human-approval-gap-review-20260729.md
---

# Chuẩn bị bộ mock public/synthetic cho PO pilot

## Mục tiêu

Bộ mock phải giống cách PO và FD đang làm việc hằng ngày, nhưng không chứa dữ liệu bí mật. PO/FD có
thể giao Word, PDF hoặc Excel. Junior engineer chịu trách nhiệm đóng gói và tạo manifest kỹ thuật.

Không yêu cầu PO viết JSON, SHA hoặc chạy command.

## Một folder cần có gì?

```text
PO-MOCK-001/
├── 00-pilot-brief.docx
├── 01-product-profile.docx
├── 02-document-list.xlsx
├── 10-F01-trial-report.docx
├── 11-F02-trial-report.docx
├── 12-F03-trial-report.docx
├── 20-comparison-rubric.xlsx
├── 30-uat-expected-results.xlsx
└── 40-linear-formulation-confirmation.docx   # chỉ cần nếu gộp khác hàm lượng
```

Junior engineer sẽ tạo thêm `classification-manifest.json` từ `02-document-list.xlsx`. Không yêu cầu
PO tự tạo file này.

## 1. Pilot brief — PO chuẩn bị

`00-pilot-brief.docx` chỉ cần trả lời ngắn:

| Câu hỏi | Ví dụ cách trả lời |
|---|---|
| Pilot đang kiểm tra quyết định gì? | “Kiểm tra F-01 và F-02 5 mg có đủ evidence để FD review tiếp không.” |
| Những công thức nào nằm trong phạm vi? | F-01 5 mg, F-02 5 mg; F-03 10 mg chỉ làm case không được gộp. |
| Kết luận nào bị cấm? | Không phê duyệt công thức; không dùng output để phát hành hồ sơ. |
| FD reviewer là ai? | Tên, vai trò, cách liên hệ. |
| PO điều phối là ai? | Tên và người chịu trách nhiệm tập hợp file. |
| Khi thiếu dữ liệu thì ai trả lời? | FD owner hoặc người phụ trách trial cụ thể. |

## 2. Product profile — FD/PO chuẩn bị

`01-product-profile.docx` cần đủ thông tin để biết các trial có thật sự so sánh được:

- hoạt chất;
- hàm lượng;
- dạng bào chế;
- đường dùng;
- mục tiêu sản phẩm;
- các chỉ tiêu chất lượng quan trọng;
- specification/target của từng chỉ tiêu;
- sản phẩm đối chiếu, nếu pilot dùng;
- điều kiện bảo quản hoặc yêu cầu khác có ảnh hưởng đến trial.

Ví dụ hiện có tại
[`cowork-p2-kit/inputs/src/product-profile.md`](../../../cowork-p2-kit/inputs/src/product-profile.md).

## 3. Document list — PO lập, junior engineer kiểm tra

`02-document-list.xlsx` có một dòng cho mỗi file:

| Cột | PO/FD ghi gì? |
|---|---|
| Document ID | Mã dễ gọi, ví dụ `DOC-F01-RESULT-01`. |
| Exact filename | Tên file chính xác, gồm cả phần mở rộng. |
| Version/date | Version hoặc ngày ban hành. Không ghi “latest”. |
| Document type | Trial report, protocol, analytical result, product profile, reference. |
| Candidate/strength | F-01 / 5 mg, F-03 / 10 mg, hoặc context chung. |
| Purpose | File này dùng trả lời câu hỏi gì? |
| May be cited? | `Có`, `Không`, hoặc `Chỉ tham khảo`. |
| Confirmed by | Người xác nhận file đúng và được dùng trong pilot. |
| Notes | Bản thay thế, scan khó đọc, trang cần chú ý, hoặc giới hạn sử dụng. |

Junior engineer kiểm tra:

- file có thật và mở được;
- không có hai dòng trỏ cùng một file;
- mọi file trong folder đều có trong danh sách;
- mọi file được ingest đều có `label: public`, `citable` và `ocr_language` phù hợp;
- không tự đổi “chỉ tham khảo” thành “được trích”.

## 4. Mỗi trial report cần gì?

Mỗi F-01/F-02/F-03 có một report riêng. Không cần giống template 100%, nhưng phải tìm được các mục sau.

### A. Nhận dạng trial và công thức

- Trial ID và formulation code;
- hoạt chất, hàm lượng, dạng bào chế;
- batch/lot và batch size;
- ngày thực hiện;
- người hoặc nhóm thực hiện;
- version của report.

### B. Thành phần công thức

Một bảng gồm:

- tên nguyên liệu và grade nếu có;
- mg/tablet;
- % w/w;
- chức năng của nguyên liệu;
- tổng khối lượng viên;
- thành phần coating, nếu liên quan.

### C. Bối cảnh quy trình

- phương pháp tạo hạt/dập thẳng hoặc quy trình chính;
- các bước chính;
- thiết bị hoặc scale có thể làm trial không tương đương;
- thông số quan trọng mà FD dùng để giải thích kết quả;
- deviation, rework hoặc sự cố trong trial.

### D. Kết quả thử nghiệm

Mỗi dòng cần:

| Trường | Ví dụ |
|---|---|
| Tên chỉ tiêu | Assay, dissolution 30 min, hardness. |
| Phương pháp/timepoint | HPLC; 30 phút; n=6. |
| Specification | 95.0–105.0%; mỗi viên ≥ 80%. |
| Kết quả | 99.2%; 92, 95, 91, 94, 93, 96%. |
| Unit | %, N, min. |
| Sample size | n=6, n=10, n=20. |
| Pass/fail | Nếu report gốc có kết luận này. |
| Source location | Trang/bảng/section để FD kiểm tra lại nhanh. |

Các chỉ tiêu trong fixture hiện tại gồm assay, dissolution, hardness, content uniformity, friability,
disintegration, related substances và loss on drying. PO/FD không phải giữ toàn bộ; rubric sẽ nói chỉ
tiêu nào thật sự dùng để quyết định.

### E. Observations

Ghi các nhận xét có ảnh hưởng đến việc hiểu kết quả: flow kém, sticking, compression khó kiểm soát,
sample bị loại, hoặc trial không cùng bối cảnh. Không biến nhận xét thành số liệu nếu report không có số.

## 5. Rubric — phần FD cần nói rõ nhất

### Rubric là gì?

Rubric là **bảng quy tắc FD duyệt trước khi hệ thống so sánh**. Nó trả lời:

- so sánh chỉ tiêu nào;
- thiếu chỉ tiêu nào thì phải dừng;
- mức nào làm một công thức bị loại;
- mức nào được bao nhiêu điểm;
- chỉ tiêu nào quan trọng hơn;
- khi hai kết quả mâu thuẫn hoặc hai công thức gần bằng nhau thì xử lý thế nào.

Rubric không phải prompt và không phải phần hệ thống được phép tự nghĩ ra.

### File `20-comparison-rubric.xlsx`

Mỗi chỉ tiêu là một dòng:

| Cột rubric | Cách FD điền bằng lời thường | Ví dụ minh họa, không phải rule thật |
|---|---|---|
| Measure | Tên chỉ tiêu FD dùng để so sánh. | Dissolution tại 30 phút. |
| Why it matters | Vì sao chỉ tiêu ảnh hưởng quyết định. | Chỉ tiêu giải phóng quan trọng cho sản phẩm. |
| Critical? | Nếu thiếu thì có được tiếp tục không? | `Có — thiếu thì cần FD xem`. |
| Unit and format | Đơn vị và dạng số được chấp nhận. | `%`, một số hoặc danh sách n=6. |
| Hard gate | Điều kiện tối thiểu; không đạt thì candidate bị loại. | “Không thấp hơn specification đã ghi.” |
| Score bands | Mức kết quả nào được bao nhiêu điểm. | FD tự ghi các khoảng và điểm. |
| Nominal weight | Mức quan trọng bình thường. | Tổng weight của mọi chỉ tiêu phải bằng 100%. |
| Weight range | Khoảng thay đổi dùng để kiểm tra winner có bền không. | 35–55%, nếu FD chấp nhận khoảng này. |
| Conflict tolerance | Hai kết quả lệch bao nhiêu thì phải coi là mâu thuẫn. | Chênh quá X thì dừng và yêu cầu review. |
| Missing-data action | Thiếu dữ liệu thì ai làm gì tiếp theo. | “FD yêu cầu assay report cho F-02.” |
| Allowed source | Loại tài liệu nào được dùng cho chỉ tiêu này. | Final trial result; không dùng email nhận xét. |

### Các rule chung FD cần chốt một lần

| Rule | Câu hỏi FD cần trả lời |
|---|---|
| Minimum candidates | Cần ít nhất bao nhiêu công thức còn hợp lệ mới được xếp hạng? |
| Tie threshold | Chênh lệch nhỏ đến mức nào thì không được tuyên bố winner? |
| Missing critical data | Thiếu chỉ tiêu bắt buộc thì dừng toàn bộ hay chỉ loại một candidate? |
| Conflicting data | Hai trial khác nhau thì ưu tiên version nào, hay luôn cần FD review? |
| Unit conversion | Có cho đổi đơn vị không? Bảng quy đổi nào và ai duyệt? |
| Cross-strength | 5 mg và 10 mg có bao giờ được đặt chung không? Cần xác nhận gì? |

### Phần xác nhận rubric

PO/FD ghi thêm ở đầu hoặc cuối file:

- rubric ID và version;
- sản phẩm/hàm lượng/phạm vi áp dụng;
- người soạn;
- FD reviewer;
- ngày review;
- trạng thái `DRAFT`, `CHƯA CHỐT`, hoặc `FD CONFIRMED FOR MOCK PILOT`;
- rubric cũ bị thay thế, nếu có.

**Quan trọng:** Project hiện chưa có production approval workflow. Dòng `FD CONFIRMED FOR MOCK PILOT`
chỉ là input để thiết kế và UAT vòng approval sau; nó chưa cho phép hệ thống chọn công thức thật.

Rubric synthetic hiện tại dùng `release_30m`, `assay` và `hardness`. Các threshold/weight trong fixture
chỉ để test code, không được copy sang rubric của PO.

Nếu FD chưa chốt một rule, ghi `CHƯA CHỐT — cần [tên người] trả lời`. Không điền một con số tạm để hệ
thống chạy tiếp.

## 6. Linear-formulation confirmation — chỉ khi cần

Nếu muốn đặt công thức khác hàm lượng vào cùng cohort, `40-linear-formulation-confirmation.docx` cần:

- formulation code và strength được xác nhận;
- thành phần nào được coi là tỷ lệ tuyến tính;
- process context nào tương đương;
- dữ liệu nào vẫn phải giữ riêng theo hàm lượng;
- điều gì bị cấm gộp/xếp hạng;
- người xác nhận và ngày.

Không có file này thì F-03 10 mg phải đứng ngoài ranking F-01/F-02 5 mg.

## 7. UAT expected results — PO và FD cùng chuẩn bị

`30-uat-expected-results.xlsx` cần ít nhất ba case:

| Case | Input thực tế gần giống | Kết quả mong đợi |
|---|---|---|
| A — So sánh được | F-01 và F-02 cùng 5 mg, đủ critical evidence | Tạo matrix truy ngược được; selected chỉ khi rubric hợp lệ và winner ổn định. |
| B — Không được so sánh | F-03 là 10 mg, chưa có linear attestation | F-03 bị tách cohort; không cộng điểm vào ranking 5 mg. |
| C — Thiếu/mâu thuẫn | F-02 thiếu assay hoặc có hai result khác nhau | `inconclusive`; nói đúng công thức/chỉ tiêu/source cần FD xử lý. |

Thêm 5–10 evidence mẫu:

- evidence được dùng;
- evidence chỉ tham khảo;
- evidence sai formulation/hàm lượng;
- evidence thiếu source/version;
- evidence có số nhưng unit không rõ;
- hai evidence mâu thuẫn.

Mỗi mẫu ghi expected result và lý do bằng lời của FD.

## 8. Ai làm gì?

| Vai trò | Việc cần làm | Không được tự quyết |
|---|---|---|
| PO | Chốt câu hỏi pilot, phạm vi, danh sách file, lịch review và expected cases. | Không tự đặt threshold khoa học thay FD. |
| FD | Chốt cohort rule, rubric, evidence được tin, cách xử lý thiếu/mâu thuẫn và expected decision. | Không cần viết JSON/SHA hoặc sửa code. |
| Junior engineer | Kiểm tra file, tên/version, manifest, chạy ingest/test và ghi lỗi có thể tái hiện. | Không đổi classification, unit, threshold, weight hoặc expected winner. |
| Reviewer | So output với expected cases và nguồn gốc. | Không coi test fixture là FD approval. |

## Checklist trước khi gửi Engineering

- [ ] Tất cả file là public/synthetic.
- [ ] Có pilot brief và người chịu trách nhiệm.
- [ ] Có product profile.
- [ ] Có đúng ba trial report và nhận dạng formulation rõ.
- [ ] Có document list với exact filename/version/quyền trích.
- [ ] Có rubric draft; chỗ chưa chốt được ghi rõ.
- [ ] Có linear confirmation nếu muốn gộp khác hàm lượng.
- [ ] Có ba UAT cases và expected results.
- [ ] Có 5–10 evidence mẫu được dùng/bị loại.
- [ ] PO/FD hiểu rằng lần chạy này không phê duyệt công thức và output vẫn internal-only.

