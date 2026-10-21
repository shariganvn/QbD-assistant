---
title: qbd_core P.2 orientation draft scope
id: D20261021
status: active
date: "2026-10-21"
scope: qbd_core
supersedes: null
affects:
  - qbd_core/
  - docs/plans/qbd-core-p2-autodraft/
read_when: Working on qbd_core/, or deciding whether automatic P.2 drafting may live outside cowork-p2-kit/ and tools/pharma-dev-draft/.
---

# D20261021 — qbd_core P.2 orientation draft scope

## Decision

`qbd_core/` is a new Python pipeline. From three inputs (active substance, up to three; dosage form,
one of 38 values in groups N1-N9; market: EU, domestic, both) it assembles an internal, gap-flagged
orientation draft of the P.2 pharmaceutical development report per SOP-RD-001 v02, so a researcher can
set direction when a project is assigned.

1. D20260727 and D20260728 are unchanged and remain true of `cowork-p2-kit/`. `qbd_core/` is a separate
   system and does not import from, or export to, `cowork-p2-kit/`.
2. `tools/pharma-dev-draft/` is unchanged (D20260825). `qbd_core/` may invoke its renderer, validator
   and verifier **as CLIs through a subprocess**, and may read its schema files. It does not import its
   modules, and the tool does not import `qbd_core/`. The contract between them is `draft.json`.
3. Output always carries the fixed notice "internal draft, not FD-approved, not a dossier submission".
   Approval by the head of R&D (step A13) is never automated.
4. No parameter value is hard-coded. A value without a source is a gap (`CẦN DỮ LIỆU`) in the Data Gap
   Register, never a filled number. Active-substance combinations are out of SOP scope and are flagged.
5. Internal repository first; external lookup only with citation (source, address, access date).
   Documents of group B, C or unclassified never leave the machine. Until a zero-data-retention
   contract exists, a real LLM provider receives group A material only. Failure of any check is
   fail-closed: nothing is published and the previous output keeps its hash.
6. The CQA set must be confirmed by a person (gate 3.5) before dependent agents run.

## Consequences

- A new module tree and CI are added; the Node renderer stays the only docx producer.
- The ADR for module boundaries moves from draft to accepted when its open questions are answered
  in step 00 of the plan.
