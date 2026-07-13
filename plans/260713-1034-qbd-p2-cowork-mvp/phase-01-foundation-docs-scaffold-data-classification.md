---
phase: 1
title: "Foundation — docs + scaffold + data-classification"
status: pending
priority: P1
effort: "0.5d"
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
- Create: `cowork-p2-kit/inputs/{product-profile.md, trials/.gitkeep, reference/.gitkeep}`
- Create: `cowork-p2-kit/inputs/trials/{formulation-trial-*.md}` — 2–3 **synthetic** bisoprolol
  trial files, each with a real formulation×attribute comparison table, labeled `public`
  (the pipeline's only trusted input; no phase else authors it).
- Create: `cowork-p2-kit/inputs/classification-manifest.json` — explicit `path → {label, citable}`
  map; the mechanism that assigns labels (liteparse cannot infer them).
- Create: `cowork-p2-kit/render/.gitkeep` (Layer C home; Phase 3 populates it)
- Create: `cowork-p2-kit/template/p2-template.md` (layout placeholder; see Risk on P0.2)
- Create: `cowork-p2-kit/rubric/scoring-90-100.md` (stub; filled in Phase 6)
- Create: `cowork-p2-kit/store/.gitkeep`, `cowork-p2-kit/outputs/.gitkeep`
- Create: `cowork-p2-kit/.gitignore` — ignore `store/**` and `outputs/**` except `.gitkeep`
  (never commit extracted quotes / rendered dossier content).
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
   (`path → {label, citable}`); a file absent from the manifest is unlabeled ⇒ `internal`
   fail-closed. Include the one-line JSON shape the store (Phase 2) persists.
3. Author `inputs/trials/formulation-trial-*.md` — 2–3 synthetic bisoprolol trial files with a
   genuine comparison table, register them `{public, citable:true}` in the manifest. These are
   the only trusted inputs; without them Phases 2/4/6 have nothing to run on.
4. Seed `inputs/product-profile.md` for bisoprolol 5/10 mg film-coated tablet from public
   facts only (drug substance identity, strengths, dosage form) — classify `{public, citable:true}`.
5. Scaffold `template/p2-template.md` from the VN P.2 form **as layout only**, with a header
   note that the citable regulatory taxonomy source is unconfirmed (P0.2).
6. Confirm `npm run docs:check` passes.

## Success Criteria

- [ ] `cowork-p2-kit/` tree exists with all scaffold files (incl. `render/`, `.gitignore`).
- [ ] `data-classification.md` documents both axes (sensitivity label + `citable` flag),
      fail-closed rule, MVP public-only admission, and the `classification-manifest.json` mechanism.
- [ ] 2–3 synthetic `inputs/trials/formulation-trial-*.md` exist with a comparison table,
      registered `{public, citable:true}` in the manifest.
- [ ] `product-profile.md` seeded with public bisoprolol facts, `{public, citable:true}`.
- [ ] `.gitignore` excludes `store/**` and `outputs/**` (except `.gitkeep`).
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

> Red Team (260713): this phase absorbed the fixes for the classification/admission chain,
> the do-not-cite trust axis, the missing mock-trial-data owner, and the store `.gitignore`.
> See `plan.md` → Red Team Review.
