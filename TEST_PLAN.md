<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260728-qbd-p4-reasoning-step-04.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:847e0cb69a0cecc2e506679ca598fa44e57728de0465d5aa0b030ed393320feb -->

# TEST_PLAN — Active Validation Gates

## T20260728-qbd-p4-reasoning-step-04

Status: **Executed — results recorded**

- Workstream: `qbd-p4-reasoning-layer`
- Date: 2026-07-28
- Plan: `docs/plans/qbd-p4-reasoning-layer/step-04-cowork-skill-artifacts.md`

## Scope

Verify the bounded Cowork instructions and publication of a complete, hash-bound Step 2/3 decision package, including deterministic Markdown, validation receipt, and human-only execution-report containment.

### Changed files

- `cowork-p2-kit/SKILL.md`
- `cowork-p2-kit/reasoning/cli.mjs`
- `cowork-p2-kit/reasoning/publication.mjs`
- `cowork-p2-kit/reasoning/markdown.mjs`
- `cowork-p2-kit/reasoning/publication-receipt.schema.json`
- `cowork-p2-kit/reasoning/publication-receipt.mjs`
- `cowork-p2-kit/reasoning/execution-report.mjs`
- `cowork-p2-kit/reasoning/tests/skill-artifacts.test.mjs`
- `docs/reports/qbd-p4-reasoning-layer/gates/G-P4-04.json`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-07-28
- Approved by: human

## Commands

### gate-p4-04 — Run bounded-skill and package-publication assertions through the P4 evidence wrapper.

```bash
node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-04 cowork-p2-kit/reasoning/tests/skill-artifacts.test.mjs
```


## Results

Verdict: **passed**
Artifact: `artifacts/260728-0906/test-verdict.json`
Counts: passed=7, failed=0, warnings=0

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
