# SPEC - quality_gate

## Purpose
Check a draft run by code, with no language model: where every covered text came from, whether the draft
agrees with its input and its own registers, section numbers per market, and the SOP's Appendix C
checklist. A failed check blocks publication.

## Ubiquitous nouns owned
Finding, ChecklistItem, NumberingRow, QualityReport.

## API contract (api.py)
- `evaluate_run(run, knowledge, outline=None) -> QualityReport` (`findings`, `checklist`, `numbering`,
  `actd_map_verified`, and `passed` / `blocking`). `run` is a `DraftRun`; `knowledge` verifies quotes.
- Findings carry codes, section ids and ids only, never draft text, so a report can leave the machine.
- Block findings:
  - provenance: `E_UNSOURCED_TEXT` (covered paragraph with no source tag, except the CQA section after a
    person confirmed it), `E_VALUE_WITHOUT_SOURCE` (table cell with a digit, no marker, no tag),
    `E_SOURCE_MISMATCH` (tag names no record, another file or page, or the text is not the record's
    quote), `E_SOURCE_UNVERIFIED` (the quote is not on the cited page), `E_DUPLICATE_EVIDENCE`,
    `E_REFERENCE_MISSING` (a cited file is not in `meta.referenceSources`).
  - consistency: `E_META_MISMATCH` (apiName or productName disagree with the input),
    `E_GAP_REGISTER_MISMATCH`, `E_CQA_UNCONFIRMED_CONTENT`, `E_RESTRICTED_FLAG_MISMATCH`.
  - numbering: `E_NUMBERING_UNMAPPED` (a leaf section has no CTD/ACTD entry).
- Info findings: `I_RESTRICTED_TEXT` (the draft holds non-class-A text, keep it local),
  `I_ACTD_MAP_UNVERIFIED` (market includes the domestic one and the numbering is from the SOP appendix).
- Numbering rows per market: EU gives the CTD number and `required`; domestic and both add the ACTD number
  and the requirement from the SOP note (`mandatory`, `literature`, `not_required`, `recommended`).
- Checklist rows 1-17. Items 1-14 are scored by coverage only: `open` (a mapped section still has a
  marker), `review` (all mapped sections have content, a person decides), `na` (nothing applies, for
  example the excipient items in the domestic market). Code never marks a content item `pass`. Items 15-17
  are decided by code: `pass`, `fail`, or `review` for item 15 while the ACTD numbers are unverified.

## Invariants
- Deterministic: same run, same report bytes. No network, no model.
- A draft is never judged good by this module; it is judged consistent and traceable.
- Marked gaps are not failures: an orientation draft is allowed to be incomplete, but must say so.

## Data owned (models.py, config/)
`config/appendix_c.json`: the 17 items and which outline sections answer items 1-14. The section mapping is
an engineering choice (formulation studies under item 7, the process development parent under item 12)
and awaits FD confirmation.

## Exposed to (file-share outside api.py)
None.

## Dependencies
dossier_drafting (`DraftRun`, `section_map`, `load_outline`, `CQA_SECTION`), evidence (`KnowledgePort`),
`shared.markers`.

## Non-goals
Scientific judgement, grading prose, and verifying the ACTD numbering against the official text (step 2.4).

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Deterministic checks, Appendix C, market numbering | Open question 2 of the ADR: code, not model, scores | - |
