# Blindspot handoff — Canonical FD direction for QbD P.2 pilot (2026-07-10)

## Session status

- **Phase:** Stage 0.1 discovery/refinement; chưa plan, chưa code.
- **Purpose:** consolidated handoff để session kế tiếp tiếp tục mà không phải phục dựng context.
- **Git history:** bypass theo yêu cầu; workspace không phải Git repository (`git status` trả `fatal: not a git repository`).
- **Code/test state:** chưa có application code hoặc tests; `package.json:2-15` chỉ khai báo document-scouting workspace và LiteParse dependency. Test verdict: **not applicable**.
- **Canonical business source:** `docs/raw/phanhoi_1783672588171.md` — phản hồi của Product Owner/phòng FD.
- **Important canonicality rule:** phản hồi FD là canonical cho **ý định nghiệp vụ, policy và acceptance expectation**; nó không biến nội dung nhiễm/placeholder trong các DOCX thành product facts đúng.

## TL;DR

FD đã chốt pilot P.2 cho bisoprolol 5/10 mg, literature-only drafting, claim-level review UI, citation số + footnote + clickable link, corpus nội bộ có kiểm soát và không cho external service lưu tài liệu. Tuy nhiên chưa thể vào plan vì “thấy tất cả thông tin” mâu thuẫn với việc để trống lab data, “giống hồ sơ FDA 90%” chưa đo được, final approver chưa có, data-retention policy chưa operational, và source/golden artifacts đều bị placeholder hoặc cross-drug contamination.

Session kế tiếp nên chạy **`ck:brainstorm` refinement**, không chạy `ck:plan`, cho đến khi các P0 gates trong report này được chốt.

## Source precedence and authority

| Priority | Artifact | Authority | Không được suy diễn |
|---|---|---|---|
| 1 | `docs/raw/phanhoi_1783672588171.md` | Canonical business direction từ PO/FD | Không tự diễn giải câu trả lời mơ hồ thành acceptance/test chi tiết |
| 2 | `docs/raw/P 2_form_Edit 29-09-2025-example.docx` | Candidate authoritative taxonomy/layout P.2 VN | Không dùng prose, values hoặc conclusions làm product truth nếu chưa phân loại/xác nhận |
| 3 | `docs/raw/135-00-Pharmaceutical Development-example.docx` | English CTD/QbD scaffold và reference về độ sâu/kiểu lập luận | Không coi là golden factual answer sạch; không ingest làm product evidence |
| 4 | `docs/raw/Quality-by-Design-for-ANDAs.pdf` | QbD methodology/mock example | Không transfer Acetriptan 20 mg facts sang bisoprolol/Concor |
| 5 | Report này | Canonical session handoff, tổng hợp evidence + trạng thái quyết định | Không thay FD trả lời open questions |
| 6 | Hai report cũ trong `plans/reports/` | Historical context | Không dùng stale Hermes prompt hoặc trạng thái “design đã hội tụ” |

Evidence: FD response lines 19-88; brainstorm lines 5,17-30,32-45,96-117; old blindspot lines 53-68,92-113; LiteParse findings recorded below.

## Canonical FD responses — decision ledger

### CONFIRMED — business decisions

