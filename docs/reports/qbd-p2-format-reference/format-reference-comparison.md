# Đối chiếu bản nháp P.2 với hồ sơ P.2 tham chiếu định dạng

- Ngày: 2026-10-01
- Đối tượng: `tools/pharma-dev-draft/draft/example-draft.json` và `schemas/p2-outline.json`, đọc trực tiếp
  ở commit chứa báo cáo này, không qua báo cáo trung gian.
- Tài liệu tham chiếu: một hồ sơ 3.2.P.2 hoàn chỉnh (tiếng Anh, phát hành 11.2024) của **một công ty khác**,
  cho cùng hoạt chất, cùng hai hàm lượng, cùng thuốc đối chiếu. **Không nằm trong repo.** Chỉ có mặt ở đây
  dưới dạng cấu trúc được mô tả bằng lời và dưới dạng băm trong `verify/format-reference-tokens.json`.

## Vị thế của tài liệu tham chiếu

Công thức của nó khác công thức của mình ở mọi tá dược trừ tá dược trơn magnesium stearate, và khối lượng
lõi viên khác. Quy trình cùng là dập thẳng. Vậy nó là **thẩm quyền về cấu trúc và độ đầy đủ của một P.2
"xong", không bao giờ là nguồn số liệu**: chép một con số từ đó vào hồ sơ này là lỗi nặng hơn cả bảng sao
chép của Thử nghiệm 2 mà công cụ đã từ chối. Nó cũng **chưa phải chuẩn do FD hay regulatory của mình ban
hành**; cấu trúc lấy từ nó vẫn chờ họ xác nhận.

## Khoảng trống cấu trúc đã đóng

| | Trước | Sau |
|---|---|---|
| Mục lá có nội dung | 26 | 43 (12 mục cha chỉ mang heading) |
| Bảng | 19 | 34 |
| Hình dựng từ bảng | 3 hình + 1 ảnh | 3 hình + 1 ảnh (thêm kiểu `profile`, chưa có số liệu để vẽ) |
| Dấu thiếu dữ liệu | 149 | 396 |
| Dấu cần quyết định | 19 | 26 |

Dấu tăng vì **17 mục mới (ròng; một số của mục cũ được dùng lại cho mục mới) và bảng khung của chúng là những chỗ trước đây không ai thấy là thiếu**, không vì một
phép đo nào mới bị phát hiện thiếu. Tài liệu dài hơn và trống hơn; đó là kết quả đúng của một bản nháp nội bộ.

Khuôn lấy từ tài liệu tham chiếu, và nơi nó nằm trong công cụ:

- **Ma trận rủi ro ghép cặp** (ban đầu → cập nhật) cho dược chất, biến công thức và quy trình, mỗi ma trận
  kèm bảng biện luận. Cặp phải cùng nhãn dòng và cột; **một ô hạ mức phải dẫn tới mục nghiên cứu đã hạ nó**
  (hoặc mang dấu). Tài liệu tham chiếu không có luật này — cả ba ma trận cập nhật của nó đều ở mức thấp, và
  một kết luận như vậy cần bằng chứng, không phải một khuôn để chép.
- **Cột ma trận quy trình suy từ một danh mục công đoạn** (`P.2.3.2`), không viết tay. Danh mục lấy hợp
  của bộ công đoạn trong ma trận cũ và bộ công đoạn của quy trình thử nghiệm — hai bộ vốn lệch nhau.
- **Phát triển quy trình theo công đoạn** (trộn, dập viên, bao phim, kiểm soát môi trường, hàm ẩm), mỗi
  công đoạn trỏ tới đúng một mục phát triển, và mỗi mục phát triển được ít nhất một công đoạn trỏ tới.
- **Tách mục theo hàm lượng** cho đặc tính lý hóa, tách vạch và nâng cỡ lô; mỗi mục khai vị trí hàm lượng
  của nó, tiêu đề in tên hàm lượng, và mục của hàm lượng suy ra **không được chứa số đo**.
- **Câu f2** cho hồ sơ hòa tan so sánh: một giá trị, một dấu chờ so sánh, hoặc "không áp dụng" **kèm điều
  kiện**. Tài liệu tham chiếu khai không áp dụng ở cả sáu bảng so sánh bằng một lý do một dòng; ở đây lời
  khai trần bị từ chối.
- **Hình hồ sơ hòa tan nhiều đường** (`profile`, tối đa ba đường).

## Chỗ tài liệu tham chiếu yếu hơn, và không được bắt chước

