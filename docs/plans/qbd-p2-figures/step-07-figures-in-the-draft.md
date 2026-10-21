# Step 07 — The two figures that have data

Status: pass · Gate: G-10

## What went in

- `P.2.3.1` — the process flow, drawn from the unit-operation columns of the risk matrix in that same
  section. Change the manufacturing method and the diagram follows, because the columns are where the
  method is already declared.
- `P.2.2.1.3.3` — the dissolution result of the three trial formulations, with the acceptance line and
  the failing column in a different colour. The values come from the results table printed above it.

## What did not, and why the wording changed

Three figures the department's form calls for are still absent: the reference product's dissolution
profile, the comparative profile across strengths, and the structural formula. Every one of those
sections used to carry a sentence saying the renderer could not place a picture and that it had to be
pasted in by hand. That reason is no longer true, and leaving it would have misdirected the reader to
a tooling limitation when the real blocker is that the data does not exist.

They now say what is actually the case: the chart is drawn from the table, the table is empty, and the
figure appears when the data does. The structural formula waits on a file, and the `image` block is
there for it — deliberately not hand-drawn, because there is no chemistry toolkit here and placing the
bonds of a forty-carbon salt by hand is a way to be quietly wrong about chemical identity.

## What this cost in the document

Nothing was duplicated. The value inventory reports duplicated 0 and added data 0: a figure block
carries no numbers, so putting a chart next to a table does not create a second copy of the values. Two
paragraphs report as lost-and-added — those are the two reworded sentences.
