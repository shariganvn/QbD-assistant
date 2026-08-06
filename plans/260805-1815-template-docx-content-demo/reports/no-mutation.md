# No-mutation and containment

Date: 2026-08-06

Command:

```text
node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs
```

Result: pass. Both fresh runs reported:

```text
canonical_unchanged: true
dirty_tracked_files_unchanged: true
```

The runner hashes the complete `cowork-p2-kit/inputs`, `cowork-p2-kit/store`,
and `cowork-p2-kit/outputs` trees before and after each run, and also hashes
every pre-existing dirty tracked file. The demo writes upstream stages only to
a temporary run root, writes evidence under this plan's report directory, and
retains the DOCX under the ignored `artifacts/template-docx-content-demo/`
root.

The runner rejects artifact roots that are outside the allowed artifact parent
or resolve to symlinks. Bubblewrap receives separate writable output/report
roots and a read-only repository/runtime bind; missing or unusable Bubblewrap
is a hard failure.

The verification suites must be run sequentially: the existing reasoning,
rationale, and render verification scripts update their own tracked gate
evidence. Running them concurrently with the demo correctly trips the demo's
dirty-file guard; the focused demo run and all sequential upstream suites pass
apart from the pre-existing render assertion that assumes the repository has
no root `plans/` directory.
