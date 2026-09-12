# Đối chiếu đầu ra 3.2.P.2 với ICH Q8(R2)

- Ngày: 2026-08-28
- Đối tượng: `tools/pharma-dev-draft/draft/example-draft.json` (Bisoprolol fumarate 10 mg,
  viên nén bao phim; nguồn duy nhất "Thử nghiệm 1.docx — Khảo sát tỷ lệ tá dược rã")
- Chuẩn đối chiếu 1: `docs/raw/international-conference-harmonisation-...-q8-r2-...-step-5_en.pdf`
  (ICH guideline Q8 (R2), Step 5, EMA/CHMP/ICH/167068/2004, 22/06/2017; 24 trang, trang in = index + 1)
- Chuẩn đối chiếu 2: `docs/raw/135-00-Pharmaceutical Development-example.docx` (file mẫu của phòng)
- Công cụ: subagent `ich_q8_r2_checker`; trích xuất PDF bằng PyMuPDF

## Trạng thái nguồn

Đã đọc được PDF gốc, toàn bộ Part I (tr. 5–11), Part II Annex (tr. 12–18) và Appendix 1 (tr. 19).
Không có trang scan, không có mục nào không trích xuất được. Mọi trích dẫn trong báo cáo này đều
kèm số trang in và đã được đối chiếu lại trực tiếp trên PDF, không phải từ trí nhớ.

Ghi chú bản quyền: trang bìa PDF ghi *"© European Medicines Agency, 2017. Reproduction is
authorised provided the source is acknowledged."* — việc lưu bản này trong repo là hợp lệ khi có
dẫn nguồn. Điều này **không** áp dụng cho Handbook of Pharmaceutical Excipients (sách thương mại
của Pharmaceutical Press) đang nằm cùng thư mục; câu hỏi bản quyền cho HPE vẫn còn treo.

ICH Q6A (Step 4, 06/10/1999, 35 trang) đã được bổ sung vào `docs/raw/` ở đợt 3. Số trang in =
chỉ số PDF − 3. Các decision tree (tr. 22–31) là **ảnh, không có text layer** — phải render trang
thành PNG mới đọc được nội dung. PDF này **không mang tuyên bố cho phép sao chép** nào; Q6A là
guideline công khai của ICH nên rủi ro thấp, nhưng không có câu cho phép tường minh như bản EMA của
Q8(R2) — ghi nhận để phòng quyết, không tự kết luận.

## Kết luận

Hồ sơ **chưa đạt kỳ vọng nền của Q8(R2) Part I**. Bốn mục chưa có nội dung (2.3 quy trình sản
xuất, 2.4 bao bì, 2.5 vi sinh, và phần lớn 2.1.1); chỉ 2.6 Compatibility đạt trọn vẹn, 2.2.2
Overages đạt điều kiện. Điều này là dự kiến được: nguồn duy nhất là một thử nghiệm sàng lọc công
thức. Bản thân draft đánh dấu gap kèm lý do một cách trung thực và không bịa số liệu ở đâu —
đó là xử lý đúng, không phải lỗi công cụ.

**Q8(R2) hầu như không quy định format.** Toàn văn chỉ có một câu chạm tới trình bày (tr. 6:
*"Summary tables and graphs are encouraged where they add clarity and facilitate review."*).
Không có bất kỳ quy định nào về đánh số heading, cấp heading, font hay độ dài. Tr. 5 tự nhận
guideline mô tả *"suggested contents"* cho mục 3.2.P.2 theo định dạng CTD của ICH M4. Vì vậy mọi
nhận xét về hình thức trong báo cáo này đều quy về **ICH M4Q hoặc file mẫu của phòng**, không quy
về Q8(R2).

## Đính chính kết luận của đợt kiểm tra trước

Đợt kiểm tra ngày trước không tải được PDF (network policy chặn EMA/ICH) nên phải dựa vào
WebSearch, và đã kết luận rằng việc thiếu QTPP/CQA/risk assessment "không phải lỗi so với
Q8(R2)". **Kết luận đó quá khoan dung và nay được sửa.**