Ghi để không ai chép ngược lại:

- **Không có design space, không có thiết kế thực nghiệm đa biến hay phân tích phương sai.** Tìm bằng từ
  khóa trên toàn văn: không có. Điều này khớp với finding I-1 của bản ghi ICH Q8(R2): vắng chúng là một
  lựa chọn hợp lệ, không phải khoảng trống.
- **Không có bảng ký duyệt, mục lục, phụ lục yêu cầu dữ liệu hay sổ quyết định.** Hai danh mục cuối tài liệu
  này (dữ liệu cần bổ sung, điểm cần quyết định) và bảng ký duyệt để trống là thứ của riêng mình.
- **Lời khai f2 không áp dụng không kèm kiểm chứng** (xem trên), và **các ma trận cập nhật không kèm truy
  vết** (xem trên).

## Chỗ cố ý khác với tài liệu tham chiếu

- **Thứ tự hàm lượng** theo `meta.strengths` của mình (5 mg trước), không theo thứ tự của tài liệu tham
  chiếu. Một thứ tự ngầm đã từng đặt nhầm một câu vào mục của hàm lượng có lô thật; giờ vị trí được khai.
- **Quy trình của thử nghiệm phòng thí nghiệm ở lại `P.2.2.1.3.3.1`**, không chuyển sang mục quy trình
  thương mại: đó là quy trình thử nghiệm, và chuyển nó là coi hai quy trình là một.
- **Không viết số viên và số lô của phép thử tách vạch.** Con số đó chỉ có ở tài liệu tham chiếu; repo
  không giữ dược điển để dẫn. Nó là một dấu quyết định ở `P.2.2.3.4`.
- **Số con của mình giữ nguyên** ở những chỗ tài liệu tham chiếu dùng tiêu đề in đậm không số, vì một tiêu
  đề không số không làm đích tham chiếu được và không kiểm được sự tồn tại.

## Biên giới dữ liệu

`verify/sample-boundary.mjs` từ chối hai thứ, đều dựa trên băm nên chính file chặn không là một bản sao:
(1) **định danh** của hồ sơ khác (số lô, nhà cung cấp, mã nguyên liệu) — một lần xuất hiện là đổ; (2) **ba
giá trị đo trở lên từ cùng một bảng** của nó trong cùng một mục. Một giá trị trùng lẻ được dung thứ vì có
thể là trùng hợp. Phiên bản đầu của file chặn từng lưu nguyên nhãn bảng của tài liệu tham chiếu, trong đó có
số lô — tức file tồn tại để giữ số lô ra ngoài lại chứa số lô; nay nhãn chỉ còn số bảng.

**Giới hạn:** luật không bắt được một con số gõ lại rồi đổi chữ số cuối, và không bắt được một lời khẳng
định bằng chữ. Phần đó là kỷ luật của người soạn (checklist bước 11 và 13).

## Điều chưa đóng và vì sao

Không phép đo nào được thêm. Ba thứ chặn P.2 vẫn nguyên và được gom thành đầu việc trong danh mục dữ liệu
cần bổ sung: khảo sát thuốc đối chiếu (38 ô), mức rủi ro và thông số do FD cấp (ma trận và biện luận của
ba cặp rủi ro — 244 ô, đang đứng ở nhóm lớn nhất), và các điểm cần người có thẩm quyền quyết. Điều gấp nhất
không đổi từ đợt 12: bảng kết quả Thử nghiệm 2 có 25 trong 45 ô trùng nguyên văn Thử nghiệm 1.

## Các luật mới và chỗ chúng chưa được thử

Ba luật đứng trên một bản nháp chưa có dữ liệu thật nên **chưa luật nào bị bản nháp thật thử**, và bằng chứng
của chúng là test dựng sẵn:

- Luật hạ mức rủi ro: mọi ô ma trận vẫn là dấu, nên không ô nào đã bị hạ.
- Luật không-số-đo cho hàm lượng suy ra: là heuristic. Bắt số kèm đơn vị và số có hai chữ số thập phân; một
  số đo viết bằng chữ, hoặc số trần không đơn vị trong đoạn văn, lọt qua.
- Luật f2: bắt buộc điều kiện được viết ra, không tính lại f2 và không đánh giá điều kiện đúng hay sai.

## Gate

G-35..G-47, định nghĩa trong `docs/plans/qbd-p2-format-reference/gates.yaml`, bằng chứng ở
`docs/reports/qbd-p2-format-reference/gates-g35-g47.txt`.
