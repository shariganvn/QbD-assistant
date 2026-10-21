---
title: "Step 07 - Experimental data intake (design)"
workstream: qbd-core-p2-autodraft
status: design, waiting for two decisions
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

## Decisions needed from the project owner
1. Input form: the team's existing trial `.docx` reports (recommended) or a fixed spreadsheet template.
2. Who may read the data: deterministic code only for now (recommended), or also a local model later.

## Risks and rollback
Trial layouts differ, so recognition will miss tables at first; misses become visible gaps, not wrong
numbers. Each piece lands as separate commits; without `--trial-file` behaviour is unchanged.
