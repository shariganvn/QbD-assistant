# Step 00 — One producer for the gap marker

Status: pass · Gate: G-00 · Blocks: step 02

## Why this comes first

The marker string `[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]` is currently written as a literal in three
places in `render/builder.mjs` (the scope-notice body, `gapParagraph`, and the `GAP_MARKER` prefix
used by the gap register) and thirteen more times across `draft/tests/table-layout.test.mjs`.

Step 02 needs to ask "does this cell carry the marker?" from the validator. Adding that check
without this step would create a fourth producer of the same string, in a second module, and the
register, the renderer and the validator would then be able to disagree about what a gap looks like.
Doing it after step 02 means the copy already exists.

## Context

`schemas/layout.mjs` is the precedent: `TABLE_WIDTH_DXA` lives in `schemas/` precisely so that
neither the Stage B validator nor the Stage C renderer owns it, and the two are kept in agreement by
the import rather than by a comment. Its header comment states that reasoning; follow it.

## Files

- create `tools/pharma-dev-draft/schemas/markers.mjs`
- modify `tools/pharma-dev-draft/render/builder.mjs`
- modify `tools/pharma-dev-draft/draft/tests/table-layout.test.mjs`

## Implementation

1. `schemas/markers.mjs` exports:
   - the full marker text used at the start of a gap paragraph;
   - the prefix the gap register matches on (today's `GAP_MARKER`, the shorter leading substring);
   - a predicate that answers whether a given cell or paragraph string carries a marker.
   Give the module a header comment in the same spirit as `layout.mjs`: it exists so the validator,
   the renderer and the tests cannot drift apart on what a gap is.
2. `builder.mjs` imports all three and drops its three literals, including the one embedded in the
   scope-notice sentence — that sentence quotes the marker to the reader, so it must quote the real
   constant.
3. The tests import the predicate instead of writing the string. Where a test builds fixture data it
   may still construct a marked cell, but it does so from the constant.

## Validation

- `node --check` the three touched modules.
- `npm run test:pharma-dev` — 25/25 still pass; this step changes no behaviour.
- `grep -c 'CHƯA CÓ DỮ LIỆU' tools/pharma-dev-draft/schemas/markers.mjs` is the only non-draft
  occurrence count above zero; the same grep over `render/` and `draft/` returns nothing outside
  `example-draft.json`.
- Re-render the example and confirm `word/document.xml` is byte-identical to the pre-change render:
  this step is a refactor, so the output must not move.

## Risks and rollback

The scope-notice sentence reads naturally only if the constant is interpolated in the right place;
check the rendered notice text, not just the test suite. Rollback is a straight revert of the three
files — nothing else depends on the module until step 02.
