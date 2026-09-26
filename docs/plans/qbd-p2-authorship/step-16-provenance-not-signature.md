# Step 16 — Provenance is not a signature

Status: pass · Gates: G-32, G-33, G-34

## The failure being removed

The sign-off table at the end of the rendered document had three rows: drafter, FD reviewer, QA/PO
approver, each with a name cell, a date cell and a signature cell. Two of them were blank. The first
one rendered as:

```
Soạn thảo (Claude (phiên làm việc 2026-08-20, tổng hợp từ Thử nghiệm 1))   —   2026-08-20
```

Three things wrong in one cell. It put a tool in the position of a drafter who has signed, in a document
whose whole purpose is to be auditable — the conformance record had logged this against itself as W-6
and left it open. The date was five weeks stale, because it was written once and nothing re-read it. And
the parentheses were doubled, because the row concatenated a label around a value that already carried
its own.

What is worth noticing is why nothing caught it. Every other rule in this tool is about measurements:
markers, derived strengths, duplicated values, figures that may not be drawn from a gap. This was a
false statement about **responsibility**, and the suite had no rule of that kind at all.

## The change

**The field's name was the cause.** `meta.preparer` reads as "the person who prepared this", so it
drifted onto a line with a signature column. It is now `meta.assembledBy`, and the contract says what it
is for: the tool or session that assembled the draft, not a signatory. The old name is refused outright
rather than accepted during a transition — one field with two spellings is one field that ends up
holding two different things, the same reason `sourceFile` was deleted when `sourceFiles` arrived.

**Provenance prints in the scope notice**, one sentence: what assembled the draft, by what extraction
method, the date of the last revision, and the fact that every role below is left blank. That sentence
deliberately does not repeat the sign-off heading verbatim, because the verifier counts that heading to
find where the signature table starts.

**The sign-off table is withheld the data.** `signoffRows()` takes no arguments. That is the rule, not a
side effect: a table with a signature column that reads no field of the file cannot claim someone
accepted responsibility, and the failure cannot come back one convenient edit at a time. The date now
lives in `draftDate` only, and `assembledBy` no longer carries a date of its own, so the two cannot
drift apart at the next revision.

## Why the rule is positional

A check that looked for AI-sounding strings would accept `assembledBy: "Nguyễn Văn A"` — the same false
statement with better camouflage. The tests assert the invented person's name is kept off the signature
lines exactly as a tool's name is, and is still stated as provenance rather than hidden.

The end-to-end rule lives in `verify.mjs`, on the rendered text: `assembledBy` appears exactly once, and
before the sign-off heading. The negative case is the one that gives it weight — the removed line was
put back into `builder.mjs`, the document re-rendered, and it **still passed XSD validation**, because
nothing structural was ever going to catch this. The text check failed it, exit 1.

## Round 12 of the conformance record

The record still carried N-1 as an open CRITICAL: the dossier asserting direct compression while Trial
1's in-process table was headed "Tính chất vật lý cốm" and measured moisture at 105 °C. Trial 2 settled
it — sieve, two blends, final blend, compression, with no granulation, wetting or drying, "cốm" meaning
the final blend, and Povidone K30 added as dry powder. The draft has said so since Trial 2 landed; the
record had not caught up, so a reader of the record would go ask FD a question that already has an
answer, and would miss the item that actually needs them.

Round 12 is appended rather than edited in. The file is a cumulative log, and deleting a past conclusion
deletes the record of who concluded what, when — so each stale statement is corrected by name, with its
evidence. Alongside N-1: D-0 narrows from "which process" to "which operation set the risk matrix
scores"; C-1 gains the lubricant as the second experimentally established critical formulation
attribute, with both limits stated — 3% was never tested, and the hardness/friability half of the
conclusion rests on the copied table; 2.3's description-and-justification requirement is recorded as
met; W-6/D-14 closes.

And the conclusion is corrected. The most urgent open item is not a process question but Trial 2's
finished-product results table: 25 of its 45 numeric cells are verbatim Trial 1 values, in a block
pattern, 28 of 69 counting the blend table with it. It is kept out of the dossier and named instead.

## Files

| File | Change |
|---|---|
| `draft/validate-draft.mjs` | `REQUIRED_META_FIELDS`: `preparer` → `assembledBy`, with the reason in a comment |
| `render/builder.mjs` | `signoffRows()` (no arguments), `SIGNOFF_HEADING`, `provenanceSentence(meta)` in the scope notice |
| `verify/verify.mjs` | printed exactly once, before the sign-off heading; heading imported from the renderer rather than spelled again |
| `schemas/p2-draft-contract.md` | `assembledBy` is provenance, not a signatory; `draftDate` is the last revision |
| `draft/checklist.md` | item 8 rewritten: no name goes into the sign-off table, and no date inside `assembledBy` |
| `draft/example-draft.json` | `assembledBy`, `draftDate` → 2026-09-26 |
| `draft/tests/authorship.test.mjs` | new, 7 tests |
| 3 fixtures | field renamed |
| `docs/reports/qbd-p2-ich-q8r2-audit/ich-q8r2-format-audit.md` | round 12 appended |

## Validation

129 tests (122 previous, 7 new). Stage B clean. `value-inventory` against the previous draft:
`lost 0, duplicated 0, moved 0, added 0 (marker 0, prose 0, data 0)`. Rendered document: XSD PASS, text
checks PASS, `unzip -t` clean, and the four figures byte-identical to the previous render — this round
moved no content. Markers unchanged at 149 gaps and 19 decisions.
