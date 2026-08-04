---
title: Freeze PO-supplied placeholder template
date: 2026-08-04
summary: Completed the isolated Phase 01 template intake freeze and verifier.
---

# Freeze PO-supplied placeholder template

## What happened

- Froze the PO-supplied FD-like MVP template and its public/synthetic mock as isolated, non-citable probe inputs.
- Added versioned intake contracts and a read-only OOXML verifier under `cowork-p2-kit/template-probe/intake/`.
- Verified both source hashes, 146 unique anchors, exact owner locations, approved paragraph owners, split runs, merge restart ownership, and canonical-ingest exclusion.

## Decision

- Keep the immutable source token `EXPERIMENT-DISCRIPTION` for provenance; compile it later through the sole canonical alias `EXPERIMENT-DESCRIPTION`.
- Keep `CONCLUSION` reference-only and never writable or derivable by this probe.
- Do not admit either DOCX to the canonical classification manifest.

## Next steps

- Phase 02 may build the field-map compiler only against the frozen intake contracts.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