Đúng là: thiếu **design space** và **real-time release testing** là lựa chọn hợp lệ — Appendix 1
tr. 19: *"In the enhanced approach, establishing a design space or using real time release testing
is not necesserily expected."* [nguyên văn, kể cả lỗi chính tả trong bản EMA]. Và Annex tr. 12 tự
tuyên bố *"is not intended to establish new standards or to introduce new regulatory
requirements"*. Thuật ngữ QTPP/CQA/control strategy cũng chỉ có trong glossary của Annex (tr. 18),
không có trong glossary Part I (tr. 10–11).

Nhưng câu quyết định nằm ở **Part I, trang 6**, không phải Annex:

> "At a minimum, those aspects of drug substances, excipients, container closure systems, and
> manufacturing processes that are critical to product quality should be determined and control
> strategies justified."

Lặp lại ở 2.2.1 tr. 7 (*"including identification of those attributes that are critical to the
quality of the drug product"*) và 2.3 tr. 9 (*"should identify any critical process parameters
that should be monitored or controlled"*).

Nghĩa là: **không cần** bảng QTPP/CQA đúng thuật ngữ Annex; **nhưng phải** xác định đâu là yếu tố
critical to product quality và biện luận cách kiểm soát, dù chỉ bằng văn xuôi. Hồ sơ hiện chưa làm
điều này dưới bất kỳ hình thức nào. Đây là thiếu so với sàn Part I.

## Bảng đối chiếu Part I 2.1.1 → 2.6

| Điều khoản Q8(R2) | Mục CTD | Hiện trạng | Kết luận |
|---|---|---|---|
| 2.1.1 Drug substance (tr. 6) — properties ảnh hưởng performance/manufacturability: solubility, water content, particle size, crystal properties, biological activity, permeability | P.2.1.1 | Bảng 7 dòng, draft tự khai là kiến thức tham khảo chưa đối chiếu CoA/dược điển. Cỡ hạt, đa hình, BCS thực nghiệm, độ tan theo pH, ổn định — đều là marker trống | Chưa đạt — **thiếu dữ liệu**. Đúng các thuộc tính guideline nêu tên lại là phần trống |
| 2.1.1 (tr. 7) — *"The compatibility of the drug substance with excipients listed in 3.2.P.1 should be evaluated"* | P.2.1.1 (draft đặt ở P.2.1.2) | Marker trống, nay đã có mục riêng `3.2.P.2.1.2.2` | Chưa đạt — **thiếu dữ liệu**. Đây là một trong số ít yêu cầu Part I dùng "should be evaluated" tuyệt đối, không kèm "where appropriate" |
| 2.1.2 Excipients (tr. 7) — *"This should include all substances used in the manufacture of the drug product, whether they appear in the finished product or not (e.g., processing aids)"* | P.2.1.2 | Bảng 6 tá dược lõi viên, tổng 100,00 mg. **Không có hệ màng bao, không có dung môi tá hạt** dù sản phẩm khai là viên nén bao phim | Chưa đạt — **thiếu cấu trúc**. Đã bổ sung marker ghi nhận trong lần cập nhật này |
| 2.2.1 Formulation development (tr. 7–8) — evolution từ concept tới final design; identification of critical attributes; tóm tắt công thức lâm sàng/BE; IVIVC; biện luận special design features | P.2.2.1.1/.2/.3 | 1 vòng thử nghiệm, 1 biến (croscarmellose 1/3/5%), 3 bảng kết quả đầy đủ, chọn CT03. RMP `gap`. Không có IVIVC, không có công thức lâm sàng, không có evolution | Chưa đạt — **thiếu dữ liệu**. Phần thực nghiệm đã có thì chắc và truy vết được. Đợt 2 đã bổ sung biện luận criticality cho yếu tố duy nhất được khảo sát biến thiên, và biện luận special design feature |
| 2.2.2 Overages (tr. 8) — overage bị *"discouraged"*, nếu có phải biện luận | P.2.2.2 | Ghi nhận không thấy overage, nêu rõ đây là quan sát chưa phải xác nhận chính thức | **Đạt điều kiện.** Không có overage thì nghĩa vụ biện luận không phát sinh |
| 2.2.3 Physicochemical and biological properties (tr. 8) | P.2.2.3 | Đợt 2 đã bổ sung biện luận discriminatory power từ dữ liệu ba công thức; điều kiện phương pháp hòa tan vẫn là marker trống | Chưa đạt một phần. Lưu ý sắc thái: phần method development dùng **"could be provided"**, không phải "should" — kỳ vọng mềm theo Q8(R2), nhưng file mẫu phòng lại đòi kỹ |
| 2.3 Manufacturing process development (tr. 8–9) | P.2.3 | `gap` toàn mục | Chưa đạt — **thiếu dữ liệu**. Cần hồ sơ quy trình/hồ sơ lô, không đóng được bằng viết lại |
| 2.4 Container closure system (tr. 9–10) | P.2.4 | `gap` toàn mục | Chưa đạt — **thiếu dữ liệu** |
| 2.5 Microbiological attributes (tr. 10) — *"Where appropriate"*, gồm cả *"rationale for performing or not performing microbial limits testing"* | P.2.5 | `gap` | Chưa đạt, **nhưng gánh nặng thấp nhất**: guideline chấp nhận biện luận lý do KHÔNG thử. Đã xác minh bằng Q6A: có lối đóng không cần thực nghiệm vi sinh, **nhưng cần dữ liệu chứng minh tính ức chế phát triển** mà hồ sơ chưa có. Xem đính chính đợt 3 |
| 2.6 Compatibility (tr. 10) — giới hạn ở dung môi hoàn nguyên và pha loãng trước khi dùng | P.2.6 | "Không áp dụng" kèm lý do dạng bào chế + chờ FD xác nhận | **Đạt trọn vẹn.** Mục duy nhất đạt hoàn toàn |

## Findings

### CRITICAL

**C-1 — Không xác định yếu tố critical to product quality và không biện luận control strategy ở
bất kỳ mục nào.** Vi phạm Part I tr. 6 (trích ở phần đính chính trên). Không phải chuyện Annex.
Chi phí đóng thấp: có thể viết dạng văn xuôi có biện luận, không bắt buộc làm QbD đầy đủ.
Loại: thiếu dữ liệu + thiếu cấu trúc.

*Trạng thái sau đợt 2:* đã đóng phần khảo sát được — xem mục "Đã sửa — đợt 2". Phần còn
lại (thuộc tính API, thông số quy trình, màng bao, bao bì) vẫn là thiếu dữ liệu.

**C-2 — Danh mục tá dược bỏ sót toàn bộ hệ màng bao và mọi processing aid.** Vi phạm 2.1.2 tr. 7.
Sản phẩm khai là viên nén bao phim, P.2.2.1.2 mô tả "viên nén tròn, bao phim trắng", nhưng bảng
thành phần cộng đúng 100,00 mg chỉ có lõi. Đây là **thiếu cấu trúc thật**, không phải chờ nguồn:
Thử nghiệm 1 đã sản xuất ra viên bao phim nên chất bao phải tồn tại đâu đó trong hồ sơ gốc.
→ Đã bổ sung marker trong lần cập nhật này; cần FD cung cấp thành phần thật.

**C-3 — Chưa có đánh giá tương hợp dược chất – tá dược.** Vi phạm 2.1.1 tr. 7. Bisoprolol fumarate
là muối acid hữu cơ dùng chung công thức với magnesium oxide (kiềm) — đúng kịch bản cần dữ liệu
tương hợp. → Đã tách thành mục `3.2.P.2.1.2.2` trong lần cập nhật này; dữ liệu vẫn cần bổ sung.

**C-4 — P.2.3 trống toàn mục.** Vi phạm 2.3 tr. 8–9. Không thể đóng bằng viết lại.

**C-5 — P.2.4 trống toàn mục.** Vi phạm 2.4 tr. 9–10. Với viên nén cần cân nhắc bảo vệ ẩm
(tr. 9: *"protection from moisture and light"*), mục này không thể để trống khi nộp.

### WARNING

**W-1 — `p2-outline.json` thiếu ba heading cha. Lệch chuẩn phòng/M4Q, KHÔNG phải lỗi Q8(R2).**
Outline chỉ có 11 entry, bắt đầu thẳng từ `P.2.1.1`. Tài liệu render ra nhảy từ
`3.2.P.2 PHÁT TRIỂN DƯỢC HỌC` xuống thẳng `3.2.P.2.1.1 DƯỢC CHẤT`, thiếu
`3.2.P.2.1 COMPONENTS OF THE DRUG PRODUCT`, `3.2.P.2.2 DRUG PRODUCT`,
`3.2.P.2.2.1 FORMULATION DEVELOPMENT` — cả ba đều có trong file mẫu của phòng.
Không làm sai lệch nội dung khoa học, nhưng phá cấu trúc CTD mà thẩm định viên dùng để điều hướng.
**Chưa sửa theo quyết định của người dùng** (chỉ ghi nhận, để phòng quyết). Chi phí sửa: thêm ba
entry vào outline + renderer chấp nhận section không mang block.

**W-2 — Mọi heading render ở Heading 1, mất phân cấp.** `render/builder.mjs` dùng `h1()` cho cả
11 mục, nên `3.2.P.2.1.1` cùng cấp với `3.2.P.2.3`. Navigation pane và TOC tự động sẽ phẳng.
Cùng nguồn với W-1; Q8(R2) im lặng về việc này.

**W-3 — Thiếu toàn bộ nhóm risk assessment so với file mẫu phòng. Lệch chuẩn phòng, KHÔNG phải
lỗi Q8(R2).** File mẫu có `3.2.P.2.2.1.3.2 Initial Risk Assessment of Formulation Variables`,
`.3.4 Updated risk assessment`, `3.2.P.2.3.1 Initial risk assessments of manufacturing process`,
`3.2.P.2.2.1.2.1 QTPP`, `3.2.P.2.2.3.1.2 Discriminatory power`, `3.2.P.2.3.2.3 Scale up`.
Hồ sơ không có mục nào. Guideline và file mẫu mâu thuẫn ở đây — phòng có quyền đặt chuẩn nội bộ
cao hơn sàn ICH. Quyết định thuộc FD.

**W-4 — CT03 ở 5% croscarmellose chạm trần khoảng khuyến cáo, không còn headroom.** CT02 (3%) đã
cho Min = 79,12%, dưới ngưỡng 80% Q. Biên an toàn phía dưới đã được chứng minh là hẹp. Chưa khai
excipient range trong batch formula nên nghĩa vụ biện luận range (2.2.1 tr. 7) chưa phát sinh,
nhưng đây là câu hỏi thẩm định gần như chắc chắn.

**W-5 — Dữ liệu lý hóa API tự khai là "tham khảo, cần xác nhận"** (pKa ≈ 9,5; BCS Class I "thường
được xếp"). 2.1.1 tr. 6 đòi properties *"identified and discussed"*; giá trị chưa đối chiếu chuyên
luận/CoA không đáp ứng. Draft đã cảnh báo minh bạch, nhưng phải thay bằng số có nguồn trước khi nộp.

*Trạng thái sau đợt 4:* vẫn mở. Chỉ ô công thức phân tử được đối chiếu. Tài liệu đóng được mục này
là **CoA hoặc tiêu chuẩn của lô nguyên liệu từ nhà cung cấp API** — chứng chỉ chuẩn đối chiếu không
thay thế được.

**W-6 — `meta.preparer` ghi AI là người soạn thảo.** Không liên quan Q8(R2); là vấn đề data
integrity — người soạn phải là cá nhân định danh được. Bảng ký cuối tài liệu đã có dòng "Rà soát
FD"/"Phê duyệt QA-PO" bỏ trống nên rủi ro có kiểm soát, nhưng trường này nên đổi.

**W-7 — Thiếu discriminatory power của phương pháp hòa tan, dù dữ liệu đã có sẵn.** Q8(R2) tr. 8
dùng "could be provided" (mềm), nhưng file mẫu phòng đòi hẳn một mục. Nghịch lý đáng chú ý: ba
công thức khác nhau về tỷ lệ rã cho 73,89 / 81,40 / 98,64% — **đó chính là bằng chứng phương pháp
phân biệt được**. Có thể đóng phần lớn mục này mà không cần thực nghiệm mới, chỉ cần bổ sung điều
kiện phương pháp (thiết bị, tốc độ, môi trường, thể tích).

*Trạng thái sau đợt 2:* nửa discriminatory power đã đóng. Điều kiện phương pháp vẫn thiếu — phải
trích từ hồ sơ 3.2.P.5.2, không suy ra được từ Thử nghiệm 1.

**W-8 — Tiêu chuẩn tạp chất viên thành phẩm không định danh tạp, và ngưỡng tổng tạp rất rộng.**
`P.2.2.1.2` ghi "Tạp đơn bất kỳ ≤ 0,2%; tổng tạp ≤ 3,0%" — không nêu tên tạp nào. Phép thử tạp
liên quan của bisoprolol fumarat theo chuyên luận lại được thực hiện dưới dạng **định danh từng
tạp**: tạp G, tạp A, tạp E, tạp khác, tổng tạp — thấy rõ trên chứng chỉ chuẩn đối chiếu SKS
C0223252. Hai điểm để đối chiếu độ rộng của ngưỡng: kết quả thực đo trên viên ở cả ba công thức là
0,1839 – 0,1918% tổng tạp, tức cách ngưỡng 3,0% hơn một bậc; và bản thân chất chuẩn đo được tổng
tạp 0,07%. Ngưỡng 3,0% cho một viên nén phóng thích ngay của hoạt chất ổn định là bất thường và
gần như chắc chắn bị hỏi khi thẩm định. Cần FD xác nhận chuyên luận áp dụng (USP/BP/Ph.Eur.) và
khai lại tiêu chuẩn theo đúng danh mục tạp của chuyên luận đó. Loại: lệch chuẩn + thiếu cấu trúc;
sửa được bằng viết lại, không cần thực nghiệm mới.

### INFO

**I-1 — Vắng mặt design space, RTRT, PAT, DoE đa biến là lựa chọn hợp lệ, đã xác minh.**
Appendix 1 tr. 19 mô tả "Minimal Approaches" gồm *"Mainly empirical / Developmental research often
conducted one variable at a time"*. Thiết kế một-biến-một-lần của Thử nghiệm 1 nằm đúng trong
minimal approach mà Q8(R2) công nhận, và hồ sơ **không** tuyên bố có QbD ở bất kỳ đâu nên không tự
đặt mình vào nghĩa vụ chứng minh. Đây là điểm tự nhất quán, đáng ghi nhận.
Bẫy cần tránh về sau — Annex 2.4.5 tr. 15: *"A combination of proven acceptable ranges does not
constitute a design space."* Điều khoản này sẽ kích hoạt nếu gom nhiều thử nghiệm đơn biến rồi gọi
đó là design space.

**I-2 — Cách xử lý khoảng trống dữ liệu là đúng, không tính là lỗi.** Sáu marker
`[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]` (nay là bảy) và bốn `status: gap` kèm `gapReason`; không chỗ nào
bịa số liệu. Bảng tổng hợp khoảng trống cuối tài liệu là điểm cộng thực chất cho việc lập kế hoạch
bổ sung. P.2.2.1.2 tự tuyên bố "KHÔNG phải bảng QTPP/CQA chính thức" là mức tự giác hiếm thấy.

**I-3 — Truy vết nguồn của P.2.1.2 tốt hơn mức trung bình.** Trích HPE 6th ed. kèm số trang từng
chuyên luận, và ghi rõ nguyên tắc không lấy chỉ tiêu từ nguồn khác khi chuyên luận không nêu.

**I-4 — Draft tự khai magnesium stearate 3% là biến nhiễu tiềm tàng.** Nếu mức trơn cao đang kìm
hãm hòa tan thì kết luận "phải dùng 5% croscarmellose" có thể là hệ quả của một biến chưa tối ưu
khác. Đáng đưa vào Thử nghiệm 2.

**I-5 — Đặc điểm "khắc số 10 một mặt" chưa có biện luận.** 2.2.1 tr. 8: *"Any special design
features of the drug product (e.g., tablet score line, overfill, anti-counterfeiting measure as it
affects the drug product) should be identified and a rationale provided for their use."* Khắc chữ
nhận dạng nhẹ hơn score line, một câu biện luận là đủ đóng.

*Trạng thái sau đợt 2:* đã đóng, kèm câu chờ FD xác nhận mục đích của ký hiệu.

## Đã sửa — đợt 1 (tách mục tá dược)

- `P.2.1.2` tách thành hai mục có đánh số theo file mẫu của phòng:
  `3.2.P.2.1.2.1. Đặc tính lý hóa` và `3.2.P.2.1.2.2. Nghiên cứu tương hợp dược chất – tá dược`.
  Lưu ý: Q8(R2) đặt yêu cầu tương hợp **dược chất–tá dược** ở mục 2.1.1 (tr. 7), còn 2.1.2 chỉ giữ
  tương hợp **tá dược–tá dược**. File mẫu của phòng đặt ở `3.2.P.2.1.2.2`. Bản này theo file mẫu;
  nếu FD muốn bám sát Q8(R2) thì chuyển sang P.2.1.1.
- Bổ sung marker ghi nhận thiếu hệ màng bao và processing aid (C-2), kèm dẫn chiếu 2.1.2 tr. 7.
- `meta.referenceSources` thêm Q8(R2) để trang bìa khai đủ nguồn tài liệu đã viện dẫn.

## Đã sửa — đợt 2 (C-1, nửa W-7, I-5)

Nguyên tắc của đợt này: **chỉ viết lập luận từ số liệu đã có trong draft**, không thêm bất kỳ giá
trị đo nào. Mọi con số trong văn bản mới đều truy về bảng kết quả ở `P.2.2.1.3`.

- **C-1 → `P.2.2.1.2`**, mục "Xác định yếu tố trọng yếu và biện luận kiểm soát". Kết luận tỷ lệ
  croscarmellose sodium là thuộc tính công thức trọng yếu, dựa trên đúng cơ chế mà Q8(R2) tr. 6 mô
  tả (*"identified through an assessment of the extent to which their variation can have impact on
  the quality of the drug product"*): biến độc lập duy nhất, tác động đo được lên độ hòa tan và độ
  rã. Biện luận kiểm soát: cố định 5% kl/kl, giữ độ hòa tan và độ rã trong bộ chỉ tiêu thành phẩm,
  kèm cảnh báo 5% chạm trần khoảng HPE. Một marker riêng liệt kê những yếu tố **chưa** đánh giá
  được tính trọng yếu, để không tạo ấn tượng đã làm risk assessment đầy đủ.
- **W-7 (một nửa) → `P.2.2.3`**: biện luận discriminatory power hồi cứu từ ba kết quả
  73,89 / 81,40 / 98,64% trên ba công thức chỉ khác tỷ lệ tá dược rã. Marker cũ được thu hẹp lại
  còn đúng phần thiếu thật — điều kiện phương pháp — kèm câu nói rõ biện luận này không thay thế
  cho việc khai điều kiện.
- **I-5 → `P.2.2.1.3`**, mục "Đặc điểm thiết kế riêng của viên": biện luận ký hiệu khắc theo
  2.2.1 tr. 8, phân biệt với vạch bẻ, dẫn AV và đồng đều khối lượng làm bằng chứng không có tác
  động bất lợi, đóng bằng câu chờ FD xác nhận.

**Câu hỏi đánh số để FD quyết:** heading criticality để **không đánh số** vì file mẫu của phòng đã
dùng `3.2.P.2.2.1.2.1 QTPP` và `.2 CQAs`. Nếu phòng muốn mục này có số riêng thì phải quyết vị trí
của nó trong cây đánh số trước.

**Đính chính một trích dẫn của đợt 1:** báo cáo đợt 1 ghi có thể đóng P.2.5 bằng "ICH Q6A Decision
Tree #8". Repo khi đó không có file Q6A nên số hiệu này được hạ xuống **chưa xác minh**. *Xem đính
chính đợt 3 bên dưới — có nguồn rồi thì #8 là đúng.* Phần vẫn đúng của ghi chú này: chỗ Q8(R2)
tr. 8 cross-reference là Q6A Decision Tree #4 (Part 3) và #7 (Part 1), thuộc phần hòa tan/drug
release — đó là việc khác, không mâu thuẫn với #8. Ràng buộc kỹ thuật đi kèm: validator chặn
`E_GAP_HAS_BLOCKS` — section `status: "gap"` không được mang block, nên muốn viết biện luận vào
P.2.5 thì phải lật sang `covered`, mà lật khi chưa có kết quả vi sinh nào là khai sai. P.2.5 giữ
nguyên `gap`.

## Đợt 3 — Q6A vào repo, đính chính ngược, làm rõ P.2.5

**Đính chính đợt 2 (sai chiều ngược lại).** Đợt 2 hạ "Decision Tree #8" xuống `chưa xác minh` vì
repo không có nguồn. Đúng quy trình vào lúc đó, nhưng nay đã đọc được Q6A và **#8 chính là cây vi
sinh**: tr. 31, *"DECISION TREE #8: MICROBIOLOGICAL ATTRIBUTES OF NON-STERILE DRUG PRODUCTS"*. Số
hiệu đợt 1 đưa ra là chính xác.

**Điều Q6A thực sự đòi, đọc từ cả thân bài lẫn cây.** Thân bài tr. 12 (§3.3.2 Solid Oral Drug
Products, mục f) nói *"With acceptable scientific justification, it should be possible to propose
no microbial limit testing for solid oral dosage forms"* — nhưng vế *"acceptable scientific
justification"* mới là phần nặng. Cây #8 (tr. 31) nói rõ nội dung vế đó cho viên nén:

1. Sản phẩm có chất bảo quản hoặc tự có hoạt tính kháng khuẩn? → **Không** (viên nén bisoprolol).
2. Có phải dạng bào chế khô (viên nén, bột)? → **Có**.
3. *"Does scientific evidence demonstrate growth inhibitory properties of the drug product?"*
   - **Có** → *"Microbial limits acceptance criteria and testing may not be necessary."*
   - **Không** → lập tiêu chuẩn theo chuyên luận dược điển hài hòa, thử **từng lô**, và chỉ sau khi
     các lô sản xuất đạt ổn định mới được *"perform skip-lot testing, or provide scientific
     justification for no routine microbial limits testing"*.

Nút 3 là nút quyết định, và hồ sơ **không có** bằng chứng cho nó. Cộng thêm hai điều kiện ở tr. 12
(nguyên liệu kiểm trước sản xuất; quy trình đã thẩm định không mang rủi ro nhiễm/tăng sinh đáng
kể), đây là ba loại dữ liệu còn thiếu. Vì vậy **có nguồn vẫn chưa đóng được P.2.5** — mục này
chuyển từ "chờ nguồn guideline" sang "thiếu dữ liệu", nhưng nay là thiếu dữ liệu **có tên cụ
thể**, không còn mơ hồ.

**Đã sửa:** `P.2.5` giữ `status: "gap"`, viết lại `gapReason` nêu hai lối Q6A cho phép và ba loại
bằng chứng còn thiếu; `meta.referenceSources` thêm Q6A (trường này khai nguồn cho trang bìa, và
`gapReason` có được render — cả trong bảng tổng hợp khoảng trống lẫn thân mục).

## Đợt 4 — Chứng chỉ chuẩn đối chiếu thứ cấp

**Tài liệu nhận được không phải CoA lô API.** Đây là Chứng chỉ phân tích **Chuẩn đối chiếu thứ
cấp** (Secondary Reference Substance) Bisoprolol fumarat, Viện Kiểm nghiệm thuốc Trung ương, SKS
**C0223252**, ban hành 15/12/2020, date of adoption 18/05/2023, re-test 2026. Mục đích ghi trên
chính tài liệu: *"intended to be used in physicochemical analysis for assay and identification"*.
Nội dung: mô tả bột màu trắng; nước (KF) 0,14%; tro sulfat 0,02%; tạp liên quan HPLC (tạp G 0,07%,
tạp A < 0,05%, tạp E và tạp khác không phát hiện, tổng 0,07%); định lượng 99,6% as-is, U = ±0,2%
(k = 2, 95%), đối chiếu USPRS lô R093J0. Bản gốc là scan không có text layer — phải render trang
thành ảnh mới đọc được.

**Ranh giới CTD.** Chất chuẩn đối chiếu là vật liệu hiệu chuẩn cho phép thử, thuộc `3.2.S.5
Reference Standards` và `3.2.P.5.2/5.3`. Nó **không** mang các thuộc tính mà `3.2.P.2` đang chờ:
pKa, LogP, độ tan theo pH, BCS thực nghiệm (W-5); phân bố cỡ hạt, đa hình, tính chảy (C-1, W-5);
dữ liệu ổn định/phân hủy dược chất; kiểm vi sinh nguyên liệu trước sản xuất (một trong ba điều
kiện Q6A cho P.2.5); tương hợp dược chất – tá dược (C-3). Gán thuộc tính của chất chuẩn thành
thuộc tính của API sản xuất là lỗi nghiêm trọng trong hồ sơ đăng ký, nên các mục trên **giữ nguyên
trạng thái thiếu**.

**Hai điểm đã đóng được:**

- `P.2.1.1` — công thức phân tử. Draft ghi `(C18H31NO4)2·C4H4O4`, chứng chỉ ghi `C40H66N2O12`;
  khai triển khớp chính xác (C 40, H 66, N 2, O 12). Đây là đối chiếu, không phải dữ liệu mới. Kèm
  ghi chú giới hạn phạm vi chứng chỉ để người đọc không hiểu nhầm là đã có CoA nguyên liệu.
- `meta.referenceSources` — thêm chứng chỉ, để trang bìa khai đủ nguồn.

**Bản scan không được commit** theo quyết định của user (tài liệu mang chữ ký và dấu của Viện
trưởng). Thông tin định danh ghi ở trên và trong `meta.referenceSources` là dấu vết truy nguyên
thay cho file.

## Còn lại, phân theo loại

**Thiếu dữ liệu** (cần nguồn, không sửa được bằng viết lại): C-3 tương hợp, C-4 quy trình sản
xuất, C-5 bao bì, P.2.2.1.1 RMP, thuộc tính API ở W-5, thành phần màng bao thật ở C-2, điều kiện
phương pháp hòa tan ở W-7, và phần criticality của mọi yếu tố ngoài tá dược rã ở C-1.

**Thiếu cấu trúc** (sửa được ngay, không cần dữ liệu mới): W-1 ba heading cha, W-2 phân cấp
heading. C-1, nửa W-7 và I-5 đã đóng ở đợt 2.

P.2.5 vi sinh chuyển sang nhóm thiếu dữ liệu: cần bằng chứng tính ức chế phát triển (ví dụ hoạt
độ nước), kết quả kiểm vi sinh nguyên liệu, và thẩm định quy trình — hoặc chấp nhận lối thử từng
lô theo cây #8.

**Lệch chuẩn phòng** (Q8(R2) không đòi, file mẫu có): W-3 nhóm risk assessment và QTPP/CQA theo
định dạng Annex.
