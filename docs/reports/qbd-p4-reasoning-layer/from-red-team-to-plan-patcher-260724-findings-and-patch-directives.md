# Red-Team Review — qbd-p4-reasoning-layer — Findings & Patch Directives

Date: 2026-07-24 | Target: `docs/plans/qbd-p4-reasoning-layer/` (plan.md, gates.yaml, step-01..05)
Reviewers: 3 hostile lenses (Security Adversary + Fact Checker; Failure Mode Analyst + Flow Tracer;
Assumption Destroyer + Scope Auditor). Raw findings 26 → deduped 15. All evidence-backed (file:line),
zero rejected at evidence filter. Fact-check tally: 22 claims / 20 verified / 1 failed / 1 unverified.

**Disposition (user-approved 2026-07-24):** Accept all 15. F8, F9 in reduced form.
**User product decisions:**

- **PD-1 (F2):** Real `selection-rubric-approved.json` is **deferred** — this workstream ships schema +
  proposal only; gates test against a fixture rubric. Real approved file commits only when FD signs,
  with SHA-256 pinned by a human commit. Absent signature → recorded deferred (owner: FD; reopen:
  FD signature), never blocks Steps 3-5.
- **PD-2 (F13):** Run products (fact-cards, cohort, decision json/md, evidence log) publish to
  **`docs/reports/qbd-p4-reasoning-layer/decision/`**, git-retained.

**Patcher contract:** apply every directive below to the named plan files; do NOT touch code, Layer A/C,
or the 5 settled Validation-Session-1 decisions (agent-produces/module-validates fact cards; SKILL.md
full rewrite; P3-schema gates.yaml with per-gate commands; rubric under `cowork-p2-kit/rubric/`;
uniform nonzero exit + `E_` code). After patching: append `## Red Team Review` section to plan.md
(template at end) and run the Whole-Plan Consistency Sweep.

---

## Critical

### F1 — Fact-card binding insufficient: value and candidate not bound to evidence
Sources: all 3 reviewers independently (strongest convergence).
Evidence: `store/records.schema.json:6` (no candidate/strength field; required keys only
`id, source_type, content, provenance, confidence, extraction_status, classification`);
13/17 records have no `F-0x` token in `content` (jq-verified) — formulation identity exists only via
`provenance.file` = `inputs/trials/formulation-trial-0{1,2,3}.docx`; live cross-record collision:
F-01 AV `6.8` (records.jsonl:5) also appears inside F-02 observations record `410e4766ea4b9e01`
(records.jsonl:11, "11.2 vs 6.8"); `"72 N"` occurs in 2 records; record `d415da715d35741b`
(trial-03 Results) holds 72 N / 96.8% / AV 5.4 with no F-code and no strength token.
Flaw: quote-substring-of-content checks the quote, not the value, and binds card→record, never
record→candidate. Forged/mislabeled cards pass every declared assertion; 10 mg data enters the 5 mg
ranking; G-P4-02's headline exclusion is bypassed without touching F-03's overview record.
**Patch:**
- plan.md assumption 6 + step-01: fact-card contract adds: (a) `candidate` field, validated against a
  committed schema-checked `provenance.file → candidate` map (part of cohort artifact); a numeric
  measure card may only cite a record whose provenance file matches its candidate; (b) card's literal
  value+unit token must appear inside the quote string; (c) quote carries `char_start`/`char_end` and
  `content.slice(start,end) === quote`; (d) minimum quote length.
- gates.yaml G-P4-01 assertion 5: extend with (a)-(d).
- gates.yaml G-P4-02: new assertions + fixtures: candidate-mismatch card (fixture:
  `d415da715d35741b` misattributed to F-01) → named `E_` rejection; adversarial card asserting a
  value/strength absent from its quote (e.g. strength "5 mg" quoting "Trial Overview" from F-03
  record) → named `E_` rejection.
- step-02: state the map is the deterministic cohort-identity source, not agent assertion.

### F2 — FD approval and linear attestation self-attestable; no acquisition/deferral path
Sources: Security Adversary + Assumption Destroyer.
Evidence: gates.yaml:51 (approval = field presence `version, approver, date` only); step-03:8-12;
plan.md:73 promises "FD-approved version" as deliverable while plan.md:127 says rubric is FD-owned
(human); no step acquires approval; `rubric/` is an ordinary agent-writable dir; contrast
`scoring-90-100.md:20-23` where approval is an explicitly unresolved human step.
Flaw: agent can copy proposal → approved.json with fabricated fields; every gate passes; forged
approval indistinguishable post-hoc. Or FD unavailable → Steps 3-5 deadlock with no deferral state
(violates RULE-BRAINSTORM-PLAN §10).
**Patch (per PD-1):**
- plan.md touchpoint (:73): deliverable = `selection-rubric.schema.json` + `selection-rubric-proposal.json`;
  approved version explicitly deferred (owner FD, reopen condition = FD signature + human-committed
  SHA-256 pin).
