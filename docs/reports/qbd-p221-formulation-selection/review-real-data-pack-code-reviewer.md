# Code Review — Phase 1: real-data-pack (typed evidence, inventory, fact-card bindings)

Reviewer: code-reviewer agent (advisory, no edits)
Date: 2026-08-08
Gate under review: G-01
Review type: pre-landing production-readiness

## Code Review Summary

### Scope
- Files reviewed:
  - `cowork-p2-kit/workflow-trial/real-data-pack.mjs` (443 lines)
  - `cowork-p2-kit/workflow-trial/contracts/formulation-evidence.schema.v1.json`
  - `cowork-p2-kit/workflow-trial/contracts/fact-card-evidence-bindings.schema.v1.json`
  - `cowork-p2-kit/workflow-trial/contracts/formulation-data-package.schema.v1.json`
  - `cowork-p2-kit/workflow-trial/tests/real-data-pack.test.mjs` (194 lines)
- Context read: `plan.md`, `phase-01-real-data-layer.md`, `gates.yaml` (G-01),
  `fact-cards.schema.json`, `contracts.mjs`, `formula-cell-receipt.mjs`,
  `formulation-spike-run.mjs`, `decision-engine.mjs`, Phase 0 evidence artifacts
- LOC added: ~800 (5 new files); existing code untouched (verified via git status:
  only `docs/plans/.../plan.md` modified, all five new files untracked/additive)
- Focus: recent (Phase 1 workstream)

### Scout findings (edge cases discovered before review)
1. All 18 emitted fact cards fail the canonical `validateFactCards` runtime
   validator (`cowork-p2-kit/reasoning/contracts.mjs`), code `E_FACT_QUOTE_VALUE_UNIT`:
   - 18/18 fail the `quote.includes(card.unit)` check — unit is `"percent"`, quotes
     are Vietnamese cell/record text that never contains that token.
   - 30/18 value-token failures — `raw_text`/`quote` use comma decimals (`"73,89"`),
     `String(normalized_value)` uses dot decimals (`"73.89"`).
   The v1 JSON *schema* is satisfied, but the repo's canonical fact-card *validator*
   is not. The existing `demo-data-pack.mjs` pattern avoids this by using `unit: "%"`
   and `raw_text: value + " %"`, so every demo card passes the canonical validator.
2. Cross-process determinism holds: re-running the CLI to a fresh temp dir produced a
   byte-identical `hashes.json` (same `package_sha256` `b9e89210…`) — the committed
   evidence is reproducible from the Phase 0 inputs.
3. The bindings validator has no completeness/coverage pass: a tampered bindings array
   that drops the scoring binding for an adverse result (e.g., `observed-result:dissolution-min:formula-01`)
   validates successfully. No negative test covers a dropped binding.
4. Card offsets are re-based to `0..quote.length` (quote-level, per the known design).
   `E_FACT_QUOTE_OFFSET` would still pass only because store record `content === quote`
   (Phase 0 `recordMatches` requires `provenance.quote === content`).

### Overall Assessment

Phase 1 is well-constructed and all eight acceptance criteria hold. Typed evidence
kinds are machine-distinct, the exact-cohort guard is order-sensitive and correct, the
inventory reconciliation is complete and catches omission/role-downgrade, roles are
derived (caller override rejected via `E_ROLE_OVERRIDE`), the spec-as-result guard is
structural (`E_SPEC_AS_RESULT` fires before any role check), the package seals all five
required hashes, the test suite passes 7/7, and determinism is verified across process
invocations. The implementation is purely additive, imports only
`sha256`/`canonicalJson` from the receipt module plus the local `fail(code)` pattern,
and follows repo conventions (`writeCanonicalJson`, schema-contract asserts).

