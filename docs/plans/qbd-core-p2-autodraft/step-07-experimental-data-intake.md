---
title: "Step 07 - Experimental data intake (design)"
workstream: qbd-core-p2-autodraft
status: slices 1 and 2 done (G-13, G-14, G-15 pass); consumers open
---

# Step 07 - Experimental data intake (agent 1.3)

## Why
28 of 59 agents are blocked because the draft sections they own describe the team's own experiments
(reference-product tests, formulation trials, dissolution, impurities, process, packaging). Nothing in
the three inputs or in the Kho can supply those numbers. The goal "enter once, approve the result"
therefore means: three fields plus the team's existing trial files, given in the same single run.

## Findings that shape the design
1. The team's data already arrives as trial `.docx` reports. `tools/pharma-dev-draft/extract/extract.mjs`
   (Stage A) turns one into tables with cell text, deterministically. `qbd_core` may call it by CLI only
   (ADR boundary); no cross-import.
2. Stage B (which table answers which P.2 question) is the step the old tool left manual because table
   layouts vary. An automatic Stage B must not invent a mapping.
3. The team's own data is internal. By the egress rules it is not class A, so it never goes to a remote
   provider (fail-closed, G-03/G-12). Only a deterministic path or a provider whose destination is
   `local` may read it.

## Design
Input: `run ... --trial-file FILE.docx` (repeatable) next to the existing flags.

```
trial .docx --(CLI Stage A, pinned, timeout)--> tables
  --(classify: header/label patterns in config/data_kinds.json)--> typed records
  --(DataRecord: kind, file, table, row, column, cell text, unit, hash)--> data store
  --> deterministic agents read records; narrative/LLM agents read them only if provider is local
```

- `DataRecord` mirrors `EvidenceRecord`: every number published from experimental data carries
  `[dữ liệu: file, bảng N, hàng R, cột C]`; `quality_gate` re-reads the cell and requires the number to
  appear in it (same rule as `[tổng hợp: ...]`).
- Kinds are data, not code: composition, reference-product tests, dissolution profile, assay and
  related substances, physical tests (hardness, disintegration), process parameters, stability,
  packaging. Each kind lists the header synonyms and required columns. A table that matches no kind, or
  matches two, is not guessed: it is reported as "chưa nhận dạng" in the gap register with file and table
  number.
- Calculations are code, never a model: f2 and similarity (7.3, 8.2), mean and RSD, composition to
  percent, overage = found minus label. Inputs are cited records; outputs carry both tags.
- A strength is read from the data (`meta.strengths`); nothing is assumed. Reference-product data
  (3.1) is accepted only from a table the file labels as reference product.
- Fail-closed: file unreadable, Stage A error, ambiguous table, unit missing, or a number in two files
  that disagree (the integrity checks the team already found by hand) stops the affected section, not
  the run, except an unreadable file which stops the run (exit 9-class, new code 10).

## Agents this unlocks
Deterministic first (no model, no egress question): 1.3, 7.3, 8.2 (f2), 11.1 to 11.4 links, 6.4 final
formula table, 3.1 reference-product table, 8.3/8.4 and 10.2 tables, risk tables as `CẦN DỮ LIỆU`
unless the team supplies the levels. Model-written parts (rationale, risk wording, conclusions) wait for
a local provider; until then they stay marked gaps. Estimated to open 14 to 18 of the 28 blocked agents.

## Gates (unverified until built)
| Gate | Invariant | Command | Negative cases |
|---|---|---|---|
| G-13 intake | same trial files give identical records and hashes | pytest data_intake -k determinism | corrupt docx, Stage A failure, two kinds match, no kind matches |
| G-14 traceability | every published experimental number is in its cited cell | pytest quality_gate -k data_tag | edited number, wrong cell, forged tag |
| G-15 calculations | f2, mean, RSD, overage match hand-checked values | pytest data_intake -k calc | fewer than 3 time points, unit mismatch |
| G-16 no leak | experimental data never reaches a remote destination | pytest provider_access -k data | data record in payload, local vs remote |

## Decisions (2026-10-21, project owner)
1. Input form: the team's existing trial `.docx` reports.
2. Who may read the data: deterministic code only; a local model may be added later.

## Slices
1. Done: `--trial-file`, Stage A by CLI, header-word recognition, unrecognised tables listed, exit 10. G-13 pass.
2. Done: `[dữ liệu: ...]` tag and quality-gate check (G-14), `calc.py` (G-15), first consumer P.2.2.3.1.1 sink condition from a `sink_condition` table.
3. Done: strengths read from composition headers (G-17); two strengths open the second-strength sections.
4. Done: P.2.2.3.2 comparative dissolution with f2 by code and `[tính: f2, ...]` tag (G-18). `derivedStrengths` is not declared: a strength column is filled only from data that names it, otherwise it is a marked gap.
5. Done: P.2.2.1.4 final formula copied from a `final_formula` table (G-19). 3.1 stays blocked: in the example report the reference columns carry brand names ("Concor"), so the reference product cannot be told from the product; it needs a stated reference name or a label word such as RMP.
6. Done (decision 2026-10-22, project owner: direction 1): P.2.2.1.1 reference product from columns whose label carries RMP / reference / đối chiếu (G-20). The team must label those columns.
7. Revised (decision 2026-10-22, project owner): reports keep the reference product's brand in table headers and no brand may be written in code. The brand is inferred from comparison tables (G-21); a reference word still works. The inferred name is shown to the final approver.
8. Done (2026-10-22): f2 ceiling and summary tables (G-22), impurity profile (G-23). 8.4 and 10.2 wait for a real table of their kind.
9. Done (2026-10-22): tablet subdivision from the department's report template (G-24). 10.2 waits for a microbiology table.
10. Next: consumers 6.4, 7.3/8.2 (needs dissolution tables with multi-row headers, and a `[tính: ...]` tag for f2), 8.3, 8.4, 10.2, 11.x. Earlier plan text: `DataRecord` with cell-level tags and the quality-gate check (G-14), then calculation module (G-15), then the first consumers: 3.1, 6.4, 7.3/8.2, 8.3, 8.4, 10.2, 11.x.

## Risks and rollback
Trial layouts differ, so recognition will miss tables at first; misses become visible gaps, not wrong
numbers. Each piece lands as separate commits; without `--trial-file` behaviour is unchanged.