- gates.yaml G-P4-03 fixture: replace approved-file fixture with
  `reasoning/tests/fixtures/rubric/selection-rubric-test-approved.json` (clearly named test-only).
- gates.yaml G-P4-03 new assertions: a real approved rubric is accepted only when its SHA-256 matches
  a human-committed pin (pin location: gates.yaml field or step-close evidence); unpinned/missing →
  `inconclusive`; `formula-decision.json` embeds the applied rubric's SHA-256.
- Same authenticity mechanism for the FD linear attestation (hash-pinned; see F6 for its schema).
- plan.md assumption 2: extend with the deferred state and pin mechanism.

### F3 — Published artifacts never re-validated; validator bypassable by direct write
Source: Security Adversary.
Evidence: gates.yaml:72 (G-P4-04 command = test file over fixtures, not live outputs); gates.yaml:94-99
(G-P4-05 validates gate evidence + e2e fixture only; MD/JSON check = mutual agreement, satisfied by
forged-in-agreement pair); precedent for receipts: `render/tests/verify-render.mjs:18,27-30` +
`gate-evidence-validator.mjs` (exact-key + SHA-256 enforcement exists for gate evidence but nothing
analogous for decision artifacts).
Flaw: agent with filesystem write skips cli.mjs, writes winner JSON + matching MD; verify:reasoning
stays green. SKILL.md prose cannot constrain an LLM with write access.
**Patch:**
- gates.yaml G-P4-05 new assertions: verify:reasoning re-runs cli.mjs validation over the actual
  published artifacts in `docs/reports/qbd-p4-reasoning-layer/decision/` against the live store
  (quote containment, admissibility, candidate map, rubric hash); publication emits a validation
  receipt (artifact SHA-256 set + run ID) checked by the runner; missing receipt or hash mismatch →
  fail closed.
- step-05: add the re-validation + receipt check to its text.

### F4 — No producer exists for per-gate evidence artifacts; G-P4-05 self-referential
Source: Failure Mode Analyst (line-by-line trace of P3 harness).
Evidence: `render/tests/run-gate.mjs:11` (gate-ID regex hardcoded `^G-P3-0[1-5]$`), `:88` (evidence
path hardcoded to qbd-p3), `:90` (sole evidence writer), `:10-14` (single testPath, but G-P4-01
command lists two test files); P3 evidence files all share one suite UUID — per-gate evidence was
only ever written by suite runs; `verify-render-evidence.mjs:6,12-14` (fixed gate list; errors on
missing evidence → chicken-and-egg if G-P4-05 includes itself); gates.yaml G-P4-05 names no test
file for e2e/consistency assertions and nothing writes `G-P4-05.json`.
Flaw: bare `node --test` writes no evidence → steps 1-4 formally unclosable (plan.md:96-98) or
evidence gets hand-authored (RULE §13 violation).
**Patch:**
- step-01: add deliverable — parameterized `cowork-p2-kit/reasoning/tests/run-gate.mjs` (gate-ID
  pattern `^G-P4-0[1-5]$`, evidence dir `docs/reports/qbd-p4-reasoning-layer/gates/`, multi-testPath
  support) with its own contract test.
- gates.yaml: every G-P4-01..04 command invokes the wrapper (wrapper + gate-id + test file(s)).
- gates.yaml G-P4-05: name `reasoning/tests/e2e-decision.test.mjs` as the owned test file for the
  e2e 5 mg fixture and MD/JSON consistency assertions; it runs through the wrapper so `G-P4-05.json`
  is machine-produced; suite validator then checks 01-05.
- plan.md validation section: reflect wrapper ownership (Step 1) vs ordered runner (Step 5).
- Resolves FMA open question: verify:reasoning re-RUNS gates 01-04 + e2e (P3 style), then validates
  the evidence set for one shared suite UUID; step-close evidence protected per F9.

## High