1. **Pilot scope:** chỉ P.2, một thuốc mẫu bisoprolol 5/10 mg viên nén bao phim, output là draft để người duyệt sửa — evidence: `docs/raw/phanhoi_1783672588171.md:19-25`.
2. **All-section visibility expectation:** demo phải cho FD “thấy tất cả thông tin” — evidence: canonical response lines 24-25. Meaning vẫn cần refine vì xung đột với lab boundary.
3. **Internal corpus exists:** shared folder chứa Word/PDF, trưởng phòng FD kiểm soát quyền xem — evidence: lines 27-33.
4. **Consent before use:** máy phải hỏi ý kiến FD; chỉ dùng tài liệu khi FD đồng ý — evidence: lines 34-35.
5. **Scans exist and can be degraded:** có scan/ảnh cũ, đôi khi khó đọc — evidence: lines 37-38.
6. **Literature/lab boundary:** agent được tra cứu/tổng hợp public information; phần cần dữ liệu thí nghiệm thực tế để trống/chờ FD, không bịa — evidence: lines 41-47.
7. **Review UX:** FD chọn màn hình claim-level với `Đồng ý / Sửa / Bỏ` và evidence bên cạnh — evidence: lines 56-62.
8. **Citation presentation:** đánh số, footnote, clickable link — evidence: lines 65-71.
9. **Preferred evidence sources:** pharmacopoeia, FDA/EMA labels, public assessment reports, peer-reviewed journals Q1-Q3; nguồn khác chỉ được cân nhắc khi có đường dẫn truy xuất — evidence: lines 70-71. Đây là preference, chưa phải whitelist operational.
10. **Data boundary:** tài liệu cần kiểm soát nội bộ; nếu gửi external service thì dịch vụ không được lưu lại — evidence: lines 73-76.
11. **New domain requirement:** phải xét tình trạng lưu hành của thuốc đối chứng — evidence: lines 80-85.
12. **New quality concern:** dữ liệu thử nghiệm thường có vấn đề về tính logic; hệ thống cần hỗ trợ phát hiện/đánh giá, nhưng phạm vi chưa chốt — evidence: lines 87-88.

### CONFIRMED — prior technical direction

1. **No Hermes:** loại Hermes khỏi baseline; dùng self-built Python pipeline — evidence: `plans/reports/blindspot-260709-hermes-first-hexagon-qbd.md:101-108`.
2. **Python and decoupling remain hard constraints:** provider/runtime/search/evidence/rendering cần tách rời, output tiếng Việt, document reading qua LiteParse — evidence: brainstorm lines 22-27,32-45.
3. **Human-in-the-loop, never autonomous finalization:** draft only; claim cannot be final without review — evidence: brainstorm lines 37-43,88-94; canonical response lines 56-63.
4. **Priority vertical slice concept:** search/retrieve → evidence store → audit trace trước khi deterministic DOCX fill — evidence: brainstorm lines 29-30,74-80,96-100.
5. **Grounding principle:** không evidence thì không viết claim — evidence: brainstorm lines 78-80,88-94; canonical response lines 65-71.

### CANDIDATE — ideas retained but not locked

1. `qbd_core` standalone với ports/adapters — evidence: brainstorm lines 36,49-53,57-68.
2. Python deterministic DAG/pipeline over P.2 fields; no agent framework until complexity proves necessary — evidence: old blindspot lines 101-108.
3. `EvidenceStorePort`, `SearchPort`, `LLMPort`, `DocRenderPort`, and a product/knowledge store as conceptual boundaries — evidence: brainstorm lines 57-68.
4. SQLite for pilot, possible Postgres later — evidence: brainstorm lines 82-86,110-116; old blindspot line 109. Do not choose migration/vector stack before corpus shape is known.
5. Tavily/CSE/Serper as search adapter candidates — evidence: brainstorm lines 27,45,63-64,116; old blindspot line 107. **No provider is yet proven citation-grade or compliant with FD retention policy.**
6. LiteLLM as provider-swapping library candidate — evidence: old blindspot line 108. Security/retention depends on downstream provider, not LiteLLM alone.
7. Deterministic DOCX rendering and claim/evidence IDs — evidence: brainstorm lines 67,79-80.
8. UX ladder idea (CLI/HTML audit report → review UI → production web) is historical; canonical FD selection makes claim-level review UI a pilot requirement, while concrete framework remains open — evidence: old blindspot line 111; canonical response lines 56-62.

## Verified source-document findings

### VN target form is structure authority, not product truth

