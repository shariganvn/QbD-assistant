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
| 2.2.1 Formulation development (tr. 7–8) — evolution từ concept tới final design; identification of critical attributes; tóm tắt công thức lâm sàng/BE; IVIVC; biện luận special design features | P.2.2.1.1/.2/.3 | 1 vòng thử nghiệm, 1 biến (croscarmellose 1/3/5%), 3 bảng kết quả đầy đủ, chọn CT03. RMP: đợt 8 đã dựng khung hai bảng theo biểu mẫu, chưa có số liệu. Không có IVIVC, không có công thức lâm sàng, không có evolution | Chưa đạt — **thiếu dữ liệu**. Phần thực nghiệm đã có thì chắc và truy vết được. Đợt 2 đã bổ sung biện luận criticality cho yếu tố duy nhất được khảo sát biến thiên, và biện luận special design feature |
| 2.2.2 Overages (tr. 8) — overage bị *"discouraged"*, nếu có phải biện luận | P.2.2.2 | Ghi nhận không thấy overage, nêu rõ đây là quan sát chưa phải xác nhận chính thức | **Đạt điều kiện.** Không có overage thì nghĩa vụ biện luận không phát sinh |
| 2.2.3 Physicochemical and biological properties (tr. 8) | P.2.2.3 | Đợt 2 đã bổ sung biện luận discriminatory power từ dữ liệu ba công thức; điều kiện phương pháp hòa tan vẫn là marker trống | Chưa đạt một phần. Lưu ý sắc thái: phần method development dùng **"could be provided"**, không phải "should" — kỳ vọng mềm theo Q8(R2), nhưng file mẫu phòng lại đòi kỹ |
| 2.3 Manufacturing process development (tr. 8–9) | P.2.3 | Đợt 9 đã dựng khung: ma trận rủi ro CQA × công đoạn và bảng biện luận theo công đoạn, quy trình trộn dập thẳng do FD chốt | Chưa đạt — **thiếu dữ liệu**. Cần hồ sơ quy trình/hồ sơ lô, không đóng được bằng viết lại |
| 2.4 Container closure system (tr. 9–10) | P.2.4 | Đợt 9 đã dựng khung hai bảng bao bì sơ cấp/thứ cấp | Chưa đạt — **thiếu dữ liệu** |
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

*Trạng thái sau đợt 5:* **đóng một phần.** CoA lô 488 cấp nguồn cho cảm quan, độ tan (nước,
methanol), phân bố cỡ hạt, hàm lượng acid fumaric, dung môi tồn dư và giới hạn vi sinh. Vẫn mở:
pKa, LogP, BCS thực nghiệm, đa hình tinh thể, tính chất chảy, độ tan theo pH, dữ liệu ổn định/phân
hủy — CoA không chứa các mục này.

*Sau đợt 6:* phần còn thiếu nay hiển thị thành các dòng trống cụ thể trong biểu mẫu thay vì một câu
marker gộp — riêng độ ổn định hóa học tách thành 5 dòng phân hủy cưỡng bức, nên đọc bảng là biết
chính xác phải đi lấy thí nghiệm nào.

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
C0223252, và CoA nguyên liệu khai theo chuyên luận **Ph.Eur. 12** với giới hạn **0,1% cho từng
tạp**. Hai điểm để đối chiếu độ rộng của ngưỡng: kết quả thực đo trên viên ở cả ba công thức là
0,1839 – 0,1918% tổng tạp, tức cách ngưỡng 3,0% hơn một bậc; và bản thân chất chuẩn đo được tổng
tạp 0,07%. Ngưỡng 3,0% cho một viên nén phóng thích ngay của hoạt chất ổn định là bất thường và
gần như chắc chắn bị hỏi khi thẩm định. Cần FD xác nhận chuyên luận áp dụng (USP/BP/Ph.Eur.) và
khai lại tiêu chuẩn theo đúng danh mục tạp của chuyên luận đó. Loại: lệch chuẩn + thiếu cấu trúc;
sửa được bằng viết lại, không cần thực nghiệm mới.

