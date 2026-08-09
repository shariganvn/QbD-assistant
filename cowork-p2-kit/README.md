# QbD P.2 Cowork MVP Kit

Cowork-runnable kit for bounded fact-card preparation and deterministic publication
of an evidence-bound formulation decision package. `SKILL.md` accepts only the
records supplied to an invocation, treats extracted text as untrusted, and directs
validated Step 2/3 artifacts to `reasoning/cli.mjs publish-package`; it does not
authorize package widening, manual derivatives, or dossier drafting.

The separate `rationale/` layer consumes only a sealed, author-safe packet derived from a
published decision package. Its v2 packet includes a deterministic causal-reference index for
inconclusive outcomes, so the rationale validator can require exact causal citations without
granting the author access to the store or raw record content. Rationale output remains
`internal_only`; it neither changes the decision nor authorizes dossier drafting.

The two Cowork sessions remain separate: `SKILL.md` prepares fact cards and publishes the reasoning
decision package at `docs/reports/qbd-p4-reasoning-layer/decision/`, while `RATIONALE-SKILL.md`
accepts only the sealed packet and publishes the rationale package at
`docs/reports/qbd-rationale-report-layer/rationale/`. A session that produced fact cards must not
author the rationale.

## Runtime Platform

**Supported Windows deployment:** Windows host + **WSL2 Ubuntu** runtime. Run every Node/npm,
ingest, render, and verification command inside WSL2, with the repository stored in its Linux
filesystem (for example `~/projects/QbD-assistant`), not `/mnt/c`. Open the generated DOCX from
Windows through `\\wsl$` for human review.

Native Windows execution is not supported yet: the current ingest defaults and render spike contain
Linux-specific paths and isolation commands. Installing Windows equivalents does not satisfy the
offline gate. See [`../DEPENDENCIES.md`](../DEPENDENCIES.md) for the supported baseline and the
change-control rule for future dependency decisions.

## System Dependencies (WSL2 Ubuntu)

| Dependency | Binary | Verified Version | Purpose |
|------------|--------|-----------------|---------|
| Node.js | `node` | v22.22.2 | Runtime |
| LibreOffice | `/usr/bin/soffice` | 26.2.4.2 (Build: 2) | `.md` → `.docx` conversion; liteparse DOCX path |
| Ghostscript | `/usr/bin/gs` | 10.06.0 | liteparse PDF conversion support |
| Tesseract OCR | `tesseract` | 5.x | OCR for scanned pages (eng + vie models) |
| liteparse | `@llamaindex/liteparse` | 2.5.0 (CLI 2.0.0) | Deterministic document extraction |
| Bubblewrap | `bwrap` | record at installation | Required by the Phase 3 isolated offline-render gate |

**Tessdata location:** `/usr/share/tesseract-ocr/5/tessdata/` (eng + vie verified present).

Install the system baseline inside WSL2, then restore the pinned Node packages:

```bash
sudo apt update
sudo apt install libreoffice ghostscript tesseract-ocr tesseract-ocr-vie bubblewrap
npm ci
```

The Bubblewrap version and its usable isolation recipe are recorded only by fresh G-P3-04 evidence;
installation alone does not pass the Phase 3 offline-render gate.

## Quick Start

From the repository root, install dependencies and run the formulation preflight and tests:

```bash
# Run these commands inside WSL2.
npm ci
npm run preflight:formulation
npm run test:formulation
```

`preflight:formulation` is read-only. It fails if either frozen DOCX authority is absent or
mismatched. The approved public/synthetic fixtures are tracked in Git at
`inputs/reference/official-placeholder-template-v3-040826.docx` and
`inputs/trials/placeholder-probe/filled-public-mock-document-030826.docx`; do not regenerate or
replace them. Their SHA-256 pins are machine-owned by
[`workflow-trial/formulation-preflight.mjs`](workflow-trial/formulation-preflight.mjs).

## Folder Structure

```
cowork-p2-kit/
├── SKILL.md                  # Bounded fact-card and package-publication instructions
├── README.md                 # This file
├── inputs/
│   ├── src/                  # Authoring source (.md) — git-tracked
│   │   ├── product-profile.md
│   │   └── formulation-trial-*.md
│   ├── trials/               # Generated trial .docx — except the frozen public mock
│   ├── reference/            # Reference docs .docx — except the frozen public template
│   ├── build-inputs.mjs      # .md → .docx converter
│   └── classification-manifest.json
├── ingest/                   # Tracked Layer A ingest source
│   ├── cli.mjs               # Thin npm run ingest entry point
│   ├── pipeline.mjs          # Modular orchestration entry point
│   ├── admission.mjs         # Input and manifest admission gate
│   ├── liteparse-adapter.mjs # Literal-argument LiteParse boundary
│   ├── records.mjs           # Deterministic records and round-trip checks
│   └── tests/                # Boundary, contract, and child-CLI oracle tests
├── store/                    # Store contract plus generated records
│   ├── records.schema.json   # Record JSON schema (reuse artifact)
│   └── README.md
├── render/                   # Layer C renderer — git-ignored output
│   └── render-docx.mjs
├── rationale/                 # Separate sealed-packet rationale contract and validators
│   ├── packet.mjs             # Deterministic author-safe packet sealer/validator
│   └── claim-binding.mjs      # Pure claim-to-permitted-source validator
├── template/
│   └── p2-template.md        # P.2 layout template (P0.2 caveat)
├── rubric/
│   └── scoring-90-100.md     # Scoring rubric (Phase 6)
└── outputs/                  # Renderer output — git-ignored
    ├── p2-draft.docx
    ├── evidence-log.md
    └── formula-decision.md
```

## Data Classification

See `data-classification.md` for the two-axis classification system (sensitivity label + citable flag).

## Retention

Generated artifacts under `store/` and `outputs/` are kept for project duration (configurable) and
git-ignored to prevent committing extracted content. Generated DOCX inputs remain git-ignored too;
only the two frozen public/synthetic fixtures named in Quick Start are tracked. The ingest source
under `ingest/`, the store schema, and store documentation remain tracked. See P0.5 tracked risk.
