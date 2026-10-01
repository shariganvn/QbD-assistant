# Step 11 — A second source, and a heading tree that can hold two trials

Status: pass · Gates: G-20, G-21

## The field that could not count

`meta.sourceFile` was one string, and the cover page printed it as "Cơ sở dữ liệu: <that string>". With a
second trial file the options were to write `"Thử nghiệm 1.docx; Thử nghiệm 2.docx"` into it, or to make
it a list.

The string wins nothing and loses the count. Nothing can check how many experimental sources a document
draws on if the answer is buried in punctuation, and a third trial would append another semicolon. So
`meta.sourceFiles` is an array — required, non-empty, no duplicate filenames — for the same reason
`strengths` is an array: the number is data.

The old field was removed rather than kept working alongside the new one. One field with two spellings is
one field that will disagree with itself, and this repo has spent three rounds deleting exactly that kind
of second source of truth.

## The heading tree that could not tell two trials apart

All seven headings in the formulation-development section were `heading2`, so "Bảng thành phần công thức"
sat level with "Thử nghiệm 1: Khảo sát tỷ lệ tá dược rã" — the heading that named the trial it belonged
to. With one trial nobody noticed. With two, a results table level with a trial heading belongs to no
trial a reader can identify, and Word's navigation pane would show ten siblings with no structure.

Each trial is now a branch: the heading naming it stays at `heading2`, its parts drop to `heading3`. The
section is at depth H5, so its parts render at H6 — inside Word's limit, which `headingLevelFor` already
clamps to.

Two groups are not part of any trial and keep the outer level: the tablet's design features, and the four
requirements of the formulation-development clause that have no content yet.

## A misfiling this fixes

Those four requirements — clinical and bioequivalence formulations, changes against the pivotal and
stability batches, comparative studies with study numbers, justification of excipient ranges — were added
last round directly beneath the heading about the tablet's engraving. They speak about the whole section,
not about a mark stamped on a tablet face. They have their own heading now.

Worth recording rather than fixing quietly: the mistake was invisible while the whole section was flat,
because under a flat tree everything looks equally misfiled. Giving the section real structure is what
surfaced it.