- Full taxonomy spans P.2.1-P.2.7; key branches include P.2.2.1 drug substance, P.2.2.2 excipients, P.2.3.1 formulation development, dissolution, manufacturing process, packaging, microbiology and compatibility — evidence: `docs/raw/P 2_form_Edit 29-09-2025-example.docx`, LiteParse extract `/tmp/module3-p2-example.txt:2-4,60-68,156-208,297-314,728-1000,1033-1274`.
- File is a hybrid template/example: blank identity fields, placeholders and filled experimental blocks coexist — evidence: extract lines 22-27,72-110,123-133,195-206,337-355,505-697,1037-1174.
- Cross-product contamination is proven: progestin narrative, galantamine text and bisoprolol/Concor tables coexist — evidence: extract lines 166-181,302-309,918-998.
- Text extraction corrupts Vietnamese numbering/labels, repeats headers and flattens charts; text-only parse cannot prove DOCX rendering fidelity — evidence: extract lines 156-208,404-430,882-1003,1146.
- The form has inline standards/references but no clean standalone bibliography in extracted text; citation completeness/format must be designed explicitly — evidence: extract lines 190-193,730-788,1250-1256.

### 135-00 is an incomplete scaffold, not clean golden truth

- Document anonymizes INN as `API fumarate` and moves between 5 mg, 5/10 mg and 2.5/5/10 mg — evidence: `docs/raw/135-00-Pharmaceutical Development-example.docx`, LiteParse extract lines 5,202-205,394-409,443-458,1361-1364.
- It expects public literature plus internal DB/DMF/CoA/RMP/batch evidence, but many proprietary cells are empty — evidence: extract lines 233-291,332-365,394-435,856-979,1038-1053.
- Blank DSC/result tables precede a conclusion that all excipients are compatible; empty trial tables coexist with all-low updated risks — evidence: extract lines 348-370,887-1015.
- Cross-drug residue `% amlodipine dissolved` appears — evidence: extract line 1225.
- Therefore it may inform structure and QbD reasoning style, but must not be ingested as trusted product evidence or used as an unquestioned answer key.

### FDA QbD PDF is methodology-only

- It explicitly presents an illustrative/mock Acetriptan Tablets 20 mg example, not the target product — evidence: `docs/raw/Quality-by-Design-for-ANDAs.pdf`, LiteParse extract lines 7-18,116-129,400-429,1630-1632.
- Valid methodological concepts include QTPP→CQA, iterative risk assessment, DoE, CMA/CPP discovery and lifecycle control strategy — evidence: extract lines 139-143,373-398,1606-1628,2544-2550,5302-5314.
- Its worked numerical facts/formula/ranges cannot populate a Concor/bisoprolol dossier.

## Resolved contradictions from earlier reports

1. **“No internal corpus” is superseded:** FD confirms a shared Word/PDF corpus exists, but availability, authorization granularity and actual contents are still unresolved — evidence: old blindspot line 31 versus canonical response lines 27-38.
2. **Target product ambiguity is resolved at business-intent level:** FD accepts bisoprolol 5/10 mg scope; product facts still require an authoritative product profile, not inference from contaminated examples — evidence: canonical response lines 19-25; 135 extract lines 202-205.
3. **Literature/lab principle is resolved:** agent drafts literature-grounded content and leaves experiment-derived content for FD — evidence: canonical response lines 41-47. Per-subsection mapping remains open.
4. **Review UX is no longer open:** option (b) was selected — evidence: canonical response lines 56-62. The template footer saying UI remains unresolved is stale (`phanhoi...md:91-95`).
5. **Hermes questions are obsolete:** the old blindspot prompt still asks for a Hermes spike, but the same file later removes Hermes — evidence: old blindspot lines 53-68,92-108.
6. **“Design đã hội tụ” is invalid:** canonical response adds security, approval, market-status and trial-logic requirements, while acceptance remains ambiguous — evidence: brainstorm line 5 versus canonical response lines 49-88.
7. **135-00 is not the acceptance target stated by FD:** the question references 135-00, but FD answers “giống hồ sơ của FDA 90%”; this may mean the FDA PDF or a broader concept and must be clarified — evidence: canonical response lines 49-54.

## Requirement impacts inferred from canonical decisions

These are requirement consequences, not final design choices:

