---
title: "FD Decision Pack — Bisoprolol technical pilot"
workstream: qbd-p4-reasoning-layer
status: requested-input
date: 2026-07-24
due_before: "2026-07-27"
audience: [Product Owner, Formulation Development, Quality/Compliance, Engineering]
related:
  - ../../plans/qbd-p4-reasoning-layer/plan.md
  - ../../plans/qbd-p4-reasoning-layer/gates.yaml
  - ../../decisions/D20260724-qbd-p4-technical-prototype-fd-decision-pack.md
---

# FD Decision Pack — Pilot Bisoprolol

## Mục đích

Đây là khung để FD và PO cung cấp **ví dụ công việc thật** cho pilot Bisoprolol.
Mục tiêu không phải là yêu cầu FD viết tài liệu kỹ thuật hay duyệt hệ thống. Nó giúp đội kỹ thuật
kiểm tra sau review: các biểu mẫu và quy tắc G-P4-01 hiện có có phản ánh cách FD đánh giá bằng
chứng hay không.

Pilot hiện chỉ là **prototype technical**. Kết quả không được dùng để phê duyệt công thức, thay
thế đánh giá của FD, hay phát hành một quyết định sản phẩm.

## Quyết định đã chốt

| Nội dung | Quyết định |
|---|---|
| Phạm vi | Pilot chạy cho Bisoprolol, theo phạm vi 5 mg/10 mg viên nén bao phim đang được mô tả trong dự án; FD xác nhận nếu pilot thực tế hẹp hơn. |
| Mục đích | Thử luồng kỹ thuật và đối chiếu với cách FD làm việc, không tạo quyết định dùng chính thức. |
| Đầu vào cần giao | FD Decision Pack phiên bản đầu tiên, trước Thứ Hai 27/07/2026. |
| Sau khi có pack | Review G-P4-01 bằng ví dụ thật; sau review mới quyết định giữ nguyên, sửa, hay tạo phiên bản mới của contract. |
| Điều chưa quyết | Không chốt schema JSON, versioning, SHA, hay sidecar trước review. Đây là phương án kỹ thuật, không phải đầu vào FD phải tự thiết kế. |

> Cách giao: FD có thể điền ngay trong file Word, bảng Excel, email có bảng, hoặc một buổi làm
> việc có PO ghi biên bản. Không cần JSON, không cần biết thuật ngữ kỹ thuật.

## Gói tối thiểu cần gửi

Tất cả mục đánh dấu **bắt buộc** cần có để review được G-P4-01. Nếu chưa có, ghi rõ `chưa có`,
người sở hữu, và ngày dự kiến thay vì đoán.

