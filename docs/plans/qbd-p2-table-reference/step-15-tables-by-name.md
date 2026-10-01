# Step 15 — Tables by name

Status: pass · Gates: G-29, G-30, G-31

## The failure being removed

A figure said which table it drew from with an index into the section's tables. Three times in two
rounds a table moved or was inserted ahead of a figure and redirected it:

- the new process figure named table 0, which was the first trial's composition;
- moving the process table to the front of its section redirected both figures in that section at once;
- the test helper, written when a section held one figure, returned whichever came first, and five
  chart tests failed on it.

What is worth noticing is that **none of those was caught by a rule aimed at it**. The process diagram
failed on its column count, the chart on its row name. Those checks exist for other reasons and caught
this by luck. The `flow` kind has no equivalent: it reads column headings straight into unit operation
names, so a misdirected flow figure renders a different manufacturing process and the document still
looks correct.

## The change

A table that a figure points at declares an `id`; the figure names it. Three decisions inside that:

**No compatibility with the index.** An integer `fromTable` is refused, with a message telling the
author to give the table an id. One field with two spellings is one field that will disagree with
itself — the same reason `sourceFile` was deleted outright when `sourceFiles` arrived.

**Ids only where a figure needs one.** Requiring them on every table would be a rule nothing uses, and
a rule nothing uses goes stale. This matches `decisionOwners`, required only once a decision marker
exists.

**Unique within the section**, not the document. A figure only reads tables in its own section, and
document-wide uniqueness would force long names for no gain.

One trap needed blocking on the way. Leaving `fromTable` out entirely made `find(t => t.id === id)`
match a table with **no id at all** — the old failure wearing a new hat, with the figure drawing from
whichever table happened to be unnamed. `tableAt` now refuses a reference that is not a non-empty
string, which is belt as well as braces, since the validator refuses it too.

## The proof that matters

A test asserting "the figure resolves to its table" would pass under both the old form and the new one.
So the test reverses each section's tables and requires every figure to resolve to the same table it
did before, and the evidence file records what the **old** form does under the same shuffle: the
process diagram would draw from the second trial's blend table, and the dissolution chart from the
in-process table.

The `flow` kind needed its own test, because the section holding the flow figure has only one table and
the shuffle cannot move it. That test inserts a decoy table at the head of the section and asserts both
that the flow still draws its own operations and that the decoy's would have been different — otherwise
the assertion could pass by the two happening to match.

## What was deliberately left positional

`form.tables[]` in the outline stays an ordered list, because there position **is** the statement: the
Nth table of this section must have this shape, and a table inserted in the middle should break it.
That asymmetry is now written into the contract, so a later round does not tidy the two into one.