1. **Consent is part of the product flow:** ingestion/retrieval cannot silently use internal files; the system needs a recorded authorization boundary approved by FD — evidence: canonical response lines 31-35.
2. **Missing lab data needs explicit state:** sections must distinguish `drafted from evidence`, `awaiting FD/lab data`, `not applicable`, `insufficient evidence`, and `reviewed`; silently blank text cannot satisfy “see all information” — evidence: lines 24-25,41-47,56-62.
3. **Evidence lifecycle needs verification/rejection:** degraded OCR and contaminated templates can produce traceable but wrong claims; append-only storage alone is insufficient — evidence: lines 37-38; target DOCX extract lines 156-208; brainstorm lines 66,72,78.
4. **Reference-product status is time-sensitive evidence:** store jurisdiction, source and `as_of/retrieved_at`, and revalidate it rather than treating it as a timeless fact — evidence: canonical response lines 84-85.
5. **Trial-logic checking must remain advisory until rules are approved:** the agent must not invent experiment results or overrule FD — evidence: lines 41-47,87-88.
6. **Clickable citation is presentation, not durable provenance:** URL alone is insufficient if content changes/disappears; audit definition must decide what source snapshot/quote/metadata is retained — evidence: lines 68-71; brainstorm lines 63-64,85,107.
7. **External processing needs a pass/fail compliance gate:** “provider says no training” is not automatically “no retention”; retention/logging/subprocessors/data region need evidence — evidence: canonical response lines 73-76.

## Unknown unknowns

- **Meaning of “all information”:** all P.2 headings visible, or every field populated? The latter contradicts accepted lab-data boundary — evidence: canonical response lines 24-25,41-47.
- **Meaning of “FDA 90%”:** unclear target document and metric; PDF is a different mock drug — evidence: canonical response lines 49-54; QbD PDF extract lines 7-18,116-129.
- **Final accountability:** final reviewer/signer is unanswered — evidence: canonical response lines 59-64.
- **Consent granularity:** approval per document, ingestion batch, pipeline run or project? Can derived chunks/indexes persist after consent? — evidence: lines 31-35.
- **Corpus readiness:** exact shared-folder files, delivery date, access mechanism, classification and representative sample are absent — evidence: lines 27-38,91-93.
- **Security semantics:** “external service must not retain” lacks contractual/technical verification criteria — evidence: lines 73-76.
- **Source whitelist:** “any source with a link” can conflict with regulated evidence quality; journal quartile year/current basis is undefined — evidence: lines 65-71.
- **Scientific-logic scope:** consistency checking versus scientific validity review are materially different features — evidence: lines 87-88.
- **Regulatory source of truth:** workspace contains no authoritative current Vietnamese regulatory checklist/version for P.2 — evidence: workspace inventory and `package.json:2-15`.
- **Evaluation ground truth:** both candidate examples are contaminated/incomplete; no clean expected-claim set or adjudicated evidence set exists — evidence: target extract lines 166-181,302-309,918-998; 135 extract lines 348-370,887-1015,1225.
- **Audit-ready semantics:** run identity, source snapshot, prompt/model/search version, transformation lineage, reviewer state and correction lineage are not defined — evidence: brainstorm lines 72,78,84-86,98.
- **Provider interchangeability:** swapping providers does not guarantee behavior/evidence equivalence; no contract test exists because there is no application code — evidence: brainstorm lines 62-68,100; `package.json:2-15`.

## Potholes

