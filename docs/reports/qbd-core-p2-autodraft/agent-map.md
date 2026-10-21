# Agent map: PTDH kit v0.1 (draft)

Source: Notion kit 5 (draft, 2026-10-21, never run). 13 skills, 58 subagents (59 tasks after 6.1 split into 6.1a/6.1b). Data: `agent-map.json`. Target sections are my inference from the kit's own SOP references (kit gives no outline ids); `P.2.` prefix dropped below. Not read: SKILL.md pages, config, templates, other contracts.

## Cross-cutting (A0 services, 0.2 0.6 0.7; 0.3 final; 0.4 after wave 6)

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 0.2 | Data Gap Register | deterministic | 0.7 | - |
| 0.3 | Report Assembler | deterministic | 12.1,0.2,all waves | - |
| 0.4 | Loop Controller | deterministic | 12.1,12.2,12.3,12.4 | - |
| 0.6 | Knowledge Base Connector | deterministic | - | - |
| 0.7 | Wave Scheduler and Merger | deterministic | - | - |

## Wave 0

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 0.1 | Input Validator | deterministic / NGOAI SOP | - | - |
| 0.5 | Dosage Form Classifier | deterministic | 0.1 | - |
| 0.8 | Combination Planner | deterministic / NGOAI SOP | 0.1,1.4 | - |
| 1.4 | Active Identity Resolver | llm | 0.1 | - |

## Wave 1

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 1.1 | API Data Collector | llm | 1.4 | - |
| 1.2 | RMP Profiler | llm | 1.4 | - |
| 1.3 | Experimental-Stability Data Intake | deterministic | 1.4 | - |
| 2.1 | CTD Mapper | deterministic | 0.1 | - |
| 2.2 | ACTD Mapper | deterministic | 0.1 | - |
| 2.3 | Dual-Market Reconciler | deterministic | 2.1,2.2 | - |
| 10.3 | Compatibility | llm | 0.5,1.3 | 6 |

## Wave 2

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 3.1 | RMP Describer | llm | 1.2 | 2.1.1 |
| 3.2 | QTPP Builder | llm | 3.1,0.5 | 2.1.2.1 |
| 3.3 | CQA Builder | llm | 3.2,3.4 | 2.1.2.2 |
| 3.4 | Dosage-Form CQA Library | deterministic | 0.5 | - |
| 4.1 | API Properties | llm | 1.1 | 1.1.1,1.1.2 |
| 4.2 | Excipient Selector | llm | 3.2,4.1 | 1.2.1,1.2.3 |
| 4.3 | Compatibility Studies | llm | 4.2,1.3 | 1.2.2 |
| 4.5 | API-API Interaction Assessor | llm / NGOAI SOP | 4.1 | - |
| 5.1 | Direct Compression Assessor | llm | 4.1,3.2 | - |
| 5.2 | Granulation Assessor | llm | 4.1,3.2 | - |
| 5.3 | Rationale Writer | llm | 5.1,5.2 | 2.1.3.1 |

## Wave gate (after 3.3)

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 3.5 | CQA Confirmation Gate | human / NGOAI SOP | 3.3 | 2.1.2.2 |

## Wave 3

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 4.4 | Initial Risk Assessment | llm | 3.3,4.1,4.3 | 1.1.3 |
| 6.1a | Formulation Risk Assessment (initial) | llm | 4.4,5.3,3.5 | 2.1.3.2 |
| 6.2 | Formulation Studies | llm | 6.1a,4.2,4.3,1.3 | 2.1.3.3 |
| 6.3 | Overage Evaluator | llm | 6.2,1.3 | 2.2 |
| 6.1b | Formulation Risk Assessment (updated) | llm | 6.2,6.3 | 2.1.3.4 |
| 6.4 | Final Formula and Roles | llm | 6.1b,6.2,6.3 | 2.1.4 |
| 6.5 | Multi-strength Strategy | llm | 6.4 | - |

## Wave 4

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 7.1 | BCS and ICH M9 Eligibility | llm | 4.1 | - |
| 7.2 | Excipient-vs-RMP Check | llm | 4.2,3.1 | - |
| 7.3 | Comparative Dissolution Gate | deterministic | 1.3 | - |
| 8.1 | Dissolution Method Developer | llm | 4.1,3.5,1.3 | 2.3.1.1,2.3.1.2,2.3.1.3 |
| 8.2 | Comparative Dissolution | deterministic | 8.1,1.3 | 2.3.2 |
| 8.3 | Impurity Profile vs RMP | llm | 1.3,3.1 | 2.3.3.1 |
| 8.4 | Other Dosage Form Properties | llm | 3.1,3.2 | 2.3.4 |
| 9.1 | Process Risk and Environment Control | llm | 6.4,5.3,3.5,4.1 | 3.1,3.2.1,3.2.2 |
| 9.2 | Unit Operation Developer | llm | 9.1,6.4,5.3,1.3 | 3.2.3,3.2.4,3.2.5 |
| 9.3 | Scale-up | llm | 9.2,1.3 | 3.3 |
| 9.4 | CPP Proposer | llm | 9.1,9.2,9.3,3.5 | 3.4 |
| 9.5 | Advanced QbD Module | llm | 9.2,9.3,user decision | - |
| 10.1 | Container Closure | llm | 6.4,4.1,3.1,1.3 | 4.1,4.2 |
| 10.2 | Microbiological Attributes | llm | 0.5,6.4,1.3 | 5 |
| 11.1 | Stability Link | deterministic | 1.3,6.3,10.1 | - |

