---
title: QbD P.2 deterministic render layer
workstream: qbd-p3-render-layer
status: completed
canonical: true
created: 2026-07-22
scope: phase-3-render-only
---

# QbD P.2 Deterministic Render Layer

## Goal

Close the Phase 3 renderer prerequisites identified by the Phase 2 readiness review and produce
a deterministic, offline-verified DOCX renderer. Layer C accepts a structured draft and evidence
envelope; it never generates reasoning or writes a final dossier directly from an LLM.

## Source-of-truth contract

- This file owns Phase 3 scope, sequence, dependencies, and step status.
- [`gates.yaml`](./gates.yaml) owns acceptance definitions, status, and retained evidence.
- Step files prescribe execution only; reports are evidence and cannot mark a gate passed.
- The Phase 2 readiness review is the entry evidence. It authorizes a fixture-only spike, not a
  production render, until all Phase 3 blocking gates pass.

## Frozen decisions

| Topic | Decision |
|---|---|
| Renderer | Keep Node `docx@9.7.1` as the candidate; select no fallback unless a must-pass gate fails. |
| Boundary | Preserve `npm run render` and the CLI input boundary; Layer C remains reusable as a future `DocRenderPort` adapter. |
| Windows runtime | Windows host + WSL2 Ubuntu is the supported runtime baseline; native Windows requires a separately approved portability plan and replacement isolation evidence. |
| Citation | Every rendered citation carries evidence identity, display provenance, and `classification.citable`; only `true` is renderable. |
| Hyperlinks | Optional only; HTTPS, exact hostname, no credentials, and host must be in the tracked allowlist. |
| Initial hosts | `www.usp.org` and `dav.gov.vn`; no wildcard or implicit subdomain matching. |
| Visual review | An engineer records the LibreOffice or Word fidelity checklist after automated gates pass. |
| Offline proof | `bwrap --unshare-net` is mandatory. If unavailable or failing, the gate fails closed and Phase 3 stops for escalation. |

## Scope

### In scope

- Renderer contract, approved-link policy, fixtures, Node built-in test suite, and retained gate evidence.
- Fail-closed citation/output behavior, OOXML inspection, isolated-network spike, determinism, and viewer fidelity evidence.
- Correct active plan/report paths, renderer documentation, and architecture wording that becomes stale after a verified renderer decision.

### Out of scope

- Phase 2 ingest code or G-01 through G-12 evidence.
- Phase 4 reasoning, LLM calls, content approval, confidential input, OCR execution, or LiteParse TOCTOU remediation.
- Silent provisioning or selection of OfficeCLI, Pandoc, or another fallback renderer.

## Public input contract

The renderer accepts one JSON object with `citations` and `blocks` arrays and an optional string
`title`, preserving the existing CLI input boundary. It rejects an unknown top-level or block field,
unknown block type, malformed table, malformed segment, duplicate `evidenceId`, or a citation
envelope that does not meet this contract. Validation completes before the output root is created or
an existing output is opened for replacement.

Every `draft.citations[]` item, whether or not it is referenced inline, must contain:

```json
{
  "evidenceId": "stable evidence record id",
  "source": "inputs/trials/example.docx",
  "location": "page 2, offset 0",
  "excerpt": "non-empty quoted evidence",
  "classification": { "label": "public", "citable": true },
  "evidenceLink": "https://www.usp.org/..."
}
```

`evidenceId`, `source`, `location`, and `excerpt` are non-empty strings. `source` is a normalized
relative POSIX provenance path: it is not absolute, contains no empty, `.` or `..` segment, and is
not a URL. `classification` has exactly `label: "public"` and `citable: true`. `evidenceLink` may
be absent or `null`, in which case the footnote is plain provenance text. A supplied link is parsed
as a URL and must use `https:`, have no username, password, or port, and have an exact lowercase
hostname in the allowlist. The link policy applies only to `evidenceLink`; relative provenance
`source` values are required and must not be treated as rejected link paths.

The only accepted blocks are `heading1`, `heading2`, `heading3`, `paragraph`, `table`, and
`chờ_dữ_liệu`. Heading and waiting blocks have one non-empty `text` string. A paragraph has either
one non-empty `text` string or a non-empty `segments` array; each segment has exactly one of a
non-empty `text` string or a non-negative integer `citation` index. A table has a non-empty string
`headers` array and a non-empty `rows` array of string cells whose length exactly equals the header
count. Every inline `citation` index resolves to a defined citation. The contract test owns the
literal accepted-key lists and all deny cases.

