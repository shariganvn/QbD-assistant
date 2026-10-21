# Trial-table recognition measured on the department's example report

Date 2026-10-21. File: `docs/raw/135-00-Pharmaceutical Development-example.docx` (46 tables).
Method: Stage A extraction, then `classify()` on the header cells only. Test:
`qbd_core/modules/evidence/tests/test_trial_intake.py::test_recognition_on_the_departments_example_report_does_not_regress`.

| Step | Named | Not recognised |
|---|---|---|
| First version (5 kinds) | 12 | 34 |
| After adding 8 kinds from this report's headers | 33 | 13 |

Named kinds: design_table 10, batch_results 4, composition 4, dissolution_profile 3, physical_tests 2,
scale_up 2, and one each of solubility, sink_condition, particle_size, dissolution_method, batch_info,
impurity, test_results, packaging. No table matched two kinds.

Not recognised (table numbers): 1, 5, 6, 7, 8, 16, 19, 20, 28, 37, 38, 39, 46 (API identity, excipient
lists, mixing test, risk legend, factor lists, batch id sheets).

## Limits to keep in mind
- The new kinds were written from this one report's headers, so 33 of 46 is a fit to this report, not a
  prediction for other reports. Another trial report will probably match fewer tables.
- This report is a template with placeholders (`<<Infor from DB>>`) and many empty cells. Naming a table
  does not mean it holds numbers; a named table with empty cells produces a marked gap, not a value.
- "design_table" tables (QTPP, CQA, risk) are named so they stop appearing as unrecognised; they are not
  experimental data and no section is written from them.
- Of the named kinds only `sink_condition` feeds a section today.

## What the per-strength sections need next
Sections such as P.2.2.1.1, P.2.2.1.4, P.2.2.3.2 have per-strength tables. The Stage B validator requires
`meta.strengths` and one equal column group per strength, and a strength with no batch of its own may
only carry gaps in measured tables. The strengths are not an input, so the draft declares a gap marker.
They can be read from composition-table headers ("... 5 mg", "... 10 mg"). That is the prerequisite for
agents 3.1, 6.4, 8.2.