| # | FD/PO cần cung cấp | Cách lấy từ công việc thường ngày | Vì sao pilot cần | Liên hệ với spec hiện tại |
|---:|---|---|---|---|
| 1 | **Một người FD chịu trách nhiệm** và một người PO điều phối | Tên, vai trò, cách liên hệ, ai trả lời khi dữ liệu mơ hồ | Biết ai xác nhận ý nghĩa khoa học và ai chốt phạm vi pilot | G-P4 chỉ hỗ trợ quyết định; FD vẫn là người có thẩm quyền chuyên môn. |
| 2 | **Mô tả sản phẩm pilot** | Dùng product profile hoặc brief mà FD đã dùng: hoạt chất, dạng bào chế, hàm lượng, mục tiêu so sánh | Tránh lấy nhầm dữ liệu của thuốc/hàm lượng khác | Cohort chỉ được so sánh khi cùng bối cảnh phù hợp. |
| 3 | **Danh sách tài liệu được phép dùng** | Danh sách Word/PDF/báo cáo trial mà FD sẵn sàng cho pilot đọc | Cho biết bằng chứng nào được phép đi vào thử nghiệm | Mỗi fact cần truy được về đúng tài liệu và đoạn gốc. |
| 4 | **Ba tình huống quyết định thật** | Chọn ba việc FD từng làm hoặc có thể làm ngay: chọn, loại, hoặc yêu cầu xem thêm | Cho biết pilot cần trả lời câu hỏi nào, không chỉ tạo file đẹp | Kết quả phải là chọn được hoặc nói rõ “chưa đủ dữ liệu, cần FD xem”. |
| 5 | **Năm đến mười bằng chứng mẫu** | Từ tài liệu ở mục 3, đánh dấu đúng câu/bảng/số FD sẽ tin dùng | Cho biết một fact “đủ tin” trông ra sao | Fact card phải gắn với nguồn, đoạn trích, và formulation đúng. |
| 6 | **Ví dụ cần loại ra** | Nêu ít nhất một ví dụ: sai hàm lượng, sai formulation, nguồn chưa đủ tin, chưa đọc được, hoặc không được trích | Cho hệ thống biết phải dừng ở đâu và nói lý do gì | Mỗi lý do loại phải được ghi riêng, không gom chung. |
| 7 | **Quy tắc “được so sánh với nhau hay không”** | FD mô tả bằng lời cách nhận ra hai formulation có thể đặt cạnh nhau | Ngăn hệ thống so sánh táo bón số liệu không cùng bối cảnh | Cùng API, hàm lượng, dạng bào chế, mục tiêu sản phẩm, và bối cảnh trial; ngoại lệ phải do FD xác nhận. |
| 8 | **Cách xử lý thiếu hoặc mâu thuẫn** | Khi hai kết quả khác nhau hoặc thiếu chỉ tiêu quan trọng, FD thường làm gì? | Đảm bảo hệ thống không tự chọn số đẹp hơn | Thiếu/mâu thuẫn phải trả về “cần FD xem”, không tự chấm điểm. |
| 9 | **Dấu hiệu “đã được FD duyệt”** | Có thể là tên người duyệt + ngày + email/biên bản/link đến bản tài liệu chính thức | Phân biệt file để tham khảo với file được phép dùng cho pilot | Sau review, kỹ thuật sẽ dùng thông tin này để thiết kế kiểm tra approval; FD không cần tạo SHA. |
| 10 | **Tiêu chí FD xem là demo đạt** | Cuối buổi review, FD cần nhìn thấy gì để nói “prototype phản ánh đúng cách tôi làm”? | Chuyển review thành có kết luận rõ, không chỉ góp ý chung | Là tiêu chí quyết định G-P4-01 giữ nguyên hay cần thay đổi. |

## Mẫu điền chi tiết

### 1. Người chịu trách nhiệm và phạm vi

| Câu hỏi | Câu trả lời của FD/PO |
|---|---|
| FD reviewer chính là ai? Ai thay thế khi vắng mặt? | |
| PO điều phối là ai? | |
| Pilot chỉ xem Bisoprolol 5 mg, 10 mg, hay một tập hẹp hơn? | |
| Dạng bào chế nào nằm trong pilot? | |
| Pilot đang cố hỗ trợ quyết định nào? Ví dụ: “so sánh F-01 và F-02 ở 5 mg để biết có đủ dữ liệu cho FD đánh giá tiếp hay không”. | |
| Pilot tuyệt đối không được kết luận điều gì? | |

**Hoàn thành khi:** FD và PO cùng xác nhận một câu mô tả phạm vi. Nếu 5 mg và 10 mg không được
so sánh trực tiếp, ghi rõ điều đó ngay tại đây.

### 2. Danh sách tài liệu được phép dùng

Mỗi tài liệu là một dòng. Không cần tính mã kiểm tra file; chỉ cần chỉ đúng bản mà FD đang dùng.

| Mã ngắn | Tên file/tài liệu | Bản/ngày | Loại tài liệu | Tài liệu này dùng để trả lời câu hỏi gì? | Có được trích làm bằng chứng trong pilot không? | Người xác nhận | Ghi chú |
|---|---|---|---|---|---|---|---|
| DOC-01 | | | Trial report / protocol / bảng kết quả / khác | | Có / Không / Chỉ tham khảo | | |

