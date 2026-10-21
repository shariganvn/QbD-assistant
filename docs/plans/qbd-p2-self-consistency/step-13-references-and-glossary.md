# Step 13 — References that land somewhere, and a glossary that matches the text

Status: pass · Gates: G-23, G-24, G-25

## The references

Six distinct references, eleven occurrences, every one aimed at a container. Each was redirected to the
leaf that actually holds what the sentence points at — verified one at a time against the draft, not
guessed from the number.

The rewrite was checked the way it had to be: every changed text compared before and after with all
references replaced by a placeholder, and the remainder required to be byte-identical. Eleven texts
changed, nothing outside a reference moved.

## The trap, twice

This is the part worth keeping.

A reference can end a sentence: `…được trình bày tại mục 3.2.P.2.2.1.3.` The detection pattern must not
take that final period as part of the number. Writing each segment as "dot followed by a digit" does it
by construction — the period has no digit after it, so the match stops.

The first scan did not do that. It used a lookahead rejecting any following period or digit, which
silently dropped the two references that close a sentence: the scan reported six where there were
eight, and I reported the smaller number.

Then the rewrite pass made the same mistake from the other side. The same lookahead refused to *match*
a reference followed by a period, so the one that ends a sentence survived the fix — seven redirects
where eleven were needed. The validator caught it immediately, which is the point of having built the
validator first.

The correct rule is narrower than either attempt: reject only a **deeper** number. A bare period is
punctuation, and a section number is never followed by one.

Both directions have their own test, because one trap that lands twice will land a third time.

## What is deliberately not a reference

`P.2` on its own is the department's form, as in "hai bảng lấy từ biểu mẫu P.2 của phòng". It stays out
because the pattern requires at least one numeric segment — not because a phrase was added to an
ignore list. A list of exceptions is a list that grows.

The department's worked example numbers two different subsections `3.2.P.2.2.3.1.2` and puts a third at
`3.2.P.2.2.3.1.1.3`, one level deeper than the group containing it. The dossier quotes the second of
those to say so, which is a number that exists in no outline. It is declared in
`meta.quotedNumbering` — in the draft, because it is a fact about this document's sources, not a rule.
And declaring one of our own sections there is refused: that would pre-build a hiding place for a real
broken link.

## The glossary

It was an array in the renderer, and five of its ten entries named terms the text no longer used — left
from when the draft still wrote "RMP" rather than "thuốc đối chiếu". It is now `meta.abbreviations`, the
renderer reads and sorts it, and the array is gone.

The rule runs one way: every declared term must appear in the text. That catches all five dead entries
and it keeps the judgement in the added list honest — all 23 additions were checked against the text
before being written, and any that were not used would fail validation.

The reverse direction was considered and rejected. A mechanical "every capitalised token must be
glossed" flags `BASE`, `QUY`, `SUNG`, `NGU` — Vietnamese words in capitals and fragments of URLs. This
repo has already built three checks whose mechanism did not match the invariant they were meant to
enforce; a fourth that cries wolf would teach people to ignore the ones that do not.

## A test that failed for the right reason

Adding the rule broke "a draft for an entirely different product validates on the same form": the
fixture swaps product name, active substance, strengths, excipients, quality attributes and both
process tables, but kept the glossary, which then described content it had removed.

The fixture was one line short, not the rule one line too strict. A glossary belongs to the content
being replaced. Fixing it there rather than relaxing the rule is what demonstrates the rule sits on the
right side of the line between form and content.
