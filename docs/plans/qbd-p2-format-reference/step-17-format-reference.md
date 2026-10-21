# Step 17 — Take the format reference's structure, refuse its data

Gate bodies live in `gates.yaml`. This file records what was done and in what order; it does not restate
a gate.

## Order, and why

1. **The boundary first** ("lock the door before opening the crate"). `verify/sample-boundary.mjs` with
   hashed identity tokens and hashed measured-value groups; wired into `verify.mjs`. Only then was the
   outline touched. G-35, G-36, G-37.
2. **Risk matrices as pairs** and the operation list that the process matrix reads. G-38..G-40.
3. **Process development per operation**, tied back to the list. G-41.
4. **Sections that report one strength**, bound to a position in `meta.strengths`, and a strength with no
   batch holding no measurement. G-42, G-43.
5. **Dissolution profile figure and the f2 statement.** G-44, G-45.
6. **The data-request annex regrouped as a work order**, the comparison report, the ICH Q8(R2) record's
   round 13, and this plan package. G-46, G-47.

## Files, by pattern

- `tools/pharma-dev-draft/schemas/` — outline `form` keys (`columnsFrom`, `columnsFromRows`,
  `riskAssessment`, `operationList`, `developsOperations`, `strengthIndex`, `similarity`, `workOrder`),
  `riskScale`, `dataOwner`, `headings.mjs`, and the contract.
- `tools/pharma-dev-draft/draft/validate-draft.mjs` and `draft/tests/*.test.mjs` — one rule family and one
  purpose-built-outline suite per phase.
- `tools/pharma-dev-draft/render/` — `figures/profile-chart.mjs`, `work-order.mjs`, the annex in
  `builder.mjs`, and the shared heading helper used by the document, the gap register and both action lists.
- `docs/reports/qbd-p2-format-reference/` — the comparison and the gate evidence.

## Not done, and why

- **No gate was run against real data**, because none exists. The three rules that need it say so in a test.
- **GitNexus was unavailable**, so `impact` before editing a symbol and `detect_changes()` before each
  commit were not run. The substitute was the suite, Stage B, `value-inventory`, the boundary check and a
  render at every phase. `builder.mjs` and `validate-draft.mjs` have many callers; run the tool before the
  next edit to either.
- **The rendered document was not rasterised**: LibreOffice cannot open it in this environment. Layout was
  checked through the document XML and the figures' own images.

## Rollback

Each phase is its own commit on the branch. Reverting the last one removes the work order and returns the
annex to a flat list; reverting an earlier one removes its rules and their sections together, because a
phase's outline keys, draft content and tests travel in one commit.