**Ví dụ đời thường:** “Trial-F02-5mg-results-v3.docx, bản 15/07/2026, dùng xem dissolution của
F-02 5 mg, được trích; FD Nguyen A xác nhận.”

**Không chấp nhận:** “dùng folder này” hoặc “bản mới nhất”. Những câu đó dễ khiến mọi người dùng
nhầm file khi có bản sửa.

### 3. Ba tình huống FD muốn prototype xử lý

Điền một dòng cho mỗi tình huống. Hãy dùng tình huống gần với cách FD quyết định hằng ngày nhất.

| Tình huống | Câu hỏi FD đang cần trả lời | Những formulation/hàm lượng nào liên quan? | Tài liệu cần xem | Kết quả FD mong chờ | Khi nào phải dừng và trả về “cần FD xem”? |
|---|---|---|---|---|---|
| A — Có thể so sánh | | | | | |
| B — Không được so sánh | | | | | |
| C — Dữ liệu thiếu hoặc mâu thuẫn | | | | | |

**Ví dụ:**

- A: “F-01 5 mg và F-02 5 mg có thể được đặt cạnh nhau theo chỉ tiêu X; output chỉ nói bằng chứng
  nào đang hỗ trợ formulation nào.”
- B: “F-03 10 mg không được cộng số liệu vào xếp hạng 5 mg.”
- C: “Nếu cùng chỉ tiêu nhưng hai trial cho xu hướng trái ngược, hệ thống phải liệt kê mâu thuẫn,
  không tự chọn một số.”

### 4. Bằng chứng mẫu mà FD tin hoặc không tin

Chọn 5–10 ví dụ nhỏ từ tài liệu ở mục 2. Có thể chụp màn hình, đánh dấu trong Word/PDF, hoặc chép
đúng câu/bảng. Không cần trích toàn bộ báo cáo.

| Mã ví dụ | Tài liệu | Trang/đoạn/bảng | Câu hoặc số cần dùng | Thuộc formulation/hàm lượng nào? | Nó nói về chỉ tiêu gì? | Dùng được không? | Lý do bằng lời thường |
|---|---|---|---|---|---|---|---|
| EV-01 | | | | | | Có / Không | |

Đây là phần quan trọng nhất để review G-P4-01. Nó cho đội kỹ thuật kiểm tra bốn điều rất cụ thể:

1. Có truy được từ kết luận về đúng file, đúng trang/đoạn không?
2. Có biết evidence đó thuộc đúng formulation và đúng hàm lượng không?
3. Câu trích có thực sự chứa số/liệu mà hệ thống nói đến không?
4. Có lưu được lý do khi FD không cho dùng evidence đó không?

### 5. Quy tắc so sánh và các ngoại lệ

FD không cần viết quy chế. Chỉ cần trả lời ngắn, bằng lời của đội mình.

| Câu hỏi | Câu trả lời của FD |
|---|---|
| Hai formulation cần giống nhau ở những điểm nào mới được so sánh? | |
| Khác hàm lượng có được dùng chung không? Nếu có, chỉ được dùng để nhận xét điều gì; điều gì vẫn cấm? | |
| Có trường hợp nào tên formulation giống nhưng thực tế không được đặt cạnh nhau? | |
| Chỉ tiêu nào là bắt buộc phải có trước khi nói “có cơ sở so sánh”? | |
| Chỉ tiêu nào chỉ để tham khảo, không quyết định? | |
| Đơn vị đo nào có thể quy đổi? Ai cho phép quy đổi? | |

Nếu FD nói “5 mg và 10 mg là công thức tuyến tính”, cần thêm một tờ/xác nhận ngắn:

| Nội dung xác nhận | FD điền |
|---|---|
| Những formulation/hàm lượng nào có quan hệ tuyến tính? | |
| Thành phần/quy trình nào được coi là tương đương? | |
| Điều gì vẫn không được gộp hoặc xếp hạng chung? | |
| Người xác nhận và ngày | |

### 6. Khi dữ liệu thiếu, khác nhau, hoặc không đáng tin

