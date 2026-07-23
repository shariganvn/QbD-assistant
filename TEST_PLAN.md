<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260723-qbd-p3-render-step-03.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:6bb01414471858b7f6e0e4d5bb39ec4e8b9402454df6ada5734a70e74e7f3fe4 -->

# TEST_PLAN — Active Validation Gates

## T20260723-qbd-p3-render-step-03

Status: **Executed — results recorded**

- Workstream: `qbd-p3-render-layer`
- Date: 2026-07-23
- Plan: `docs/plans/qbd-p3-render-layer/step-03-fidelity-offline-spike.md`

## Scope

Test-first fidelity and offline verification of the existing Node docx candidate with the committed public two-citation fixture. This plan verifies G-P3-03 and G-P3-04 only; it does not select, provision, or test a fallback renderer.

### Changed files

- `package.json`
- `cowork-p2-kit/render/render-spike.mjs`
- `cowork-p2-kit/render/run-isolated-spike.mjs`
- `cowork-p2-kit/render/document-builder.mjs`
- `cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs`
- `cowork-p2-kit/render/tests/isolated-network.test.mjs`
- `cowork-p2-kit/render/tests/run-gate.mjs`
- `cowork-p2-kit/render/tests/gate-evidence-validator.mjs`
- `cowork-p2-kit/render/tests/gate-evidence.contract.test.mjs`
- `cowork-p2-kit/render/tests/fixtures/fidelity/two-citation-draft.json`
- `docs/reports/qbd-p3-render-layer/gates/`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-23
- Approved by: human

## Commands

### render-contract-regression — Preserve the Step 1 citation envelope and exact-host policy before fidelity work.

```bash
node --test cowork-p2-kit/render/tests/contract.test.mjs
```

### render-output-preservation-regression — Preserve G-P3-02 fail-closed output publication while Step 3 calls the production publisher.

```bash
node --test cowork-p2-kit/render/tests/output-preservation.test.mjs
```

### ooxml-citation-fidelity — Render the committed two-citation draft, inspect OOXML without shell evaluation, and prove the two positive footnote IDs/references, one allowed external footnote relationship, no relationship for the local citation, TOC field, and table markup.

```bash
node --test cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs
```

### isolated-network-render — Invoke run-isolated-spike.mjs once. It must use a literal bwrap argv with --unshare-net, read-only /work and runtime mounts, and only test-created /out and /report write mounts; retain argv, stdout, stderr, tool versions, and output hash as one required structured G-P3-04 snapshot through the gate runner. The runner passes a unique snapshot-file path to the test, validates its JSON, and fails if it is absent, malformed, or has an unexpected shape.

```bash
node --test cowork-p2-kit/render/tests/isolated-network.test.mjs
```

### isolated-evidence-contract — Reject empty, malformed, or multiple G-P3-04 snapshots before evidence can pass.

```bash
node --test cowork-p2-kit/render/tests/gate-evidence.contract.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260723-1215/test-verdict.json`
Counts: passed=29, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
