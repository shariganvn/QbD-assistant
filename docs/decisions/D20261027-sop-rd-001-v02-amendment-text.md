# Đề xuất sửa SOP-RD-001 v02, Phụ lục A (bảng ánh xạ CTD và ACTD)

Ngày: 27/10/2026. Căn cứ: đối chiếu với ICH M4Q(R1) và Phụ lục I ACTD dự thảo 2025 (`docs/reports/qbd-core-p2-autodraft/g-08.txt`), quyết định của chủ dự án trong `D20261027-g08-numbering-owner-decisions.md`. Bảng dưới chỉ nêu những ô phải đổi; các dòng còn lại của Phụ lục A khớp nguồn và giữ nguyên.

## 1. Sửa bắt buộc (làm hệ thống và SOP nhất quán)

| Dòng | Ô | Hiện tại (theo hệ thống đang đọc từ SOP) | Sửa thành |
|---|---|---|---|
| P.2.3 Phát triển quy trình sản xuất (ACTD P2.4) | Yêu cầu, thị trường trong nước, thuốc generic | Mục đánh dấu NCE/Biotech; EU yêu cầu | **Không yêu cầu đối với thuốc generic (ACTD P2.4 chỉ yêu cầu NCE và biotech). EU: yêu cầu.** |
| P9 Khả năng thay thế lẫn nhau (không có mục CTD tương ứng) | Yêu cầu | Dữ liệu hòa tan in vitro | **Bắt buộc: dữ liệu hòa tan in vitro và tương đương sinh học in vivo (ACTD P9, áp dụng cho thay đổi lớn và generic).** |

## 2. Sửa tên cho đúng nguồn (không đổi yêu cầu)

| Dòng | Hiện tại | Sửa thành |
|---|---|---|
| ACTD P2.5 (CTD P.2.4) | Hệ bao bì | Hệ thống bao bì đóng gói |
| ACTD P2.6 (CTD P.2.5) | Thuộc tính vi sinh | Thuộc tính vi sinh vật |
| ACTD P2.3.3 (CTD P.2.2.3) | Đặc tính lý hóa và sinh học | Đặc tính hoá lý và sinh học (nếu SOP muốn khớp nguyên văn dự thảo) |
| ACTD P2.3.1 (CTD P.2.2.1) | Phát triển công thức | Phát triển công thức bào chế |

## 3. Bổ sung một ghi chú phạm vi

Thêm dưới bảng Phụ lục A: "ACTD P 2.1 (Thông tin về những nghiên cứu phát triển) chỉ áp dụng cho NCE và sản phẩm công nghệ sinh học, nằm ngoài phạm vi SOP này. Với thuốc generic không soạn mục này."

Thêm một dòng nguồn ở đầu Phụ lục A: "Đối chiếu ngày 27/10/2026 với ICH M4Q(R1) (Step 4, 12/09/2002) và Phụ lục I ACTD dự thảo 2025. Khi Phụ lục I được ban hành chính thức kèm Thông tư, đối chiếu lại số mục."

## 4. Ghi vào lịch sử sửa đổi

"v02.1 (27/10/2026): Phụ lục A: P.2.3 không yêu cầu cho thuốc generic thị trường trong nước; P9 bổ sung tương đương sinh học in vivo; chỉnh tên mục ACTD theo nguồn; thêm ghi chú P 2.1 và nguồn đối chiếu."

## Sau khi sửa SOP

Báo lại để hệ thống ghi nhận số phiên bản mới (cập nhật `source` trong `config/ctd_actd_map.json` và `gates.yaml`). Mã đã khớp nội dung ở mục 1 và 2 nên không cần chạy lại gì khác; G-08 chỉ còn chờ bản Phụ lục I ban hành chính thức nếu số mục khác dự thảo.