**W-9 — Bản thảo đã ghi sai dung môi suốt bốn đợt.** Bảng thuộc tính tham khảo ghi "dễ tan trong
nước và **ethanol**"; CoA ghi **methanol** (*freely soluble*), còn nước là *very soluble* chứ không
phải "dễ tan". Sai cả dung môi lẫn mức độ tan. Đây chính là rủi ro mà câu caveat ngay đầu mục đó
cảnh báo — dùng kiến thức tham khảo thay cho nguồn. Đã sửa ở đợt 5. Đáng ghi lại như bằng chứng cho
nguyên tắc: một giá trị "ai cũng biết" vẫn phải chờ nguồn, và caveat không làm cho giá trị sai trở
nên vô hại.

**W-10 — Hai chỗ trên CoA cần nhà cung cấp xác nhận.** (a) Cỡ hạt ghi "less than 200 **pm**"; 200
picomet nhỏ hơn kích thước một nguyên tử, gần như chắc chắn là lỗi đánh máy của µm. Bản thảo giữ
nguyên văn và đánh dấu thay vì tự sửa — không sửa số của nhà cung cấp trong tài liệu đăng ký.
(b) Ô định tính ghi "Conforms to **5th**" trong khi sản phẩm khai theo Ph.Eur. 12; chưa rõ "5th"
chỉ đến tài liệu nào. Cả hai nên đưa vào văn bản hỏi nhà cung cấp cùng một lượt.

**W-11 — Biểu mẫu "General properties" của phòng không có dòng độ tan và không có dòng phân bố cỡ
hạt.** Q8(R2) mục 2.1.1 (tr. 6) yêu cầu nêu các thuộc tính *"that can influence the performance of
the drug product"*. Với viên nén phóng thích ngay của một hoạt chất dễ tan, độ tan và phân bố cỡ
hạt là hai thuộc tính nặng ký nhất — độ tan là nền của mọi lập luận BCS, cỡ hạt là biến số then
chốt của đồng đều hàm lượng và tốc độ hòa tan. Cả hai đều đã có nguồn từ CoA lô 488, nhưng vì biểu
mẫu không có dòng nên chỉ nằm ở khối trích dẫn, tức đọc lướt bảng sẽ không thấy. Đây là nhận xét
về **biểu mẫu của phòng**, không phải về Q8(R2).

*Đã xử lý ở đợt 7:* phòng quyết định nới biểu mẫu. Hai dòng "Độ tan" và "Phân bố cỡ hạt" đã được
thêm ngay sau "Cảm quan"; biểu mẫu đi từ 16 lên 18 dòng. Giá trị lấy từ CoA lô 488, gỡ khỏi khối
trích dẫn để không trùng hai chỗ.

**W-12 — Mốc khuyến cáo croscarmellose đang đối chiếu nhầm phương pháp.** `P.2.2.1.3` viết CT02
(3%) "trùng mức khuyến cáo cho xát hạt ướt". Nhưng bảng tá dược ở `P.2.1.2` đã trích sẵn chuyên
luận: *"Thông thường 2% cho dập thẳng và 3% cho xát hạt ướt"*. Quy trình của sản phẩm là **trộn dập
thẳng**, nên mốc đối chiếu đúng là **2%**, không phải 3%. Hệ quả: cả ba công thức đều nằm xa mốc
đó, và CT03 ở 5% — công thức được chọn mang sang Thử nghiệm 2 — gấp **2,5 lần** mức thông thường
của dập thẳng. Đây là câu hỏi thẩm định gần như chắc chắn, và nó cộng dồn với W-4 (5% đã chạm trần
khoảng 0,5 – 5,0%). Đã thêm câu nêu rõ vào `P.2.2.1.3`; không sửa số liệu thực nghiệm. Nguồn nằm
ngay trong tài liệu nên không cần tra lại HPE.

**W-13 — Lệch phiên bản dược điển giữa hai mục.** Biểu mẫu của phòng dẫn EP 11.0 phụ lục 5.1.4 cho
giới hạn vi sinh, trong khi CoA nguyên liệu khai theo **Ph.Eur. 12** và `P.2.2.3` đã ghi chuyên
luận tạp chất theo Ph.Eur. 12. Hồ sơ đang viện dẫn hai phiên bản dược điển khác nhau. Cần FD thống
nhất một phiên bản áp dụng cho toàn hồ sơ. Đã ghi vào `P.2.5`.

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

