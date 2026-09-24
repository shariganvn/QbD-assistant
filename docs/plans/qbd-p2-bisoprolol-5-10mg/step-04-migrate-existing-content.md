# Step 04 — Move the existing content onto the new outline, adding no data

Status: unverified · Gate: G-04 · Depends on: step 03

## Requirement

The worked example holds real values from one trial, from the batch-488 certificate of analysis, from
the secondary reference-standard certificate, and from the excipient handbook, plus 93 gap markers.
The new outline has 26 leaves where there were 11. Every existing value has to land in exactly one of
them.

This step adds **no data**. Not one measurement, not one property value, not one threshold. A new
value appearing here would be a value with no source, which is the one thing the tool exists to
prevent.

## Migration map

| From | To |
|---|---|
| `P.2.1.1` General properties form and its numbered source notes | `P.2.1.1.1` physicochemical |
| BCS / permeability statements currently inside `P.2.1.1` prose | `P.2.1.1.2` biological — as markers where the value has no source |
| `P.2.1.2` heading `…2.1 Đặc tính lý hóa` and its excipient table | `P.2.1.2.1` |
| `P.2.1.2` heading `…2.2 Nghiên cứu tương hợp` | `P.2.1.2.2` |
| `P.2.2.1.1` reference-product framework, both tables | `P.2.2.1.1` unchanged |
| `P.2.2.1.2` quality-attribute table | `P.2.2.1.2.1` — and the process risk matrix's `rowsFrom` follows it |
| `P.2.2.1.2` criticality heading and its reasoning paragraphs | `P.2.2.1.2.2` |
| `P.2.2.1.3` trial objective, fixed parameters, composition, IPC/QC results, conclusion | `P.2.2.1.3.3` |
| `P.2.2.1.3` before/after risk paragraphs | `P.2.2.1.3.2` and `.3.4` respectively |
| `P.2.2.1.3` special design feature (the debossed "10") | stays with `P.2.2.1.3.3` |
| `P.2.2.2` overages | `P.2.2.2` unchanged |
| `P.2.2.3` dissolution-method heading and its method marker | `P.2.2.3.1.2` |
| `P.2.2.3` discriminatory-power reasoning from the three formulas | `P.2.2.3.1.3` |
| `P.2.2.3` impurity-profile heading and content | `P.2.2.3.2` |
| `P.2.3` CQA × unit-operation risk matrix | `P.2.3.1` |
| `P.2.3` per-step critical-parameter table and the scale-up note | `P.2.3.2.1` and `.2.3` |
| `P.2.4` primary packaging table | `P.2.4.1` |
| `P.2.4` secondary packaging table | `P.2.4.2` |
| `P.2.5`, `P.2.6` | unchanged |

Destination ids are written in the outline's short form; each one's full CTD number is `3.2.` plus the
id, as `schemas/p2-outline.json` records it.

New leaves with no existing content — `P.2.2.1.3.1` preliminary experiments, `P.2.2.3.1.1` sink
condition, `P.2.2.3.1.4` comparative dissolution, `P.2.3.2.2` updated process risk assessment — open
as built-out skeletons or `gap` with a reason, whichever the leaf's form allows. A leaf whose form
declares tables cannot be `gap`, because the validator forbids blocks on a gap section; build the form
with markers and let the gap register report it as a skeleton, the behaviour established when the
reference-product section was framed.

## Files

- modify `tools/pharma-dev-draft/draft/example-draft.json`
- create `tools/pharma-dev-draft/draft/tests/value-inventory.mjs`

## Implementation

1. Write the destination draft leaf by leaf, moving blocks rather than retyping them. Retyping is how
   a comma-decimal becomes a period and how `98,64` quietly becomes `98.64`.
2. When a block moves out of a section, it must not remain there. The most likely defect in this step
   is a value present in both its old and new home, which reads to a reviewer as two independent
   findings that happen to agree.
3. `value-inventory.mjs` takes a before draft and an after draft and reports, for every value in the
   before, which after-sections contain it; plus a list of values present only in the after. It is a
   derived comparison, not a hand-kept list — a hand-kept list is exactly the artefact that goes stale
   halfway through a migration.
4. Keep the numbered source-note mechanism of the General properties form intact. Each value's label
   points at one source note; the notes carry the warnings that the property was not checked against a
   monograph, that the reference-standard certificate describes the standard rather than the production
   batch, and that the batch number has not been reconciled with the trial record. Losing a note while
   keeping its value would turn a qualified statement into an unqualified one.

## Validation

- `npm run pharma-dev:validate` on the migrated draft.
- `node tools/pharma-dev-draft/draft/tests/value-inventory.mjs --before … --after …` — every before
  value maps to exactly one destination; the added-values list holds only markers and required
  headings.
- `npm run test:pharma-dev`.
- Render, then read the document end to end. The gap register should show 26 rows whose statuses match
  what each section actually holds.

## Risks and rollback

The section that most needs care is the General properties form: the seventh audit pass settled it at
one 18-row table with numbered notes below and nothing else, specifically to stop it growing a new
cluster per source. Splitting physicochemical from biological properties must not become licence to add
a second table — the biological leaf takes prose and markers.

Rollback is a revert of `example-draft.json`; the inventory script is additive and can stay.