### F5 — Gate fixtures depend on gitignored regenerated store; zero inadmissible records; no store integrity anchor
Sources: Failure Mode Analyst + Assumption Destroyer + Security Adversary.
Evidence: `cowork-p2-kit/.gitignore` (`store/records.jsonl` "regenerated per ingest run",
`inputs/**/*.docx`, `outputs/*`); `git ls-files cowork-p2-kit/store/` → no records.jsonl; jq scan:
17/17 records `public|citable:true|high|ok` (nothing to exercise G-P4-02 assertion 3's four
rejection reasons); `records.jsonl.bak` byte-identical unmanaged copy beside canonical file;
G-P4-05 change detection is symbol-level only (data file edits invisible).
Flaw: fresh clone → tests fail on missing file (undeclared discovery dependency, RULE §4); ingest
re-run → IDs/offsets drift, all fixtures + retained evidence rot; editable store = mintable evidence.
**Patch:**
- gates.yaml G-P4-02/G-P4-05 fixture fields: fixtures are committed snapshots under
  `reasoning/tests/fixtures/store/` (F-01/F-02/F-03 records copied once from current ingest run;
  copy step documented) plus synthetic inadmissible records, one per exclusion reason: `internal`,
  `internal-derived`, `citable:false`, `confidence:low`, `extraction_status:needs-ocr`.
- gates.yaml: G-P4-01 evidence records SHA-256 of live `store/records.jsonl`; G-P4-05 asserts the
  same hash (re-pin allowed only with a recorded reason).
- plan.md: pre-Step-1 action — delete or quarantine `store/records.jsonl.bak`; reasoning modules
  read exactly `store/records.jsonl`.
- plan.md dependencies: live-store agreement (published-artifact re-validation, F3) is explicitly
  store-dependent; `npm run ingest` named as the discovery prerequisite for live-store checks.

### F6 — Linear-attestation "frozen contract" does not exist; no owner
Source: Assumption Destroyer.
Evidence: plan.md:50-52 ("satisfies the frozen contract"); gates.yaml:30-32 ("complete" attestation
required, undefined); step-01:3-4 envelope list omits attestation; plan.md:69 touchpoint omits it;
brainstorm:38-41 gives intent ("comparable manufacturing/process context") but no field list.
Flaw: Step 2 must invent attestation fields mid-step, outside G-P4-01's contract freeze; "complete
vs incomplete" becomes fixture-author improvisation.
**Patch:** step-01 envelope list + plan.md touchpoint: add `linear-attestation.schema.json` (or an
attestation sub-object of the cohort contract) with an explicit required-field definition of
"complete"; G-P4-01 fixture set covers valid/invalid attestations; authenticity via hash pin (F2).

### F7 — Conflict detection reachable only through agent self-report; omission undetectable
Source: Assumption Destroyer.
Evidence: gates.yaml:51,59-60 (conflict fixtures are handed-in conflicts — honest path only);
plan.md:53-60 (validator limited to shape/linkage/substring by settled design); SKILL.md:16 already
names extracted-text injection as a live adversary.
Flaw: agent emits one favorable card per measure; no conflict exists in the card set; winner named;
G-P4-03 passes. Phantom coverage for the real threat (withheld evidence).
**Patch:**
- gates.yaml G-P4-03 new assertion: engine records, per scored candidate and critical measure, which
  admitted records were cited and which admitted records mapped to that candidate (via F1's
  provenance-file→candidate map) were not cited; an uncited Results-type record for a scored
  candidate → named FD-review decision state.
- plan.md risks: add residual-risk row — values withheld *within* a cited record are undetectable by
  design; independent FD adjudication is the control. Do not claim G-P4-03 closes this.

### F8 (reduced) — Multi-artifact publication ordering unspecified
Source: Failure Mode Analyst.
Evidence: `render/publication.mjs:36-39` (precedent is single-file temp+rename); Layer B publishes
≥3 coupled artifacts; gates.yaml:19-20 preservation covers failing runs only — crash between renames
is neither.
Flaw: kill between renames → published JSON says F-02 wins, MD says inconclusive.
**Patch (reduced per user):** plan.md/step-04: specify publication order — derivatives staged first,
canonical JSON renamed last as the commit point; partial-publish divergence is detected by F3's
published-artifact re-validation at verify time. No crash-injection fixture required.

