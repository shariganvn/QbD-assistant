# Step 02 — A calculated strength cannot carry a measured result

Status: unverified · Gate: G-02 · Depends on: step 00, step 01

## Requirement

For this product, 5 mg exists only as a proportional calculation from 10 mg. A ratio yields a **mass**.
It does not yield a dissolution percentage, a hardness, a disintegration time, a content-uniformity
acceptance value, or a stability result. A tool that lets a 5 mg result cell hold a number is a tool
that writes invented data into a document shaped like a registration dossier, and no reviewer reading
the finished Word file can tell the difference.

So this must be structurally impossible, enforced in the Stage B validator, upstream of the renderer.

## Context

The draft already distinguishes a limit from a result by hand: `P.2.5` carries real limits from the
house form in one column and markers in the result column, and a test locks that distinction. This step
generalises the same idea along the strength axis and makes the validator, not a test on one example,
the thing that enforces it.

## Files

- modify `tools/pharma-dev-draft/schemas/p2-outline.json`
- modify `tools/pharma-dev-draft/schemas/p2-draft-contract.md`
- modify `tools/pharma-dev-draft/draft/validate-draft.mjs`
- modify `tools/pharma-dev-draft/draft/tests/table-layout.test.mjs`
- modify `tools/pharma-dev-draft/draft/checklist.md`

## Implementation

1. **`form.measuredOnly: true`** marks a table whose value cells hold measurements: in-process and
   quality-control results, dissolution, hardness, disintegration, content uniformity, reference-product
   survey results, stability. This is a property of the department's form, so it belongs in the outline.
   Putting the list of such tables in the validator instead would be a hardcoded id list and fails G-00.
2. The validator, for each `measuredOnly` table, for each strength in `meta.derivedStrengths`: every
   cell in that strength's column group must satisfy the marker predicate from step 00.
   `E_DERIVED_STRENGTH_HAS_RESULT`, naming the section, the table, the row label and the strength.
3. A blank cell is not a gap. An empty string fails the same check — the document has to say that data
   is missing, not leave a hole a reader can mistake for "not applicable".
4. **The one permitted exception** is the final-formulation table `P.2.2.1.3.5`, which is not
   `measuredOnly` because a composition is a declared quantity, not a measurement. The derived
   strength's masses may hold calculated values there, and the section must carry a paragraph stating
   the masses are computed by proportion from the studied strength and are not a formula that has been
   manufactured. Lock that paragraph's presence with a test.
5. `checklist.md` gains the rule in plain terms, with the reason: proportion gives mass, never a
   measurement.

## What this step deliberately does not do

It does not decide whether the 5 mg formula is scientifically acceptable. Dose proportionality is FD's
call, backed by a biowaiver dissolution comparison. Three items stay markers and each gets a row in the
step 05 annex:

1. FD's written linear-formulation confirmation;
2. comparative dissolution across 5 mg, 10 mg and the reference product — the house example carries a
   biowaiver comparison over 2.5, 5 and 10 mg (body lines 1336–1346);
3. the 5 mg tablet's design. The house example states *"Unscored for low strength and scored for high
   strength"* (line 457), and the 10 mg tablet here is debossed "10". The two strengths are therefore
   not design-identical, and nothing about the 5 mg tablet's marking or scoring follows from proportion.

## Tests to add

- a draft with one dissolution cell filled for the derived strength fails
  `E_DERIVED_STRENGTH_HAS_RESULT`; the message names the row and the strength;
- the same cell marked validates;
- a blank cell for a derived strength fails;
- the non-derived strength's result cells are untouched by the rule — filling them validates;
- the final-formulation table accepts calculated masses for the derived strength;
- removing the calculated-mass disclosure paragraph fails.

## Validation

- `node --check`; `npm run test:pharma-dev`.
- Render and read the 5 mg columns in the Word file: every result cell shows the marker in red.
- G-00's literal scan: `measuredOnly` sits in the outline, no strength value reached the validator.

## Risks and rollback

The likely failure is scoping `measuredOnly` too narrowly and leaving a results table unmarked, which
lets a fabricated value through silently. Cross-check the marked set against the gap register: a table
holding measurements for the studied strength and markers for the derived one is a results table by
definition.

Rollback removes the key and the check. Do not soften the rule to a warning — a warning in a document
of this kind is a value a reader will read as data.
