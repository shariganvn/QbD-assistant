<!-- GENERATED VIEW — do not edit manually -->
<!-- Source: docs/test-plans/T20260804-placeholder-template-ingest-phase-00.yaml -->
<!-- Regenerate: baton render-test-plan -->
<!-- Source fingerprint: sha256:ae222b16ed32e50e6860993cad4f5d4dbb00d8a04b451cee7671af26daacf8b6 -->

# TEST_PLAN — Active Validation Gates

## T20260804-placeholder-template-ingest-phase-00

Status: **Executed — results recorded**

- Workstream: `placeholder-template-ingest-workflow-probe`
- Date: 2026-08-04
- Plan: `docs/plans/placeholder-template-ingest-workflow-probe/phase-00-cleanup-stale-probe-worktree.md`

## Scope

Validate that the superseded wide-table probe remains recoverably quarantined and absent from active paths before the placeholder-template probe advances.

### Changed files

- `docs/plans/placeholder-template-ingest-workflow-probe/`
- `docs/test-plans/T20260804-placeholder-template-ingest-phase-00.yaml`
- `docs/test-plans/active.yaml`
- `docs/progress/P20260804-placeholder-template-ingest-phase-00-closeout.yaml`

## Approval

- **Human approval required** before running commands.
- Approved at: 2026-08-04
- Approved by: human

## Commands

### recovery-boundary-validation — Verify archived bytes, recovery checksums, stale-path absence, and diff whitespace.

```bash
bash -lc 'set -euo pipefail
archive="artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/stale-wip.tar"
manifest="artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/stale-wip-sha256.txt"
plan_snapshot="artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/plan-pre-cleanup.md"
plan_snapshot_sha256="80eeaa3a6f94714fe3b44005b35f37ebb385e96cb6607ce1114fa861ddb75040"
sha256sum --check "artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/stale-wip.tar.sha256"
sha256sum --check "artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/phase-00-pre-cleanup.sha256"
test "$(sha256sum "$plan_snapshot" | awk "{print \$1}")" = "$plan_snapshot_sha256"
test "$(tar -xOf "artifacts/260804-1207-placeholder-template-ingest-workflow-probe/recovery/plan-pre-cleanup.tar" "docs/plans/placeholder-template-ingest-workflow-probe/plan.md" | sha256sum | awk "{print \$1}")" = "$plan_snapshot_sha256"
while read -r expected path
do
  actual="$(tar -xOf "$archive" "$path" | sha256sum | awk "{print \$1}")"
  test "$actual" = "$expected"
done < "$manifest"
test ! -e cowork-p2-kit/preprocess
test ! -e plans/260803-1903-p0-preprocess-public-formulation-docx-workflow-probe
test ! -e plans/reports/tester-260803-1903-p0-preprocess-public-formulation-docx-workflow-probe.md
! git status --short --untracked-files=all | grep -E "(^\?\? (cowork-p2-kit/preprocess/|plans/260803-1903-p0-preprocess-public-formulation-docx-workflow-probe/|plans/reports/tester-260803-1903-p0-preprocess-public-formulation-docx-workflow-probe\.md))"
git diff --check'
```


## Results

Verdict: **passed**
Artifact: `artifacts/260804-1418/test-verdict.json`
Counts: passed=unknown, failed=unknown, warnings=unknown

---

- Historical pre-S29 gates: `docs/archive/TEST_PLAN-ARCHIVE.md`
- Search older context with qmd.