### F9 (reduced) — Gate-evidence lifecycle: overwrite on rerun, solo-run UUID poisoning, red results homeless
Source: Failure Mode Analyst.
Evidence: `run-gate.mjs:61` (`suite_run_id = env ?? randomUUID()` — solo runs mint fresh UUIDs),
`:88-90` (unconditional overwrite, even on crashed child); `verify-render.mjs:32` (first-failure
stop after earlier evidence already overwritten); P3 gates dir: five files, one UUID — only the final
suite run survives; TDD rule (plan.md:79-84) demands recorded red results with no defined home.
Flaw: evidence that closed Step N at time T is destroyed by any later run; plan shows steps
completed on artifacts that no longer exist.
**Patch (reduced per user):** plan.md validation section: (a) fixed evidence path = "latest";
(b) on step completion, snapshot that gate's evidence to
`docs/reports/qbd-p4-reasoning-layer/gates/step-close/G-P4-0N.json` (or hash-pin in the step's
progress doc); (c) TDD red results recorded under `gates/red/` (filename = gate + date). No per-run
archival machinery.

### F10 — G-P4-05 change-detection assertion names a nonexistent command; tool degraded and self-polluting
Sources: Security Adversary + Failure Mode Analyst.
Evidence: gitnexus CLI surface = analyze/status/clean/wiki/list (`.claude/skills/gitnexus/gitnexus-cli/SKILL.md:12-69`);
`detect_changes` is MCP-only (`gitnexus-guide/SKILL.md:38`); gates.yaml:99 says `npx gitnexus
detect-changes`; live FTS "read-only database" errors + CLAUDE.md Known Issues (analyze rewrites
CLAUDE.md/AGENTS.md — both already modified in worktree); P3 precedent put detect-changes in its own
gate G-P3-06 as the command.
Flaw: assertion has no executable oracle → satisfied by hand-authored code-review.md (RULE §13
manual-claim violation); or analyze's side effects fail the touchpoint confinement on their own.
**Patch:**
- gates.yaml G-P4-05 assertion 5 → executable: `git diff --name-only <base>` confined to the
  touchpoint table; raw diff output retained inside the gate evidence.
- MCP `gitnexus_detect_changes()` output recorded in `code-review.md` as review context, not a gate
  oracle. Pre-declare `CLAUDE.md`/`AGENTS.md` as expected tool-generated diffs when analyze runs.
- plan.md:119-120: align wording (MCP tool for impact analysis; git diff for the gate).

## Medium

### F11 — Markdown derivative: no owner, disagreement-only check, injection channel
Sources: Security Adversary + Assumption Destroyer.
Evidence: gates.yaml:77,98 (agreement-only assertions; generator unnamed → either tautology or
unspecified parser); brainstorm:98 names no MD author; records.schema.json:19 (content is
untrusted-by-contract); current SKILL.md's untrusted-text rule dies with the Step 4 rewrite unless
re-asserted; surplus non-contradicting content (e.g. instruction-shaped text for future agent
sessions) passes an agreement check.
**Patch:**
- gates.yaml G-P4-04: (a) `formula-decision.md` and evidence-log MD are generated deterministically
  from canonical JSON by a reasoning module; consistency assertion = regeneration equality
  (hand-authored MD rejected wholesale); (b) verbatim quotes rendered inside declared delimiters in
  all artifacts; (c) rewritten SKILL.md retains the untrusted-extracted-text rule — gate asserts its
  presence alongside the drafting-absence check.
- step-04: agent forbidden from writing MD derivatives; define the SKILL.md template-extraction
  convention (fenced blocks with declared info-string tags) so assertion 1 is testable.

### F12 — Drafting-absence gate is a token-grep phantom
Sources: Security Adversary + Failure Mode Analyst.
Evidence: SKILL.md:6-7,:25-32 (mixed EN/VN drafting mandate + `headings[]/prose[]/tables[]/citations[]`
contract — the token set any grep would key on); gates.yaml:79 gives no stronger definition;
Vietnamese paraphrase ("soạn thảo phần phát triển công thức") evades literal checks.
**Patch:** gates.yaml G-P4-04 assertion 4: scope honestly — pinned forbidden-token denylist (EN:
`P.2.2`, `P.2.3`, `headings[]`, `prose[]`, `tables[]`, `citations[]`; VN: `soạn thảo`, `soạn nội
dung`, `dự thảo`) documented as best-effort; plan.md adds a standing line: FD/human review is the
authority for semantic drafting-drift in SKILL.md prose.