## Đợt 5 — CoA lô nguyên liệu API

**Nguồn.** Certificate of Analysis của nhà sản xuất Johnson Canady cho Bisoprolol fumarate
**Ph.Eur. 12**, mã sản phẩm 71460, **lô 488**, sản xuất 23/04/2026, re-test 23/04/2031, 400,00 kg
trong 16 kiện, ký bởi QC Manager. Tên cá nhân người ký không đưa vào hồ sơ hay repo — mã sản phẩm
cộng số lô cộng ngày đã đủ định danh tài liệu.

**Cách đọc bảng, cần lưu ý cho các đợt sau.** Trên CoA, cột nhãn "Specification" chứa **tên phép
thử** (TAMC, TYMC, E. coli, Impurity A…) còn cột "Result" chứa **giới hạn chấp nhận** (Maximum 1000
CFU/g, Absence/g, Maximum 0,1%). Bốn dòng đầu mang "Conforms" — đó mới là kết quả thử của lô. Đọc
theo nhãn cột sẽ hiểu ngược.

**Ràng buộc chưa gỡ được: chưa xác nhận đúng lô.** Hồ sơ Thử nghiệm 1 không ghi số lô dược chất đã
dùng, nên không có cơ sở khẳng định lô 488 là lô bào chế CT01 – CT03. Ngày sản xuất lô sớm hơn ngày
lập bản thảo nên về thời gian là khả dĩ — nhưng khả dĩ không phải xác nhận. Bản thảo ghi rõ điều
này và yêu cầu đối chiếu hồ sơ lô. Đây là rào cản truy nguyên duy nhất còn lại của nguồn này.

**Đã đóng:**

- `P.2.1.1` — thêm mục "Thuộc tính theo CoA lô nguyên liệu" với bảng 14 phép thử, ghi rõ ô nào là
  kết quả và ô nào là giới hạn, kèm định danh tài liệu và bốn ghi chú kỹ thuật.
- `P.2.5` — 1/3 điều kiện Q6A nay có nguồn (xem dưới).
- `P.2.2.3` — danh mục tạp nay có chuyên luận và giới hạn cụ thể.
- `meta.referenceSources` — thêm CoA.

**C-1, phân biệt cần giữ cho rõ.** Cỡ hạt API nay có **giới hạn tiêu chuẩn** (tối thiểu 75% dưới
200 µm). Điều đó **không** đồng nghĩa đã đánh giá tính trọng yếu của cỡ hạt. Q8(R2) tr. 6 đòi xác
định criticality qua *"an assessment of the extent to which their variation can have impact on the
quality"* — tức phải có thực nghiệm thay đổi cỡ hạt và đo tác động. Thử nghiệm 1 giữ cố định nguồn
API nên không có dữ liệu đó. Có giới hạn là có kiểm soát; chưa có biện luận vì sao mức kiểm soát đó
là đủ.

**P.2.5 — 1/3 điều kiện Q6A.** CoA cho thấy nguyên liệu **được kiểm vi sinh trước khi sản xuất**
(TAMC ≤ 1.000 CFU/g, TYMC ≤ 100 CFU/g, không có E. coli và Salmonella), đúng vế đầu của điều kiện
Q6A tr. 12. Hai vế còn thiếu: thẩm định quy trình chứng minh không mang rủi ro nhiễm/tăng sinh đáng
kể, và bằng chứng tính ức chế phát triển của viên. Mục vẫn giữ `gap`. Lưu ý vị trí CTD: số liệu vi
sinh **nguyên liệu** đặt ở `P.2.1.1`, `P.2.5` chỉ dẫn chiếu sang — `P.2.5` nói về thành phẩm.

## Đợt 6 — P.2.1.1 gom về đúng một biểu mẫu

**Ràng buộc hình thức mới, áp dụng lâu dài.** Qua năm đợt, `P.2.1.1` phình thành 9 block: 2 bảng,
1 heading và 5 đoạn — mỗi nguồn mới lại đẻ thêm một cụm. Phòng chốt: dù đưa bao nhiêu tài liệu về
API, mục này chỉ được **một bảng "General properties" 16 dòng** theo biểu mẫu của phòng, phía dưới
là khối trích dẫn đánh số. Chỉ tiêu nào biểu mẫu không có dòng thì ghi vào khối trích dẫn, không
thêm bảng hay heading.

