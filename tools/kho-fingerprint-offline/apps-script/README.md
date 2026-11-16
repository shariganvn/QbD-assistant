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

## Chạy lại sau khi cập nhật script (bổ sung loại file)
Bản mới đọc trực tiếp `.docx`, `.pptx` (slide và ghi chú), `.xlsx` (chuỗi văn bản) từ nội dung file,
OCR ảnh PNG/JPG, và đánh dấu riêng file lớn hơn `MAX_BYTES` (50 MB) là `too_large` thay vì gửi cho
trình chuyển đổi của Google. Không hỗ trợ: `.zip`, `.xla`, `.doc` (nếu Google không chuyển được) và PDF
quá lớn.

1. Dán `Code.gs` mới đè lên cũ, giữ nguyên `TABLE_SHEET_ID` và `MANIFEST_FILE_ID` ở `CONFIG`. Lưu.
2. Chạy **reprocess**: xóa trạng thái bỏ qua loại `unsupported_type` và `convert_failed` trong
   `progress.json` (file đã băm xong được giữ nguyên, không xử lý lại).
3. Chạy **runBatch** đến khi có dòng `done`, rồi **finalize** (ghi đè `fingerprints.json` và
   `report.txt`) và **cleanupTemp**.

## Các file còn lại sau lần chạy đầu (bản 3)
Bản này đọc thêm `.zip` đệ quy (độ sâu và số thành viên và dung lượng giải nén đều có giới hạn trong
`CONFIG`; vượt giới hạn thì ghi `zip_limits`), trích chuỗi chữ đọc được từ `.xla` và `.doc` khi Google
không chuyển được (phương pháp "strings", độ chính xác thấp hơn bộ đọc thật; mã VBA nén trong `.xla`
không được thấy), và thử chuyển đổi tối đa 3 cách trước khi bỏ cuộc một file.

1. Dán `Code.gs` mới, giữ `CONFIG`. Chạy **selfTest**.
2. Chạy **inspect**: in từng dòng đếm cho các file còn bỏ qua (loại, dung lượng, với zip là số thành
   viên theo đuôi, với nhị phân là số đoạn chữ). Không in tên file hay nội dung. Gửi tôi các dòng này.
3. Chạy **reprocess**, rồi **runBatch** đến `done: run finalize`, rồi **finalize** và **cleanupTemp**.
   Báo cáo có thêm dòng `methods {...}` cho biết file được đọc bằng cách nào (`xml`, `converted`,
   `zip`, `strings`).

## Kiểm thử
`python -m pytest qbd_core/tests/test_kho_fingerprint_appsscript.py` chạy `Code.gs` trong node với
Google services giả: so từng hash với bản Python, so từng byte file kết quả, kiểm tra bản chuyển đổi
tạm bị xóa, các lỗi cấu hình dừng trước khi ghi gì. Dựng lại `Code.gs` từ mẫu:
`PYTHONPATH=. python tools/kho-fingerprint-offline/apps-script/build.py`.
