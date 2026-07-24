# Step 4 Implementation Notes

Date: 2026-07-23
Status: superseded by post-implementation remediation
Gate: G-P3-05 unverified

> Review correction (2026-07-23): The remainder of this note describes the prior attempted
> implementation, not passing evidence. Its viewer artifact predates the repaired deterministic
> output and its cited suite UUID is stale. Do not use it to close Step 4 or start Step 5; the
> current execution state is owned by `step-04-determinism-viewer-evidence.md` and `gates.yaml`.

## Determinism Problem

`docx@9.7.1` generates non-deterministic output:
- Random relationship IDs (`rId` + random chars) in `.rels` files
- Timestamps in `docProps/core.xml` (`dcterms:created`, `dcterms:modified`)

## Solution

### 1. `determinize-ooxml.mjs` (post-processor)

- Parses DOCX as ZIP via `jszip` (bundled with `docx`)
- Builds deterministic ID mapping: `SHA256(type + target)[:16]` → `rId{hash}`
- Replaces IDs in all `.rels` files
- Replaces `r:id=`, `r:embed=`, `r:link=` references in all `.xml` files
- Normalizes `docProps/core.xml` timestamps to fixed `2000-01-01T00:00:00.000Z`

### 2. `normalize-ooxml.mjs` (verifier)

- Lists entries via `unzip -Z1`
- Reads each entry via `unzip -p` (escaped glob for `[Content_Types].xml`)
- Hashes uncompressed bytes → sorted path-to-SHA256 manifest
- Rejects: empty/absolute/traversal/duplicate entry paths

### 3. Integration

- `document-builder.mjs`: `buildDocumentBuffer()` calls `determinizeDocx(rawBuffer)` after `Packer.toBuffer()`
- `determinism.test.mjs`: imports `viewer-checklist.test.mjs` so G-P3-05 validates both automated and manual evidence

## Viewer Checklist

Manual procedure completed:
- Viewer: LibreOffice 26.2.4.2 620(Build:2)
- Host: Windows host + WSL2 Ubuntu
- Verified: 2 positive footnotes, USP hyperlink, local provenance, Mục lục TOC, 4-column table

## Gate Evidence

All five gates share suite_run_id `e4f982d8-da64-433c-9de8-9b4365d04b38`.
Post-G-P3-05 validation in `verify-render.mjs` confirms all evidence records pass schema + UUID check.