Ràng buộc này đã ghi vào `description` của `P.2.1.1` trong `schemas/p2-outline.json` và khóa bằng
test, để các đợt sau không phải hỏi lại và không tái diễn việc phình mục.

**Kết quả đối chiếu biểu mẫu: 6/16 dòng có giá trị, 10/16 trống.** (Sau đợt 7 biểu mẫu thành 18
dòng, tỉ lệ là 8/18 có giá trị.)

| Có nguồn | Trống |
|---|---|
| INN, CAS, khối lượng phân tử, pKa — nhưng chỉ ở mức tham khảo `[1]`, chưa đối chiếu chuyên luận | IUPAC, điểm chảy, Log P |
| Công thức phân tử — đối chiếu chứng chỉ chuẩn `[2]` | Công thức cấu tạo (cần hình) |
| Cảm quan — kết quả lô 488 `[3]` | Độ ổn định hóa học + 5 dòng phân hủy cưỡng bức |

Bảng trống 10/18 là kết quả trung thực và dùng được: nó thành danh mục việc cần lấy cho FD, thay vì
trông như đã đủ. Đáng chú ý nhất là **toàn bộ khối phân hủy cưỡng bức trống** — chưa có nghiên cứu
nhiệt, ẩm, peroxid, acid/base, ánh sáng nào cho dược chất.

**Cơ chế truy nguyên.** Mỗi giá trị mang một nhãn `[1]` `[2]` `[3]` trỏ tới đúng một nguồn ở khối
dưới bảng; `[1]` mang cảnh báo chưa đối chiếu chuyên luận, `[2]` nói rõ chứng chỉ đặc trưng cho
chất chuẩn chứ không phải lô sản xuất, `[3]` nói rõ chưa đối chiếu số lô với hồ sơ Thử nghiệm 1.
Không giá trị nào của CoA bị mất khi gom bảng: các chỉ tiêu không có dòng trong biểu mẫu nằm đủ ở
ghi chú cuối `[3]`, kèm ghi rõ chúng thuộc phạm vi `3.2.S.4` chứ không phải `3.2.P.2.1.1`.

**Thay đổi công cụ đi kèm.** Biểu mẫu là bảng nhãn–giá trị nên không có hàng tiêu đề, trong khi
renderer luôn phát một hàng tiêu đề in đậm nền xám. Đã thêm cờ tuỳ chọn `headerless` cho block
table: `headers` vẫn bắt buộc vì chúng định nghĩa số cột và là mốc kiểm số ô mỗi hàng, cờ chỉ quyết
định có in hàng đó ra hay không. Mọi bảng khác giữ nguyên tiêu đề — đã xác minh trên bản render.

**Hạn chế công cụ cần xử lý thủ công:** ô "Công thức cấu tạo" cần hình, renderer chưa chèn được
hình. Phải bổ sung thủ công vào bản Word cuối; bản thảo đánh dấu rõ ở ô đó.

## Đợt 7 — Nới biểu mẫu theo quyết định của phòng

Phòng chốt xử lý W-11: thêm **hai dòng** vào biểu mẫu General properties, đặt ngay sau "Cảm quan"
để nhóm ba thuộc tính vật lý cạnh nhau và để hai thuộc tính quan trọng nhất nằm ở phần đầu bảng —
đúng lý do W-11 nêu ra. Biểu mẫu 16 → **18 dòng**, số dòng có giá trị 6 → **8**.

| Dòng mới | Giá trị, nguồn [3] |
|---|---|
| Độ tan | Trong nước rất dễ tan (*very soluble*) — Đạt; trong methanol dễ tan (*freely soluble*) — Đạt |
| Phân bố cỡ hạt | Tối thiểu 75% nhỏ hơn "200 pm" (nguyên văn CoA) |