### F13 — Publication destination undefined; only output dir is gitignored
Source: Assumption Destroyer.
Evidence: plan.md:64-77 (no artifact-location row); `.gitignore` `outputs/*`; git ls-files → only
`.gitkeep`; gates.yaml:19 "injected output root" is test-only; gates.yaml:37 "the artifact" unnamed.
**Patch (per PD-2):** plan.md touchpoint table: add row —
`docs/reports/qbd-p4-reasoning-layer/decision/` = publication root for fact-cards.json, cohort
artifact, formula-decision.json/.md, evidence-log; git-retained. cli.mjs refuses to publish outside
the declared root. gates.yaml G-P4-02 names the artifact files that record exclusion reasons.

### F14 — No unit/normalization/aggregation policy; validator cannot check normalized values
Source: Assumption Destroyer.
Evidence: records.jsonl:5 (`3 min 50 sec`, `68 N (range 58-78)`), :10 (dissolution list + separate
mean), :16; grep across 7 plan files: "unit" appears only as "unit ambiguity"/"admission unit";
brainstorm says units live in the rubric but no vocabulary/conversion/aggregation rules exist.
**Patch:** step-01 fact-card contract: card carries `raw_text` (validator-checked: must contain the
quote's value token exactly) + `normalized_value` + `unit`; selection-rubric schema owns the unit
vocabulary and range/list aggregation rules (which statistic enters a matrix cell per measure);
gates.yaml G-P4-03 fixture: a mis-normalized card → rejected or flagged decision state.

### F15 — No Node version pin; harness depends on TAP epilogue of the default reporter
Source: Failure Mode Analyst.
Evidence: `run-gate.mjs:38-42,54` (pass/fail parsed from `^# tests N` TAP summary; total 0 → fail);
Node 23 changed default test reporter to `spec`; `package.json` has no `engines`; local Node
v22.22.2; RULE §5 requires version pinning.
**Patch:** step-01 harness contract: `package.json` gains `engines.node` (pin to the v22 line) and
the P4 run-gate wrapper invokes `--test-reporter=tap` explicitly; wrapper contract test asserts the
parsed format.

---

## Patch scope map

| File | Findings |
|---|---|
| plan.md (assumptions, touchpoints, risks, validation section) | F1 F2 F5 F6 F7 F8 F9 F10 F12 F13 |
| gates.yaml G-P4-01 | F1 F4 F5 F15 |
| gates.yaml G-P4-02 | F1 F5 F13 |
| gates.yaml G-P4-03 | F2 F7 F14 |
| gates.yaml G-P4-04 | F11 F12 |
| gates.yaml G-P4-05 | F3 F4 F5 F10 |
| step-01 | F1 F4 F6 F14 F15 |
| step-02 | F1 |
| step-03 | F2 |
| step-04 | F8 F11 F12 |
| step-05 | F3 F4 F9 F10 |

## Post-patch obligations (patcher)

1. Append to plan.md:

```markdown
## Red Team Review

### Session — 2026-07-24
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 4 Critical, 6 High, 5 Medium
| # | Finding | Severity | Disposition | Applied To |
(fill from this report; F8, F9 = "Accept (reduced)"; F2, F13 = "Accept (user decision PD-1/PD-2)")
```

2. Run Whole-Plan Consistency Sweep (re-read plan.md + all step files; reconcile every term this
   report renames: fixture rubric filename, publication root, wrapper name, evidence subdirs,
   git-diff oracle; report deltas/reconciled/unresolved counts in the Red Team Review section).
3. Do not mark the plan implementation-ready if any contradiction remains.

## Verified facts patcher may rely on (no re-verification needed)

- `render/tests/run-gate.mjs:11,61,88-90`; `verify-render.mjs:9-16,18,24-33,35-43`;
  `verify-render-evidence.mjs:6,10-38`; `render/publication.mjs:36-39`; `render-docx.mjs:107-111`.
- `store/records.schema.json:6` required keys; records.jsonl lines 1/7/12 = F-01/F-02/F-03; 17
  records all admissible; 13/17 lack F-codes in content; `records.jsonl.bak` byte-identical.
- SKILL.md:6-7,:25-32 drafting mandate + Layer C contract tokens; `scoring-90-100.md:16,20-23`.
- gitnexus CLI has no `detect-changes` subcommand (MCP-only).
- package.json: `verify:ingest`, `verify:render`, no `engines`, no `verify:reasoning`.

## Unresolved questions

None. Both reviewer open questions resolved: (a) verify:reasoning re-runs gates P3-style (F4);
(b) decision artifacts are git-retained under docs/reports (PD-2). Residual accepted risk recorded in
F7 (withheld values within a cited record — control = FD adjudication).
