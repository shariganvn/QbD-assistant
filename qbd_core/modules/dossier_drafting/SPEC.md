# SPEC - dossier_drafting

## Purpose
Turn a validated intake request into a gap-flagged draft of the P.2 sections, with every value tied to evidence.

## Ubiquitous nouns owned
IntakeRequest, DraftSection, GapEntry

## API contract (api.py)
- `validate_intake(raw) -> IntakeResult`: raises `IntakeRejected` carrying every issue found. Codes:
  `E_FIELD_MISSING`, `E_FIELD_TYPE`, `E_FIELD_UNKNOWN`, `E_SUBSTANCE_COUNT` (more than 3),
  `E_SUBSTANCE_DUPLICATE`, `E_FORM_UNKNOWN`, `E_MARKET_UNKNOWN`. A form is matched by id, number or name;
  a market by `eu`, `domestic`/`trong nước`, `both`/`cả hai`. Two or more substances set
  `COMBINATION_OUT_OF_SOP`.
- `groups()`, `section_map()`: read-only configuration (38 forms in groups N1-N9, CQA candidates per
  group, CTD/ACTD numbering from the SOP appendix).
- `assemble_draft(intake, knowledge, today) -> DraftRun`: builds a `draft.json` that follows the Stage B
  contract of tools/pharma-dev-draft. Every leaf section of its outline is a gap with a marked reason,
  except the free-form sections listed in `SECTION_QUERIES`, which become `covered` only when
  `knowledge.search` returns sentences; each such paragraph is the retrieved sentence verbatim plus
  `[nguồn: file, trang, id]`. No language model is used in this slice. A combination of substances raises
  `DraftingRefused("E_COMBINATION_NOT_SUPPORTED")`. The draft states what it lacks: strength and source
  file carry the gap marker, and `notApplicableSections` lists the second-strength sections. `DraftRun`
  also returns the evidence used, the gap register, and `contains_restricted` (true when any sentence
  comes from a document that is not class A, which means the draft file must not leave the machine).
- `propose_cqa(intake) -> CqaProposal`: candidate CQA of the dosage-form group (status
  `candidate_unconfirmed`), the digest of the input, and a blank confirmation template.
- `intake_digest(intake)`: hash of substances (case and order ignored), form id and market.
- `require_confirmation(intake, confirmation, today) -> ConfirmedCqa`: raises `CqaNotConfirmed` with
  `E_CQA_NOT_CONFIRMED` (none given), `E_CQA_WRONG_INPUT` (digest differs), `E_CQA_EMPTY`,
  `E_CQA_INVALID` (blank or duplicate name), `E_CQA_UNSIGNED` (no name, no date, or a date after today).
  CQA the person added beyond the proposal are reported in `added_by_person`.
- `load_confirmation(path)`: `None` for a missing or unreadable file.
- In `assemble_draft`, no confirmation leaves P.2.2.1.2.2 a gap (`cqa_status = "pending"`); a flawed one
  raises. Command line: `cqa-propose` writes the proposal; `run --cqa-confirmation` exits 5 on a flawed one.
- `group_gaps(group_id)`: `CẦN DỮ LIỆU` entries owed by a group without internal documents (N5-N9).

## Invariants
A value without a source is a gap, never a filled number. Dependent agents do not run before the CQA set is confirmed by a person.

## Data owned (models.py, config/)
`IntakeResult`, `IntakeIssue`; `config/dosage_forms.json`, `config/groups.json`, `config/ctd_actd_map.json`.
CQA lists are candidates (`candidate_unconfirmed`) until a person confirms them at gate 3.5.
The CTD/ACTD map is from the SOP appendix and is not yet checked against the Kho texts.

## Exposed to (file-share outside api.py)
None.

## Dependencies
None yet; other modules are called only through their api.py.

## Non-goals
Anything outside the purpose above. Verifying who a signer is (the gate checks the record, not the
identity). In this slice also: market-specific numbering (the outline is CTD;
the ACTD mapping is a later quality check), tables, risk matrices and figures, and any text a language
model writes.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Intake validation and configuration data | Input rules and the 38-form catalogue as data, not code | - |
| 2026-10-21 | Thin-slice assembler and `run` command | Three inputs to a valid, gap-flagged draft end to end | - |
| 2026-10-21 | CQA proposal and confirmation gate | Dependent sections wait for a person's confirmation bound to the input | - |
