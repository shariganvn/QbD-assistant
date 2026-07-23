<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260723-qbd-p3-render-step-02.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:f49fea192d3382d3826747b753af333f21c71b6ef11fc13e6f6da23a3a836151 -->

# TEST_PLAN — Active Validation Gates

## T20260723-qbd-p3-render-step-02

Status: **Executed — results recorded**

- Workstream: `qbd-p3-render-layer`
- Date: 2026-07-23
- Plan: `docs/plans/qbd-p3-render-layer/step-02-fail-closed-renderer.md`

## Scope

Prove that complete draft validation happens before publication and that every invalid input preserves the injected output root byte-for-byte.

### Changed files

- `cowork-p2-kit/render/`
- `docs/reports/qbd-p3-render-layer/`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-23
- Approved by: human

## Commands

### render-contract-regression — Keep the frozen structured-draft and exact-host contract green.

```bash
node --test cowork-p2-kit/render/tests/contract.test.mjs
```

### render-output-preservation — Exercise every declared invalid-input code and verify the seeded output root hash map is unchanged; then verify a valid draft publishes one DOCX through the injected root.

```bash
node --test cowork-p2-kit/render/tests/output-preservation.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260723-0731/test-verdict.json`
Counts: passed=10, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
