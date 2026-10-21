# Step 10 — The conformance re-check, and what it put in the document

Status: pass · Gate: G-18

## Why re-check

The ICH Q8(R2) conformance record stopped at a round dated 28/08. Three rounds of work happened after
it: the outline rebuild to two strengths, the figures, and the PubChem sourcing. A report that stale is
not neutral — it is the file a later session reads to decide what to do next, and it was saying that
three closed findings were open and that the document had never identified a critical quality attribute
in any form.

## What the re-check corrected

W-1, W-2 and W-3 are closed, verified by running `headingLevelFor` over all 38 outline entries rather
than by reading the code. The reference-product count was 19 in one report and 38 in another; 38 is
right — 19 rows × 2 strength columns — and the two reports no longer contradict each other.

The correction that mattered most was C-1. The old text said the document had not identified anything
critical to product quality "in any form". `P.2.2.1.2.2` now does all three things Part I page 6 asks,
for the one factor whose variation the trial actually explored, and says so with the page quoted. What
remains open is three of the four target groups that page lists — and that is missing data, not missing
intent. Leaving the harsher sentence in place would have sent somebody to rewrite a section that is
already right.

## The finding worth the whole round

The dossier states the process is direct compression. The trial's own in-process table is titled
"granule physical properties", measures moisture at 105 °C on a halogen balance across five sieve
fractions, and the formula carries Povidone K30 declared as a binder — which the excipient section's own
monograph describes as a wet granulation binder.

This came from the subagent and was **checked directly on the draft before being written down**, because
it contradicts a premise several rendered sections are built on. If the real process is wet granulation,
the five unit operations, the process flow drawn from them, and the croscarmellose benchmark all change —
and those are prose and a figure, not markers, so nothing would have flagged them.

It is now a decision marker in `P.2.3.1`, naming what it blocks.

## Two structural gaps, closed by marking rather than by inventing

Four requirements of section 2.2.1 — clinical and bioequivalence formulations, changes against the
pivotal and primary stability batches, comparative in vitro and in vivo studies with study numbers, and
justification of excipient ranges — had no heading and no marker. Unlike every other gap in the document
they were invisible, so nobody would ever have been asked for them. They are now four marked requests in
`P.2.2.1.3.3`.

Three things section 2.4 names — container closure integrity, sorption and leaching, safety of the
materials of construction — had no row in the primary-packaging form. Format lives in the outline, so the
rows went there and the draft followed.

A third, the film coat missing from the final-formula table, was deliberately **not** closed with a new
row. A film coat is several substances and which ones is FD's choice; a single row would have presumed
the answer. It is a marked request instead.

## What went into the document, and what stayed out

Sixteen decisions across eleven sections, each naming its owner: the process premise, the impurity
monograph, the pharmacopoeia version, the dissolution sampling plan and media set, the excipient at its
ceiling, the lubricant confounder, the multi-valued physicochemical properties, free-base values in a
salt dossier, two queries to the supplier on the certificate, the tablet design for the derived strength,
the QTPP itself, the overage confirmation, the compatibility confirmation, and sign-off on renumbering
the dissolution group.

Two stayed out on purpose. The preparer field naming an AI is a data-integrity matter for the file, not
content of a CTD section, so it is in the conformance record only. And the CQA set being the 10 mg set
while the risk matrix binds both strengths is left inside the QTPP decision rather than made a separate
row — it is the same piece of work.

## Verification note

`value-inventory` exits non-zero on seven lost values. Each is a text deliberately shortened or
reclassified this round, and each has its replacement in the added list — three gap markers that were
really decisions, and four paragraphs whose closing ask became a marker. The two criteria that matter,
`duplicated 0` and `added data 0`, both hold.