**Ô cỡ hạt giữ nguyên văn "200 pm"** và trỏ sang ghi chú [3] cho cảnh báo đơn vị, giữ đúng nguyên
tắc của đợt 5: không sửa số của nhà cung cấp trong tài liệu đăng ký. Cảnh báo này vẫn nằm ở [3] nên
ô bảng có chỗ để dẫn tới; W-10 chưa đóng cho tới khi nhà cung cấp xác nhận.

**Chống trùng lặp.** Hai chỉ tiêu này trước đó nằm trong danh sách "các chỉ tiêu không có dòng
tương ứng trong biểu mẫu" ở ghi chú [3]. Nay chúng có dòng nên đã được gỡ khỏi danh sách đó — nếu
để lại thì câu dẫn của ghi chú thành sai và nội dung hiện hai chỗ. Đã xác minh trên bản render:
`very soluble` và `freely soluble` mỗi chuỗi xuất hiện đúng một lần.

Bốn chỗ ràng buộc lẫn nhau đều đã đồng bộ: bảng, ghi chú [3], test khóa nhãn dòng, và `description`
của `P.2.1.1` trong `schemas/p2-outline.json`.

## Đợt 8 — Dựng khung P.2.2.1.1 và cho bảng tổng hợp một trạng thái thứ ba

**Cấu trúc lấy từ biểu mẫu của phòng, không tự nghĩ.** Hai file trong `docs/raw/` thống nhất về mục
này, tên trong biểu mẫu là "Đặc tính thuốc biệt dược gốc": `P 2_form_Edit 29-09-2025-example.docx`
dòng 164–222 và `135-00-Pharmaceutical Development-example.docx` dòng 303–319. Cấu trúc gồm đoạn mở
đầu (ba hướng khảo sát: thu thập dữ liệu, thực nghiệm, kỹ thuật đảo ngược), bảng thành phần tá dược
thuốc đối chiếu, và bảng đặc tính lý hóa 14 chỉ tiêu cộng khối hòa tan.

**RMP: Concor® 10 mg**, FD xác nhận. Khớp với file mẫu 135-00 vốn nêu thẳng `Concor® 5 mg` và
`Concor® 10 mg` cho bisoprolol. Lưu ý cả hai file đều là template còn chỗ giữ chỗ `<<API name>>` và
một câu lẫn galantamine với Concor, nên tên thuốc đối chiếu đến từ xác nhận của FD chứ không phải
từ suy diễn trên file mẫu.

**Khung đã dựng, 19 ô chờ số liệu.** Bảng 1 ba dòng, bảng 2 mười sáu dòng. Mỗi ô không chỉ mang
marker mà còn ghi **lấy dữ liệu ở đâu** — nhãn/SmPC, thực nghiệm trên mẫu mua về, hay kỹ thuật đảo
ngược — nên khung rỗng dùng được như danh mục việc, giống cách 10 dòng trống của `P.2.1.1` đang
dùng. Hai dòng hòa tan tách riêng điều kiện thử và hồ sơ theo thời gian, kèm ghi chú nêu lý do:
mục đích cuối là so với CT03 (98,64% tại 30 phút, mục `P.2.2.1.3`), muốn tính f2 thì phải có nhiều
thời điểm và cùng điều kiện thử.

**Bảng tổng hợp khoảng trống nay có ba trạng thái.** Đây là thay đổi chống khai sai, không phải mỹ
thuật. Validator cấm section `gap` mang block, nên dựng khung buộc phải lật `covered`; mà bảng tổng
hợp trước đây chỉ đọc `status` nên sẽ khai mục toàn marker là "Có dữ liệu" — sai trong một tài liệu
định dạng hồ sơ đăng ký.

| Trạng thái | Điều kiện |
|---|---|
| Không có dữ liệu | `status: gap` |
| Đã dựng khung, chưa có dữ liệu | `covered`, mọi ô giá trị của mọi bảng đều mang marker |
| Có dữ liệu (một phần hoặc đầy đủ) | `covered`, có ít nhất một ô giá trị thật |

Trạng thái được **suy từ nội dung**, không khai thêm trường. Một trường khai tay sẽ thành nguồn sự
thật thứ hai và chắc chắn lệch khi có người điền số rồi quên đổi trạng thái; suy từ ô thì điền một
giá trị thật là bảng tự đổi. Đã có test khóa đúng hành vi đó.

