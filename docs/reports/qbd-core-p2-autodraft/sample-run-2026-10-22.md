# Run on SAMPLE_P2-Sample_Aceholder.docx (bisoprolol, 74 tables)

Date 2026-10-22. The file is on `origin/master` (`docs/raw/SAMPLE_P2-Sample_Aceholder.docx`), not on this
branch; it was read from there into a scratch folder. Substance Bisoprolol fumarate, form Viên nén bao
phim, market both. Local run, nothing sent anywhere.

## Recognition
74 tables: 42 named (design_table 14, dissolution_profile 14, batch_results 4, scale_up 4, test_results 2,
solubility 1, particle_size 1, final_formula 1, composition 1), 32 not recognised. Strengths read from
the formula table: 5 mg and 10 mg.

## Sections filled from the data (quality gate passed)
- P.2.2.1.4 final formula: filled, every cell tagged.
- P.2.2.1.1 reference product: gap. The reference columns are named by brand ("Concor® 5 mg").
- P.2.2.3.2 comparative dissolution: gap. Same cause for tables 27 to 29 and 32 to 34. Tables 40 to 47
  hold summary rows (Average, Max, Min, RSD) per product with the time points across, which the reader
  does not support.

## Experiment, not committed: count "Concor" as a reference word
Sections filled rise to three (P.2.2.1.1, P.2.2.1.4, P.2.2.3.2) and the quality gate still passes.
In P.2.2.3.2 two comparisons give f2 (56.5 and 91.4); the other four are marked gaps because the
reference mean is above 100 % at some time point (the sample shows values such as 107.7 %). In
P.2.2.1.1 six cells are filled; "Tạp chất liên quan" is a marked gap because several impurity rows match
the single form row.

## Defects found by this run and fixed
1. A comparison that could not be computed produced a gap row whose label carried digits without a tag,
   which the gate blocks (exit 7). The label now carries its cell tags like a computed row.
2. The gap row showed an internal code (E_F2_RANGE); it now says why in words.
3. The conflict note for several matching rows said "different values"; it now says several rows or
   tables match.

## Open decision for the project owner
The team's reports name the reference product by brand in every table. Direction 1 (a reference word in the
column label) means editing each table. Option 2 (one `--reference-product Concor` input) would fill the
three sections above from this file as it is.
