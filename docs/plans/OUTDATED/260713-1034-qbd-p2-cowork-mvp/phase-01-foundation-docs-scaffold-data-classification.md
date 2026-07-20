---
phase: 1
title: "Foundation — docs + scaffold + data-classification"
status: done
priority: P1
effort: "0.75d"
dependencies: []
---

# Phase 1: Foundation — docs + scaffold + data-classification

## Overview

Stand up the project substrate: the four project docs (already initiated this session), the
`cowork-p2-kit/` folder tree, the seed product profile, and the data-classification convention
that every later phase relies on.

## Requirements

- Functional: kit tree exists as runnable scaffold; every input can be labeled with a
  data-classification; bisoprolol product profile seeded from public/mock facts.
- Non-functional: KISS scaffold (stubs, not premature abstraction); files < 200 lines.

## Architecture

Layer-A/B/C split and the 3 guardrail layers are defined in `docs/system-architecture.md`.
This phase creates the folder shape those layers populate. Classification is the admission
control feeding guardrail layer 2 (egress) — see `docs/glossary.md`.

## Related Code Files

- Create: `cowork-p2-kit/{SKILL.md, README.md}` (stubs)
- Create: `cowork-p2-kit/inputs/{trials/.gitkeep, reference/.gitkeep}`
- Create: `cowork-p2-kit/inputs/src/{product-profile.md, formulation-trial-*.md}` — **authored
  markdown source** (human-reviewable, git-committed, clean diffs). 2–3 **synthetic** bisoprolol
  trial files, each with a real formulation×attribute comparison table, plus the product profile
  (the pipeline's only trusted inputs; no phase else authors them).
- Create: `cowork-p2-kit/inputs/build-inputs.mjs` — converts `inputs/src/*.md` → `.docx` via
  headless LibreOffice. **Ingest inputs must be `.docx`, not `.md`: liteparse rejects `.md`
  outright** (`conversion error: unsupported file format: .md`, verified) and `.md` has no page
  or textItem concept for provenance. Generated `inputs/{product-profile.docx,
  trials/formulation-trial-*.docx}` are git-ignored and rebuilt with `npm run inputs:build`.
- Create: `cowork-p2-kit/inputs/classification-manifest.json` — explicit `path → {label, citable,
  ocr_language}` map; the mechanism that assigns labels (liteparse cannot infer them). Paths
  reference the **generated `.docx`** (the ingest input), not the `.md` source.
- Create: `cowork-p2-kit/render/.gitkeep` (Layer C home; Phase 3 populates it)
- Create: `cowork-p2-kit/template/p2-template.md` (layout placeholder; see Risk on P0.2)
- Create: `cowork-p2-kit/rubric/scoring-90-100.md` (stub; filled in Phase 6)
- Create: `cowork-p2-kit/store/.gitkeep`, `cowork-p2-kit/outputs/.gitkeep`
- Create: `cowork-p2-kit/.gitignore` — ignore `store/**` and `outputs/**` except `.gitkeep`
  (never commit extracted quotes / rendered dossier content), plus the generated
  `inputs/**/*.docx` (regenerable from `inputs/src/`; keep binaries out of diffs).
- Modify: `package.json` — add the `inputs:build` / `ingest` / `render` script stubs here, in
  Phase 1 (see Step 6). Phase 1 owns the **`scripts` block**; Phase 2 does not touch
  `package.json` at all, and Phase 3 only adds the `docx` **dependency** in its Step 0. No two
  parallel phases write this file.
- Create: `cowork-p2-kit/data-classification.md` (label convention)
- Already done (this session): `docs/system-architecture.md`, `docs/code-standards.md`,
  `docs/project-roadmap.md`, `docs/glossary.md`, `docs/docs-state.yaml` registration.

## Implementation Steps

1. Create the `cowork-p2-kit/` tree above (incl. `render/` and `.gitignore`) with stub content
   and short READMEs per subfolder.
2. Write `data-classification.md`. Two orthogonal axes per record:
   - **Sensitivity label** `public` / `internal` / `internal-derived`; **unlabeled ⇒ internal
     (fail-closed)**; MVP admits `public`/mock only.
   - **`citable` flag** (trust axis, independent of sensitivity): a source can be `public` yet
     **not citable** (e.g. cross-drug reference docs). Default `citable:false` whenever the
     source's `docs-state` is `reference`; Layer B refuses to cite `citable:false` records.
   Define the **label-assignment mechanism explicitly**: `inputs/classification-manifest.json`
   (`path → {label, citable, ocr_language}`); a file absent from the manifest is unlabeled ⇒
   `internal` fail-closed. `ocr_language` is a **required, explicit** per-file field (`vie` |
   `eng`) — liteparse's `--ocr-language` default is `eng`, so a Vietnamese page OCR'd under the
   default returns garbage. Include the one-line JSON shape the store (Phase 2) persists.
3. Author `inputs/src/formulation-trial-*.md` — 2–3 synthetic bisoprolol trial files with a
   genuine markdown comparison table (formulation × attribute). These are the only trusted
   inputs; without them Phases 2/4/6 have nothing to run on.
4. Seed `inputs/src/product-profile.md` for bisoprolol 5/10 mg film-coated tablet from public
   facts only (drug substance identity, strengths, dosage form).
5. Write `inputs/build-inputs.mjs` + wire `npm run inputs:build`: convert every `inputs/src/*.md`
   to `.docx` with `soffice --headless --convert-to docx --outdir <dest>`, trials landing in
   `inputs/trials/`, the profile in `inputs/`. Register each **generated `.docx`**
   `{label:"public", citable:true, ocr_language:"vie"}` in the manifest. Verified: LibreOffice
   markdown import emits a genuine Word table (`<w:tbl>`), and `lit parse --format json` returns
   one `textItem` per cell with distinct x per column — the grid Phase 2 reconstructs from.
6. Add the **shared-file script stubs to `package.json` in this phase** so the parallel Phase 2/3
   never co-edit it (lost-update guard): `inputs:build` (Step 5), `ingest` (Phase 2 fills),
   `render` (Phase 3 fills). Stubs may be no-op placeholders exiting nonzero with "not yet
   implemented".
7. Document the **system dependencies** the kit shells out to, in `cowork-p2-kit/README.md`:
   LibreOffice (`/usr/bin/soffice` — required both to build `.docx` inputs and for liteparse's own
   DOCX→PDF conversion path) and Ghostscript (`/usr/bin/gs`). Both verified present; record the
   installed versions so a missing runtime fails loudly rather than mid-ingest.
8. Scaffold `template/p2-template.md` from the VN P.2 form **as layout only**, with a header
   note that the citable regulatory taxonomy source is unconfirmed (P0.2).
9. Confirm `npm run inputs:build` produces parseable `.docx` (`lit parse --format json` returns
   non-empty `pages[].textItems`) and `npm run docs:check` passes.

## Success Criteria

- [ ] `cowork-p2-kit/` tree exists with all scaffold files (incl. `render/`, `.gitignore`).
- [ ] `data-classification.md` documents both axes (sensitivity label + `citable` flag), the
      required `ocr_language` field, fail-closed rule, MVP public-only admission, and the
      `classification-manifest.json` mechanism.
- [ ] 2–3 synthetic `inputs/src/formulation-trial-*.md` exist with a comparison table.
- [ ] `inputs/src/product-profile.md` seeded with public bisoprolol facts.
- [ ] `npm run inputs:build` converts every `inputs/src/*.md` → `.docx`; each generated file is
      registered `{public, citable:true, ocr_language}` in the manifest, and
      `lit parse <file>.docx --format json` returns non-empty `pages[].textItems` (proves the
      ingest input is liteparse-readable — an `.md` input is not).
- [ ] `package.json` carries the `inputs:build` / `ingest` / `render` script stubs.
- [ ] `README.md` records LibreOffice + Ghostscript as system deps with installed versions.
- [ ] `.gitignore` excludes `store/**`, `outputs/**` (except `.gitkeep`), and `inputs/**/*.docx`.
- [ ] `template/p2-template.md` carries the P0.2 taxonomy-source caveat.
- [ ] `npm run docs:check` OK.

## Risk Assessment

- **P0.2 (tracked risk):** no named regulatory guideline yet (only "File Word template
  chuẩn"). The template is layout-only until FD names guideline/authority/version/date; flag
  in the template header, do not invent a taxonomy.
- **P0.5 (tracked risk):** retention window unresolved; the classification doc notes the
  MVP-default (keep derived artifacts for project duration, configurable) pending FD confirm.
  The `.gitignore` on `store/**`/`outputs/**` enforces "no committed extracted content" now,
  independent of the retention decision.

- **LibreOffice is now load-bearing (verified present):** it converts `inputs/src/*.md` → the
  `.docx` ingest inputs, and liteparse's own DOCX path shells out to it. A missing/older
  LibreOffice changes input fidelity silently, so Step 7 records the version and Step 9 asserts
  the generated `.docx` actually parses. Conversion output is not byte-reproducible (embedded
  timestamps) — hence `.docx` is git-ignored and the `.md` source is the reviewed artifact.

> Red Team (260713): this phase absorbed the fixes for the classification/admission chain,
> the do-not-cite trust axis, the missing mock-trial-data owner, and the store `.gitignore`.
> See `plan.md` → Red Team Review.

<!-- Updated: Validation Session 1 - P0.2 (template layout-only + caveat) and P0.5 (retain for project duration, configurable, store/**+outputs/** git-ignored) defaults CONFIRMED as tracked risks, not blockers. No content change. -->
<!-- Updated: Validation Session 2 - BLOCKER fix: trial/profile inputs are .docx generated from .md source via headless LibreOffice (liteparse rejects .md, verified). Added inputs/src/ + build-inputs.mjs + inputs:build. Manifest gains required ocr_language. package.json script stubs assigned to this phase (closes the plan.md parallel lost-update gap). System deps (LibreOffice, Ghostscript) declared. Effort 0.5d -> 0.75d. -->

## Code Review Patch Posture — 2026-07-16

**Status remains done.** The review accepted the Phase-1 scaffold, classification contract,
canonical markdown inputs, generated-DOCX boundary, and dependency documentation. No production
Phase-1 file needs a remediation change.

Phase 2's negative tests must instead run with temporary input/store roots (or an equivalent
test harness) so they can exercise rejected extensions, labels, and manifest entries without
altering the canonical public mock documents owned here. Generated `.docx` files are intentionally
not byte-deterministic because LibreOffice embeds document metadata; the deterministic contract
starts at the admitted input bytes and applies to the Phase-2 JSONL output.
