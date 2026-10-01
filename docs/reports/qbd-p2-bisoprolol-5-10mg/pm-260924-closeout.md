# Closeout — P.2 hai hàm lượng và outline đầy đủ

- Ngày: 2026-09-24
- Workstream: `qbd-p2-bisoprolol-5-10mg`
- Branch: `claude/codebase-architecture-summary-po0utr`
- Phạm vi chạm: `tools/pharma-dev-draft/` — không chạm `cowork-p2-kit/`

## Trạng thái

| | Trước | Sau |
|---|---|---|
| Mục CTD | 11 mục phẳng | 12 mục cha + 26 mục lá, lồng đúng cây |
| Hàm lượng phủ | 10 mg | 5 mg và 10 mg |
| Cấp heading render | mọi mục Heading 1 | suy từ độ sâu số CTD, không nhảy cấp |
| Test | 25 | 72 |
| Marker dữ liệu | 93 | 147, mỗi cái nêu nơi lấy dữ liệu |
| Danh mục việc cần bổ sung | không có | 113 dòng, sinh từ marker |

Gate: G-00..G-05 và G-07 `pass` kèm evidence trong thư mục này. G-06 `deferred`.

## Điều quan trọng nhất của đợt này

Hàm lượng 5 mg chỉ có công thức suy theo tỷ lệ. Tỷ lệ cho ra **khối lượng**, không cho ra **số đo**,
và không ai đọc file Word cuối cùng phân biệt được số nào là đo và số nào là tính. Nên điều đó được
chặn bằng máy: bảng nào biểu mẫu khai là bảng kết quả đo thì mọi ô thuộc cột của một hàm lượng khai
trong `meta.derivedStrengths` bắt buộc mang dấu. Luật nằm ở validator Stage B, trước renderer, nên tài
liệu chứa một số liệu bịa **không tạo ra được**, chứ không phải chỉ bị khuyên là đừng làm.

Luật đọc danh sách hàm lượng từ draft và không biết "5 mg" là gì, nên đúng với mọi sản phẩm.

Ngoại lệ duy nhất là bảng công thức cuối: thành phần là lượng khai báo, tỷ lệ cấp được. Mục đó buộc
phải nói rõ khối lượng là số tính. Trong bản thảo hiện tại nó vẫn trống, vì Thử nghiệm 1 kết luận CT03
là điểm khởi đầu cho Thử nghiệm 2 chứ không phải công thức chốt.

## Ba lỗi tự phát hiện trong chính gate của mình

Đáng ghi lại vì cùng một dạng: **cơ chế kiểm không khớp bất biến muốn kiểm**.

1. **G-00 viết dạng `grep -i` với bracket expression chứa ký tự Việt.** `grep` so sánh byte, nên trong
   locale byte-oriented thì `[aá]` bị tách thành các byte UTF-8 và **âm thầm thôi match**. Scan báo
   sạch trong khi từ đó đang nằm trong file. Chuyển thành test chạy trong suite, so sánh ký tự. Đã
   kiểm ngược bằng cách ghim tên công đoạn làm nhãn dòng và xem gate đổ.
2. **G-00 nhắm sai bề mặt.** Quét cả file outline, nên bắt phải sáu tên phương pháp pha chế trong
   `description` của `P.2.3` — văn xuôi hướng dẫn người soạn, không ràng buộc draft nào. Thu về đúng
   bề mặt được cưỡng chế: id, số CTD, heading, khối `form`. Cùng lý do đó, comment trong module cũng
   được loại khỏi scan.
3. **G-04 đòi "chỉ được thêm marker hoặc heading"** trong khi bất biến thật là "không thêm số đo".
   Một mục mới cần một câu nói nó dùng để làm gì. Phân loại lại theo **chỗ** giá trị nằm: ô bảng mới
   mang gì khác marker là số liệu không nguồn và bị chặn; đoạn văn mới là văn xuôi, báo cho người đọc
   duyệt.

Và một lỗi thứ tư cùng họ, ở G-07: bản đầu đòi số dòng phụ lục **bằng** số marker. Ma trận rủi ro
7 × 5 toàn ô trống cho thấy điều đó sai hướng — muốn bằng thì phải viết nguồn vào cả 35 ô, tức làm
bảng trong tài liệu không đọc được để thoả một cái danh sách. Đổi thành **phủ**: mỗi dòng mang số
marker nó phủ, tổng phải bằng đúng số marker, và bảng toàn-trống gộp thành một dòng.

## Hai lỗi khai sai trong bảng tổng hợp khoảng trống

Bảng này là chỗ duy nhất tài liệu tự khai mức sẵn sàng, nên một dòng sai là một câu sai về cả mục.

1. Nó đếm nhãn dòng là giá trị mỗi khi bảng mở đầu bằng cột số thứ tự — nên một biểu mẫu **chưa điền
   ô nào** lại báo "Có dữ liệu".
2. Nó bỏ qua đoạn văn — nên một mục mà toàn bộ nội dung là "chỗ này thiếu dữ liệu" cũng báo "Có dữ
   liệu".

Cột nào là cấu trúc nay suy từ chính các ô (cột toàn số thứ tự nhìn giống nhau dù đặt tên gì) và dùng
chung với công cụ đối chiếu giá trị thay vì tính hai lần. Kết quả trung thực: 12 mục có dữ liệu,
8 mục không có, 6 mục đã dựng khung.

## Còn lại, không đóng được bằng code

Cấp dữ liệu (FD): xác nhận linear formulation 5/10 mg · thiết kế viên 5 mg (file mẫu của phòng khắc
vạch chỉ ở hàm lượng cao, viên 10 mg của ta khắc số "10", nên hai hàm lượng không đồng nhất thiết kế
và không suy được bằng tỷ lệ) · hòa tan so sánh giữa hai hàm lượng và với thuốc đối chiếu · hệ màng
bao và processing aid · tương hợp dược chất–tá dược · điều kiện phương pháp hòa tan từ `3.2.P.5.2` ·
thông số quy trình và mức rủi ro · bao bì và độ ổn định `3.2.P.8` · pKa, LogP, đa hình, tính chảy,
phân hủy cưỡng bức · khảo sát Concor® ở từng hàm lượng.

Quyết định (FD/QA): phiên bản EP còn hiệu lực (G-06) · tiêu chuẩn tạp thành phẩm theo danh mục chuyên
luận · đánh lại số bốn mục con hòa tan, vì file mẫu dùng một số cho hai mục khác nhau và có một mục
sâu hơn nhóm chứa nó.

Danh mục đầy đủ 113 dòng nằm cuối bản Word đã render, sinh từ chính các dấu trong tài liệu.

## Hạn chế công cụ chưa gỡ

Renderer chưa chèn được hình. Công thức cấu tạo ở `3.2.P.2.1.1.1`, biểu đồ hòa tan ở `3.2.P.2.2.1.1`
và `3.2.P.2.2.3.1.4`, sơ đồ quy trình ở `3.2.P.2.3` phải bổ sung thủ công vào bản Word.

> **Đã gỡ ở workstream `qbd-p2-figures` (25/09/2026).** Renderer chèn được hình. Sơ đồ quy trình và
> biểu đồ hòa tan Thử nghiệm 1 nay tự dựng từ chính bảng trong mục. Ba hình còn lại vẫn vắng, nhưng lý
> do đổi từ "công cụ không làm được" sang "chưa có số liệu" — hai điều khác nhau với người đọc duyệt.
