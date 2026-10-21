# Agent status after P4.4 (generated from the registry, 2026-10-21)

| id | agent | status | why |
|---|---|---|---|
| 0.1 | Input Validator | implemented | dossier_drafting.validate_intake |
| 0.2 | Data Gap Register | implemented | dossier_drafting.assemble (gap register) |
| 0.3 | Report Assembler | partial | dossier_drafting.assemble_draft and rendering; no final self-check pass |
| 0.4 | Loop Controller | blocked | no model review loop exists (12.2 deferred), so there is nothing to control |
| 0.5 | Dosage Form Classifier | implemented | dossier_drafting.config (38 forms, groups N1-N9) |
| 0.6 | Knowledge Base Connector | implemented | evidence.KnowledgePort |
| 0.7 | Wave Scheduler and Merger | implemented | dossier_drafting.agents.schedule |
| 0.8 | Combination Planner | partial | combinations are refused (E_COMBINATION_NOT_SUPPORTED), not planned |
| 1.4 | Active Identity Resolver | partial | substance name is taken as typed; no identity resolution or ambiguity stop |
| 1.1 | API Data Collector | partial | retrieval is done inside agent 4.1; no separate collector output |
| 1.2 | RMP Profiler | blocked | the reference-product profile needs its measured data (strengths, tests) |
| 1.3 | Experimental-Stability Data Intake | blocked | intake of experimental and stability files; no such files are given |
| 2.1 | CTD Mapper | implemented | quality_gate.numbering (CTD) |
| 2.2 | ACTD Mapper | partial | quality_gate.numbering (ACTD from the SOP, unchecked against Appendix I) |
| 2.3 | Dual-Market Reconciler | implemented | quality_gate.numbering (market: eu, domestic, both) |
| 3.1 | RMP Describer | blocked | needs strengths and measured reference-product data, not among the three inputs |
| 3.2 | QTPP Builder | implemented | dossier_drafting.agents.qtpp |
| 3.3 | CQA Builder | partial | candidates from propose_cqa; the person confirms at gate 3.5; no rationale |
| 3.4 | Dosage-Form CQA Library | partial | dossier_drafting.config.groups and propose_cqa (candidates) |
| 3.5 | CQA Confirmation Gate | implemented | dossier_drafting.cqa (confirmation gate) |
| 4.1 | API Properties | implemented | dossier_drafting.agents.api_properties |
| 4.2 | Excipient Selector | implemented | dossier_drafting.agents.excipients |
| 4.3 | Compatibility Studies | partial | dossier_drafting.agents.narrative: sourced literature only; the own compatibility study stays a gap |
| 4.4 | Initial Risk Assessment | blocked | risk levels are the team's judgement on confirmed CQA and experiments |
| 4.5 | API-API Interaction Assessor | blocked | combinations of substances are out of the SOP and refused at intake |
| 5.1 | Direct Compression Assessor | partial | absorbed into 5.3; no separate assessment without the team's data |
| 5.2 | Granulation Assessor | partial | absorbed into 5.3; no separate assessment without the team's data |
| 5.3 | Rationale Writer | partial | dossier_drafting.agents.narrative: sourced literature only; the own compression/granulation assessment stays a gap |
| 6.1a | Formulation Risk Assessment (initial) | blocked | risk levels are the team's judgement on confirmed CQA and experiments |
| 6.2 | Formulation Studies | blocked | needs the team's own experimental data, which is not among the three inputs |
| 6.3 | Overage Evaluator | partial | dossier_drafting.agents.narrative: sourced literature only; overage from the own data stays a gap |
| 6.1b | Formulation Risk Assessment (updated) | blocked | risk levels are the team's judgement on confirmed CQA and experiments |
| 6.4 | Final Formula and Roles | blocked | final formula needs strengths and the team's formulation results |
| 6.5 | Multi-strength Strategy | blocked | needs the final formula and the strengths |
| 7.1 | BCS and ICH M9 Eligibility | partial | BCS statements come from agent 4.1 (P.2.1.1.2); no separate verdict |
| 7.2 | Excipient-vs-RMP Check | blocked | compares excipients with the reference product, which needs agent 3.1 data |
| 7.3 | Comparative Dissolution Gate | blocked | similarity calculation needs the team's dissolution data |
| 7.4 | Route: Miễn BE hoặc Kế hoạch BE | blocked | route decision needs dissolution data and the eligibility verdict |
| 8.1 | Dissolution Method Developer | partial | dossier_drafting.agents.narrative: sourced literature only; the own dissolution method and sink data stay gaps |
| 8.2 | Comparative Dissolution | blocked | comparative dissolution needs the team's dissolution data |
| 8.3 | Impurity Profile vs RMP | blocked | needs the team's own experimental data, which is not among the three inputs |
| 8.4 | Other Dosage Form Properties | blocked | needs the team's own experimental data, which is not among the three inputs |
| 8.5 | BE-Biowaiver Conclusion Writer | blocked | conclusion needs the route decision and the team's data |
| 9.1 | Process Risk and Environment Control | partial | dossier_drafting.agents.narrative: sourced literature only; environment and moisture data stay gaps; the risk table is blocked |
| 9.2 | Unit Operation Developer | partial | dossier_drafting.agents.narrative: sourced literature only; the own unit-operation results stay gaps |
| 9.3 | Scale-up | blocked | needs the team's own experimental data, which is not among the three inputs |
| 9.4 | CPP Proposer | blocked | risk levels are the team's judgement on confirmed CQA and experiments |
| 9.5 | Advanced QbD Module | blocked | optional module that needs a decision of the project owner |
| 10.1 | Container Closure | blocked | container-closure choice needs the final formula and stability data |
| 10.2 | Microbiological Attributes | blocked | needs the team's own experimental data, which is not among the three inputs |
| 10.3 | Compatibility | partial | dossier_drafting.agents.narrative: sourced literature only; the own compatibility tests stay gaps |
| 11.1 | Stability Link | blocked | links stability, overage and container sections that are still gaps |
| 11.2 | Process Link | blocked | links process sections that are still gaps |
| 11.3 | Control Strategy Link | blocked | links control-strategy sections that are still gaps |
| 11.4 | Interchangeability Link | blocked | links the route decision and the BE conclusion, which are still gaps |
| 12.1 | Self-check Phụ lục C | implemented | quality_gate.checklist (Appendix C) |
| 12.2 | QA/QC Reviewer | blocked | a model review would send the draft text out; the code checks 12.1, 12.3, 12.4 stay |
| 12.3 | Consistency Checker | implemented | quality_gate.consistency |
| 12.4 | Evidence Tracer | implemented | quality_gate.provenance |