Two high-priority contract-fidelity gaps should be resolved before downstream phases
consume these artifacts: the emitted fact cards do not pass the repo's canonical
fact-card runtime validator, and `validateBindings` does not enforce binding coverage.
Both are non-blocking for the current gate (all G-01 negative cases pass) but are
integration landmines for G-02/G-03.

### Critical Issues

None. No security, breaking-change, or data-loss defect found. The fail-closed paths
(`E_SPEC_AS_RESULT`, `E_EXACT_COHORT`, `E_INVENTORY_RECONCILIATION`,
`E_ROLE_OVERRIDE`, `E_BINDING_AMBIGUOUS`) are all exercised by negative tests.

### High Priority

#### H1 — Emitted fact cards fail the canonical `validateFactCards` validator
`real-data-pack.mjs` builds cards with `unit: "percent"` (forced by the evidence
schema) and `raw_text`/`quote` in comma-decimal source form. The repo's canonical
validator `validateFactCards` (`reasoning/contracts.mjs:225`) rejects any card whose
quote lacks the unit token and whose raw_text/quote lack `String(normalized_value)`:
`E_FACT_QUOTE_VALUE_UNIT`. Verified: 18/18 unit-token failures, 30 value-token
failures across the emitted `fact-cards.json`.

The phase-01 plan explicitly says "Read/reuse: `reasoning/contracts.mjs` quote/offset
validation" and the non-negotiable says "existing fact-card v1 schema stays unchanged
for compatibility" — schema compatibility is preserved, but runtime-validator
compatibility is not. Any G-02+ consumer that runs the canonical validator (e.g.,
reusing `cohort-evidence.mjs`/`publication.mjs` paths) will hard-fail.

Resolution options (pick one, then document it):
1. Make the cards canonical-validator-compatible: emit `unit: "%"`, `raw_text` with
   dot-decimal value + unit so `String(value)` and `unit` both appear in the quote
   (mirror `demo-data-pack.mjs`). The evidence envelope keeps `unit: "percent"`.
2. Explicitly declare these cards "binding-validator-only" and add a guard so any
   formulation-path consumer is asserted to use the evidence envelope + binding map,
   never `validateFactCards`. Add a test asserting the decision/cohort construction in
   G-02 cannot feed these cards into the legacy validator.

#### H2 — `validateBindings` does not enforce binding coverage
`validateBindings` (`real-data-pack.mjs:221`) iterates the supplied bindings and
checks resolution, kind, role, and field agreement, but never proves completeness.
A caller can drop the scoring binding for an adverse observed result (the exact
"caller hides adverse evidence" threat) and the guard passes. This contradicts the
phase-01 invariant "the evaluator rejects a missing or wrong-kind binding" and the
G-01 negative "Binding points to wrong kind/source/store/receipt → reject".

The authoritative build path is safe (bindings are generated from all evidence), but
the exported guard — which G-02's evaluator is expected to reuse — is incomplete.

Add a completeness pass to `validateBindings`:
- every `observed_result` evidence has exactly one `scoring` binding;
- every `composition_context` evidence has exactly one `rationale_support` binding;
- no orphan binding (already checked) and no duplicate `card_id`/`evidence_id` pair.
Add a negative test: build a valid package, drop the dissolution-min scoring binding,
and assert rejection.

### Medium Priority

#### M1 — `recordRoles` shape collision with the v2 decision engine
Phase 1 `derived_roles`/`recordRoles` is `record_id → [evidence kinds]` (arrays).
The existing `decision-engine.mjs evaluateSelection` requires `record_id → "results"|"context"`
and requires every admitted record to be present (`E_RUBRIC_ENVELOPE`). The emitted
`inventory-reconciliation.json` `roles` arrays are therefore not directly consumable by
the v2 engine. This is not a Phase 1 defect, but G-02 must define the
kinds→results/context translation before wiring the package into the evaluator.
Consider noting the mapping in the phase-02 plan.

