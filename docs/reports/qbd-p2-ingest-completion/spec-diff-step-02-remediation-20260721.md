---
title: "Step 2 G-03 spec-diff remediation verdict"
date: 2026-07-21
baseline: d03cf4f
review_head: working tree after 8006568 and 21cf9f9
prior_review: docs/reports/qbd-p2-ingest-completion/spec-diff-step-02-20260721.md
verdict: accept-g-03
---

# Step 2 G-03 remediation spec-diff

## Verdict

**ACCEPT G-03.** The two findings in the prior formal review are resolved, and a fresh focused
verification run passed 15/15. Step 3 is unblocked; no Step 3 code was added by this remediation.

## Product-owner view

The operator-facing promise has not changed: running ingest over approved product/trial documents
still produces the same reproducible, citeable 17-record JSONL store. The remediation only makes
the compatibility test honest about that promise and makes a library seam explicit for future work.

| Original operating promise | Remediation result | Evidence |
|---|---|---|
| The committed test fixture is self-contained and must not invoke LibreOffice. | The child CLI now receives `process.execPath` as the absolute injected `sofficeBinary`; it probes Node, never `/usr/bin/soffice`. The normal CLI still preserves the configured LibreOffice preflight inherited from the frozen baseline. | `pipeline.test.mjs` asserts equality to `process.execPath`, absoluteness, non-equality to `/usr/bin/soffice`, and use of the injected pipeline value. Fresh suite passed. |
| The public record-building boundary is stable for callers and tests. | `buildRecords` now declares exactly `(admitted, adapter, config)`; the orchestration call already supplied all three values. | Focused `buildRecords.length === 3` test passed. |
| The same approved documents yield the same reviewable output. | Output remains byte-identical: 17 records; SHA-256 `6a16599838b8335e58f4e4f985c78d089cdd55e1a9b11696d240414b2fc28c56`; frozen representative records still match. | Fresh `npm run verify:ingest`, 15 passed, 0 failed/skipped. |

## Frozen-contract check

- Default prerequisite probing remains intact: baseline `d03cf4f` probed LibreOffice, and
  `pipeline.mjs` still probes the configured `sofficeBinary`. The fixture is permitted to inject an
  absolute non-LibreOffice executable, so it does not execute LibreOffice.
- All nine production modules remain within the 200-line limit; `records.mjs` is now 136 lines.
- No JSONL fields, ordering, IDs, provenance offsets, fixture checksum, default roots, or CLI error
  ownership changed.
- No lock, unique temporary file, complete-schema, failure-path, or concurrency work was added;
  those remain Step 3 gates G-04 through G-06.

## Evidence and disposition

| Item | Result |
|---|---|
| Test plan | `docs/test-plans/T20260721-qbd-p2-ingest-g03-spec-diff-remediation.yaml` — executed, passed |
| Fresh command | `npm run verify:ingest` — 15/15 pass, 0 fail/cancelled/skipped/todo |
| Gate evidence | `artifacts/qbd-p2-ingest-completion/gates/G-03.json` — refreshed with the remediation assertions |
| Prior rejected review | Retained unchanged as an audit record; its two blockers are superseded by this report |

**Disposition:** accept G-03 and stop this remediation. The next implementation work, if chosen,
is Step 3 publication and file-boundary hardening.

## Workflow note

The canonical remediation test-plan record is updated and points from `docs/test-plans/active.yaml`.
The repository does not contain the documented `scripts/render_test_plan_view.py` renderer or its
`.venv` interpreter, so the generated `TEST_PLAN.md` compatibility view was not rendered or edited
manually. This documentation-tooling gap does not change the G-03 verdict; restore the renderer
before the next formal session closeout.