Kiểm không hồi quy trên bản render: `P.2.2.1.1` hiện "Đã dựng khung"; `P.2.3`, `P.2.4`, `P.2.5` vẫn
"Không có dữ liệu"; bảy mục còn lại vẫn "Có dữ liệu".

**Hạn chế công cụ:** biểu đồ hòa tan của biểu mẫu phải vẽ thủ công — cùng loại với công thức cấu tạo
ở `P.2.1.1`. Renderer không hỗ trợ hình.

## Đợt 9 — Dựng khung ba mục cuối, và giữ hệ thống trung lập với phương pháp pha chế

Sau đợt này **không còn mục nào ở trạng thái "Không có dữ liệu"**: mọi mục CTD trong tài liệu đều
ít nhất đã có khung theo biểu mẫu của phòng.

**Nguyên tắc chi phối: tên công đoạn là dữ liệu, không phải hình dạng hệ thống.** Phòng nêu rõ
bisoprolol trộn dập thẳng chỉ là ví dụ để dựng hệ thống; thực tế còn xát hạt ướt, phun sấy tầng sôi
tạo hạt, cán ép, đóng tán, ép đùn nóng chảy, và mỗi phương pháp có bộ công đoạn cùng bộ CQA/CPP
riêng. Vì vậy:

- `schemas/p2-outline.json` mô tả **hình dạng** của `P.2.3` (một ma trận rủi ro có cột đầu là CQA và
  các cột sau là công đoạn, cộng một bảng biện luận) và nói rõ bộ công đoạn phụ thuộc phương pháp;
  contract **không chứa tên công đoạn nào** — đã kiểm bằng assert khi ghi file.
- Bản thảo có một đoạn riêng nêu: đổi phương pháp thì **dựng lại cả hai bảng**, không sửa từng ô.
- Test **không pin tên công đoạn**. Thay vào đó kiểm tính nhất quán: các dòng CQA của ma trận
  `P.2.3` phải trùng đúng danh mục chỉ tiêu đang khai ở `P.2.2.1.2`, và số dòng bảng biện luận phải
  bằng số cột công đoạn. Đúng với mọi sản phẩm và mọi phương pháp, đồng thời bắt được lỗi thật —
  ma trận bỏ sót một CQA của chính sản phẩm.

**`P.2.3`** — ma trận 7 CQA × 5 công đoạn (mọi ô mức rủi ro là marker) và bảng biện luận 5 dòng nêu
thông số trọng yếu dự kiến của từng công đoạn. Kèm ghi chú nâng cỡ lô: Thử nghiệm 1 ở 1.000 viên,
cần lên pilot rồi thương mại trước khi lập được bảng rủi ro cập nhật. Sơ đồ quy trình phải vẽ thủ
công.

**`P.2.4`** — hai bảng theo `135-00` dòng 1931–1948. Kèm lưu ý trình tự: tính tương hợp chỉ chứng
minh được bằng dữ liệu độ ổn định trong chính bao bì đó, nên mục không đóng được trước `3.2.P.8`
ngay cả khi đã chọn xong vật liệu.

**`P.2.5`** — dựng theo nhánh **thử định kỳ** mà biểu mẫu của phòng đã chọn, tức nhánh thứ hai của
Q6A Decision Tree #8 (tr. 31). Giới hạn (TAMC ≤ 10³ CFU/g, TYMC ≤ 10² CFU/g, E. coli không được
có/g) và tần suất là **nội dung thật lấy từ biểu mẫu**; chỉ cột kết quả là marker. Do đó mục này
hiện "Có dữ liệu (một phần)" chứ không phải "Đã dựng khung" — đúng, và test khóa đúng sự phân biệt
đó: cột giới hạn không được mang marker, cột kết quả bắt buộc phải mang.

**Hai sửa ở mục đã có, do phương pháp pha chế làm lộ ra:**

- `P.2.1.2` — "dung môi tá hạt" là lỗi đánh máy của "dung môi **xát** hạt"; đã sửa chính tả, giữ
  nguyên nội dung vì đây là ví dụ về loại chất chỉ dùng khi sản xuất.
