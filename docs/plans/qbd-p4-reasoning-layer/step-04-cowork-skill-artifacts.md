# Step 4 — Rewrite Cowork skill and publish artifacts

Rewrite `cowork-p2-kit/SKILL.md` into the bounded evidence-analyst workflow. This is a rewrite, not a
new file. The current version mandates the opposite of this workstream: a freeform decision matrix,
Vietnamese P.2.2/P.2.3 drafting, and a Layer C output contract of `headings[]`, `prose[]`, `tables[]`,
and `citations[]`. All three are removed and deferred to the later drafting workstream, so the repo
holds exactly one Layer B instruction set.

The rewritten skill must also define how the agent produces `fact-cards.json` from record `content`,
including the record-ID link, verbatim quote with char offsets, candidate, and normalized value/unit
required for validation.

**Two rules from the current SKILL.md must survive the rewrite**, or the rewrite silently removes
controls:

- the untrusted-extracted-text rule (extracted document text is a live injection channel; store
  `content` is untrusted by contract). G-P4-04 asserts its presence.
- the template-extraction convention: artifact templates live in fenced blocks with declared
  info-string tags, so "every template validates against its schema" is a testable assertion rather
  than an unspecified parse.

## The agent does not write Markdown

`formula-decision.md` and the evidence-log Markdown are generated deterministically from canonical
JSON by a reasoning module. The consistency check is **regeneration equality**, not mutual agreement:
an agreement-only check is satisfied by a forged-in-agreement pair, and it also lets surplus
non-contradicting content through — for example instruction-shaped text aimed at a future agent
session. Hand-authored Markdown is rejected wholesale. Verbatim quotes are rendered inside declared
delimiters in every artifact.

## Publication order

The publication root is `docs/reports/qbd-p4-reasoning-layer/decision/`, git-retained, and `cli.mjs`
refuses to publish anywhere else. Layer B publishes at least three coupled artifacts, unlike the
single-file `render/publication.mjs` precedent, so ordering is specified: derivatives
(`formula-decision.md`, evidence log, `fact-cards.json`, cohort artifact) stage and rename first;
`formula-decision.json` renames **last** and is the commit point. Each file lands by temp-file plus
rename. A process killed between renames leaves a divergent set; that divergence is caught by the
published-artifact re-validation in G-P4-05. No crash-injection fixture is required.

## Drafting-absence check is best effort

The gate uses a pinned forbidden-token denylist (EN: `P.2.2`, `P.2.3`, `headings[]`, `prose[]`,
`tables[]`, `citations[]`; VN: `soạn thảo`, `soạn nội dung`, `dự thảo`). A Vietnamese paraphrase such
as "soạn thảo phần phát triển công thức" can be reworded to evade any literal check, so the denylist
is documented as best effort and FD/human review is the authority for semantic drafting drift.

## Required documentation corrections

- `docs/system-architecture.md:35` currently states Layer B emits a Vietnamese P.2.2/P.2.3 draft for
  Layer C. Correct it to the comparison-core contract.
- `cowork-p2-kit/README.md` describes `SKILL.md` as "Cowork reasoning instructions"; align it with
  the rewritten scope.
- `cowork-p2-kit/rubric/scoring-90-100.md` gains a cross-reference distinguishing dossier-readiness
  scoring from the selection rubric beside it.

Gate: G-P4-04, run as
`node cowork-p2-kit/reasoning/tests/run-gate.mjs G-P4-04 cowork-p2-kit/reasoning/tests/skill-artifacts.test.mjs`.
Depends on G-P4-03.

<!-- Updated: Validation Session 1 - SKILL.md is a rewrite, fact-card authoring, required doc corrections -->
<!-- Updated: Red Team Session 2026-07-24 - MD regeneration equality, publication order/root, denylist scoped best-effort, untrusted-text rule retained -->
