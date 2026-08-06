---
title: Validate template-to-DOCX trial plan
date: 2026-08-05
summary: Red-team and validation decisions for the internal structural workflow trial
---

# Validate template-to-DOCX trial plan

## What happened

- Drafted and red-teamed the seven-phase template-to-DOCX structural trial.
- Empirical LiteParse 2.0.0 evidence supports three exact and two unmapped receipt values.
- Validation interview confirmed four implementation boundaries.

## Decisions

- Fail on any 3/2/0 mapping drift.
- Use a visibly synthetic trial-candidate-01 profile.
- Use hash pins, isolated roots, and direct timeouts for template/ingest; Bubblewrap remains mandatory for render.
- Cleanup by default; retain an immutable review bundle only on explicit request.

## Next steps

- Implement only after handing the validated plan to ak:cook.
- Preserve the existing 18 dirty tracked files and avoid retained-evidence verify suites.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