- `P.2.2.1.2` — marker criticality liệt kê "điều kiện xát hạt" trong các thông số chưa đánh giá;
  quy trình là dập thẳng nên không có công đoạn xát hạt. Đã bỏ vế đó, giữ thời gian trộn, lực dập,
  điều kiện bao phim.

## Đợt 10 — Rà soát logic build: format P.2 nay được cưỡng chế cho mọi sản phẩm

**Yêu cầu.** Mỗi sản phẩm viên nén bao phim có hoạt chất khác, tá dược khác, kéo theo mọi yếu tố
khác đều đổi; không được hard-code những thay đổi đó, nhưng phải giữ đúng format tài liệu P.2.

**Kết quả rà soát: logic build đang sai, nhưng sai ngược chiều với dự đoán ban đầu.** Extractor
(`extract/*.mjs`) và renderer (`render/builder.mjs`) **sạch** — grep toàn bộ code và schema cho
bisoprolol, croscarmellose, Cellactose, Primellose, povidone, Concor, CT01… chỉ trả ba chỗ vô hại:
một ví dụ minh hoạ trong `p2-draft-contract.md`, một liệt kê **phương pháp pha chế** trong outline,
và một câu mô tả worked example trong `README.md`.

Vấn đề nằm ở chiều ngược lại: **format P.2 không được mã hoá ở đâu cưỡng chế được.**

| Nơi | Chứa gì | Cưỡng chế? |
|---|---|---|
| `draft/example-draft.json` | Dữ liệu một sản phẩm | — |
| `schemas/p2-outline.json` → `description` | Mô tả form bằng văn xuôi, 547–738 ký tự mỗi mục | Không — máy không đọc được |
| `draft/tests/table-layout.test.mjs` | 7 mảng nhãn dòng hard-code | Không — chỉ kiểm đúng file ví dụ |
| `draft/validate-draft.mjs` | Đọc outline **chỉ để lấy danh sách id mục** | Không kiểm hình dạng form |

Hệ quả cụ thể: một draft cho sản phẩm khác **vẫn validate PASS** kể cả khi dựng `P.2.1.1` thành ba
bảng, bỏ hết dòng của biểu mẫu, hay thêm heading tuỳ ý. Format tồn tại ở **ba bản sao** và không bản
nào ràng buộc được sản phẩm mới — đúng nghĩa hard-code sai chỗ: format thì lỏng, còn thứ bị ghim
cứng lại là dữ liệu của một sản phẩm.

**Khắc phục: khoá `form` máy đọc được trong `schemas/p2-outline.json`, cưỡng chế bởi validator.**
Ký hiệu đầy đủ ghi ở `_formSpec` của outline và ở `p2-draft-contract.md`. Cốt lõi:

- `headings` — danh sách heading3 bắt buộc theo thứ tự; `[]` = không được có heading.
- `tables` — đúng số bảng, đúng thứ tự. Mỗi bảng khai `columns` (nhãn chính xác; `"*"` = bất kỳ,
  dùng cho nhãn mang **tên sản phẩm**; `"..."` cuối = các cột còn lại tự do về số lượng và tên),
  cộng một trong `rows` (nhãn chính xác) / `rows: "variable"` (sản phẩm quyết định) /
  `rowsFrom: "<id mục>"` (phải trùng nhãn dòng bảng đầu của mục đó).

Tám mục được ràng buộc. Ba chỗ **cố tình để mở** vì chúng đổi theo sản phẩm: nhãn cột mang tên thuốc
đối chiếu ở `P.2.2.1.1`, nhãn cột mang tên thử nghiệm ở `P.2.2.1.2`, và toàn bộ cột công đoạn của ma
trận rủi ro `P.2.3` — đổi theo phương pháp pha chế.

`rowsFrom` là cách diễn đạt máy-kiểm-được cho quy tắc quan trọng nhất: **ma trận rủi ro phải chấm
đúng bộ CQA mà sản phẩm tự khai**. Đổi một CQA ở `P.2.2.1.2` mà quên rescore `P.2.3` sẽ bị chặn.