1. **Circular evaluation/leakage:** using 135-00 or FDA mock as both retrieval context and evaluation target rewards template reproduction — evidence: brainstorm lines 20,101,115; 135 extract lines 15-19; FDA extract lines 122-129.
2. **Wrong-drug claims with valid-looking citations:** contaminated examples can yield plausible prose about progestin, galantamine, amlodipine or Acetriptan — evidence: target extract lines 166-181,302-309; 135 extract line 1225; FDA extract lines 116-129.
3. **“90%” becomes vanity metric:** without a denominator/rubric it can be declared passed without demonstrating factual correctness — evidence: canonical response lines 49-54.
4. **Link equals trust:** a retrievable URL does not prove source authority, quote fidelity or claim entailment — evidence: canonical response lines 68-71.
5. **Audit theater:** append-only records can permanently preserve OCR errors or bad evidence unless rejection/correction lineage exists — evidence: brainstorm lines 66,72,78; canonical response lines 37-38.
6. **Privacy theater:** provider marketing claims can be mistaken for enforceable zero retention — evidence: canonical response lines 73-76.
7. **Silent scope expansion:** “evaluate trial logic” may expand from consistency checks into scientific validation without data/rules/expert accountability — evidence: lines 87-88.
8. **Premature stack lock:** Tavily, LiteLLM, SQLite, vector DB or UI framework can be chosen before source, retention, evaluation and corpus gates are defined — evidence: brainstorm lines 57-86,110-117; canonical response lines 27-76.
9. **Rendering mistaken for generation:** correct grounded text does not guarantee preservation of tables, charts, numbering and page layout in the target DOCX — evidence: target extract lines 404-430,882-1003,1146.

## Open questions — prioritized for next session

### P0 — blocking before `ck:plan`

1. “Thấy tất cả thông tin” nghĩa là full P.2 coverage with explicit missing-data states, hay mọi field phải có content?
2. “Giống hồ sơ FDA 90%” nói tới artifact nào và 90% được tính bằng rubric nào?
3. Ai là final approver/signer? Có bao nhiêu review gates và ai được sửa/approve/reject?
4. Approval sử dụng tài liệu nội bộ được cấp ở mức nào? Có được lưu parsed text/chunk/index/quote sau run không?
5. External processing phải chứng minh zero retention bằng tiêu chí nào? Nếu provider không pass thì local-only có phải hard fallback không?
6. Bộ corpus pilot cụ thể nào sẽ được cấp, khi nào, và đâu là authoritative product profile cho bisoprolol 5/10 mg?
7. Regulatory reference/version nào là canonical cho taxonomy và submission expectation P.2 VN?

### P1 — resolve during refinement/spikes

1. Per-subsection P.2 matrix: literature-derived / internal-data-required / lab-required / not-applicable.
2. Source whitelist/denylist và trust tiers; cách xử lý Q1-Q3, preprints, manufacturer pages, aggregators và paywalled sources.
3. Citation unit: claim/câu/ô bảng/đoạn; metadata tối thiểu ngoài number + footnote + link.
4. Audit-ready pass/fail: source snapshot, lineage, run config, correction/rejection and reviewer sign-off.
5. Search-provider spike: exact quote, stable source, full metadata, source snapshot rights, latency/cost and retention compliance.
6. Trial-logic scope: mechanical consistency checks hay scientific validity; rulebook nào và ai approves findings?
7. Reference-product market-status policy: jurisdiction, official source, freshness interval and behavior when discontinued/unavailable.
8. Evaluation design without leakage: clean fact set, adjudicated citations, template fidelity and human-review effort.

### P2 — explicitly defer

1. Postgres/vector-store choice and migration path.
2. Multi-product platform and full Module 3 English scope.
3. LangGraph/CrewAI or autonomous agent framework.
4. Production Next.js UI and enterprise deployment topology.
5. Automated final approval/signature; pilot remains human-controlled draft.

## Non-goals for pilot

- Không tạo hoặc suy diễn lab/experimental data.
- Không dùng mock/example values làm target-product facts.
- Không tự final hồ sơ hoặc thay trách nhiệm chuyên môn của FD.
- Không ingest internal corpus khi chưa có recorded FD approval.
- Không mặc định gửi internal documents tới external providers.
- Không chứng minh provider swappability bằng interface-only; behavior equivalence để sau contract tests.
- Không mở rộng ra full Module 3, multiple drugs hoặc production web platform.

## Recommended next-session pickup

