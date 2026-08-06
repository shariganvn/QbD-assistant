# Draft and rationale assertions

Date: 2026-08-06

Command:

```text
node --test cowork-p2-kit/workflow-trial/tests/content-demo.test.mjs
```

Result: pass, including same-packet rationale and draft contract checks.

The rationale was authored from the selected sealed packet, published through
the existing rationale CLI, and retained with `display_state: internal_only`.
Its packet ID, decision ID/hash, cohort ID, winner, and action all agree with
the source packet.

The validated draft has:

- exact title: `SYNTHETIC / DEMO — không dùng để nộp hoặc trích dẫn`
- one representative P.2.2.1-style heading
- two body paragraphs
- citation segments for exactly three exact joins
- one synthetic score table
- zero `chờ_dữ_liệu` blocks

The draft passes both `validateDraft` and the demo-specific watermark/content
guard. The adapter deep-clones citation envelopes, so downstream draft edits do
not mutate the source citation pack. Mock excerpts do not occur in uncited body
or table text, and the prose explicitly states that the citations demonstrate
provenance format rather than supporting the synthetic score or selected
outcome.

Negative checks pass for a changed watermark, an inserted wait-data block, and
an uncitable citation.
