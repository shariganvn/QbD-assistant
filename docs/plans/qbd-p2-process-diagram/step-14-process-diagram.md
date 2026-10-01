# Step 14 — The process, as a table and as a picture

Status: pass · Gates: G-26, G-27, G-28

## Why the existing figure was not enough

The document could already draw a process: a row of boxes, one per unit operation, taken from the risk
matrix's column headings. That answers "which operations exist". It cannot answer the question a
reviewer actually brings to a direct-compression process with three blending steps — which component
enters at which blend — and that is the difference between a formulation that disintegrates and one
that does not.

## The shape

Operations run down the page. The components added at each one sit in a box to its left with an arrow
into it. The mixture carried forward is the vertical arrow, drawn heavier than the input arrows.

Sieving is not a box. FD's description has each group of components sieved **before** it is added, not
the whole blend sieved between operations, and a box in the chain would say the second thing. It lives
in the column heading and in a sentence.

## Two shape decisions, both tested

The table's columns are **required outright** — step number, components, operation — instead of derived
with `labelColumnCount`. That helper models "leading ordinals plus one label column", which is right
for a results table and wrong here: it would put the components on the label side and the operation on
the value side, and the diagram needs both. Demanding three columns also refuses a table that grew a
fourth, which a "read the last column" rule would silently draw as the operation.

A step that adds nothing writes `—`. Not a blank: a blank cell in this document means "not applicable",
which is precisely the reading the gap markers were introduced to prevent. The em dash is already the
draft's character for this, so no new convention appears. A gap marker in that column is refused, and
the refusal message says to write the em dash if the step adds nothing.

## Looking at it

The diagram was rendered on its own and opened before anything else was believed. `trial-2-process.png`
is kept beside the evidence.

The previous figures round is why. It shipped three drawing faults that every test passed: an axis
rounded up to 200 that pushed every column into the lower half, a threshold label landing on the
tallest column, and a threshold line struck through a value label. None is expressible as an assertion
anybody thinks to write in advance.

One drawing decision came out of looking: a component list splits **one per line** rather than wrapping
as prose. Five excipients wrapped across three lines is a paragraph in a box, and the reader has to
parse the separators back out of it.

## What the sequence cost, and why it was worth waiting for

The previous round refused to write the order. The source draws its process as text boxes, and the
extractor reads those in file order rather than visual order — so the operation set was certain and the
sequence was not, and the pharmaceutically obvious order is exactly the one it would have been careless
to assume. FD supplied it this round, and the decision that held the place closes.

## Trial 1

Its document describes no process. The branch gets the signs — same excipients, same batch size, the
same in-process attributes measured — stated as signs, and a decision for FD to confirm. Not a copy of
Trial 2's table, and not a second diagram: one process drawn twice is one process in two places, and
the duplicate check would report it, the same way it refused the copied results table last round.

## Against the risk matrix

The real operation set is known now, so the standing decision about the matrix names three concrete
differences instead of gesturing at a mismatch: the matrix folds both homogenising blends into one
column, it carries coating and packaging that the process does not mention, and the process sieves each
component group with no column to score it against. Which columns belong in the matrix is FD's call,
because the matrix is their risk assessment — so it stays a decision, now a specific one.

The older chain figure stays where it is. The two diagrams say different things: one is the process
that ran in the laboratory, the other is the set of operations being scored for risk. Where they differ
is the decision.

---

## Đợt sau — FD trả lời, và sơ đồ đổi nhánh (26/09/2026)

Bước trên để ngỏ một dấu quyết định: cả hai thử nghiệm có dùng chung quy trình không. FD trả lời là
**có**, và chỉ định trình bày dưới nhánh **Thử nghiệm 1**. Nên bảng các bước và sơ đồ chuyển sang
Thử nghiệm 1; Thử nghiệm 2 nay mang ghi chú trỏ sang đó. Dấu quyết định đóng.

Xuất xứ phải nói rõ ở **cả hai** nhánh, vì nó đi ngược chiều người đọc dễ đoán: bản mô tả bằng văn bản
đến từ tài liệu **Thử nghiệm 2** — tài liệu Thử nghiệm 1 không mô tả quy trình — còn việc nó áp cho cả
hai là xác nhận của FD. Một sơ đồ đứng dưới Thử nghiệm 1 mà không nói điều đó sẽ ngầm khai rằng tài
liệu Thử nghiệm 1 mô tả nó.

Ghi chú của Thử nghiệm 2 trỏ theo **tên nhánh**, không theo số mục CTD: hai thử nghiệm nằm trong cùng
một mục lá, nên một tham chiếu kiểu `3.2.P.2.2.1.3.3` không phân biệt được chúng.

### Cái bẫy `fromTable` cắn lần thứ hai, ở hai chỗ mới

Chuyển bảng quy trình lên đầu mục làm mọi chỉ số bảng phía sau dịch một bậc. Hai hình trong mục đều
trỏ sai ngay sau đó, và **không phải luật nào nhắm vào chuyện này bắt được** — mà là hai phép kiểm phụ:
sơ đồ quy trình đổ vì bảng nó trỏ tới không đúng ba cột, biểu đồ hòa tan đổ vì tên dòng nó nêu không có
trong bảng đó.

Rồi bẫy đó cắn tiếp lần thứ ba, trong chính bộ test: `figureOf(section)` lấy **hình đầu tiên** của mục —
viết khi mỗi mục chỉ có một hình. Nay mục này có hai, và hình quy trình đứng trước, nên năm test biểu đồ
đổ. Helper nay nêu rõ loại hình cần lấy.

Chỉ số bảng theo vị trí vẫn là chỗ yếu chưa vá: với loại `flow`, một hình trỏ nhầm bảng sẽ **vẽ ra bộ
công đoạn khác mà không có gì báo**, vì flow không kiểm tên dòng hay số cột. Muốn chắc thì hình phải nêu
bảng bằng một thuộc tính bền — ví dụ nhãn cột đầu — thay vì bằng vị trí. Đó là thay đổi contract, ghi
lại ở đây chứ không tự làm trong đợt này.
