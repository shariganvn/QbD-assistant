# Step 3 — Derive the readable rationale

Step 3 turns the validated rationale JSON into `rationale.md`. It is a pure rendering step. It adds no
claim, resolves no new source, and makes no publication or filesystem decision beyond reading files
for the regeneration assertion.

## Goal

`rationale.md` is a byte-exact function of the published canonical JSON. Consistency is proved by
regeneration equality, exactly as P4 proves `formula-decision.md`.

## Exported functions

`cowork-p2-kit/rationale/rationale-markdown.mjs`:

- `renderRationaleMarkdown(rationale, packet)` — pure, deterministic, returns a UTF-8 string ending in
  exactly one LF.
- `assertRegeneratedRationaleMarkdown(packageRootOrPaths)` — reads the published `rationale.json`,
  `rationale-packet.json`, and `rationale.md`, renders, and compares bytes. A mismatch throws
  `E_RATIONALE_MARKDOWN_REGENERATION`.

## Rendered content, in this order

1. Title and the internal-only label.
2. Header block: `rationale_id`, `packet_id`, `packet_sha256`, `decision_id`, `decision_sha256`,
   `cohort_id`, `run_id`, `decision_status`, `winner` or literal `null`, `fd_action`,
   `display_state`, cohort basis from `packet.cohort.cohort_basis`, attestation ID and SHA-256 or
   literal `null`.
3. The validated `fd_action` decision-state claim for an inconclusive decision, rendered in stored
   claim order; there is no separate free-text explanation field.
4. Claims, in stored `claim_id` order. For each: claim ID, kind, text, then its resolved citations in
   stored order.
5. Quoted evidence, when a `fact` claim cites quotes.

The renderer must not sort, summarize, translate, infer, aggregate, or narrate. Every ordering comes
from the already validated artifact.

## Untrusted text handling

Quote text and claim text are untrusted Markdown. Render both in a deterministic literal-safe form
that neutralises Markdown and HTML syntax (including headings, lists, links, fences, backticks, `&`,
`<`, and `>`), while preserving the original UTF-8 value in a deterministic escaped representation.
The displayed representation may not be described as verbatim source bytes. The fixtures include each
listed Markdown form and assert that none becomes active markup.

## Regeneration equality is the only check

There is no parse-and-agree comparison and no hand-authored Markdown exception. A file that a human
wrote which happens to state the same facts is rejected wholesale, because accepting it would mean the
readable artifact is no longer derived from validated JSON.

## Inconclusive rendering

An inconclusive rationale renders the exact FD-action decision-state claim and the exclusion/gate claims that record
the missing or conflicting evidence. It contains no winner line and no recommendation line. The
`winner` field renders as the literal `null`, never as an empty string or an interpretive phrase.

## Files

Create: `cowork-p2-kit/rationale/rationale-markdown.mjs`,
`cowork-p2-kit/rationale/tests/rationale-markdown.test.mjs`.
Extend: `cowork-p2-kit/rationale/errors.mjs` with `E_RATIONALE_MARKDOWN_REGENERATION`.

## TDD sequence

1. Write `tests/rationale-markdown.test.mjs` first, covering every G-RL-03 assertion, including the
   hand-authored-but-agreeing file and the whitespace-only difference.
2. Record the red result as `gates/red/G-RL-03-<YYYYMMDD>.json`.
3. Implement, pass, copy `G-RL-03.json` to `gates/step-close/`.
4. Re-run G-RL-01 and G-RL-02.
5. Set the Step 3 row in `plan.md` to `completed`.

## Risks

| Risk | Mitigation |
|---|---|
| A "nicer" renderer is added later that reformats or groups claims | Regeneration equality makes any renderer change a deliberate, test-visible change; the gate asserts stored order |
| Literal-safe rendering makes quotes less compact for FD to read | The displayed escaped representation is deterministic and visibly identified as untrusted source text; active Markdown is not permitted |
| Markdown becomes the artifact people cite instead of the JSON | The header carries `packet_sha256` and `decision_sha256`, so any Markdown copy remains traceable to its source |
