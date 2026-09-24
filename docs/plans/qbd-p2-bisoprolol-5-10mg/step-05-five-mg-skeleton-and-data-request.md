# Step 05 — The 5 mg columns, and a data-request annex derived from them

Status: unverified · Gate: G-07 · Depends on: steps 01, 02, 04

## Requirement

Declare both strengths, build out every per-strength table for both, and turn the resulting markers
into a request a person can act on. The empty half of the document is the deliverable here: if each
marker says what is needed and where it comes from, the skeleton is a work list rather than a hole.

## Context

The reference-product section already works this way. Its nineteen empty cells each state where the
value would come from — the label or summary of product characteristics, an experiment on purchased
samples, or reverse engineering — so the framework reads as a task list. Extend that to the 5 mg
columns and then let the annex read those statements back out.

## Files

- modify `tools/pharma-dev-draft/draft/example-draft.json`
- modify `tools/pharma-dev-draft/render/builder.mjs`
- modify `tools/pharma-dev-draft/draft/tests/table-layout.test.mjs`

## Implementation

1. `meta.strengths` declares both strengths. `meta.derivedStrengths` declares the 5 mg one.
   `meta.productName` names the product across both strengths rather than one of them.
2. Every table the outline marks `perStrength` gains its 5 mg group. Under step 02's rule, every 5 mg
   cell in a `measuredOnly` table must be marked — so this step cannot accidentally fill one.
3. The final-formulation table `P.2.2.1.3.5` carries the 5 mg masses computed by proportion, and the
   section states plainly that these are calculated, that no 5 mg batch has been manufactured, and that
   FD's linear-formulation confirmation is outstanding.
4. Each marker states its own data location, in the cell. Nowhere in the code is there a table mapping
   a CTD section to a place data comes from: such a table is a second source of truth, and the first
   time a marker moves section the two disagree.
5. The annex is derived. The renderer walks the draft, collects every marker, reads the location out of
   the marker text, and emits one row per marker: CTD section, item, strength it applies to, where the
   data comes from, owner. Replacing a marker with a real value removes its row and nothing else — the
   same derive-from-content mechanism the gap register uses, for the same reason.
6. Three rows exist for things proportion cannot supply, each named explicitly rather than folded into
   a general "5 mg data missing" row:
   - FD's written linear-formulation confirmation;
   - comparative dissolution across both strengths and the reference product;
   - the 5 mg tablet's design — the house example scores only the high strength and the 10 mg tablet
     here is debossed "10", so the two are not design-identical and the 5 mg marking is an FD input.
7. One further row carries the pharmacopoeia version question from G-06, owned by FD/QA.

## Tests to add

- annex row count equals the draft's marker count;
- every annex row carries a location and an owner;
- replacing one marker with a real value in a scratch copy of the draft reduces the row count by
  exactly one;
- the final-formulation section keeps its calculated-mass disclosure;
- the three proportion-cannot-supply rows are present by their own identity, not as one combined row.

## Validation

- `npm run pharma-dev:validate`, `npm run test:pharma-dev`.
- Render and verify; read the 5 mg columns and the annex in the Word file.
- Count markers in the draft and rows in the rendered annex independently and compare — G-07's evidence
  is that join, not an assertion that they were built together.

## Risks and rollback

The real risk is presentational and it is the one that matters most: a reader skimming a document that
lists both strengths in every table may take the 5 mg column as characterised. The mitigations are the
red marker styling already in the renderer, the stated-as-calculated paragraph, and the annex. Check
how the 5 mg columns read to someone who did not write them before calling this step done.

Rollback: revert the draft to one declared strength and remove the annex. Note that the annex is useful
for a single-strength draft too, so prefer keeping it and reverting only the strength declaration.
