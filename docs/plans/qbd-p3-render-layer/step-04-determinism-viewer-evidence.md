# Step 4 — Prove Determinism and Viewer Fidelity

## Goal

Turn the renderer's deterministic and visual-fidelity claims into retained evidence.

## Preconditions

- G-P3-03 and G-P3-04 are `pass`.

## Exact file map

- `cowork-p2-kit/render/{normalize-ooxml,render-docx}.mjs`
- `cowork-p2-kit/render/tests/{determinism,viewer-checklist}.test.mjs`
- `docs/reports/qbd-p3-render-layer/gates/G-P3-05-viewer.md`
- `cowork-p2-kit/render/README.md` and active architecture documentation only when evidence exists

## Work

1. Render the committed fidelity fixture twice. `normalize-ooxml.mjs` produces a sorted manifest of
   `zip-entry-path: SHA-256(uncompressed bytes)` for every entry; it ignores only ZIP container
   metadata (timestamps, external attributes, ordering, and compression representation), never XML,
   relationships, media, or any entry payload.
2. Create `G-P3-05-viewer.md` from the committed template and require reviewer name, date, viewer
   product/version, host baseline, input hash, output hash, and individual pass/fail observations for
   positive footnotes, the approved clickable link, plain local provenance, TOC, and table layout.
   LibreOffice or Microsoft Word is accepted only when the exact product/version is recorded.
3. `viewer-checklist.test.mjs` fails on any blank, missing, or non-pass required field. Only then run
   the full `npm run verify:render` suite and retain G-P3-01…05 evidence from that single suite UUID.
4. Update renderer documentation and active architecture wording only with the verified renderer
   decision and evidence links; do not name a fallback as selected or evaluated.

## Validation

- Run G-P3-05 and retain the normalization command, hashes, viewer/version, reviewer, date, and checklist verdict.

## Stop conditions

- A missing, partial, or failed viewer checklist blocks completion.
- Do not claim a fallback renderer was evaluated or selected without its own evidence.
