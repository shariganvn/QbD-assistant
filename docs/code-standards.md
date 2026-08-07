# Code Standards — QbD P.2 kit

Status: active · Updated: 2026-07-13

Standards for building and maintaining the Cowork P.2 kit and (later) `qbd_core`.
Baseline principles: **YAGNI · KISS · DRY**, in that order.

## Structural

- Keep individual code files **under 200 lines**; split by real boundary, not for its own sake.
- **Kebab-case** for JS/TS/shell filenames; snake_case for Python; PascalCase for C#.
  Descriptive names — a name should tell a grep-reading tool the file's purpose.
- Do **not** create enhanced/duplicate files (`*-v2`, `*-new`); edit the existing file.
- Markdown lives only in `docs/` or `plans/` unless the user asks otherwise.

## Determinism & the render invariant

- **The LLM never writes the final `.docx`.** Layer B (reasoning) emits structured content
  + citations; Layer C (render) fills the document deterministically.
- Ingest (Layer A) and render (Layer C) are deterministic and must stay side-effect-clear
  so `qbd_core` can reuse them behind `KnowledgeDBPort` / `DocRenderPort`.

## Ingest & provenance

- Read docx/pdf/xlsx **only via `liteparse`** (`lit` CLI / `@llamaindex/liteparse`).
  **Never read a binary office file directly into the model context** (context blowout).
- Every stored record carries provenance `{file, page, quote}` and a **data-classification
  label**. Unlabeled ⇒ treated as internal (fail-closed).
- For scouting docx/xlsx/pdf, spawn a lower-tier subagent (Haiku/Sonnet) + `liteparse`;
  do not read the raw file in the main context.

## Grounding, citations, guardrails

- **No evidence ID → no claim.** Missing source ⇒ emit **"chờ dữ liệu"**, never fabricate.
- **Never invent lab-experiment numbers**; those stay blank/pending FD.
- Citations = **numbered + footnote + clickable link**, claim-level, evidence adjacent.
- Trial-logic checks are **Level-1 mechanical only** (unit/total mismatch,
  missing-result-with-conclusion, wrong product/substance). Do not silently expand scope.
- Vietnamese output with correct pharma terminology (see `glossary.md`).

## Provider & secrets

- Cloud LLM = Anthropic direct under ZDR, **Opus 4.8 / Sonnet 5 only** (never Fable 5 on the
  cloud track). Provider selection is **code**, not a prompt instruction.
- Never commit secrets, `.env`, API keys, or provider credentials. Never send internal-labeled
  content to a non-cleared provider.

## Docs & plans hygiene

- Không duy trì docs registry trong repo. Trạng thái workflow bám theo `plan.md` (checkbox + frontmatter `status`) và `gates.yaml`; dùng skill `ak-project-management` để track tiến độ và sync-back.
- **No plan IDs, phase numbers, or finding codes in code comments, filenames, test names, or
  commit messages.** Explain the invariant/behavior directly.
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), no AI
  references.

## Verification

- Run the narrowest useful check first (compile/lint the touched file), then broaden.
- Do not hide failing tests/lint/build errors. Implement real behavior — no mocks/shortcuts
  to pass a gate.
