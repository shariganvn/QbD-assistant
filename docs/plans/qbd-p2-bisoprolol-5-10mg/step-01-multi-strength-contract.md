# Step 01 — The strength dimension

Status: pass · Gate: G-01 · Blocks: step 02, step 05

## Requirement

A product may have any number of strengths. Today nothing in the tool knows the concept: `meta` holds
a single `productName` string, and `example-draft.json` covers 10 mg only because that string says so.
The document must be able to cover every strength a product declares, with the count of strengths
being data rather than a number built into the schema or the code.

## Context

The house example covers both strengths in one document. Two per-strength table shapes occur in it:

- one column per strength — `Ingredients | Concor® | API 5 mg | API 10 mg` (body lines 608–611);
- two columns per strength — a mass column and a percentage column each, in the final-formulation
  table (body lines 1004–1014).

Both must work without the schema stating which shape a table uses. That number is derivable from the
table itself, and a derived number cannot drift from what it describes.

## Files

- modify `tools/pharma-dev-draft/schemas/p2-draft-contract.md`
- modify `tools/pharma-dev-draft/schemas/p2-outline.json`
- modify `tools/pharma-dev-draft/draft/validate-draft.mjs`
- modify `tools/pharma-dev-draft/draft/tests/table-layout.test.mjs`
- modify `tools/pharma-dev-draft/draft/checklist.md`

## Implementation

1. **`meta.strengths`** joins the required-field list: an array, at least one entry, every entry a
   non-empty string, no duplicates. No upper bound. `E_META_STRENGTHS`.
2. **`meta.derivedStrengths`** is optional: an array whose every entry appears in `meta.strengths`.
   It declares which strengths have no experimental source. Same error code for a violation, since it
   is the same field family and the message names which rule failed.
3. **`form.perStrength: true`** on a table spec. When present, the validator:
   - counts the fixed columns the spec declares (the leading labels, before the per-strength block);
   - computes the group size as `(headers.length - fixedCount) / strengths.length`;
   - rejects a non-integer or non-positive result;
   - requires the first column of each group to contain its strength string verbatim, in the order
     `meta.strengths` declares;
   - rejects two groups carrying the same strength string.
   `E_FORM_STRENGTH_COLUMNS`, naming the section, the table index and what was expected.
4. The existing `"..."` open-ended column marker keeps its current meaning and must not be combined
   with `perStrength` on the same table — the two make opposite claims about the trailing columns.
   Reject that combination in the outline as a schema error rather than leaving it undefined.
5. Document the notation in `_formSpec` inside the outline and in `p2-draft-contract.md`. Both already
   carry the full form notation; keep them the only two places it is written.
6. `checklist.md` gains one step: name every strength the draft covers, and name in
   `derivedStrengths` any strength with no trial data.

## Tests to add

Build fixtures from the outline at test time; do not pin labels.

- a two-strength draft with a correct two-column-per-strength table validates;
- the same draft with one group instead of two fails `E_FORM_STRENGTH_COLUMNS`;
- a group whose first column omits its strength string fails;
- **a three-strength draft validates** — this is the test that proves nothing assumes exactly two,
  and it is the reason G-01 lists a three-strength fixture as evidence;
- `meta.strengths` absent, empty, or holding a duplicate fails `E_META_STRENGTHS`;
- `derivedStrengths` naming an unknown strength fails.

## Validation

- `node --check` touched modules.
- `npm run test:pharma-dev`.
- G-00's literal scan: no strength string entered the outline or the validator.

## Risks and rollback

The trap is declaring the group size in the schema when a validator failure is easier to fix that way.
That reintroduces a number to keep in sync by hand and fails G-00. If the derivation genuinely cannot
express a table's shape, the table's shape is the thing to reconsider — not the derivation.

Rollback: remove the three keys and their checks. `meta.strengths` becoming required means the worked
example must declare its strengths, so a rollback also reverts that one line.
