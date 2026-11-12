# Kho fingerprint — bản Google Apps Script

Dành cho trường hợp không tải được Kho về máy và không chạy được lệnh. Script chạy **trong Drive của
bạn**, đọc file nhóm B/C, băm bằng đúng thuật toán của `python -m qbd_core kho-fingerprint` và công cụ
HTML, rồi ghi kết quả vào thư mục `kho-fingerprints` trên Drive.

An toàn: `appsscript.json` không có quyền `script.external_request` và mã không có `UrlFetchApp`, nên
script không gọi ra ngoài Google được (có test kiểm tra). Văn bản chỉ nằm trong bộ nhớ và trong bản
chuyển đổi Google Docs tạm (`__kho_tmp__…`), xóa vĩnh viễn ngay sau khi đọc.

Quyền Sheets: `SpreadsheetApp.openById` đòi quyền `spreadsheets` đầy đủ (bản chỉ đọc không đủ). Script
chỉ đọc Sheet, không có lệnh ghi nào, và vẫn không có quyền gọi ra ngoài Google.

Giới hạn cần biết:
- PDF và DOCX được **Google chuyển đổi sang Google Docs** (PDF qua OCR/convert), nên văn bản có thể
  khác `pdftotext`/pdf.js. Một số hash sẽ không trùng bản khác; đoạn chép dài nhiều dòng vẫn bị bắt.
  PDF quá lớn hoặc quá nhiều trang có thể bị Google từ chối: script ghi `convert_failed`, không bỏ qua
  im lặng, và dòng đó sẽ không có hash (G-03 chưa đóng cho đến khi xử lý được).
- Chỉ bắt trùng nguyên văn từ 8 từ trở lên, không bắt diễn đạt lại.
- Hash của cả 144 file có thể lên vài chục đến vài trăm MB. `finalize` dừng nếu `fingerprints.json`
  vượt 45 MB; khi đó giữ các file `<file_id>.json` từng file trong thư mục.

## Các bước
1. **Bảng phân loại thành Google Sheet.** Tải `kho-manifest-phan-loai.xlsx` lên Drive, mở bằng Google
   Sheets, chọn *Tệp → Lưu dưới dạng Google Trang tính*. Sheet phải có tab `Manifest` với cột
   `file_id`, `file_name`, `nhom`. Copy ID trong địa chỉ (đoạn giữa `/d/` và `/edit`).
2. **manifest.json lên Drive.** Tải `docs/kho/manifest.json` (nhánh hiện tại) lên Drive, mở file, copy
   ID trong địa chỉ.
3. **Tạo dự án.** Vào script.google.com → *Dự án mới*. Xóa nội dung `Code.gs` mặc định, dán toàn bộ
   `Code.gs` của thư mục này. Vào *Cài đặt dự án* → bật *Hiện tệp kê khai appsscript.json*, dán nội dung
   `appsscript.json` (bật sẵn Drive API v3 và các quyền cần).
4. **Điền CONFIG** ở đầu `Code.gs`: `TABLE_SHEET_ID`, `MANIFEST_FILE_ID`. `SALT` để trống hoặc điền
   chuỗi riêng (ghi vào file kết quả).
5. **Chạy `selfTest`.** Lần đầu Google hỏi cấp quyền; nếu hiện "chưa xác minh", chọn *Nâng cao → Đi tới
   dự án*. Nhật ký phải kết thúc bằng `selfTest passed`.
6. **Chạy `pilot`.** Xử lý thử 3 file nhóm A, không ghi gì. Xem nhật ký: có `"s":"ok"`, số từ và thời
   gian mỗi file. Nếu `convert_failed`, dừng lại và báo tôi.
7. **Chạy `runBatch`** nhiều lần (mỗi lần tối đa khoảng 4,5 phút) đến khi nhật ký có `done: run finalize`.
   Hoặc chạy `installTrigger` một lần để tự chạy mỗi 10 phút, xong thì xóa trigger.
8. **Chạy `finalize`.** Tạo `fingerprints.json` và `report.txt` trong thư mục `kho-fingerprints`.
   Nhật ký in số đã băm, lý do bỏ qua và kết quả bẫy (`leaked 0`).
9. **Chạy `cleanupTemp`** để chắc không còn bản chuyển đổi tạm nào.
10. Gửi tôi `report.txt` (chỉ có số đếm). `fingerprints.json` chỉ gửi theo phê duyệt của Trưởng bộ phận
    R&D, không commit vào git.

## Kiểm thử
`python -m pytest qbd_core/tests/test_kho_fingerprint_appsscript.py` chạy `Code.gs` trong node với
Google services giả: so từng hash với bản Python, so từng byte file kết quả, kiểm tra bản chuyển đổi
tạm bị xóa, các lỗi cấu hình dừng trước khi ghi gì. Dựng lại `Code.gs` từ mẫu:
`PYTHONPATH=. python tools/kho-fingerprint-offline/apps-script/build.py`.