## Wave 5

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 7.4 | Route: Miễn BE hoặc Kế hoạch BE | llm | 7.1,7.2,7.3,8.2 | - |
| 8.5 | BE-Biowaiver Conclusion Writer | llm | 7.4,8.2,8.3 | - |
| 11.2 | Process Link | deterministic | 9.2,9.3,9.4 | - |
| 11.3 | Control Strategy Link | deterministic | 9.4,3.5,11.2 | - |
| 11.4 | Interchangeability Link | deterministic | 7.4,8.5,2.1,2.2 | - |

## Wave 6

| id | name | kind | depends_on | targets |
|---|---|---|---|---|
| 12.1 | Self-check Phụ lục C | deterministic | 12.3,12.4,2.1,2.2,A1-A11 outputs | - |
| 12.2 | QA/QC Reviewer | llm | 12.1,9.4,11.3,8.1,3.5 | - |
| 12.3 | Consistency Checker | deterministic | A1-A11 outputs | - |
| 12.4 | Evidence Tracer | deterministic | A1-A11 outputs | - |

## Deterministic, code first
0.1, 0.5, 0.6, 0.7, 0.2, 0.4 (A0 plumbing and config lookups); 3.4 (library extract); 1.3 (intake by supplementary-data-format); 2.1-2.3 (frame mapping from App.A); 7.3 / 8.2 (similarity calc from user data only); 11.1-11.4 (pointer text); 12.1, 12.3, 12.4 (checklist, consistency, trace; need structured source tags on every value); 0.3 (ordered merge). Others need an LLM.

## Human gates
3.5 (CQA, blocks wave 3+); A13 (R&D head, not automated); conditional stops: 1.4 ambiguity, 0.1 errors, 7.1 scope, 7.4 mismatch, 9.5 opt-in, 0.4 over max_review_loops, 0.8 combo without RMP. Pending R&D head: A5 refinement (5.1/5.2 after 4.1).

## Conflicts inside the kit or vs SOP
1. Status text: A6-A12 pages call their dependencies "proposed, awaiting approval"; the graph (2c-2e) says approved 21/10/2026.
2. 0.3 "runs checklist on the merged report" and "reuses 12.1", but 12.1 runs in wave 6 on A1-A11 outputs before 0.3 exists. Circular unless 12.1 gets a second pass on the merge.
3. Dependency lists omit declared inputs: 4.1 (needs 1.3), 4.4 (needs gate 3.5, still waits for it), 4.2 and 6.4 (transitive only), 10.3 (market from A2), 11.4 ("A2" is a skill, not an id).
4. 7.3 and 8.2 must share one similarity method yet 7.3 does not depend on 8.1/8.2; coupling is only policed afterwards by 12.3.
5. In-SOP scope differs: 0.5 says only immediate-release tablets are in SOP; 3.4 flags N2-N9; 5.3 and 9.2 flag outside N1,N2; 10.2 flags N5-N9. N2 is ambiguous.
6. 3.4 sources "SOP v01 method library" while 12.4 treats unconfirmed SOP v01 values as untraceable.
7. Wave table puts 1.4 and 0.8 in wave 0 under A1/A0 but lists wave 1 as "A1"; 1.4 needs ordering inside wave 0.
8. Parallel wave 4 contradicts chains: A9 (9.1-9.4) and 10.1 -> 11.1 are sequential, and A6 in wave 3 is a pure chain.
9. A4/A5 run before the CQA gate (accepted deviation); 4.4 and 8.1 must rerun if CQA changes.
10. "58 subagents" but 6.1 is two tasks (59).
11. Updated API risk (P.2.1.1.4) has no owner; no outline leaf for BE conclusion (6.5 of SOP, written by 7.4/8.5) or strength-specific leaves (6.5, 8.4).

## Open questions for project owner
- Which agent fills P.2.1.1.4 and the BE leaf?
- Is N2 in SOP scope?
- Should 0.3 trigger a final 12.1 pass?
- Is A12 rolling rerun after waves 1-5 in v1?
- How are per-active branches keyed in outputs?
- Defaults for concurrency, max_actives, max_review_loops (kit: 1) and where config lives (config page not read).
- Is 9.5 / Appendix D in v1?
