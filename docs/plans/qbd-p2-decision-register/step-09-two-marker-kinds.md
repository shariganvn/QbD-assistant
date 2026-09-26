# Step 09 — Two kinds of unfinished

Status: pass · Gates: G-13, G-14, G-15, G-16, G-17

## What was wrong

The document had one way to say a spot was unfinished, and it meant "nobody has measured this". The
annex at the back was built from those markers, so it listed 143 things to go and measure.

But the draft was also carrying, in prose, a different kind of unfinished — a finished-product impurity
limit naming no impurity while the substance certificate names three; EP 11.0 cited in one section and
Ph.Eur. 12 in another; croscarmellose at the ceiling of its recommended range; a "not applicable"
inferred from the dosage form and never confirmed. None of these is a missing measurement. Each was
written down, each was true, and each appeared in no list.

So the document told a reviewer that data was the only thing standing between it and submission, while
holding the evidence that it was not.

## The distinction, and why it is worth a second label rather than a column

The two go to different people and close by different means. A data gap closes when somebody runs an
experiment. A decision closes when somebody with the authority chooses — no experiment helps, because
both numbers are already there and they disagree.

One list with a kind column would have printed a single table that two departments each read half of.
Two registers hand each reader their own list.

## What holds the line

`schemas/markers.mjs` was already the single producer of the marker; the second label went there, beside
the first, with the shared label-stripping lifted out of `render/data-request.mjs` so the two registers
read their rows the same way rather than through two copies of one regex.

Three rules, all in the Stage B validator:

- **One spot is one kind.** Both labels in one text is rejected — it would be listed twice and mean
  neither thing clearly.
- **A decision names what and who.** The owner is matched against `meta.decisionOwners`, which is data.
  Hard-coding FD and QA would have made the rule wrong for every department that names its roles
  differently, and this repo has spent three rounds removing exactly that kind of built-in assumption.
- **The strength rule stays shut.** A cell in a `measuredOnly` table belonging to a derived strength must
  still carry the *gap* marker. This was the one real risk of a second label: a cell that should say
  "no batch exists to measure this" saying instead "somebody should decide" reads as progress and is not.
  `validateMeasuredOnly` was left demanding the gap marker, and now says so explicitly when it finds the
  other one.

`meta.decisionOwners` is required exactly when a decision marker exists. A field every draft must carry
whether or not anything uses it is a field that goes stale.

## The readiness register

`dataStatusLabel` had to learn the difference too. It previously asked `isGapText`, so a section whose
only content was an open decision would have reported "Có dữ liệu" — the same false-readiness failure
this register was already fixed for twice, once for counting row labels as values and once for ignoring
paragraphs. It now asks `isMarkedText`, and the test covers all three states.

## What did not change

The data-request annex is byte-identical after the refactor — checked by serialising its rows before and
after and comparing, rather than by reading the diff and believing it.
