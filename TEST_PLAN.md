<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260723-qbd-p3-render-step-04.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:235a4b34a9390e705b55d2e6820f86f41e3c20119b209b122ee5bb05290ab90c -->

# TEST_PLAN — Active Validation Gates

## T20260723-qbd-p3-render-step-04

Status: **Executed — results recorded**

- Workstream: `qbd-p3-render-layer`
- Date: 2026-07-23
- Plan: `docs/plans/qbd-p3-render-layer/step-04-determinism-viewer-evidence.md`

## Scope

Test-first G-P3-05 verification for the existing Node docx candidate. It proves that two renders of the committed public two-citation draft have identical normalized OOXML payloads, then requires a named engineer to record a passing LibreOffice or Word review of that same fixture. This plan neither selects nor provisions a fallback renderer.

### Changed files

- `package.json`
- `package-lock.json`
- `cowork-p2-kit/render/document-builder.mjs`
- `cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs`
- `cowork-p2-kit/render/determinize-ooxml.mjs`
- `cowork-p2-kit/render/normalize-ooxml.mjs`
- `cowork-p2-kit/render/tests/determinism.test.mjs`
- `cowork-p2-kit/render/tests/viewer-checklist.test.mjs`
- `cowork-p2-kit/render/tests/run-gate.mjs`
- `cowork-p2-kit/render/tests/gate-evidence-validator.mjs`
- `cowork-p2-kit/render/tests/gate-evidence.contract.test.mjs`
- `cowork-p2-kit/render/tests/verify-render.mjs`
- `cowork-p2-kit/render/tests/fixtures/normalization/`
- `docs/reports/qbd-p3-render-layer/gates/G-P3-05-viewer.template.md`
- `docs/reports/qbd-p3-render-layer/gates/G-P3-05-viewer.md`
- `docs/reports/qbd-p3-render-layer/gates/G-P3-05.json`
- `docs/plans/qbd-p3-render-layer/step-04-determinism-viewer-evidence.md`
- `docs/plans/qbd-p3-render-layer/step-04-viewer-patch-implementation.md`
- `docs/plans/qbd-p3-render-layer/plan.md`
- `docs/plans/qbd-p3-render-layer/gates.yaml`
- `docs/test-plans/T20260723-qbd-p3-render-step-04.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-23
- Approved by: human

## Commands

### render-contract-regression — Preserve the frozen citation envelope and exact-host policy.

```bash
node --test cowork-p2-kit/render/tests/contract.test.mjs
```

### output-preservation-regression — Preserve fail-closed publication before rendering the deterministic fixture twice.

```bash
node --test cowork-p2-kit/render/tests/output-preservation.test.mjs
```

### fidelity-and-isolation-regression — Keep G-P3-03 OOXML semantics and G-P3-04 bwrap isolation green before G-P3-05.

```bash
node --test cowork-p2-kit/render/tests/ooxml-fidelity.test.mjs cowork-p2-kit/render/tests/isolated-network.test.mjs
```

### deterministic-ooxml — Render the committed two-citation draft into two fresh temporary output roots. Normalize each DOCX as a lexically sorted path-to-SHA-256 manifest over every ZIP entry's uncompressed bytes; compare the complete manifests and assert stable document.xml, relationships, footnotes, and media entries. ZIP timestamps, external attributes, entry order, and compression encoding are the only ignored differences. Emit the explicit normalization command and both raw-output and normalized-manifest hashes and every explicit unzip argument array as TAP diagnostics retained in G-P3-05.json. A committed archive fixture with XML, relationship, and word/media entries proves the normalizer does not omit any of those payload types.

```bash
node --test cowork-p2-kit/render/tests/determinism.test.mjs
```

### viewer-fidelity — An engineer renders the committed fixture, opens that generated DOCX in LibreOffice or Word, and completes G-P3-05-viewer.md from its committed template with reviewer, ISO date, exact viewer/version, the literal Windows host + WSL2 Ubuntu baseline, fixture SHA-256, opened-output SHA-256, normalized-manifest SHA-256, and PASS observations for positive footnotes, the exact USP link, local plain provenance, TOC, and table layout. It must not navigate to the network. viewer-checklist.test.mjs rejects every blank, malformed, duplicate, unknown, or non-PASS field.

```bash
libreoffice --version
```

### render-gate-suite — Run the ordered G-P3-01 through G-P3-05 suite once after focused tests and manual review pass. All five evidence records must share one suite UUID; G-P3-05.json is the retained automated result and G-P3-05-viewer.md is the retained human evidence.

```bash
npm run verify:render
```


## Results

Verdict: **passed**
Artifact: `artifacts/260723-p3-render-step-04-evidence/test-verdict.json`
Counts: passed=58, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
