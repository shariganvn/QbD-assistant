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
Anything outside the purpose above.

## Spec history
| Date | Change | Rationale | PR |
|---|---|---|---|
| 2026-10-21 | Scaffold | Module boundary accepted in the ADR | - |
| 2026-10-21 | Intake validation and configuration data | Input rules and the 38-form catalogue as data, not code | - |
