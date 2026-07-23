# Step 1 — Freeze Render Contract and Test Boundary

## Goal

Make the renderer input and approved-link policy executable before changing document construction.

## Preconditions

- Read the Phase 2 → Phase 3 readiness review and D20260722.
- Inspect the current dirty worktree; do not absorb Phase 2 review artifacts.
- Run GitNexus impact analysis before changing an existing renderer symbol.
- Before marking this step `in-progress`, reconcile `project-state.yaml` with `baton state write-state`
  and validate it; this plan patch alone does not activate a generated state record.

## Exact file map

Create or update only these Step 1 files:

- `cowork-p2-kit/render/approved-hosts.json`
- `cowork-p2-kit/render/contract.mjs`
- `cowork-p2-kit/render/tests/contract.test.mjs`
- `cowork-p2-kit/render/tests/fixtures/contract/{valid,uncitable,missing-classification,invalid-links,unresolved-citation,invalid-source,invalid-block}.json`
- `cowork-p2-kit/render/tests/{gate-evidence-validator,run-gate,verify-render}.mjs`
- `package.json`, `cowork-p2-kit/README.md`, `cowork-p2-kit/render/README.md`
- `docs/plans/qbd-p3-render-layer/{plan.md,gates.yaml,step-01-freeze-render-contract.md}`
- `docs/reports/qbd-p3-render-layer/README.md` and `docs/reports/qbd-p3-render-layer/gates/.gitkeep`

## Work

1. Add the exact-host JSON allowlist containing only `www.usp.org` and `dav.gov.vn`; validation uses
   parsed lowercase hostnames, never a suffix match.
2. Write the contract test and all named allow/deny fixtures before any renderer refactor. It owns the
   literal accepted-key lists, draft shape, source-path rules, link rules, and error-code mapping in
   `plan.md`.
3. Add the evidence validator, a render-specific gate runner, and the literal ordered G-P3-01…05 map.
   `verify:render` exists now but must fail until every mapped test and the completed viewer artifact exist.
4. Preserve `npm run render`; add no `render:spike` behavior here. Record Windows host + WSL2 Ubuntu as
   the supported baseline and state that native Windows requires a separately approved portability plan.
5. Replace stale historical PASS/fallback and “bwrap absent” claims in both renderer READMEs with an
   explicit statement that Phase 3 gates are unverified and that current host availability is recorded
   only by G-P3-04 evidence.

## Validation

- Run the focused G-P3-01 test through the render gate runner and retain schema-valid raw TAP evidence.
- Do not begin renderer refactoring until G-P3-01 passes.

## Stop conditions

- Stop if the proposed envelope cannot preserve Phase 2 evidence identity and citable classification.
- Stop if a link policy would accept wildcards, implicit subdomains, HTTP, or an unreviewed host.