The CLI uses only these non-success codes: `E_DRAFT_INPUT` (missing/unreadable input),
`E_DRAFT_JSON` (invalid JSON), `E_DRAFT_BLOCK` (draft/block/segment/table shape),
`E_CITATION_UNRESOLVED`, `E_CITATION_ENVELOPE`, `E_CITATION_UNCITABLE`,
`E_EVIDENCE_LINK_POLICY`, `E_OUTPUT_ROOT`, and `E_OUTPUT_WRITE`. A validation failure is one of the
first seven codes and must leave every pre-existing output-root file byte-identical.

When a new approved host is needed, update the allowlist, contract documentation, allow/deny
fixtures, and fresh gate evidence in one reviewed change; do not add a wildcard.

## Gate execution and evidence contract

### Test-first delivery rule

For each implementation step, add the named focused test and fixture first, observe the expected
failure against current behavior, then make the smallest renderer change that turns that test green.
Do not add a production renderer module, CLI option, or isolation wrapper before its named test
exists. A green focused test never replaces its mapped retained gate evidence.

`npm run verify:render` is the final ordered suite for G-P3-01 through G-P3-05 only. It runs the
literal map in `cowork-p2-kit/render/tests/verify-render.mjs`, invokes
`cowork-p2-kit/render/tests/run-gate.mjs` for every automated gate, writes gate evidence below
`docs/reports/qbd-p3-render-layer/gates/`, and fails if any child test is nonzero, timed out,
failed, skipped, todo, or cancelled. Its per-gate evidence uses the Phase 2 key set and semantics:
`gate_id`, `status`, `command`, `exit_code`, `raw_tap_output`, `raw_stderr`, `timestamp`, `run_id`,
`suite_run_id`, `assertions_summary`, `snapshots`, `timeout_ms`, `duration_ms`, `timed_out`, and
`signal`. `gate-evidence-validator.mjs` rejects a pass record that lacks a complete successful TAP
summary or any required key. The only manual input is the completed G-P3-05 viewer checklist; its
test verifies the required fields before the suite may pass.

The package may be planned while the old workstream remains in `project-state.yaml`. Before moving
Step 1 to `in-progress`, update that generated state only through `baton state write-state` with its
optimistic-concurrency arguments, then run `baton state validate`. Do not edit generated state files
by hand and do not claim a Phase 3 gate passed during this planning change.

## Ordered execution

| Step | Execution file | Status | Blocking gates |
|---|---|---|---|
| 1 | [Freeze render contract and test boundary](./step-01-freeze-render-contract.md) | completed | G-P3-01 |
| 2 | [Implement fail-closed renderer](./step-02-fail-closed-renderer.md) | completed | G-P3-02 |
| 3 | [Run fidelity and offline spike](./step-03-fidelity-offline-spike.md) | completed | G-P3-03, G-P3-04 |
| 4 | [Prove determinism and viewer fidelity](./step-04-determinism-viewer-evidence.md) | completed | G-P3-05 |
| 5 | [Review closure and handoff](./step-05-review-closure-handoff.md) | completed | G-P3-06 |

Only this table may transition a step from `pending` to `in-progress` to `completed`. A completed
step requires every listed gate to be `pass` with readable version-controlled evidence.

## Dependencies and stop conditions

1. Step 2 may begin only after the citation contract and exact-host fixtures are frozen by G-P3-01.
2. Step 3 may begin only after invalid input preserves the existing DOCX and G-P3-02 passes.
3. Step 4 may begin only after OOXML semantics and isolated-network evidence pass **and** the
   human approval required by `T20260723-qbd-p3-render-step-04.yaml` is recorded. Its
   `awaiting_approval` state blocks test creation, preflight, rendering, and evidence writes.
4. If G-P3-03 or G-P3-04 fails, stop. A separate approved plan is required before provisioning or
   selecting any fallback renderer.
5. Phase 3 is done only after all G-P3-01 through G-P3-06 gates pass; a blank viewer checklist or
   unavailable isolation runner is blocking, not deferred success.

## Exit acceptance

- `npm run verify:render` passes with no failed, skipped, todo, cancelled, or timed-out test.
- Uncitable, malformed, unresolved, or unapproved-link citations fail before replacing an existing output.
- OOXML contains exactly the expected positive footnotes, inline references, hyperlink relationships,
  TOC field, and table markup for the committed fixture.
- The actual spike succeeds under `bwrap --unshare-net`; no prior report substitutes for this run.
- Two identical inputs have identical normalized OOXML content, and an engineer records a passing viewer checklist.
- GitNexus change detection and review find no unexpected flow or architecture impact.
