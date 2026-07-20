# Render Fidelity Spike Report — 2026-07-16

## Environment

- Library: `docx` v9.7.1 (pure-JS OOXML writer, MIT)
- Node: v22.22.2
- Platform: linux x64

## Spike Results

| Element | Status | Evidence |
|---------|--------|----------|
| Footnotes | ✅ PASS | footnotes.xml: 2 unique positive IDs [1,2] |
| Clickable hyperlinks | ✅ PASS | 1 hyperlink relationships (expected 1) |
| Offline render | ✅ PASS | PASS: bwrap --unshare-net render succeeded, no network access |
| Table of Contents | ✅ PASS | OOXML contains TOC |
| Tables | ✅ PASS | OOXML contains w:tbl |

## Must-Pass Gate

| Criterion | Status |
|-----------|--------|
| Footnotes with unique positive IDs | ✅ PASS |
| Clickable hyperlinks for URL-bearing citations | ✅ PASS |
| Fully offline render | ✅ PASS |

**Must-pass verdict:** ✅ PASS

## Gate Decision

Lock `.docx`-via-`docx`-npm as primary renderer. No .NET provisioning needed.

## Citation Contract

- Footnote IDs start at **1** (not 0 — 0 conflicts with DOCX continuation separator)
- URL-bearing citations render as `ExternalHyperlink` inside the footnote
- Local-only citations render as **plain provenance text** (no `file://` link)
- `file://` and absolute-path link targets are **rejected**

## OOXML Evidence

- Footnotes: footnotes.xml: 2 unique positive IDs [1,2]
- Hyperlinks: 1 hyperlink relationships (expected 1)

## Output

- File: `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/outputs/spike-test.docx`
- Size: 9641 bytes
- SHA-256 (first 16): 99d5ea4dcd8f02da

## Viewer Verification

Open `/media/E/VIBECODING/MODULE3-agent/cowork-p2-kit/outputs/spike-test.docx` in LibreOffice or Word to visually confirm:
- [ ] Footnotes appear at bottom of page with correct content
- [ ] URL-bearing footnote has clickable hyperlink
- [ ] Local-only footnote shows plain text (no broken link)
- [ ] TOC field renders (may need "Update Fields" in Word)
- [ ] Table renders with correct structure
