# QbD P.2 Cowork MVP Kit

Claude Cowork-runnable kit that ingests bisoprolol trial data, selects the best formulation via decision matrix, and drafts CTD P.2.2/P.2.3 in Vietnamese.

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

```bash
# Run these commands inside WSL2.

# 1. Build .docx inputs from markdown source
npm run inputs:build

# 2. Run ingest (extract → store)
npm run ingest

# 3. Run render (draft → .docx)
npm run render
```

## Folder Structure

```
cowork-p2-kit/
├── SKILL.md                  # Cowork reasoning instructions
├── README.md                 # This file
├── inputs/
│   ├── src/                  # Authoring source (.md) — git-tracked
│   │   ├── product-profile.md
│   │   └── formulation-trial-*.md
│   ├── trials/               # Generated trial .docx — git-ignored
│   ├── reference/            # Reference docs .docx — git-ignored
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
├── template/
│   └── p2-template.md        # P.2 layout template (P0.2 caveat)
├── rubric/
│   └── scoring-90-100.md     # Scoring rubric (Phase 6)
└── outputs/                  # Final rendered output — git-ignored
    ├── p2-draft.docx
    ├── evidence-log.md
    └── formula-decision.md
```

## Data Classification

See `data-classification.md` for the two-axis classification system (sensitivity label + citable flag).

## Retention

Generated artifacts under `store/` and `outputs/` are kept for project duration (configurable) and
git-ignored to prevent committing extracted content. The ingest source under `ingest/`, the store
schema, and store documentation remain tracked. See P0.5 tracked risk.
