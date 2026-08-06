---
phase: 4
title: "Render, prove determinism/isolation, retain review artifact"
status: completed
priority: P1
effort: "5h"
dependencies: [3]
---

# Phase 4: Render, prove determinism/isolation, retain review artifact

## Context links

- `cowork-p2-kit/workflow-trial/spike-e2e-run.mjs` (five-stage wiring reference;
  its direct render call is not the isolation authority)
- `cowork-p2-kit/render/document-builder.mjs`, `.../normalize-ooxml.mjs`,
  `.../determinize-ooxml.mjs`, `.../render-docx.mjs`
- Phase 3 draft + adapter

## Overview

Wire the demo end-to-end: template + isolated ingest → exact join + augmented
isolated store → selected reasoning → sealed/validated rationale → rich draft →
sandboxed render. Render through the existing Bubblewrap owner, not the spike's
direct in-process call. Prove text order, determinism, and containment; retain
the DOCX under the ignored review-artifact root.

## Requirements

- One runner command produces one DOCX in a fresh directory under
  `artifacts/template-docx-content-demo/`; tests may inject a temp output root.
- Render uses `render/run-isolated-spike.mjs` with Bubblewrap
  `--unshare-net`. Missing/unusable Bubblewrap is a hard failure; no direct
  `buildDocumentBuffer` fallback.
- Ordered DOCX text begins with the exact watermark before `Mục lục`, then
  contains the section heading, ≥2 body paragraphs, ≥1 synthetic-score table,
  and a Sources section with exactly three exact-join citations. It contains no
  `⏳ Chờ dữ liệu`.
- Two runs → equal normalized OOXML; raw SHA-256 recorded diagnostically.
- Immutable roots are exactly `cowork-p2-kit/inputs`, `cowork-p2-kit/store`, and
  `cowork-p2-kit/outputs`, plus a startup hash map of every pre-existing dirty
  tracked file. Plan reports and ignored artifacts are authorized outputs.
- Markdown evidence belongs in
  `plans/260805-1815-template-docx-content-demo/reports/`. The retained binary
  belongs in ignored `artifacts/template-docx-content-demo/<run-id>/`; print its
  absolute path and hashes.

## Files to create / modify

| Action | Path | Note |
|---|---|---|
| Create | `cowork-p2-kit/workflow-trial/content-demo-run.mjs` | Orchestrates the five stages into the rendered demo DOCX |
| Modify | `cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs` | Render text + determinism + no-mutation assertions |
| Modify if required | `cowork-p2-kit/render/run-isolated-spike.mjs` | Admit the explicit controller-owned artifact layout without weakening existing root checks |
| Modify if required | `cowork-p2-kit/render/tests/isolated-network.test.mjs` | Preserve old rejects and prove the narrow content-demo layout |

## Implementation steps

1. Snapshot immutable roots and pre-existing dirty tracked files before any run
   write. Create the authorized artifact/report roots separately.
2. Run all upstream stages in isolated run-owned paths, write the validated draft
   there, then invoke the existing Bubblewrap wrapper with explicit argument
   arrays. If its root policy rejects the new artifact layout, extend only that
   narrow allowlist and add regression tests.
3. Reopen the DOCX ZIP and inspect ordered `word/document.xml` text runs. Assert
   the watermark is first and precedes `Mục lục`; assert body/table/Sources,
   exactly three citation excerpts, and no wait-data text.
4. Render twice in fresh roots; compare normalized OOXML manifests and record
   raw hashes diagnostically.
5. Re-hash immutable roots and dirty-file baseline. Fail on any difference while
   ignoring only the explicit plan report and artifact outputs.
6. Retain one review DOCX and print its absolute path plus hashes.

## Gate G-04 — Rendered DOCX carries the demo content and the watermark

- Requirement: Bubblewrap receipt proves `--unshare-net`; ordered DOCX text
  starts with the exact watermark before `Mục lục`, then has the heading, ≥2
  paragraphs, a synthetic-score table, exactly three cited Sources entries, and
  no `⏳ Chờ dữ liệu`.
- Boundary / owner: `content-demo-run.mjs` + `render/*`; Phase 4.
- Fixture: Phase 2 pack → Phase 3 draft.
- Command: `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs`
- Expected exit/output: exit `0`; text assertions pass; DOCX exists under the run
  root.
- Negative cases: missing/unusable Bubblewrap; unsandboxed fallback; watermark
  after TOC; citation count drift; any `chờ_dữ_liệu`.
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/render-content.md`
  (+ retained DOCX path)
- Blocks: —
- Status: passed (2026-08-06)

## Gate G-05 — Two runs are deterministic

- Requirement: normalized OOXML manifests are equal across two fresh runs.
- Boundary / owner: `render/normalize-ooxml.mjs`; Phase 4.
- Fixture: same data pack, two runs.
- Command: `node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs`
- Expected exit/output: exit `0`; normalized manifests equal; raw hashes logged.
- Negative cases: a nondeterministic field would break manifest equality.
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/determinism.md`
- Blocks: —
- Status: passed (2026-08-06)

## Gate G-06 — No canonical mutation

- Requirement: the three exact canonical roots and baseline dirty tracked files
  are byte-identical before/after; only plan reports and ignored artifacts may
  differ.
- Boundary / owner: `content-demo-run.mjs` write containment; Phase 4.
- Fixture: pre/post hash snapshot.
- Command: `git status --porcelain` + a hash-diff assertion in the test.
- Expected exit/output: exit `0`; zero unexpected changes outside authorized
  report/artifact roots.
- Negative cases: canonical write; dirty-file drift; untracked output outside
  authorized roots; symlinked artifact root.
- Evidence artifact: `plans/260805-1815-template-docx-content-demo/reports/no-mutation.md`
- Blocks: —
- Status: passed (2026-08-06)

## Success criteria

- [x] G-04, G-05, G-06 all pass; DOCX retained and path reported to the PO.
- [x] Plan exit acceptance in `plan.md` is satisfied.

## Risks

Retaining the artifact is intentional. The ignored artifact root must be a real
directory, never a symlink, and every DOCX remains watermarked. Markdown review
evidence is durable with the plan; generated binaries never become canonical or
tracked by Git.

<!-- Updated: Validation Session 1 - require Bubblewrap and separate immutable from authorized output roots -->