| Tình huống thường gặp | FD muốn hệ thống làm gì? | Cần ai quyết tiếp? |
|---|---|---|
| Thiếu chỉ tiêu quan trọng | | |
| Hai trial cho kết quả khác nhau | | |
| Đơn vị không rõ hoặc không thể quy đổi | | |
| Tài liệu chưa được phép trích | | |
| File đọc không rõ/bảng lỗi | | |
| Bằng chứng thuộc formulation hoặc hàm lượng khác | | |

**Nguyên tắc mặc định của prototype:** nếu FD chưa nói rõ cách xử lý, hệ thống dừng và ghi
“cần FD xem”; không tự suy luận để tiếp tục.

### 7. Xác nhận và phiên bản tài liệu

Điền mức tối thiểu dưới đây. Đội kỹ thuật sẽ tự lo việc lưu mã kiểm tra file sau khi FD xác nhận.

| Câu hỏi | Câu trả lời |
|---|---|
| Ai có quyền nói tài liệu/bằng chứng này được dùng trong pilot? | |
| Xác nhận được lưu ở đâu? Email, meeting minutes, hệ thống quản lý tài liệu, hay nơi khác? | |
| Nếu tài liệu được thay bản mới, ai thông báo và bản cũ còn dùng được không? | |
| Có tài liệu nào chỉ được xem nhưng không được trích? | |
| Có hạn dùng hoặc điều kiện sử dụng nào không? | |

### 8. Review prototype: FD sẽ chấp nhận điều gì?

Buổi review G-P4-01 cần trả lời từng câu bằng **Có / Không / Cần sửa**, kèm một ví dụ nếu cần sửa.

| Câu kiểm tra | Có / Không / Cần sửa | Ghi chú FD |
|---|---|---|
| Prototype chỉ dùng đúng các tài liệu FD cho phép? | | |
| Mỗi kết luận truy ngược được về đúng tài liệu và đúng đoạn/bảng? | | |
| Prototype không lẫn formulation hoặc hàm lượng? | | |
| Prototype ghi đúng lý do khi loại một evidence? | | |
| Khi thiếu/mâu thuẫn dữ liệu, prototype biết dừng và yêu cầu FD? | | |
| Cách trình bày có đủ để FD kiểm tra lại nhanh không? | | |
| Có thông tin nào FD cần thấy nhưng prototype chưa lưu? | | |

## Những thứ FD không phải làm

- Không viết JSON, schema, API, version number, SHA, hay thiết kế sidecar.
- Không cần cung cấp toàn bộ lịch sử phát triển sản phẩm cho vòng pilot.
- Không cần tự tạo “approval artifact” mới; chỉ cần chỉ ra cách nhóm đang xác nhận tài liệu trong
  công việc thường ngày.
- Không cần ép dữ liệu chưa rõ thành một quyết định. `chưa có` và `cần FD xem` là câu trả lời hợp lệ.

## PO checklist trước Thứ Hai 27/07/2026

- [ ] Gửi khung này cho FD owner và hẹn thời gian trao đổi.
- [ ] Chốt phạm vi Bisoprolol/hàm lượng/dạng bào chế của pilot.
- [ ] Nhận ít nhất ba tình huống và năm ví dụ evidence.
- [ ] Nhận danh sách tài liệu kèm phiên bản/ngày và quyền dùng.
- [ ] Ghi rõ phần nào còn thiếu, ai cung cấp, ngày dự kiến.
- [ ] Đặt buổi review G-P4-01; mục tiêu là đánh dấu **giữ / sửa / cần thêm mẫu**, không phải phê duyệt sản phẩm.

## Sau buổi review G-P4-01

Đội kỹ thuật cùng PO/FD sẽ lập bảng ngắn gồm: điều FD cần nhưng contract đã có; điều contract có
nhưng FD không dùng; và khoảng trống phải sửa. Chỉ lúc đó mới quyết định có thay đổi G-P4-01, tăng
phiên bản, hay cần một artifact đi kèm để người dùng kiểm tra lại. Không thay contract dựa trên suy
đoán trước review.
