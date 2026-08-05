---
title: Placeholder template probe rework boundary
date: 2026-08-04
summary: "Field-map and synthetic receipt contracts pass; the authorized mock has paragraph-owner drift, so promotion is held."
---

# Placeholder template probe rework boundary

## What happened

- Compiled the frozen PO-supplied placeholder template into a 146-anchor field map with explicit metadata, tagged owners, deterministic occurrence IDs, and stable output bytes.
- Added isolated extraction and receipt validation; synthetic fixtures preserve exact raw values and the page-provenance boundary.
- The authorized filled mock fails closed with `E_STRUCTURE_DRIFT`: its paragraph owners and literal boundaries do not match the frozen map.

## Decision

Hold promotion and rework the input contract. Reissue the mock from the frozen template, or freeze a new template version and compile a new map. Do not infer values by labels or semantics, and do not change the committed record schema.

## Next steps

- Obtain a structurally compatible filled mock or approve a new template version.
- Re-run extraction, then the two-run isolated workflow and downstream coverage.
- Preserve the evidence report and keep probe outputs non-citable.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