**Bằng chứng spec hoạt động.** Sáu kiểu phá format bị chặn đúng mã lỗi: bỏ một dòng biểu mẫu
(`E_FORM_ROWS`), thêm bảng (`E_FORM_TABLE_COUNT`), bỏ `headerless` (`E_FORM_HEADERLESS`), thêm
heading (`E_FORM_HEADINGS`), đổi nhãn cột cố định (`E_FORM_COLUMNS`), lệch CQA giữa `P.2.2.1.2` và
`P.2.3` (`E_FORM_ROWS`). Hai biến thiên hợp lệ được cho qua: đổi tên thuốc đối chiếu ở nhãn cột, và
đổi ma trận từ năm công đoạn dập thẳng sang ba công đoạn xát hạt ướt.

**Phép thử quyết định: `example-draft.json` không bị sửa một ký tự nào** và vẫn validate PASS. Nếu
phải sửa dữ liệu cho khớp spec thì spec đã viết sai. `git diff` trên file đó trống, và `document.xml`
của bản render có SHA-256 **không đổi** so với đợt 9 — spec chỉ kiểm, không sinh.

Bảy mảng nhãn hard-code trong test đã được gỡ; thay bằng các test âm chứng minh spec chặn thật, hai
test chứng minh spec không dính vào sản phẩm/phương pháp, và **một test dựng draft cho sản phẩm
khác hẳn** (metformin, tá dược khác, CQA khác, thuốc đối chiếu khác) — phải validate PASS trên đúng
form đó. 25/25 test xanh.

**Dọn branch remote.** `claude/codebase-architecture-summary-po0utr` đã bị xoá sẵn trên remote
(`git fetch --prune` xác nhận).

`master` không xoá được bằng `git push origin --delete master` (HTTP 403 trong khi push commit
thường vẫn hoạt động, proxy không ghi nhận lỗi relay nào) — dấu hiệu nó đang là default branch,
thứ GitHub không cho xoá. Push trực tiếp vào `master` cũng bị chặn vì branch này không nằm trong
danh sách session được phép push.

Thay vào đó, hai branch đã được đồng bộ theo hai bước. Một: merge `master` vào
`tienpharmacist` (commit `93f37d4`), khiến `master` thành tổ tiên thuần tuý — 0 commit riêng. Hai:
merge PR #4 trên GitHub (commit `f280563`), đưa đủ 24 commit vào default branch.

Kết quả: `git diff origin/master origin/tienpharmacist` **trống**, hai branch cùng nội dung cây file.
Xoá `master` từ đây không mất gì, nhưng vẫn cần đổi default sang `tienpharmacist` ở Settings →
Branches trước. SHA của `master` trước khi đồng bộ: `f2bc632ca88a31bf32c5f4556bcc4aad0e674149`.

## Còn lại, phân theo loại

**Thiếu dữ liệu** (cần nguồn, không sửa được bằng viết lại): C-3 tương hợp, C-4 quy trình sản
xuất (khung đã dựng, chờ mức rủi ro và thông số quy trình), C-5 bao bì (khung đã dựng, chờ 3.2.P.8), P.2.2.1.1 RMP (19 ô chờ số liệu, khung đã dựng), kết quả thử vi sinh ở P.2.5, phần còn lại của thuộc tính API ở W-5 (pKa, BCS, đa hình, tính
chảy, ổn định), thành phần màng bao thật ở C-2, điều kiện phương pháp hòa tan ở W-7, và phần
criticality của mọi yếu tố ngoài tá dược rã ở C-1.

**Thiếu cấu trúc** (sửa được ngay, không cần dữ liệu mới): W-1 ba heading cha, W-2 phân cấp
heading. C-1, nửa W-7 và I-5 đã đóng ở đợt 2.

P.2.5 vi sinh, sau đợt 5 còn thiếu 2/3 điều kiện Q6A: bằng chứng tính ức chế phát triển (ví dụ
hoạt độ nước) và thẩm định quy trình — hoặc chấp nhận lối thử từng lô theo cây #8. Kết quả kiểm vi
sinh nguyên liệu đã có trên CoA lô 488.

**Lệch chuẩn phòng** (Q8(R2) không đòi, file mẫu có): W-3 nhóm risk assessment và QTPP/CQA theo
định dạng Annex.
