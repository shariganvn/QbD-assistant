# Research Report: Downstream Full-Chain Orchestration Boundary

- Conducted: 2026-08-05T13:41:38+07:00
- Scope: existing records through reasoning, rationale, renderer draft, and DOCX
- Recommendation: one isolated trial-only acceptance harness plus one narrow rationale-to-render-draft adapter; no production orchestrator or authoring policy

## Contents

1. [Executive summary](#executive-summary)
2. [Method and scope](#method-and-scope)
3. [Exact artifact chain](#exact-artifact-chain)
4. [What exists and what is missing](#what-exists-and-what-is-missing)
5. [Recommended minimum boundary](#recommended-minimum-boundary)
6. [Rationale authoring boundary](#rationale-authoring-boundary)
7. [Files and symbols](#files-and-symbols)
8. [Test scenario matrix](#test-scenario-matrix)
9. [Validation and evidence](#validation-and-evidence)
10. [Cleanup and rollback](#cleanup-and-rollback)
11. [Risks and non-goals](#risks-and-non-goals)
12. [Unresolved Questions](#unresolved-questions)

## Executive summary

No current code or test spans the whole chain. The strongest existing production handoffs are reasoning-package publication, reasoning-package-to-rationale-packet sealing, rationale-package publication, and structured-draft-to-DOCX rendering. Two material boundaries are absent: production creation of reasoning inputs from arbitrary records, and rationale-package-to-render-draft adaptation. Rationale prose authoring is intentionally not implemented as production policy; only test helpers create deterministic generic rationales.

The minimum safe trial is not a new product CLI. It is an isolated acceptance test that composes existing exported production boundaries inside one fresh temporary root, emulates the established two-session authoring handoff with an explicitly test-only deterministic rationale artifact, converts the validated rationale package plus the hash-bound raw store into the existing render draft contract, and produces `p2-draft.docx`. All outputs remain below the temporary trial root. No `docs/reports` root, gate evidence path, production publication root, network service, or LLM is touched.

The frozen placeholder template and filled public/synthetic mock are explicitly `citable:false`, excluded from canonical ingest, and receipt-only with `record_projection.status:not_available`. They cannot enter this citation chain. A downstream success test may use the separate 17-record citable synthetic store, but then it is a composite wiring trial: template/mock bytes provide structure only, while citations come from the separate citable fixture. It must not be reported as a template-derived evidence E2E. A strict mock-derived full chain is currently expected to stop before reasoning/citable render.

The current repository explicitly prohibits claiming dossier drafting or production readiness. The resulting DOCX must therefore be described as an internal synthetic trial document, not a P.2.2/P.2.3 dossier or FD approval.

## Method and scope

- Sources: 23 local code, test, configuration, and project-document files; referenced committed fixtures; GitNexus query/context/process evidence.
- External research: none. Current behavior is fully answerable from the repository, and the acceptance trial must not require network access.
- GitNexus findings:
  - `buildCohortEvidence` and `evaluateSelection` have production implementations but current incoming callers are tests.
  - `validatePublishedDecisionPackage` is called by `buildRationalePacket`, proving a real cross-module production handoff.
  - Process trace `SealRationalePacket → Step4PublicationError` is `sealRationalePacket → buildRationalePacket → validatePublishedDecisionPackage → validatePublicationReceipt → exactObject → Step4PublicationError`.
  - `validateDraft`, `buildDocumentBuffer`, and `publishBuffer` are independently exported production boundaries.
- Template-probe boundary:
  - `template-freeze-manifest.v1.json` fixes both template and filled mock as immutable `public`, `citable:false`, with `canonical_ingest_admission:false`.
  - Its five-entry receipt has no record projection. The completed two-run probe explicitly forbids ingest, reasoning, and render.
  - `CONCLUSION` is reference-only and may not be written or derived by the template probe; rationale authoring belongs to the separate later authoring session.
- Evaluation criteria: public/synthetic-only data, deterministic behavior, fail-closed validation, immutable root ownership, no invented scientific or authoring policy, no production promotion, and the smallest change surface.

## Exact artifact chain

```text
records.jsonl raw bytes
  │ SHA-256 pinned by cohort.store_records_sha256
  ▼
cohort + evidence log + fact cards + decision + selection evaluation
  │ createReasoningCli(...).main("publish-package", ...)
  ▼
reasoning package root
  │ publication-receipt.json hashes every package member
  ▼
rationale-packet.json
  │ embeds verified projections and source receipt/artifact hashes
  ▼
rationale.json supplied by an external authoring boundary
  │ validateRationale + publishRationale
  ▼
rationale package root
  │ rationale-receipt.json hashes packet, rationale JSON, and Markdown
  ▼
render draft JSON
  │ MISSING adapter; validateDraft is the receiving contract
  ▼
deterministic DOCX buffer
  │ buildDocumentBuffer → determinizeDocx → publishBuffer
  ▼
p2-draft.docx
```

The placeholder template/mock lane is adjacent, not an upstream evidence producer for this graph:

```text
immutable public/synthetic citable:false template + filled mock
  └─ template field map / receipt (zero records, no record projection)
       ├─ may supply approved document structure only
       └─ MUST NOT supply citations, fact cards, rationale evidence, or a derived CONCLUSION
```

### Handoff details

| Handoff | Exact input | Exact output | Binding/validation | Current status |
|---|---|---|---|---|
| Store to reasoning construction | Raw `records.jsonl` bytes and parsed records; candidate map/profiles; rubric and pin; optional attestation | `cohort`, `evidenceLog`, `factCards`, `decision`, `evaluation` | `cohort.store_records_sha256`; record/provenance/quote bindings; rubric and decision hashes | Partial production primitives, test-only composition |
| Reasoning construction to publication | Five JSON artifacts, raw store, `run-id`, optional attestation | Eight required members plus optional `linear-attestation.json` | Exact schemas, cross-artifact identities, regenerated Markdown, receipt hashes, allowlist, transactional publish | Production |
| Reasoning package to rationale packet | Published reasoning root plus the same raw store bytes | `rationale-packet.json` | Revalidates full reasoning package and store; binds receipt bytes, every source artifact hash, packet ID, permitted sources, causal evidence | Production |
| Rationale packet to authored rationale | Packet | `rationale.json` | Must bind packet/decision/cohort identities; claims limited to sealed sources; invented numeric/unit tokens rejected; display state fixed to `internal_only` | Missing production author; deterministic helpers in tests only |
| Authored rationale to rationale package | Packet plus authored rationale | `rationale-packet.json`, `rationale.json`, `rationale.md`, `rationale-receipt.json` | Packet/rationale validation, canonical JSON, regenerated Markdown, receipt hashes, allowlist, transactional publish | Production |
| Rationale package to render draft | Rationale package, reasoning root, same raw store, approved template structure | `{title?, citations, blocks}` | Must reconstruct public citation envelopes and preserve every authored claim | Missing |
| Render draft to DOCX | Valid draft object/JSON and absolute output root | `p2-draft.docx` | Exact draft contract; approved-link policy; deterministic OOXML; staged publication | Production |

### Canonical artifact members

Reasoning package:

- `cohort.json`
- `fact-cards.json`
- `evidence-log.json`
- `formula-decision.json`
- `selection-evaluation.json`
- `formula-decision.md`
- `evidence-log.md`
- `publication-receipt.json`
- optional `linear-attestation.json`

Rationale package:

- `rationale-packet.json`
- `rationale.json`
- `rationale.md`
- `rationale-receipt.json`

Renderer input/output:

- one canonical `draft.json` with optional `title`, `citations`, and `blocks`
- one `p2-draft.docx`

## What exists and what is missing

### Production code already available

- `buildCohortEvidence(...)` admits/excludes records and creates cohort/evidence-log contracts.
- `evaluateSelection(...)` validates the rubric and produces decision/evaluation contracts.
- `createReasoningCli({ publicationRoot })` supports an injected declared root and publishes a validated package through its private `publishDecisionPackage` path.
- `validatePublishedDecisionPackage(...)` reopens and verifies the committed package against raw store bytes.
- `buildRationalePacket(...)` and `sealRationalePacket(...)` create the author-safe packet only after full source-package validation.
- `validateRationale(...)`, `publishRationale(...)`, and `validatePublishedRationalePackage(...)` enforce the internal rationale package.
- `validateDraft(...)`, `buildDocumentBuffer(...)`, and `publishBuffer(...)` render and publish deterministic DOCX output.

### Existing only in fixtures/tests

- `reasoning/tests/e2e-decision.test.mjs::buildDecisionArtifacts` supplies fixed candidate maps/profiles, regex-based fact-card extraction, record roles, and the `test-approved` rubric. These are test policy, not a production records-to-reasoning adapter.
- `rationale/tests/e2e-rationale.test.mjs::rationaleFor` deterministically creates generic claims. This is test authoring, not an approved operational author.
- Rationale decision-package fixtures (`selected`, `inconclusive`, `attested`) prove the reasoning-to-rationale boundary without running live reasoning in the same test.
- Render contract tests derive a citation directly from the ingest contract fixture. Render fixtures do not consume `rationale.json` or `rationale-packet.json`.
- `cowork-p2-kit/store/records.jsonl` and `reasoning/tests/fixtures/store/records.jsonl` are byte-identical: SHA-256 `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56`, 17 records, all `public:true`. This is suitable only as the repository's synthetic/public test corpus, not evidence of a real FD-approved trial.
- The test rubric hash is `40e942181235bbe606af9f158606111f2b893a35c093e2887ff34c30c1471358` and its `approval_state` is `test-approved`.
- The newer placeholder-template freeze is a different corpus and trust boundary: `public`, `citable:false`, not admitted to canonical ingest, and never dossier evidence. It cannot replace the 17-record citable fixture in this downstream test.

### Missing boundaries

1. No supported production function converts arbitrary ingested records into fact cards, candidate profiles/maps, record roles, and approved reasoning policy.
2. No production rationale author exists. The CLI requires a caller-supplied `rationale.json`.
3. No adapter converts a validated rationale package into the render draft contract.
4. The rationale packet intentionally omits record classification, while the render citation contract requires exact `{ label: "public", citable: true }`. The adapter must therefore receive the same hash-bound raw store; it must not invent classification.
5. `validatePublishedRationalePackage` validates its sealed local package but does not reopen the reasoning root. A full-chain harness should additionally call `validateRationalePacket(packet, { sourcePackage: reasoningRoot })` and revalidate the reasoning package against the store.
6. No existing test crosses records → live reasoning publication → live rationale publication → render draft → DOCX.
7. No provenance bridge joins the receipt-only placeholder mock to canonical records. Its current contract requires zero projected records, so using its cell values as reasoning evidence would violate the accepted probe boundary.

## Recommended minimum boundary

### Design decision

Make the acceptance test the orchestrator. Add only one trial-scoped adapter. Do not add a production full-chain CLI yet.

Preserve two explicit logical sessions even inside one test process:

- **Session 1 — evidence preparation/sealing:** build and publish reasoning, seal `rationale-packet.json`, write a canonical author-request manifest, then stop. The packet and its hashes are the only authoring handoff.
- **Session 2 — authored output/validation/render:** accept an explicitly supplied `rationale.json`, validate it against the unchanged packet, publish the rationale package, adapt to draft, and render DOCX.

The acceptance helper may generate the Session 2 artifact deterministically to avoid a human or LLM dependency, but it must serialize and reopen the Session 1 handoff. Do not replace the two-session product boundary with a hidden in-process production author.

Proposed exported adapter:

```js
buildRenderDraftFromRationale({
  reasoningRoot,
  rationaleRoot,
  store,
  templateStructure,
}) -> validatedDraft
```

`templateStructure` may supply only structure already approved by the upstream template contract, such as title and section placement. It must not create or rewrite rationale claims.

For the frozen placeholder probe specifically, `templateStructure` is layout-only and non-evidentiary. It carries the freeze/receipt identity and may position headings/placeholders, but it cannot be converted to a render `citation`, fact card, or authored `CONCLUSION`.

### Adapter validation order

1. Resolve supplied roots once. Reject aliases, overlap, non-directories, symlinks, or roots outside the fresh trial root.
2. Call `validatePublishedDecisionPackage(reasoningRoot, { store })`.
3. Call `validatePublishedRationalePackage(rationaleRoot)`.
4. Read canonical packet/rationale JSON, then call `validateRationalePacket(packet, { sourcePackage: reasoningRoot })` and `validateRationale(rationale, packet)`.
5. Parse raw store records by unique `id`; rely on the already-verified store hash and reject duplicates or malformed records.
6. For every fact claim, resolve each cited fact card to one packet evidence-log entry and one raw record. Require exact record ID, quote, source file, page, and offsets.
7. Require the raw record classification to be exactly `public` and `citable:true`. Set `evidenceLink:null`; do not infer URLs.
8. Deduplicate citations by stable evidence record ID in first-claim traversal order. A fact claim becomes a paragraph whose text segment is followed by its resolved citation segments.
9. Render non-fact rationale claims as plain internal-review paragraphs unless the approved template contract defines a stronger mapping. Never fabricate a renderer citation for gate, sensitivity, exclusion, or decision-state references.
10. Ensure every rationale claim appears exactly once in draft blocks; reject omissions, extra prose, reordered identities, and unsupported template placements.
11. Call `validateDraft(draft)` before returning it. Do not write inside the adapter.

### Isolated trial layout

```text
/tmp/qbd-template-docx-trial-<random>/       # one mkdtemp-owned root
├── reasoning-inputs/                       # canonical JSON inputs for CLI
├── reasoning-package/                      # immutable declared publication root
├── session-01-author-handoff/               # sealed packet + canonical request manifest
├── session-02-author-input/                 # explicit deterministic test rationale only
├── rationale-package/                      # immutable declared publication root
├── render-input/draft.json                 # canonical adapter result
└── render-output/p2-draft.docx             # only final binary
```

Root rules:

- Construct and `Object.freeze` one root manifest before any publication.
- Every child is an absolute normalized descendant of the exact `mkdtemp` root and pairwise disjoint.
- Inject `reasoning-package` into `createReasoningCli` and `rationale-package` into `createRationaleCli`; never call their production-default roots.
- Use fresh empty render output. The harness rejects a non-empty or symlinked output root before `publishBuffer`, because `publishBuffer` may replace an existing `p2-draft.docx`.
- Keep the committed store and fixtures read-only; hash them before and after the run.
- Never read root paths from environment variables or recompute them from defaults midway through the run.

### Orchestrator sequence

1. Read and hash the committed public/synthetic store.
2. Build test reasoning artifacts using the existing deterministic fixture logic and test-approved rubric.
3. Write canonical reasoning inputs under `reasoning-inputs`.
4. Publish through `createReasoningCli({ publicationRoot: roots.reasoningPackage })`.
5. Revalidate the committed reasoning package against the original store bytes.
6. Seal a packet through `createRationaleCli({ publicationRoot: roots.rationalePackage })`, copy its exact bytes/hash into the Session 1 handoff, and close Session 1.
7. Reopen the handoff in Session 2; invoke the required injected test author callback only as a deterministic stand-in for an explicitly supplied author artifact; validate its result before writing.
8. Publish and revalidate the rationale package without changing the sealed packet.
9. Build and validate the render draft through the new adapter.
10. Canonically write `draft.json`; call `buildDocumentBuffer` and `publishBuffer` directly.
11. Reopen the DOCX as ZIP, assert required OOXML parts and visible chain content, collect in-memory hashes, then clean the whole trial root.

Using the exported render primitives avoids changing `render-docx.mjs`, whose `main` is not exported. A subprocess CLI test can be added later if command-line behavior itself becomes part of acceptance.

## Rationale authoring boundary

The acceptance test must not make an LLM call. It also must not turn `rationaleFor(packet)` into silent production policy or collapse the established two-session authoring boundary.

Minimum contract:

- Session 1 ends after sealing an immutable packet and canonical author-request manifest. Session 2 begins by re-reading those exact bytes and verifying their hashes.
- The test controller requires an `authorRationale(packet)` dependency for Session 2. No default author is provided.
- The acceptance test supplies a deterministic local test author equivalent to the existing generic `rationaleFor` helper. It emulates an approved Session 2 artifact and may use only values and references already present in the sealed packet.
- The helper is named and documented as test-only/approved-fixture authoring. Its generic phrases are not scientific interpretation and not dossier prose.
- Absence of the callback fails before rationale or render publication with a dedicated trial error such as `E_TRIAL_AUTHOR_REQUIRED`.
- Any callback result passes `validateRationale` before it is written. Decision drift, external display, invented values, uncited references, and incomplete inconclusive explanation fail closed.
- A future LLM adapter requires a separate user/PO/FD-approved policy and isolation plan. It must remain an explicit injected mode, never a fallback, and its output still passes the same deterministic validator.

## Files and symbols

### Minimum files to create

| File | Responsibility | Likely symbols |
|---|---|---|
| `cowork-p2-kit/trial/rationale-to-render-draft.mjs` | Trial-scoped, read-only adapter from validated rationale/reasoning/store inputs to the existing draft contract | `buildRenderDraftFromRationale`, local root/source/citation resolution helpers, `TrialDraftError` |
| `cowork-p2-kit/trial/tests/template-to-docx-e2e.test.mjs` | Full-chain temp-root orchestrator, deterministic test author, positive and fail-closed cases | `runIsolatedTrial`, `buildSyntheticReasoningArtifacts`, `authorApprovedTestRationale`, hash/ZIP assertions |

No new fixture is required for the minimum trial. Reuse these exact committed inputs:

- `cowork-p2-kit/reasoning/tests/fixtures/store/records.jsonl`
- `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-approved.v2.json`
- `cowork-p2-kit/reasoning/tests/fixtures/rubric/selection-rubric-test-pin.json`
- optional attestation fixtures only if the attested branch is explicitly added

### Existing files/symbols to call unchanged

- `reasoning/cohort-evidence.mjs::buildCohortEvidence`
- `reasoning/decision-engine.mjs::evaluateSelection`
- `reasoning/publication.mjs::canonicalBytes`, `createReasoningCli`, `validatePublishedDecisionPackage`
- `rationale/packet.mjs::validateRationalePacket`
- `rationale/claim-binding.mjs::validateRationale`
- `rationale/cli.mjs::createRationaleCli`
- `rationale/rationale-publication.mjs::validatePublishedRationalePackage`
- `render/contract.mjs::validateDraft`
- `render/document-builder.mjs::buildDocumentBuffer`
- `render/publication.mjs::publishBuffer`

### Changes not recommended for the first trial

- No `package.json` script; use the direct test command until the boundary is accepted.
- No edits to production CLI defaults.
- No edits to reasoning/rationale contracts.
- No renderer contract expansion for generalized rationale references.
- No docs/report gate writer and no production publication.
- No extraction of current test helpers unless duplication later proves material.

## Test scenario matrix

| Scenario | Stage exercised | Expected result | Required absence/preservation proof |
|---|---|---|---|
| Selected synthetic happy path | Entire chain | Valid reasoning and rationale receipts, validated draft, non-empty deterministic DOCX | Production/docs roots byte-identical; temp-only outputs |
| Inconclusive synthetic branch | Entire chain | `winner:null`; exact `fd_action`; complete causal references; no recommendation text | Same isolation; no invented winner |
| Same input twice | Entire chain | Canonical draft hash and raw/normalized DOCX hashes identical | No residual temp/backup members |
| Tampered store after reasoning input | Reasoning → packet | Store/receipt/package validation error | No rationale package, draft, or DOCX |
| Tampered reasoning member or stale receipt | Reasoning → packet | `E_PACKET_SOURCE_INVALID` wrapping source validation failure | No downstream outputs |
| Missing author callback | Packet → rationale | `E_TRIAL_AUTHOR_REQUIRED` | Packet may exist; rationale/draft/DOCX absent |
| Author changes decision, emits external display, or invents value | Rationale validation | Existing `E_RATIONALE_*` code | No rationale publication or downstream output |
| Inconclusive author omits causal explanation | Rationale validation | `E_RATIONALE_INCONCLUSIVE_EXPLANATION` | No downstream output |
| Cited raw record is internal/uncitable | Rationale → draft | Trial adapter rejects non-public citation | No draft or DOCX; classification is never upgraded |
| Frozen placeholder mock is offered as evidence | Template/mock → reasoning or draft | Reject: `citable:false`, no canonical ingest admission, no projected records | It may remain layout-only; no fact card/citation/CONCLUSION derived |
| Session 2 packet differs from Session 1 handoff | Authoring boundary | Packet/hash mismatch before rationale validation | No rationale publication or render |
| Packet fact card/quote/provenance cannot resolve to store | Rationale → draft | Adapter binding error | No draft or DOCX |
| Rationale member/receipt tampered or surplus member present | Rationale package → draft | Existing rationale publication error | No draft or DOCX |
| Overlapping, escaped, symlinked, or non-empty output root | Root admission | Trial root error before publication | No writes outside exact trial root |
| Adapter emits malformed/unresolved draft | Draft validation | Existing `E_DRAFT_*`/`E_CITATION_*` code | No DOCX |
| Injected render publication failure | DOCX publication | `E_OUTPUT_WRITE`; invocation temp removed | Fresh root contains no partial DOCX |

Minimum acceptance set: selected happy path, deterministic rerun, missing author, tampered reasoning/store, non-public citation rejection, malformed draft rejection, and root-preservation assertion. Add the inconclusive branch if the plan claims decision-state completeness rather than only mechanical full-chain connectivity.

The selected happy path must be labelled **composite** if it combines placeholder-template structure with the separate citable reasoning fixture. A test using only the frozen placeholder mock should assert a truthful fail-closed/non-evidentiary result, not DOCX citations.

## Validation and evidence

### Focused commands

```bash
node --test cowork-p2-kit/trial/tests/template-to-docx-e2e.test.mjs
node --test cowork-p2-kit/render/tests/contract.test.mjs cowork-p2-kit/render/tests/output-preservation.test.mjs
node --test cowork-p2-kit/rationale/tests/packet-contract.test.mjs cowork-p2-kit/rationale/tests/claim-binding.test.mjs cowork-p2-kit/rationale/tests/rationale-publication.test.mjs
node --test cowork-p2-kit/reasoning/tests/skill-artifacts.test.mjs
```

Do not use `npm run verify:reasoning`, `npm run verify:rationale`, or the existing reasoning/rationale E2E files as the focused trial command: their gate runners or reference-package tests write under `docs/reports`. They may run only later in a disposable worktree with evidence paths redirected and all mutations discarded.

### In-memory/temporary evidence chain

The new test should assert, not merely log:

1. Store bytes hash equals `cohort.store_records_sha256` and reasoning receipt `input_store_sha256`.
2. Every reasoning receipt artifact hash equals committed member bytes.
3. Packet `source_publication_receipt_sha256` equals reasoning receipt bytes and `source_artifacts` equals its artifact map.
4. Rationale packet/decision/cohort IDs and hashes equal the authored rationale envelope.
5. Rationale receipt hashes equal the packet, rationale JSON, and regenerated Markdown.
6. Every draft citation resolves to one raw public/citable store record and exact packet evidence provenance.
7. Every authored claim is represented once in draft blocks.
8. DOCX is a valid ZIP containing at least `[Content_Types].xml`, `word/document.xml`, and expected footnote/provenance parts; XML includes the approved internal claim text and evidence identity.
9. Two identical runs yield identical canonical draft bytes and DOCX SHA-256/normalized OOXML manifests.
10. Hash snapshots of committed fixtures and production publication roots are unchanged after success and every injected failure.

TAP output is sufficient focused-test evidence. Do not write gate JSON, reports, receipts, or trial artifacts into `docs/` or `docs/reports/`.

## Cleanup and rollback

- Create one exact root with `mkdtempSync(join(tmpdir(), "qbd-template-docx-trial-"))`.
- Track only that returned absolute path. In `finally`, remove that exact root with recursive force; never use a glob, environment-derived path, workspace root, or home path.
- Reasoning and rationale publishers already stage, validate, back up, and restore their package members on failure.
- `publishBuffer` removes its invocation-owned temporary file but does not restore a pre-existing destination. The trial prevents this case by requiring a fresh empty render root.
- The adapter is pure and performs no writes. The test writes canonical `draft.json` only after the adapter and `validateDraft` succeed.
- No background process, worktree, network call, or external service is needed.
- If a debugging mode retains a failed temp root, it must be explicit, off by default, print only the exact temp path, and never promote its content into repository evidence automatically.

Rollback of a future implementation is removal of the two trial files. Existing source contracts and production artifacts remain untouched.

## Risks and non-goals

- The test-approved rubric and regex fact-card builder are fixture policy. Passing them does not establish scientific correctness or FD approval.
- Current public labels describe the synthetic fixture contract; they do not authorize real or confidential inputs.
- `public` and `citable` are independent. The frozen placeholder mock is public/synthetic but explicitly non-citable; no adapter may upgrade it to `citable:true`.
- The rationale package is permanently `internal_only`. Rendering it does not authorize external display.
- A DOCX that resembles a dossier section must not be called P.2.2/P.2.3 without a separate approved scope. The repository README currently says this capability is unavailable.
- Gate, sensitivity, exclusion, and decision-state rationale references do not naturally fit the renderer's evidence-record citation envelope. The first adapter should preserve their validated text without fabricated footnotes rather than broaden the render contract.
- The design preserves the repository's cooperative-writer boundary. It does not solve hostile same-host filesystem races.
- The acceptance trial begins from existing record bytes. Re-running LiteParse ingest and upstream template extraction in the same test is a separate boundary and should be composed only after their isolated contracts are accepted.

## Unresolved Questions

1. Is the final DOCX explicitly an internal trial/review document, or does the parent plan expect dossier-like P.2.2/P.2.3 output? The latter conflicts with current repository policy and needs user/PO/FD approval.
2. Who approves the deterministic local rationale text used by the trial? The existing generic `rationaleFor` pattern is mechanically safe but is not a production authoring policy.
3. Does acceptance authorize a **composite wiring trial** (non-citable placeholder structure plus separate citable 17-record reasoning fixture), or must it be mock-derived? Mock-derived evidence flow is blocked by the current zero-record/non-citable contract.
4. Must the first acceptance test cover both `selected` and `inconclusive`, or is one selected public/synthetic happy path plus fail-closed negatives sufficient?
5. Should non-fact claims remain plain validated paragraphs, or should a later approved contract add generalized packet-reference citations to DOCX? The latter is a renderer contract expansion.
6. What exact structure will the upstream template boundary supply to `templateStructure`, and which component owns placement of rationale claims into template sections?