1. Đọc report này trước; sau đó đọc `docs/raw/phanhoi_1783672588171.md:19-88`.
2. Không đọc lại toàn bộ DOCX/PDF; dùng LiteParse temp extracts/targeted search khi cần evidence cụ thể.
3. Chạy `ck:brainstorm` với A Better Prompt bên dưới.
4. Tạo decision ledger `CONFIRMED / ASSUMED / NEEDS FD / NEEDS SPIKE` và authority matrix.
5. Chốt P0 gates hoặc soạn một follow-up questionnaire cực ngắn cho FD.
6. Chỉ handoff sang `ck:plan` khi “FDA 90%”, data permission/retention, final approver, corpus pilot và regulatory source đã operational.

## A Better Prompt

```text
Use ck:brainstorm to refine — do not plan or code yet — the canonical direction for
the Vietnamese QbD P.2 pilot.

Canonical business source:
`docs/raw/phanhoi_1783672588171.md` (PO/FD response). Treat it as authoritative for
business intent and policy, but not as proof that example-document facts are correct.

Confirmed baseline:
- Pilot = P.2 draft for bisoprolol 5/10 mg film-coated tablets, one product.
- FD wants visibility across all information/sections, but accepts that lab-derived
  content remains empty or explicitly awaits FD data; the agent must never invent it.
- Internal Word/PDF corpus exists in a shared folder controlled by the FD head.
  The system must request approval before using internal documents.
- Review UX = claim-level Accept/Edit/Reject with evidence beside each claim.
- Citation = numbered reference + footnote + clickable link.
- Preferred sources = pharmacopoeias, FDA/EMA labels, public assessment reports,
  peer-reviewed Q1-Q3 journals; other linked sources need an explicit trust policy.
- Internal documents are controlled; external services may process them only if
  non-retention is demonstrably satisfied.
- New domain needs: reference-product market status and trial-data logic checking.
- Hermes is removed; self-built Python pipeline remains the technical direction.

Verified artifact constraints:
- VN target DOCX provides P.2.1-P.2.7 structure but mixes placeholders with progestin,
  galantamine and bisoprolol/Concor content. Structure candidate only, not product truth.
- 135-00 is an incomplete anonymized CTD/QbD scaffold with empty evidence, prewritten
  conclusions and an amlodipine residue. Do not ingest as trusted evidence or treat as
  a clean golden answer.
- FDA QbD PDF is an illustrative Acetriptan 20 mg mock. Use methodology only; never
  transfer its product data.

Required brainstorm output:
1. Decision ledger: CONFIRMED / ASSUMED / NEEDS FD / NEEDS SPIKE.
2. Artifact authority matrix: structure / methodology / product evidence /
   evaluation-only / prohibited-for-ingest.
3. Per-subsection P.2 scope matrix: literature-derived / internal-data-required /
   lab-required / not-applicable, including visible missing-data states.
4. Two or three measurable interpretations of “similar to FDA dossier by 90%”, with
   trade-offs and a recommended leakage-free evaluation rubric.
5. Operational options for per-use FD consent and internal-corpus retention.
6. Operational options for external-service zero-retention compliance, including a
   local-only fallback.
7. Source trust policy and minimum citation/provenance requirements.
8. Bounded interpretations of trial-logic checking: consistency versus scientific
   validity, with human accountability explicit.
9. Reference-product market-status requirements including jurisdiction and freshness.
10. Ranked P0/P1 questions, non-goals, recommended direction, and a clean ck:plan
    prompt only if all blocking gates are resolved.

Do not lock Tavily, LiteLLM, vector DB, UI framework or schema without evidence.
Do not write an implementation plan. Cite every finding with file:line or source
document + extract line; label unsupported statements as assumptions.
```

## Handoff verdict

- **Ready for:** `ck:brainstorm` refinement and short FD follow-up.
- **Not ready for:** `ck:plan` or coding.
- **Primary blockers:** measurable acceptance (“FDA 90%”), internal-data consent/retention, external zero-retention compliance, final approver, pilot corpus availability, authoritative VN regulatory reference.
- **Session-closer fallback note:** full KBGMP closeout workflow was not applicable because this workspace is not a Git repo and lacks its workflow-state/test scripts. No commits, workflow ledgers or generated state files were created; this self-contained report is the handoff artifact requested by the user.