#### M2 — Exported `buildRealDataPackage` allows skipping the pinned receipt-set check
`buildRealDataPackage` checks `receiptSetSha256 != null` and does not re-verify
per-receipt internal hashes (`raw_cell_sha256` vs `raw_cell_text`,
`normalized_value_sha256` vs `normalized_value`, `quote_sha256` vs `quote`). The CLI
path always passes the pin (from `go-no-go.json`), so the emitted evidence is bound.
API callers can pass `receiptSetSha256: null` to bypass the pin check. Recommend
requiring the pin (fail-closed) and/or re-running the Phase 0 integrity asserts
(`assertReceiptIntegrity`/`assertBoundReceipt` equivalents) on the input receipts.

### Low Priority

- L1 `validateEvidenceEnvelope` throws a raw `TypeError` on non-array
  `evidence[key]` and only checks `kind`/keys/cohort, not the schema enums
  (`measure`, `candidate`, `unit`, `value` type). Fine for the internal build path;
  add defensive guards if it becomes a public contract.
- L2 The CLI output guard rejects `outDir` inside the kit but (unlike
  `formulation-spike-run.mjs` `assertSafeOutputRoot`) does not detect a symlinked
  `outDir` resolving into the kit. Local CLI; low risk.
- L3 `validateBindings` does not reject duplicate bindings (same `card_id` twice).
  Fold into the H2 completeness pass.

### Edge Cases Found by Scout

- Canonical-validator incompatibility (H1) — all 18 cards.
- Missing binding-coverage guard (H2) — no negative test covers a dropped binding.
- Cross-process determinism verified byte-identical (re-run to temp dir).
- Quote offsets re-based to `0..len` pass `E_FACT_QUOTE_OFFSET` only because store
  `content === quote`; fragile if a store record ever becomes longer than its quote.

### Positive Observations

- Determinism is real, not just asserted: independent CLI process re-run produced the
  exact committed hashes (`package_sha256 b9e89210…`, `byte_identical: true`).
- All six emitted package hashes recompute exactly from the emitted JSON files.
- No regression: reasoning `contract.test.mjs` + `decision-engine.test.mjs` 73/73 pass
  (the pre-existing `skill-artifacts.test.mjs` G-P4-04 failure is unrelated/out of scope).
- The schema-contract self-asserts (`assertSchemasMatchContract`) tie the three new
  schemas to the code's constants — a strong drift guard.

### Recommended Actions

1. Resolve H1 before G-02: either make cards pass `validateFactCards` or explicitly
   declare and test the binding-validator-only path.
2. Add the H2 completeness pass to `validateBindings` plus a dropped-binding negative
   test.
3. Decide the M1 kinds→results/context mapping in the phase-02 plan.
4. Harden M2: require `receiptSetSha256` and re-verify per-receipt hash integrity in
   `buildRealDataPackage`.

### Metrics

- Test suite: 7/7 pass (`node --test cowork-p2-kit/workflow-trial/tests/real-data-pack.test.mjs`)
- Reasoning regression: 73/73 pass
- Hash recomputation vs `hashes.json`: 6/6 exact matches
- Cross-process determinism: byte-identical (confirmed by temp-dir re-run)
- Type coverage: N/A (plain JS, no TS)
- Lint: not run (no lint gate in this workstream; test suite is the gate)

### Unresolved Questions

- Whether G-02's evaluator will reuse the canonical `validateFactCards` on the emitted
  cards or the evidence-envelope/binding validator exclusively. This determines whether
  H1 is a must-fix or a documented decision.

Status: DONE_WITH_CONCERNS
Summary: All eight G-01 acceptance criteria hold; tests 7/7 green, deterministic
across processes, additive-only, no regression. Two high-priority contract-fidelity
gaps to resolve before downstream phases: emitted fact cards fail the canonical
`validateFactCards` validator, and `validateBindings` lacks a binding-coverage check.
Concerns/Blockers: H1, H2 (non-blocking for G-01 itself; block safe G-02 integration).
