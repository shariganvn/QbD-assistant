---
title: Step 3 publication and file-boundary decisions
id: D20260721
status: active
date: "2026-07-21"
scope: qbd-p2-ingest-completion-step-03
affects:
  - docs/plans/qbd-p2-ingest-completion/step-03-harden-publication-and-file-boundaries.md
  - docs/plans/qbd-p2-ingest-completion/gates.yaml
  - cowork-p2-kit/ingest/
read_when: Before implementing Step 2 fixture seams or any Step 3 publication, path, or parser boundary.
---

# Step 3 Publication and File-Boundary Decisions

## Purpose

Make the remaining Step 3 choices executable and testable without interpreting alternatives during
implementation. These decisions refine the canonical plan and its gates; they do not change step
status or waive any gate.

| ID | Accepted decision | Product effect |
|---|---|---|
| D1 | Reject a second concurrent publication immediately. | A second ingest receives `E_PUBLICATION_LOCKED`, exits nonzero, and writes no store file. |
| D2 | Recover a stale lock only when its owner process is absent and it is at least five minutes old. | A crashed run does not block later work forever; live, fresh, malformed, or indeterminate locks fail closed. |
| D3 | Validate every output record against the full `records.schema.json` contract before publication. | Required fields, types, enums, nested objects, and other schema constraints are all enforced. |
| D4 | Fail closed on path traversal, absolute paths outside configured roots, duplicate normalized paths, unsupported extensions, and every symlink. | Admitted inputs and publication files cannot escape their configured roots. |
| D5 | Invoke the configured absolute LiteParse binary with literal argument arrays and no shell. | File names and shell metacharacters are data, never commands. |
| D6 | Use a crypto-random, at-least-128-bit run identifier in a unique sibling temp-file name. | Runs cannot share or delete one another's temp files. |
| D7 | Commit a minimal non-sensitive DOCX happy-path fixture, expected JSONL snapshot, and checksums. | Reproducible tests do not depend on local documents or LibreOffice generation. |
| D8 | Generate machine-readable gate evidence automatically after a passing run. | Evidence records the command, result, hashes, run identifier, and timestamp; it cannot be hand-declared as pass. |
| D9 | Retain a failed-run log only under `artifacts/qbd-p2-ingest-completion/runs/`, never under the store root. | Failures remain diagnosable without changing the published store or its metadata. |

## Consequences

- Step 2 remains the blocking prerequisite: it must expose injected roots, typed errors, process
  probes, clock, and failure seams needed by these behaviours.
- The choice of JSON Schema library is not a product decision. Any library used must enforce the
  complete existing schema and be added as a direct, exact-pinned dependency; no partial validator
  is acceptable.
- The canonical Step 3 execution contract and G-03 through G-06 acceptance definitions contain
  the authoritative implementation and verification detail.
